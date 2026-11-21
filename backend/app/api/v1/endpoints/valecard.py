import logging
import uuid
from datetime import date, timedelta
from typing import Callable, List, Optional, TypeVar
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.database import get_db, sanitize_db_error
from backend.app.core.valecard.client_base import (
    ValeCardAPIError,
    ValeCardBaseException,
    ValeCardConnectionError,
    ValeCardTimeoutError,
)
from backend.app.models.valecard import ValeCardTransacao
from backend.app.schemas.valecard import (
    ValeCardTransacaoResponse,
    FrotaAlertaCombustivelResponse,
    SincronizacaoRequest,
    SincronizacaoResponse,
    ValeCardKPIsResponse,
    ResolverAlertaRequest,
    ValeCardCartaoResponse,
    SincronizacaoCartoesRequest,
    SincronizacaoCartoesResponse,
    Solicitar2ViaCartaoRequest,
    Solicitar2ViaCartaoResponse,
    ValeCardSolicitacaoCartaoResponse,
    AlterarLimiteRequest,
    AlterarLimiteResponse,
    ValeCardAlteracaoLimiteResponse,
    ValeCardMotoristaResponse,
    SincronizacaoMotoristasRequest,
    SincronizacaoMotoristasResponse,
    CadastrarMotoristaRequest,
    CadastrarMotoristaResponse,
    AtualizarMotoristaRequest,
    AtualizarMotoristaResponse,
    ValeCardVeiculoResponse,
    CadastrarVeiculoValeCardRequest,
    CadastrarVeiculoValeCardResponse,
    AtualizarVeiculoValeCardRequest,
    AtualizarVeiculoValeCardResponse,
    BloqueioAbastecimentoRequest,
    BloqueioAbastecimentoResponse,
    VincularMotoristaRequest,
    ValeCardVinculoResponse,
    ProcessarVinculosResponse,
    CadastrarResponsavelRequest,
    CadastrarResponsavelResponse,
    ValeCardResponsavelResponse,
    SincronizacaoFaturamentoRequest,
    ValeCardFaturamentoResponse,
    ConciliacaoFaturamentoResponse,
    SincronizacaoEstornosRequest,
    ValeCardEstornoResponse,
    SincronizacaoEstornosResponse
)
from backend.app.services.valecard.transacoes_service import ValeCardTransacoesService
from backend.app.services.valecard.cartoes_service import ValeCardCartoesService
from backend.app.services.valecard.limites_service import ValeCardLimitesService
from backend.app.services.valecard.motoristas_service import ValeCardMotoristasService
from backend.app.services.valecard.veiculos_service import ValeCardVeiculosService
from backend.app.services.valecard.vinculos_service import ValeCardVinculosService
from backend.app.services.valecard.faturamento_service import ValeCardFaturamentoService

logger = logging.getLogger("valecard.api")
router = APIRouter()

T = TypeVar("T")


def _executar_leitura_supabase(response: Response, operacao: Callable[[], T], contexto: str) -> T:
    """Executa leitura exclusivamente no Supabase; falha explicitamente (HTTP 503) se o banco estiver indisponível."""
    try:
        resultado = operacao()
        response.headers["X-Data-Source"] = "supabase"
        return resultado
    except SQLAlchemyError as exc:
        raise _erro_operacao_valecard(exc, contexto) from exc


def _erro_operacao_valecard(exc: Exception, contexto: str, not_found_on_value_error: bool = False) -> HTTPException:
    """Converte falhas de validação, banco Supabase e KissAPI em respostas HTTP semânticas."""
    if isinstance(exc, ValueError):
        code = status.HTTP_404_NOT_FOUND if not_found_on_value_error else status.HTTP_400_BAD_REQUEST
        return HTTPException(status_code=code, detail=str(exc))
    if isinstance(exc, ValeCardTimeoutError):
        return HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(exc))
    if isinstance(exc, ValeCardConnectionError):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    if isinstance(exc, ValeCardAPIError):
        return HTTPException(status_code=exc.status_code or status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    if isinstance(exc, ValeCardBaseException):
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    if isinstance(exc, SQLAlchemyError):
        msg = sanitize_db_error(exc)
        logger.error("[ValeCard] Falha de banco ao %s: %s", contexto, msg)
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Banco PostgreSQL (Supabase) indisponível ao {contexto}: {msg}",
        )
    logger.exception("[ValeCard] Erro inesperado ao %s", contexto)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Erro interno ao {contexto}: {sanitize_db_error(exc)}",
    )


@router.get(
    "/status-conexao",
    summary="Diagnóstico da conexão PostgreSQL (Supabase) e configuração KissAPI ValeCard",
)
def obter_status_conexao(db: Session = Depends(get_db)):
    """Verifica conectividade com o Supabase e presença do token ValeCard sem expor segredos."""
    banco_conectado = True
    banco_erro: Optional[str] = None
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        banco_conectado = False
        banco_erro = sanitize_db_error(exc)

    return {
        "banco_conectado": banco_conectado,
        "banco_host": settings.POSTGRES_HOST,
        "banco_erro": banco_erro,
        "kissapi_configurada": bool(settings.VALECARD_API_TOKEN),
        "contrato_cliente": settings.VALECARD_CONTRATO_CLIENTE,
    }


@router.get(
    "/transacoes",
    response_model=List[ValeCardTransacaoResponse],
    summary="Listar transações de abastecimento ValeCard",
    description="Retorna transações com paginação e filtros opcionais por placa, condutor, período e auditoria."
)
def listar_transacoes(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    cpf_motorista: Optional[str] = Query(None, description="Filtro por CPF"),
    status_auditoria: Optional[str] = Query(None, description="APROVADO, ALERTA_FRAUDE, PENDENTE_CONCILIACAO, ESTORNADO"),
    data_inicio: Optional[date] = Query(None, description="Data inicial YYYY-MM-DD"),
    data_fim: Optional[date] = Query(None, description="Data final YYYY-MM-DD")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardTransacoesService.get_transacoes(
            db=db,
            skip=skip,
            limit=limit,
            placa=placa,
            cpf_motorista=cpf_motorista,
            status_auditoria=status_auditoria,
            data_inicio=data_inicio,
            data_fim=data_fim,
        )[0],
        contexto="listar_transacoes",
    )


@router.get(
    "/transacoes/kpis/resumo",
    response_model=ValeCardKPIsResponse,
    summary="KPIs consolidados de abastecimento e telemetria",
    description="Retorna total gasto, litragem total, preço médio/litro, Km/L médio e total de alertas pendentes."
)
def obter_kpis(
    response: Response,
    db: Session = Depends(get_db),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None)
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardTransacoesService.get_kpis(db=db, data_inicio=data_inicio, data_fim=data_fim),
        contexto="obter_kpis",
    )


@router.get(
    "/transacoes/{id_transacao}",
    response_model=ValeCardTransacaoResponse,
    summary="Obter detalhes de uma transação específica",
    description="Retorna dados imutáveis do abastecimento e snapshot contábil."
)
def obter_transacao(
    response: Response,
    id_transacao: uuid.UUID,
    db: Session = Depends(get_db)
):
    try:
        transacao = db.query(ValeCardTransacao).filter(ValeCardTransacao.id_transacao == id_transacao).first()
        response.headers["X-Data-Source"] = "supabase"
    except SQLAlchemyError as exc:
        raise _erro_operacao_valecard(exc, "consultar transação") from exc
    if not transacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada.")
    return transacao


@router.post(
    "/transacoes/sync",
    response_model=SincronizacaoResponse,
    summary="Sincronizar transações sob demanda com a ValeCard",
    description="Dispara ingestão de transações em janelas de até 30 dias com idempotência e auditoria anti-fraude."
)
async def sincronizar_transacoes(
    payload: Optional[SincronizacaoRequest] = None,
    db: Session = Depends(get_db)
):
    hoje = date.today()
    data_ini = hoje - timedelta(days=30)
    data_fim = hoje
    tipo_transacao = "TODAS"
    placa = None

    if payload:
        if payload.data_inicial:
            try:
                data_ini = date.fromisoformat(payload.data_inicial)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato de data_inicial inválido. Utilize YYYY-MM-DD."
                )
        if payload.data_final:
            try:
                data_fim = date.fromisoformat(payload.data_final)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato de data_final inválido. Utilize YYYY-MM-DD."
                )
        if payload.tipo_transacao:
            tipo_transacao = payload.tipo_transacao
        placa = payload.placa

    try:
        resultado = await ValeCardTransacoesService.sync_transacoes(
            db=db,
            data_inicio=data_ini,
            data_fim=data_fim,
            tipo_transacao=tipo_transacao,
            placa=placa
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "sincronizar transações ValeCard")


@router.get(
    "/alertas",
    response_model=List[FrotaAlertaCombustivelResponse],
    summary="Listar alertas e anomalias de combustível",
    description="Fila de auditoria para o gestor com filtros por status de resolução."
)
def listar_alertas(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_resolucao: Optional[str] = Query(None, description="PENDENTE, JUSTIFICADO, CONFIRMADO_FRAUDE, ARQUIVADO")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardTransacoesService.get_alertas(
            db=db,
            skip=skip,
            limit=limit,
            status_resolucao=status_resolucao,
        )[0],
        contexto="listar_alertas",
    )


@router.post(
    "/alertas/{id_alerta}/resolver",
    response_model=FrotaAlertaCombustivelResponse,
    summary="Resolver alerta de combustível com justificativa",
    description="Permite ao gestor justificar ou confirmar fraude em uma anomalia de abastecimento."
)
def resolver_alerta(
    id_alerta: uuid.UUID,
    payload: ResolverAlertaRequest,
    db: Session = Depends(get_db)
):
    if payload.status_resolucao not in ("JUSTIFICADO", "CONFIRMADO_FRAUDE", "ARQUIVADO"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status de resolução inválido. Deve ser 'JUSTIFICADO', 'CONFIRMADO_FRAUDE' ou 'ARQUIVADO'."
        )

    try:
        alerta_resolvido = ValeCardTransacoesService.resolver_alerta(
            db=db,
            id_alerta=id_alerta,
            dados=payload
        )
        return alerta_resolvido
    except Exception as e:
        raise _erro_operacao_valecard(e, "resolver alerta de combustível", not_found_on_value_error=True)


# --- Endpoints de Cartões da Frota & 2ª Via ---

@router.get(
    "/cartoes",
    response_model=List[ValeCardCartaoResponse],
    summary="Listar cartões de combustível da frota",
    description="Retorna cartões cadastrados com saldo, limite e filtros por placa, número e status."
)
def listar_cartoes(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    status_cartao: Optional[str] = Query(None, description="ATIVO, BLOQUEADO, CANCELADO, INATIVO"),
    numero_cartao: Optional[str] = Query(None, description="Filtro parcial por número do cartão")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardCartoesService.get_cartoes(
            db=db,
            skip=skip,
            limit=limit,
            placa=placa,
            status_cartao=status_cartao,
            numero_cartao=numero_cartao,
        )[0],
        contexto="listar_cartoes",
    )


@router.post(
    "/cartoes/sync",
    response_model=SincronizacaoCartoesResponse,
    summary="Sincronizar base de cartões da frota com ValeCard",
    description="Executa chamada ao webservice buscarBasedeCartoes e sincroniza limites, saldos e vínculos com veículos."
)
async def sincronizar_cartoes(
    payload: Optional[SincronizacaoCartoesRequest] = None,
    db: Session = Depends(get_db)
):
    try:
        numero_cartao = payload.numero_cartao if payload else None
        placa = payload.placa if payload else None
        resultado = await ValeCardCartoesService.sync_cartoes(
            db=db,
            numero_cartao=numero_cartao,
            placa=placa
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "sincronizar cartões ValeCard")


@router.post(
    "/cartoes/solicitar-2via",
    response_model=Solicitar2ViaCartaoResponse,
    summary="Solicitar 2ª via de cartão de combustível",
    description="Dispara solicitação ao webservice solicitar2ViaCartao da ValeCard e registra trilha de auditoria."
)
async def solicitar_2via_cartao(
    payload: Solicitar2ViaCartaoRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardCartoesService.solicitar_2via(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "solicitar 2ª via de cartão ValeCard")


@router.get(
    "/cartoes/solicitacoes",
    response_model=List[ValeCardSolicitacaoCartaoResponse],
    summary="Listar histórico de solicitações de 2ª via",
    description="Retorna auditoria das solicitações de 2ª via com motivo, status e solicitante."
)
def listar_solicitacoes_2via(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardCartoesService.get_solicitacoes(
            db=db,
            skip=skip,
            limit=limit,
            placa=placa,
        )[0],
        contexto="listar_solicitacoes_2via",
    )


# --- Endpoints de Gestão de Limites e Saldo do Veículo ---

@router.post(
    "/limites/alterar",
    response_model=AlterarLimiteResponse,
    summary="Alterar, aumentar ou diminuir limite de combustível",
    description="Executa ajuste no webservice alterarLimiteveiculo da ValeCard e registra trilha de auditoria contábil."
)
async def alterar_limite_veiculo(
    payload: AlterarLimiteRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardLimitesService.alterar_limite(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "alterar limite na ValeCard")


@router.get(
    "/limites/historico",
    response_model=List[ValeCardAlteracaoLimiteResponse],
    summary="Histórico auditado de alterações de limite",
    description="Retorna log cronológico de todas as alterações de limites realizadas com valores, motivos e solicitantes."
)
def listar_historico_limites(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    tipo_operacao: Optional[str] = Query(None, description="AUMENTAR, DIMINUIR, ALTERAR")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardLimitesService.get_alteracoes(
            db=db,
            skip=skip,
            limit=limit,
            placa=placa,
            tipo_operacao=tipo_operacao,
        )[0],
        contexto="listar_historico_limites",
    )


# --- Endpoints de Condutores e Motoristas ValeCard ---

@router.get(
    "/motoristas",
    response_model=List[ValeCardMotoristaResponse],
    summary="Listar motoristas/condutores espelhados da ValeCard",
    description="Retorna condutores cadastrados com filtros por CPF, matrícula, status e vínculo com técnico."
)
def listar_motoristas(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    cpf: Optional[str] = Query(None, description="Filtro por CPF (parcial ou completo)"),
    matricula: Optional[str] = Query(None, description="Filtro por matrícula"),
    status_motorista: Optional[str] = Query(None, description="ATIVO, BLOQUEADO, INATIVO, CANCELADO"),
    somente_com_tecnico: bool = Query(False, description="Filtrar apenas motoristas vinculados a um técnico do SGFrotas")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardMotoristasService.get_motoristas(
            db=db,
            skip=skip,
            limit=limit,
            cpf=cpf,
            matricula=matricula,
            status_motorista=status_motorista,
            somente_com_tecnico=somente_com_tecnico,
        )[0],
        contexto="listar_motoristas",
    )


@router.post(
    "/motoristas/sync",
    response_model=SincronizacaoMotoristasResponse,
    summary="Sincronizar base de condutores com a ValeCard",
    description="Consome a API buscarMotoristas da ValeCard, atualiza a base espelho e vincula automaticamente aos técnicos do SGFrotas."
)
async def sincronizar_motoristas(
    payload: Optional[SincronizacaoMotoristasRequest] = None,
    db: Session = Depends(get_db)
):
    try:
        cpf = payload.cpf if payload else None
        matricula = payload.matricula if payload else None
        nome_completo = payload.nome_completo if payload else None
        resultado = await ValeCardMotoristasService.sync_motoristas(
            db=db,
            cpf=cpf,
            matricula=matricula,
            nome_completo=nome_completo
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "sincronizar condutores ValeCard")


@router.post(
    "/motoristas/cadastrar",
    response_model=CadastrarMotoristaResponse,
    summary="Cadastrar novo motorista na ValeCard",
    description="Executa chamada ao webservice cadastrarMotorista e cadastra o espelho local vinculado ao técnico."
)
async def cadastrar_motorista(
    payload: CadastrarMotoristaRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardMotoristasService.cadastrar_motorista(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "cadastrar motorista na ValeCard")


@router.post(
    "/motoristas/atualizar",
    response_model=AtualizarMotoristaResponse,
    summary="Atualizar dados de condutor na ValeCard",
    description="Executa chamada ao webservice atualizarMotoristas para alterar status, CNH ou dados de contato do condutor."
)
async def atualizar_motorista(
    payload: AtualizarMotoristaRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardMotoristasService.atualizar_motorista(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "atualizar motorista na ValeCard")


# --- Endpoints de Frota de Veículos & Bloqueio Preventivo de Bomba ---

@router.get(
    "/veiculos",
    response_model=List[ValeCardVeiculoResponse],
    summary="Listar veículos espelhados na ValeCard",
    description="Retorna frota cadastrada na ValeCard com filtros por placa, status e sinalizador de bloqueio na bomba."
)
def listar_veiculos(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    status_valecard: Optional[str] = Query(None, description="ATIVO, INATIVO, FORA_DE_USO, EMPRESTADO"),
    somente_bloqueados: bool = Query(False, description="Filtrar apenas veículos com abastecimento bloqueado na bomba")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardVeiculosService.get_veiculos(
            db=db,
            skip=skip,
            limit=limit,
            placa=placa,
            status_valecard=status_valecard,
            somente_bloqueados=somente_bloqueados,
        )[0],
        contexto="listar_veiculos",
    )


@router.post(
    "/veiculos/cadastrar",
    response_model=CadastrarVeiculoValeCardResponse,
    summary="Cadastrar veículo da frota na ValeCard",
    description="Executa chamada ao webservice cadastrarVeiculoFrota e sincroniza espelho local."
)
async def cadastrar_veiculo(
    payload: CadastrarVeiculoValeCardRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardVeiculosService.cadastrar_veiculo(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "cadastrar veículo na ValeCard")


@router.post(
    "/veiculos/atualizar",
    response_model=AtualizarVeiculoValeCardResponse,
    summary="Atualizar veículo na ValeCard",
    description="Executa chamada ao webservice atualizarVeiculoFrota para alterar status, hodômetro ou dados cadastrais."
)
async def atualizar_veiculo(
    payload: AtualizarVeiculoValeCardRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardVeiculosService.atualizar_veiculo(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "atualizar veículo na ValeCard")


@router.post(
    "/veiculos/bloqueio-bomba",
    response_model=BloqueioAbastecimentoResponse,
    summary="Bloquear ou desbloquear abastecimento do veículo na bomba",
    description="Bloqueio preventivo na bomba ValeCard (código 10 - Fora de Uso) para carros em manutenção ou sinistrados."
)
async def gerenciar_bloqueio_bomba(
    payload: BloqueioAbastecimentoRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardVeiculosService.gerenciar_bloqueio_bomba(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "gerenciar bloqueio de bomba na ValeCard")


# --- Endpoints de Vínculos Veículo x Motorista e Responsáveis ---

@router.post(
    "/vinculos",
    response_model=ProcessarVinculosResponse,
    summary="Vincular ou desvincular motoristas a veículos",
    description="Dispara operações de vínculo ('V') ou desvínculo ('D') ao webservice da ValeCard e registra auditoria."
)
async def processar_vinculos_motorista(
    payload: VincularMotoristaRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardVinculosService.processar_vinculos(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "processar vínculos na ValeCard")


@router.get(
    "/vinculos",
    response_model=List[ValeCardVinculoResponse],
    summary="Listar histórico de vínculos veículo x motorista",
    description="Retorna histórico de vínculos e desvínculos com filtros por placa, matrícula e status."
)
def listar_vinculos(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    matricula: Optional[str] = Query(None, description="Filtro por matrícula"),
    status_vinculo: Optional[str] = Query(None, description="ATIVO, DESVINCULADO, FALHA")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardVinculosService.listar_vinculos(
            db=db,
            placa=placa,
            matricula=matricula,
            status=status_vinculo,
            skip=skip,
            limit=limit,
        ),
        contexto="listar_vinculos",
    )


@router.post(
    "/responsaveis",
    response_model=CadastrarResponsavelResponse,
    summary="Cadastrar responsável de frota no SIAG ValeCard",
    description="Cadastra gestores e responsáveis no webservice cadastrarResponsavel da ValeCard."
)
async def cadastrar_responsavel(
    payload: CadastrarResponsavelRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardVinculosService.cadastrar_responsavel(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "cadastrar responsável na ValeCard")


@router.get(
    "/responsaveis",
    response_model=List[ValeCardResponsavelResponse],
    summary="Listar responsáveis de frota cadastrados",
    description="Retorna gestores e responsáveis cadastrados com filtros por CPF, matrícula ou termo de busca."
)
def listar_responsaveis(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    cpf: Optional[str] = Query(None, description="Filtro por CPF"),
    matricula: Optional[str] = Query(None, description="Filtro por matrícula"),
    termo: Optional[str] = Query(None, description="Busca textual por nome, cidade ou e-mail")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardVinculosService.listar_responsaveis(
            db=db,
            cpf=cpf,
            matricula=matricula,
            termo=termo,
            skip=skip,
            limit=limit,
        ),
        contexto="listar_responsaveis",
    )


# --- Endpoints de Faturamento, Fechamento Contábil e Estornos ---

@router.post(
    "/faturamento/conciliar",
    response_model=ConciliacaoFaturamentoResponse,
    summary="Conciliar faturamento e fechamento fiscal ValeCard",
    description="Consome o webservice buscarDadosFaturamento da ValeCard, calcula divergências com a NF e persiste o fechamento contábil."
)
async def conciliar_faturamento(
    payload: SincronizacaoFaturamentoRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardFaturamentoService.conciliar_faturamento(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "conciliar faturamento na ValeCard")


@router.get(
    "/faturamento",
    response_model=List[ValeCardFaturamentoResponse],
    summary="Listar fechamentos fiscais e faturamentos auditados",
    description="Retorna notas fiscais faturadas com total de transações, divergência contábil e status de conciliação."
)
def listar_faturamentos(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    numero_titulo: Optional[str] = Query(None, description="Filtro por número do título/NF"),
    status_faturamento: Optional[str] = Query(None, description="FECHADO, DIVERGENTE, PROCESSADO"),
    data_inicio: Optional[date] = Query(None, description="Data mínima de início"),
    data_fim: Optional[date] = Query(None, description="Data máxima de término")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardFaturamentoService.listar_faturamentos(
            db=db,
            numero_titulo=numero_titulo,
            status=status_faturamento,
            data_inicio=data_inicio,
            data_fim=data_fim,
            skip=skip,
            limit=limit,
        ),
        contexto="listar_faturamentos",
    )


@router.post(
    "/estornos/sync",
    response_model=SincronizacaoEstornosResponse,
    summary="Sincronizar transações de combustível estornadas",
    description="Consome o webservice buscarEstorno da ValeCard (máximo de 91 dias) e vincula às transações da base central."
)
async def sincronizar_estornos(
    payload: SincronizacaoEstornosRequest,
    db: Session = Depends(get_db)
):
    try:
        resultado = await ValeCardFaturamentoService.sincronizar_estornos(
            db=db,
            dados=payload
        )
        return resultado
    except Exception as e:
        raise _erro_operacao_valecard(e, "sincronizar estornos na ValeCard")


@router.get(
    "/estornos",
    response_model=List[ValeCardEstornoResponse],
    summary="Listar histórico auditado de estornos",
    description="Retorna transações canceladas/estornadas com filtros por placa e NSU."
)
def listar_estornos(
    response: Response,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    placa: Optional[str] = Query(None, description="Filtro por placa"),
    nsu: Optional[str] = Query(None, description="Filtro por NSU da transação original")
):
    return _executar_leitura_supabase(
        response=response,
        operacao=lambda: ValeCardFaturamentoService.listar_estornos(
            db=db,
            placa=placa,
            nsu=nsu,
            skip=skip,
            limit=limit,
        ),
        contexto="listar_estornos",
    )

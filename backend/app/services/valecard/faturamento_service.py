import logging
import re
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import (
    ValeCardFaturamento,
    ValeCardFaturamentoItem,
    ValeCardEstorno,
    ValeCardTransacao
)
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.valecard import (
    SincronizacaoFaturamentoRequest,
    ConciliacaoFaturamentoResponse,
    SincronizacaoEstornosRequest,
    SincronizacaoEstornosResponse
)

logger = logging.getLogger("valecard.faturamento")


class ValeCardFaturamentoService:
    """
    Serviço para Fechamento Contábil, Faturamento e Estornos da ValeCard
    (PDFs: 09 - buscardadosfaturamento e 10 - buscarEstorno).
    """

    ENDPOINT_FATURAMENTO = "buscarDadosFaturamento"
    ENDPOINT_ESTORNO = "buscarEstorno"

    @staticmethod
    def _normalize_placa(placa: Any) -> str:
        if not placa:
            return ""
        return re.sub(r"[^A-Za-z0-9]", "", str(placa)).upper()

    @staticmethod
    def _parse_decimal(val: Any, default: Decimal = Decimal("0.00")) -> Decimal:
        if val is None or str(val).strip() == "":
            return default
        try:
            s = str(val).strip().replace("R$", "").replace(" ", "").replace(",", ".")
            return Decimal(s)
        except Exception:
            return default

    @staticmethod
    def _parse_datetime(val: Any) -> datetime:
        if isinstance(val, datetime):
            return val
        if isinstance(val, date):
            return datetime.combine(val, datetime.min.time(), tzinfo=timezone.utc)
        if not val:
            return datetime.now(timezone.utc)
        val_str = str(val).strip()
        for fmt in [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y-%m-%d"
        ]:
            try:
                dt = datetime.strptime(val_str, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return datetime.now(timezone.utc)

    @classmethod
    async def conciliar_faturamento(
        cls,
        db: Session,
        dados: SincronizacaoFaturamentoRequest
    ) -> ConciliacaoFaturamentoResponse:
        """
        Consome os dados de faturamento (PDF 09), realiza o fechamento contábil,
        calcula divergências em relação à Nota Fiscal e persiste o faturamento detalhado.
        """
        if dados.data_inicio > dados.data_fim:
            raise ValueError("A data de início não pode ser maior que a data de término.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        payload = {
            "contratoCliente": contrato,
            "dataInicio": dados.data_inicio.isoformat(),
            "dataFim": dados.data_fim.isoformat(),
            "numeroTitulo": dados.numero_titulo
        }

        client = ValeCardBaseClient()
        logger.info(f"[ValeCard Faturamento] Consultando período {dados.data_inicio} a {dados.data_fim}...")
        res_data = await client.post(cls.ENDPOINT_FATURAMENTO, payload=payload)

        # Tratar caso de retorno vazio (PDF 09: HTTP 200 vazio quando não há dados)
        itens_raw: List[Dict[str, Any]] = []
        if isinstance(res_data, list):
            itens_raw = res_data
        elif isinstance(res_data, dict):
            if "itens" in res_data and isinstance(res_data["itens"], list):
                itens_raw = res_data["itens"]
            elif "transacoes" in res_data and isinstance(res_data["transacoes"], list):
                itens_raw = res_data["transacoes"]
            elif "faturamento" in res_data and isinstance(res_data["faturamento"], list):
                itens_raw = res_data["faturamento"]
            elif any(k in res_data for k in ["VALOR TOTAL", "valorTotal", "PLACA"]):
                itens_raw = [res_data]

        if not itens_raw:
            return ConciliacaoFaturamentoResponse(
                sucesso=True,
                numero_titulo=dados.numero_titulo or "S/N",
                total_itens_processados=0,
                valor_liquido=Decimal("0.00"),
                valor_total_transacoes=Decimal("0.00"),
                divergencia_contabil=Decimal("0.00"),
                status_faturamento="FECHADO",
                mensagem="Nenhuma nota fiscal ou transação faturada no período informado."
            )

        # Detectar número do título e valor líquido da NF
        num_titulo = dados.numero_titulo
        valor_liquido_nf = Decimal("0.00")

        primeiro_item = itens_raw[0]
        if not num_titulo:
            num_titulo = str(primeiro_item.get("NUMERO TITULO") or primeiro_item.get("numeroTitulo") or f"FAT-{dados.data_inicio.strftime('%Y%m%d')}")

        val_liq_raw = primeiro_item.get("VALOR LIQUIDO") or primeiro_item.get("valorLiquido")
        if val_liq_raw is not None:
            valor_liquido_nf = cls._parse_decimal(val_liq_raw)

        # Localizar ou criar Faturamento
        faturamento = db.query(ValeCardFaturamento).filter(
            ValeCardFaturamento.numero_titulo == num_titulo,
            ValeCardFaturamento.data_inicio == dados.data_inicio,
            ValeCardFaturamento.data_fim == dados.data_fim
        ).first()

        if not faturamento:
            faturamento = ValeCardFaturamento(
                numero_titulo=num_titulo,
                data_inicio=dados.data_inicio,
                data_fim=dados.data_fim,
                valor_liquido=valor_liquido_nf,
                valor_total_transacoes=Decimal("0.00"),
                divergencia_contabil=Decimal("0.00"),
                total_transacoes=0,
                status_faturamento="PROCESSANDO",
                payload_raw=res_data if isinstance(res_data, (dict, list)) else {"raw": str(res_data)}
            )
            db.add(faturamento)
            db.flush()
        else:
            # Limpar itens anteriores para re-processamento idempotente
            db.query(ValeCardFaturamentoItem).filter(
                ValeCardFaturamentoItem.id_faturamento == faturamento.id_faturamento
            ).delete()
            db.flush()

        soma_transacoes = Decimal("0.00")
        itens_adicionados = 0

        for r in itens_raw:
            placa_str = str(r.get("PLACA") or r.get("placa") or "").strip()
            placa_norm = cls._normalize_placa(placa_str)
            if not placa_norm:
                continue

            veiculo = db.query(Veiculo).filter(
                func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
            ).first()

            val_total = cls._parse_decimal(r.get("VALOR TOTAL") or r.get("valorTotal") or r.get("valor_total"))
            val_unit = cls._parse_decimal(r.get("VALOR UNITARIO") or r.get("valorUnitario") or r.get("valor_unitario"))
            qtd_litros = cls._parse_decimal(r.get("QUANTIDADE") or r.get("quantidade") or r.get("litros"))
            dt_trans = cls._parse_datetime(r.get("DATA") or r.get("data") or r.get("dataTransacao"))

            # Tentar associar à transação original por placa e data
            transacao = db.query(ValeCardTransacao).filter(
                ValeCardTransacao.placa == placa_str,
                ValeCardTransacao.valor_total == val_total
            ).first()

            item_obj = ValeCardFaturamentoItem(
                id_faturamento=faturamento.id_faturamento,
                id_transacao=transacao.id_transacao if transacao else None,
                id_veiculo=veiculo.id_veiculo if veiculo else None,
                placa=placa_str,
                numero_cartao=r.get("NUMERO CARTAO") or r.get("numeroCartao"),
                cpf_motorista=r.get("CPF MOTORISTA") or r.get("cpfMotorista"),
                nome_motorista=r.get("MOTORISTA") or r.get("motorista"),
                data_transacao=dt_trans,
                tipo_combustivel=r.get("PRODUTO") or r.get("produto"),
                quantidade_litros=qtd_litros,
                valor_unitario=val_unit,
                valor_total=val_total,
                hodometro=cls._parse_decimal(r.get("HODOMETRO") or r.get("hodometro")),
                distancia_km=cls._parse_decimal(r.get("DISTANCIA") or r.get("distancia")),
                consumo_kml=cls._parse_decimal(r.get("CONSUMO") or r.get("consumo")),
                reais_por_km=cls._parse_decimal(r.get("REAIS POR KM") or r.get("reaisPorKm")),
                posto_cnpj=r.get("CNPJ") or r.get("cnpj"),
                posto_nome_fantasia=r.get("NOME FANTASIA") or r.get("nomeFantasia"),
                posto_cidade=r.get("CIDADE") or r.get("cidade"),
                posto_uf=r.get("ESTADO") or r.get("estado"),
                payload_raw=r
            )
            db.add(item_obj)
            soma_transacoes += val_total
            itens_adicionados += 1

        if valor_liquido_nf == Decimal("0.00"):
            valor_liquido_nf = soma_transacoes

        divergencia = soma_transacoes - valor_liquido_nf
        status_fat = "DIVERGENTE" if abs(divergencia) > Decimal("0.05") else "FECHADO"

        faturamento.valor_liquido = valor_liquido_nf
        faturamento.valor_total_transacoes = soma_transacoes
        faturamento.divergencia_contabil = divergencia
        faturamento.total_transacoes = itens_adicionados
        faturamento.status_faturamento = status_fat
        faturamento.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(faturamento)

        return ConciliacaoFaturamentoResponse(
            sucesso=True,
            id_faturamento=faturamento.id_faturamento,
            numero_titulo=num_titulo,
            total_itens_processados=itens_adicionados,
            valor_liquido=valor_liquido_nf,
            valor_total_transacoes=soma_transacoes,
            divergencia_contabil=divergencia,
            status_faturamento=status_fat,
            mensagem=f"Fechamento contábil processado com {itens_adicionados} transações (Status: {status_fat})."
        )

    @classmethod
    def listar_faturamentos(
        cls,
        db: Session,
        numero_titulo: Optional[str] = None,
        status: Optional[str] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ValeCardFaturamento]:
        """
        Consulta faturamentos auditados com filtros e paginação.
        """
        query = db.query(ValeCardFaturamento)
        if numero_titulo:
            query = query.filter(ValeCardFaturamento.numero_titulo == numero_titulo.strip())
        if status:
            query = query.filter(ValeCardFaturamento.status_faturamento == status.upper().strip())
        if data_inicio:
            query = query.filter(ValeCardFaturamento.data_inicio >= data_inicio)
        if data_fim:
            query = query.filter(ValeCardFaturamento.data_fim <= data_fim)

        return query.order_by(desc(ValeCardFaturamento.created_at)).offset(skip).limit(limit).all()

    @classmethod
    async def sincronizar_estornos(
        cls,
        db: Session,
        dados: SincronizacaoEstornosRequest
    ) -> SincronizacaoEstornosResponse:
        """
        Consome transações estornadas da ValeCard (PDF 10) e vincula à base de transações.
        Respeita a restrição oficial da ValeCard de no máximo 91 dias por consulta.
        """
        if dados.data_inicial > dados.data_final:
            raise ValueError("A data inicial não pode ser superior à data final.")

        dias_intervalo = (dados.data_final - dados.data_inicial).days
        if dias_intervalo > 91:
            raise ValueError(f"O intervalo de consulta ({dias_intervalo} dias) excede o limite máximo permitido de 91 dias pela ValeCard.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        payload = {
            "contratoCliente": contrato,
            "dataInicial": dados.data_inicial.strftime("%d-%m-%Y"),
            "dataFinal": dados.data_final.strftime("%d-%m-%Y"),
            "placa": dados.placa,
            "filial": dados.filial,
            "centroCusto": dados.centro_custo,
            "estabelecimento": dados.estabelecimento
        }

        client = ValeCardBaseClient()
        logger.info(f"[ValeCard Estornos] Buscando estornos de {dados.data_inicial} a {dados.data_final}...")
        res_data = await client.post(cls.ENDPOINT_ESTORNO, payload=payload)

        itens_raw: List[Dict[str, Any]] = []
        if isinstance(res_data, list):
            itens_raw = res_data
        elif isinstance(res_data, dict):
            if "estornos" in res_data and isinstance(res_data["estornos"], list):
                itens_raw = res_data["estornos"]
            elif any(k in res_data for k in ["ID", "id", "NSU", "nsu"]):
                itens_raw = [res_data]

        total_encontrados = len(itens_raw)
        total_inseridos = 0
        total_vinculados = 0

        for r in itens_raw:
            nsu = str(r.get("ID") or r.get("id") or r.get("NSU") or r.get("nsu") or "").strip()
            if not nsu:
                continue

            dt_estorno = cls._parse_datetime(r.get("DATA ESTORNO") or r.get("dataEstorno"))
            dt_trans = cls._parse_datetime(r.get("DATA TRANSACAO") or r.get("dataTransacao"))
            placa_str = str(r.get("PLACA") or r.get("placa") or "").strip()
            placa_norm = cls._normalize_placa(placa_str)

            # Evitar duplicações
            estorno_existente = db.query(ValeCardEstorno).filter(
                ValeCardEstorno.nsu_transacao == nsu,
                ValeCardEstorno.data_estorno == dt_estorno
            ).first()

            if estorno_existente:
                continue

            # Vincular transação original
            transacao = db.query(ValeCardTransacao).filter(ValeCardTransacao.nsu_transacao == nsu).first()
            if transacao:
                total_vinculados += 1

            veiculo = None
            if placa_norm:
                veiculo = db.query(Veiculo).filter(
                    func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
                ).first()

            estorno_obj = ValeCardEstorno(
                nsu_transacao=nsu,
                id_transacao=transacao.id_transacao if transacao else None,
                id_veiculo=veiculo.id_veiculo if veiculo else None,
                placa=placa_str,
                data_estorno=dt_estorno,
                data_transacao=dt_trans,
                nome_motorista=r.get("MOTORISTA") or r.get("motorista"),
                produto=r.get("PRODUTO") or r.get("produto"),
                quantidade_litros=cls._parse_decimal(r.get("QUANTIDADE") or r.get("quantidade")),
                valor_unitario=cls._parse_decimal(r.get("VALOR UNITARIO") or r.get("valorUnitario")),
                valor_total=cls._parse_decimal(r.get("VALOR TOTAL") or r.get("valorTotal")),
                hodometro=cls._parse_decimal(r.get("HODOMETRO") or r.get("hodometro")),
                posto_nome_fantasia=r.get("NOME FANTASIA") or r.get("nomeFantasia"),
                posto_terminal=r.get("TERMINAL") or r.get("terminal"),
                status_estorno="PROCESSADO",
                payload_raw=r
            )
            db.add(estorno_obj)
            total_inseridos += 1

        db.commit()

        return SincronizacaoEstornosResponse(
            sucesso=True,
            total_estornos_encontrados=total_encontrados,
            total_estornos_inseridos=total_inseridos,
            total_transacoes_vinculadas=total_vinculados,
            mensagem=f"Sincronização de estornos concluída: {total_inseridos} inserido(s), {total_vinculados} vinculado(s) à base central."
        )

    @classmethod
    def listar_estornos(
        cls,
        db: Session,
        placa: Optional[str] = None,
        nsu: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ValeCardEstorno]:
        """
        Consulta histórico de transações estornadas com filtros e paginação.
        """
        query = db.query(ValeCardEstorno)
        if placa:
            p_norm = cls._normalize_placa(placa)
            query = query.filter(func.replace(func.upper(ValeCardEstorno.placa), "-", "") == p_norm)
        if nsu:
            query = query.filter(ValeCardEstorno.nsu_transacao == nsu.strip())

        return query.order_by(desc(ValeCardEstorno.data_estorno)).offset(skip).limit(limit).all()

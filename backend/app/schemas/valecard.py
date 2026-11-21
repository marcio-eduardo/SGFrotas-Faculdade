import uuid
from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


# --- Schemas de Transação ValeCard ---

class ValeCardTransacaoBase(BaseModel):
    nsu_transacao: str
    placa: str
    numero_cartao: Optional[str] = None
    cpf_motorista: Optional[str] = None
    nome_motorista: Optional[str] = None
    matricula_motorista: Optional[str] = None
    posto_cnpj: Optional[str] = None
    posto_nome_fantasia: Optional[str] = None
    posto_cidade: Optional[str] = None
    posto_uf: Optional[str] = None
    tipo_combustivel: Optional[str] = None
    quantidade_litros: Decimal
    valor_unitario: Decimal
    valor_total: Decimal
    hodometro: Optional[Decimal] = None
    distancia_percorrida: Optional[Decimal] = None
    consumo_medio_kml: Optional[Decimal] = None
    status_auditoria: str = "APROVADO"
    motivo_auditoria: Optional[str] = None
    origem_ingestao: str = "API_REST"
    data_hora_transacao: datetime


class ValeCardTransacaoCreate(ValeCardTransacaoBase):
    id_veiculo: Optional[uuid.UUID] = None
    id_tecnico: Optional[int] = None
    payload_raw: Optional[Dict[str, Any]] = None


class ValeCardTransacaoResponse(ValeCardTransacaoBase):
    model_config = ConfigDict(from_attributes=True)

    id_transacao: uuid.UUID
    id_veiculo: Optional[uuid.UUID] = None
    id_tecnico: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# --- Schemas de Alertas de Combustível ---

class FrotaAlertaCombustivelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_alerta: uuid.UUID
    id_transacao: uuid.UUID
    id_veiculo: Optional[uuid.UUID] = None
    id_tecnico: Optional[int] = None
    tipo_anomalia: str
    detalhes: str
    status_resolucao: str
    justificativa_gestor: Optional[str] = None
    resolvido_por: Optional[int] = None
    data_resolucao: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ResolverAlertaRequest(BaseModel):
    status_resolucao: str = Field(..., description="'JUSTIFICADO', 'CONFIRMADO_FRAUDE' ou 'ARQUIVADO'")
    justificativa_gestor: str = Field(..., min_length=5, description="Justificativa formal do gestor de frotas")
    resolvido_por: Optional[int] = Field(None, description="ID do técnico/gestor que está resolvendo")


# --- Schemas de Sincronização e KPIs ---

class SincronizacaoRequest(BaseModel):
    data_inicial: Optional[str] = Field(None, description="Data inicial no formato YYYY-MM-DD (padrão: 30 dias atrás)")
    data_final: Optional[str] = Field(None, description="Data final no formato YYYY-MM-DD (padrão: hoje)")
    tipo_transacao: str = Field("TODAS", description="TODAS, ESTABELECIMENTO, BOMBA ou AJUSTE")
    placa: Optional[str] = Field(None, description="Filtro opcional por placa")


class SincronizacaoResponse(BaseModel):
    total_recebidas: int
    total_inseridas: int
    total_atualizadas: int
    total_alertas_gerados: int
    periodo_consultado: str
    mensagem: str


class ValeCardKPIsResponse(BaseModel):
    total_gasto: Decimal
    total_litros: Decimal
    preco_medio_litro: Decimal
    consumo_medio_frota_kml: Optional[Decimal] = None
    total_transacoes: int
    total_alertas_pendentes: int


# --- Schemas de Cartões da Frota & 2ª Via ---

class ValeCardCartaoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_cartao: uuid.UUID
    numero_cartao: str
    id_cartao_valecard: Optional[int] = None
    id_veiculo: Optional[uuid.UUID] = None
    placa: str
    status_cartao: str
    tipo_cartao: str
    limite_atual: Decimal
    saldo_disponivel: Decimal
    novo_limite: Optional[Decimal] = None
    centro_custo_codigo: Optional[str] = None
    centro_custo_descricao: Optional[str] = None
    centro_resultado_codigo: Optional[str] = None
    centro_resultado_descricao: Optional[str] = None
    filial_descricao: Optional[str] = None
    modelo_veiculo_valecard: Optional[str] = None
    status_veiculo_valecard: Optional[str] = None
    data_geracao_valecard: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SincronizacaoCartoesRequest(BaseModel):
    numero_cartao: Optional[str] = Field(None, description="Número do cartão opcional para consulta específica")
    placa: Optional[str] = Field(None, description="Placa do veículo opcional para consulta específica")


class SincronizacaoCartoesResponse(BaseModel):
    total_processados: int
    total_inseridos: int
    total_atualizados: int
    mensagem: str


class Solicitar2ViaCartaoRequest(BaseModel):
    placa: Optional[str] = Field(None, description="Placa do veículo vinculado")
    numero_cartao: Optional[str] = Field(None, description="Número do cartão a ser substituído")
    motivo: str = Field(..., min_length=5, description="Motivo da solicitação (ex: perda, dano físico, extravio)")
    solicitado_por: Optional[int] = Field(None, description="ID do técnico solicitante")


class Solicitar2ViaCartaoResponse(BaseModel):
    sucesso: bool
    mensagem: str
    id_solicitacao: Optional[uuid.UUID] = None
    placa: str
    numero_cartao_anterior: Optional[str] = None


class ValeCardSolicitacaoCartaoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_solicitacao: uuid.UUID
    id_cartao: Optional[uuid.UUID] = None
    id_veiculo: Optional[uuid.UUID] = None
    placa: str
    numero_cartao_anterior: Optional[str] = None
    motivo: str
    solicitado_por: Optional[int] = None
    status_solicitacao: str
    created_at: datetime


# --- Schemas de Gestão de Limites e Saldo do Veículo ---

class AlterarLimiteRequest(BaseModel):
    placa: Optional[str] = Field(None, description="Placa do veículo")
    numero_cartao: Optional[str] = Field(None, description="Número do cartão do veículo")
    tipo_operacao: str = Field(..., description="Tipo de alteração: 'aumentar', 'diminuir' ou 'alterar'")
    valor_alteracao: Decimal = Field(..., gt=Decimal("0.00"), description="Valor positivo para alteração do limite")
    motivo: str = Field(..., min_length=5, description="Justificativa formal da alteração de limite")
    periodo: Optional[str] = Field("atual", description="Período da aplicação (padrão 'atual')")
    modulo: Optional[str] = Field("abastecimento", description="Módulo do limite (padrão 'abastecimento')")
    solicitado_por: Optional[int] = Field(None, description="ID do técnico ou gestor que solicitou o ajuste")


class AlterarLimiteResponse(BaseModel):
    sucesso: bool
    mensagem: str
    id_alteracao: Optional[uuid.UUID] = None
    placa: str
    numero_cartao: Optional[str] = None
    tipo_operacao: str
    valor_alteracao: Decimal
    limite_anterior: Optional[Decimal] = None
    novo_limite: Optional[Decimal] = None


class ValeCardAlteracaoLimiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_alteracao: uuid.UUID
    id_veiculo: Optional[uuid.UUID] = None
    id_cartao: Optional[uuid.UUID] = None
    placa: str
    numero_cartao: Optional[str] = None
    tipo_operacao: str
    valor_alteracao: Decimal
    limite_anterior: Optional[Decimal] = None
    novo_limite: Optional[Decimal] = None
    periodo: str
    modulo: str
    motivo: str
    solicitado_por: Optional[int] = None
    status_operacao: str
    created_at: datetime


# --- Schemas de Sincronização e Gestão de Condutores/Motoristas ---

class ValeCardMotoristaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_valecard_motorista: uuid.UUID
    id_motorista_valecard: Optional[int] = None
    id_tecnico: Optional[int] = None
    matricula: str
    nome_completo: str
    cpf: str
    rg: Optional[str] = None
    orgao_emissor: Optional[str] = None
    sexo: Optional[str] = None
    cargo: Optional[str] = None
    cnh_numero: Optional[str] = None
    cnh_categoria: Optional[str] = None
    cnh_vencimento: Optional[date] = None
    cnh_primeira_habilitacao: Optional[date] = None
    data_nascimento: Optional[date] = None
    data_admissao: Optional[date] = None
    status_motorista: str
    status_codigo: str
    telefone: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    centro_custo_codigo: Optional[str] = None
    centro_resultado_codigo: Optional[str] = None
    codigo_filial_frota: Optional[str] = None
    descricao_filial: Optional[str] = None
    sincronizado_em: datetime
    created_at: datetime


class SincronizacaoMotoristasRequest(BaseModel):
    cpf: Optional[str] = Field(None, description="CPF para consulta individual (11 dígitos)")
    matricula: Optional[str] = Field(None, description="Matrícula para consulta individual")
    nome_completo: Optional[str] = Field(None, description="Nome parcial para filtro")


class SincronizacaoMotoristasResponse(BaseModel):
    total_processados: int
    total_inseridos: int
    total_atualizados: int
    total_vinculados_tecnicos: int
    mensagem: str


class CadastrarMotoristaRequest(BaseModel):
    matricula: str = Field(..., description="Matrícula do motorista")
    nome_completo: str = Field(..., min_length=3, description="Nome completo do condutor")
    cpf: str = Field(..., description="CPF 11 dígitos sem máscara")
    rg: Optional[str] = None
    orgao_emissor: Optional[str] = None
    sexo: str = Field("M", description="'M' - masculino, 'F' - feminino")
    cargo: Optional[str] = "Motorista"
    telefone: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    data_nascimento: Optional[date] = None
    data_admissao: Optional[date] = None
    numero_cnh: str = Field(..., description="Número da CNH")
    categoria: str = Field("B", description="Categoria CNH: 'A', 'B', 'AB', etc.")
    data_vencimento: date = Field(..., description="Data de vencimento da CNH")
    data_primeira_habilitacao: Optional[date] = None
    status: Optional[str] = Field("A", description="'A' - ativo, 'I' - inativo, 'B' - bloqueado, 'C' - cancelado")


class CadastrarMotoristaResponse(BaseModel):
    sucesso: bool
    mensagem: str
    id_valecard_motorista: Optional[uuid.UUID] = None
    matricula: str
    cpf: str
    nome_completo: str


class AtualizarMotoristaRequest(BaseModel):
    matricula: str = Field(..., description="Matrícula chave para localizar na ValeCard")
    nome_completo: Optional[str] = None
    telefone: Optional[str] = None
    celular: Optional[str] = None
    email: Optional[str] = None
    numero_cnh: Optional[str] = None
    categoria: Optional[str] = None
    data_vencimento: Optional[date] = None
    data_primeira_habilitacao: Optional[date] = None
    status: Optional[str] = Field(None, description="'A' - ativo, 'I' - inativo, 'B' - bloqueado, 'C' - cancelado")
    cargo: Optional[str] = None


class AtualizarMotoristaResponse(BaseModel):
    sucesso: bool
    mensagem: str
    matricula: str
    status: Optional[str] = None


# --- Schemas de Sincronização, Cadastro e Bloqueio de Veículos ---

class ValeCardVeiculoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_valecard_veiculo: uuid.UUID
    id_veiculo: Optional[uuid.UUID] = None
    placa: str
    codigo_status: str
    status_valecard: str
    bloqueio_abastecimento: bool
    motivo_bloqueio: Optional[str] = None
    hodometro_cadastrado: Decimal
    valor_aquisicao: Decimal
    codigo_filial: Optional[str] = None
    codigo_centro_custo: Optional[str] = None
    codigo_centro_resultado: Optional[str] = None
    propriedade: str
    sincronizado_em: datetime
    created_at: datetime


class CadastrarVeiculoValeCardRequest(BaseModel):
    placa: str = Field(..., min_length=7, description="Placa do veículo")
    chassi: Optional[str] = None
    renavam: Optional[str] = None
    ano: Optional[int] = 2026
    cor: Optional[str] = "BRANCO"
    uf: Optional[str] = "SP"
    hodometro: Optional[Decimal] = Decimal("0.00")
    valor_aquisicao: Optional[Decimal] = Decimal("0.00")
    codigo_status: Optional[str] = Field("1", description="1-Ativo, 2-Inativo, 10-Fora de Uso, 12-Emprestado")
    propriedade: Optional[str] = "LEASING"
    combustivel: Optional[str] = "FLEX"


class CadastrarVeiculoValeCardResponse(BaseModel):
    sucesso: bool
    mensagem: str
    id_valecard_veiculo: Optional[uuid.UUID] = None
    placa: str
    status_valecard: str


class AtualizarVeiculoValeCardRequest(BaseModel):
    placa: str = Field(..., description="Placa do veículo (obrigatório)")
    codigo_status: Optional[str] = Field(None, description="1-Ativo, 2-Inativo, 10-Fora de Uso, 12-Emprestado")
    hodometro: Optional[Decimal] = None
    cor: Optional[str] = None
    combustivel: Optional[str] = None


class AtualizarVeiculoValeCardResponse(BaseModel):
    sucesso: bool
    mensagem: str
    placa: str
    codigo_status: Optional[str] = None


class BloqueioAbastecimentoRequest(BaseModel):
    placa: str = Field(..., description="Placa do veículo a ser bloqueado/desbloqueado")
    bloquear: bool = Field(..., description="True para bloquear na bomba (Fora de Uso), False para desbloquear (Ativo)")
    motivo: str = Field(..., min_length=5, description="Justificativa do bloqueio/desbloqueio (ex: Manutenção corretiva em oficina)")


class BloqueioAbastecimentoResponse(BaseModel):
    sucesso: bool
    mensagem: str
    placa: str
    bloqueio_ativo: bool
    codigo_status: str
    motivo: str


# --- Schemas de Vínculo Veículo x Motorista e Responsáveis ---

class ValeCardVinculoItem(BaseModel):
    placa: str = Field(..., description="Placa do veículo (ex: ABC-1234)")
    matricula_motorista: List[str] = Field(..., description="Lista de matrículas de condutores a vincular/desvincular")
    operacao: str = Field("V", description="'V' para vincular, 'D' para desvincular")


class VincularMotoristaRequest(BaseModel):
    vinculos: List[ValeCardVinculoItem] = Field(..., description="Lista de operações de vínculo/desvínculo")
    motivo: Optional[str] = Field(None, description="Motivo operacional (ex: Entrega de termo de cautela)")
    solicitado_por: Optional[int] = Field(None, description="ID do técnico/gestor solicitante")


class ValeCardVinculoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_vinculo: uuid.UUID
    id_veiculo: Optional[uuid.UUID] = None
    id_tecnico: Optional[int] = None
    placa: str
    matricula_motorista: str
    operacao: str
    status_vinculo: str
    motivo: Optional[str] = None
    sucesso: bool
    mensagem_retorno: Optional[str] = None
    created_at: datetime


class ProcessarVinculosResponse(BaseModel):
    sucesso: bool
    total_processados: int
    total_sucesso: int
    total_falhas: int
    resultados: List[Dict[str, Any]]
    mensagem: str


class CadastrarResponsavelRequest(BaseModel):
    nome_responsavel: str = Field(..., min_length=3, max_length=100, description="Nome completo do responsável")
    matricula: str = Field(..., max_length=50, description="Matrícula do gestor/responsável")
    cpf: str = Field(..., description="CPF com ou sem máscara")
    rg: str = Field(..., max_length=30, description="RG do responsável")
    data_nascimento: date = Field(..., description="Data de nascimento")
    telefone: str = Field(..., description="Telefone com DDD")
    email: str = Field(..., description="E-mail corporativo do responsável")
    cep: str = Field(..., description="CEP (8 dígitos)")
    tipo_logradouro: str = Field("Rua", description="Tipo de logradouro (Rua, Av, etc)")
    logradouro: str = Field(..., description="Nome da rua/avenida")
    numero: str = Field(..., description="Número predial")
    complemento: Optional[str] = Field(None, description="Complemento do endereço")
    bairro: str = Field(..., description="Bairro")
    cidade: str = Field(..., description="Município")
    estado: str = Field(..., min_length=2, max_length=2, description="UF com 2 letras")
    id_tecnico: Optional[int] = Field(None, description="ID do técnico correspondente, se houver")


class ValeCardResponsavelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_valecard_responsavel: uuid.UUID
    id_tecnico: Optional[int] = None
    nome_responsavel: str
    matricula: str
    cpf: str
    rg: str
    data_nascimento: date
    telefone: str
    email: str
    cep: str
    tipo_logradouro: str
    logradouro: str
    numero: str
    complemento: Optional[str] = None
    bairro: str
    cidade: str
    estado: str
    status_cadastro: str
    created_at: datetime


class CadastrarResponsavelResponse(BaseModel):
    sucesso: bool
    mensagem: str
    id_valecard_responsavel: Optional[uuid.UUID] = None
    matricula: str
    cpf: str
    nome_responsavel: str


# --- Schemas de Faturamento e Fechamento Contábil ---

class SincronizacaoFaturamentoRequest(BaseModel):
    data_inicio: date = Field(..., description="Data de início do período de faturamento (AAAA-MM-DD)")
    data_fim: date = Field(..., description="Data de fim do período de faturamento (AAAA-MM-DD)")
    numero_titulo: Optional[str] = Field(None, description="Número da nota fiscal / título (opcional)")


class ValeCardFaturamentoItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_item_faturamento: uuid.UUID
    placa: str
    numero_cartao: Optional[str] = None
    cpf_motorista: Optional[str] = None
    nome_motorista: Optional[str] = None
    data_transacao: datetime
    tipo_combustivel: Optional[str] = None
    quantidade_litros: Decimal
    valor_unitario: Decimal
    valor_total: Decimal
    hodometro: Optional[Decimal] = None
    distancia_km: Optional[Decimal] = None
    consumo_kml: Optional[Decimal] = None
    reais_por_km: Optional[Decimal] = None
    posto_nome_fantasia: Optional[str] = None
    posto_cidade: Optional[str] = None
    posto_uf: Optional[str] = None
    created_at: datetime


class ValeCardFaturamentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_faturamento: uuid.UUID
    numero_titulo: str
    data_inicio: date
    data_fim: date
    valor_liquido: Decimal
    valor_total_transacoes: Decimal
    divergencia_contabil: Decimal
    total_transacoes: int
    status_faturamento: str
    observacoes_conciliacao: Optional[str] = None
    created_at: datetime
    itens: Optional[List[ValeCardFaturamentoItemResponse]] = None


class ConciliacaoFaturamentoResponse(BaseModel):
    sucesso: bool
    id_faturamento: Optional[uuid.UUID] = None
    numero_titulo: str
    total_itens_processados: int
    valor_liquido: Decimal
    valor_total_transacoes: Decimal
    divergencia_contabil: Decimal
    status_faturamento: str
    mensagem: str


# --- Schemas de Estornos de Combustível ---

class SincronizacaoEstornosRequest(BaseModel):
    data_inicial: date = Field(..., description="Data inicial do período de consulta (máx 91 dias)")
    data_final: date = Field(..., description="Data final do período de consulta")
    placa: Optional[str] = Field(None, description="Filtro opcional por placa")
    filial: Optional[str] = Field(None, description="Filtro opcional por filial")
    centro_custo: Optional[str] = Field(None, description="Filtro opcional por centro de custo")
    estabelecimento: Optional[str] = Field(None, description="Filtro opcional por terminal de estabelecimento")


class ValeCardEstornoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_estorno: uuid.UUID
    nsu_transacao: str
    id_transacao: Optional[uuid.UUID] = None
    id_veiculo: Optional[uuid.UUID] = None
    placa: str
    data_estorno: datetime
    data_transacao: datetime
    nome_motorista: Optional[str] = None
    produto: Optional[str] = None
    quantidade_litros: Decimal
    valor_unitario: Decimal
    valor_total: Decimal
    hodometro: Optional[Decimal] = None
    posto_nome_fantasia: Optional[str] = None
    posto_terminal: Optional[str] = None
    status_estorno: str
    created_at: datetime


class SincronizacaoEstornosResponse(BaseModel):
    sucesso: bool
    total_estornos_encontrados: int
    total_estornos_inseridos: int
    total_transacoes_vinculadas: int
    mensagem: str

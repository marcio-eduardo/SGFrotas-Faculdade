from typing import Optional, List
from uuid import UUID
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

class VeiculoBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    placa: str
    modelo: str
    marca: Optional[str] = "RENAULT"
    ano: Optional[int] = 2026
    status_operacional: str = "DISPONIVEL"
    hodometro_atual: Decimal = Decimal("0.00")
    franquia_mensal_km: Decimal = Decimal("2800.00")
    franquia_final_km: Decimal = Decimal("100800.00")
    custo_locacao_mensal: Decimal = Decimal("1933.53")
    data_inicio_contrato: Optional[date] = None
    data_fim_contrato: Optional[date] = None

class VeiculoRead(VeiculoBase):
    id_veiculo: UUID
    locadora_nome: Optional[str] = None
    base_nome: Optional[str] = None
    base_cidade: Optional[str] = None
    base_uf: Optional[str] = None
    base_regiao: Optional[str] = None
    base_codigo_atp: Optional[str] = None
    condutor_atual_id: Optional[int] = None
    condutor_atual_nome: Optional[str] = None
    condutor_atual_matricula: Optional[str] = None
    condutor_atual_ativo: Optional[bool] = True
    dias_para_fim_contrato: Optional[int] = None
    status_vigencia_contrato: Optional[str] = "VIGENTE"

class VeiculoKPISummary(BaseModel):
    total_veiculos: int
    em_uso: int
    disponiveis: int
    em_manutencao: int
    sinistrados: int
    taxa_utilizacao_percent: float
    revisoes_urgentes_ou_vencidas: int
    multas_pendentes_indicacao: int
    veiculos_condutor_inativo: int

class PaginatedVeiculos(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[VeiculoRead]

class DonutSegment(BaseModel):
    label: str
    value: str
    percentage: float
    color: str

class RankingItem(BaseModel):
    id: int
    title: str
    subtitle: str
    km: int

class RevisaoAlertaItem(BaseModel):
    id: int
    placa: str
    modelo: str
    atp: str
    hodometro: str
    restanteKm: int
    status: str

class FranquiaStats(BaseModel):
    franquiaContratada: str
    mediaRealizada: str
    utilizacaoPct: str
    totalKm: str

class CombustivelPumpItem(BaseModel):
    categoria: str  # "ETANOL" | "GASOLINA" | "DIESEL" | "SERVICOS"
    label: str
    litros: float
    litrosFormatado: str
    percentage: float
    abastecimentos: int = 0
    valorTotal: float = 0.0

class CombustivelDetalheStats(BaseModel):
    etanolLitros: float
    etanolFormatado: str
    etanolPct: float
    gasolinaLitros: float
    gasolinaFormatado: str
    gasolinaPct: float
    totalCombustivelLitrosFormatado: str
    eficienciaMediaKmL: Optional[float] = None
    combustiveis: List[CombustivelPumpItem] = []
    servicos: List[CombustivelPumpItem] = []

class RegiaoMapaItem(BaseModel):
    codigo: str  # "NORTE" | "NORDESTE" | "CENTRO_OESTE" | "SUDESTE" | "SUL"
    label: str
    siglasUfs: List[str] = []
    veiculos: int
    percentage: float
    atpsAtivas: int = 0
    color: str

class AtpResumoItem(BaseModel):
    cidade: str
    uf: str
    regiao: str
    nomeAtp: str
    veiculos: int

class DashboardAnalyticsResponse(BaseModel):
    revisoesConformidadePct: float
    donutRevisoes: List[DonutSegment]
    donutCombustivel: List[DonutSegment]
    donutRegioes: List[DonutSegment]
    veiculosRanking: List[RankingItem]
    condutoresRanking: List[RankingItem]
    veiculosRevisaoAlertas: List[RevisaoAlertaItem]
    franquiaStats: FranquiaStats
    revisoesTotalAtivos: int = 0
    revisoesCriticasLista: List[RevisaoAlertaItem] = []
    revisoesListaCompleta: List[RevisaoAlertaItem] = []
    combustivelStats: Optional[CombustivelDetalheStats] = None
    regioesMapa: List[RegiaoMapaItem] = []
    atpsResumo: List[AtpResumoItem] = []
    totalAtpsAtivas: int = 0
    totalVeiculosAtivos: int = 0

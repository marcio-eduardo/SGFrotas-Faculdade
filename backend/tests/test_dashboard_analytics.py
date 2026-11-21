import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

# Ensure repository root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError
from backend.app.services.frota_service import FrotaService
from backend.app.schemas.veiculo import (
    CombustivelDetalheStats,
    DashboardAnalyticsResponse,
)


def test_get_dashboard_analytics_raises_503_when_supabase_offline():
    """Sem contingência local: quando o Supabase falha, retorna HTTP 503 explicitamente."""
    db_mock = MagicMock()
    db_mock.execute.side_effect = OperationalError("SELECT 1", {}, Exception("DB offline"))

    with pytest.raises(HTTPException) as exc:
        FrotaService.get_dashboard_analytics(db_mock)
    assert exc.value.status_code == 503
    assert "Supabase" in exc.value.detail


def test_get_dashboard_analytics_empty_fuel_returns_zeroed_stats():
    """Sem fallback sintético de combustível: banco sem abastecimentos retorna 0 L e donut vazio."""

    def execute_side_effect(query, *args, **kwargs):
        result = MagicMock()
        result.fetchall.return_value = []
        result.scalar.return_value = None
        return result

    db_mock = MagicMock()
    db_mock.execute.side_effect = execute_side_effect

    analytics = FrotaService.get_dashboard_analytics(db_mock)

    assert isinstance(analytics, DashboardAnalyticsResponse)
    assert analytics.donutCombustivel == []
    assert isinstance(analytics.combustivelStats, CombustivelDetalheStats)
    assert analytics.combustivelStats.etanolLitros == 0.0
    assert analytics.combustivelStats.gasolinaLitros == 0.0
    assert analytics.combustivelStats.totalCombustivelLitrosFormatado == "0 L"
    assert analytics.combustivelStats.eficienciaMediaKmL is None
    assert analytics.totalAtpsAtivas == 0
    assert analytics.totalVeiculosAtivos == 0


def test_classify_fuel_categoria_and_aggregation():
    """Valida que combustíveis agregam Etanol/Gasolina/Diesel e serviços não poluem o split flex."""
    assert FrotaService._classify_fuel_categoria("GASOLINA COMUM") == "GASOLINA"
    assert FrotaService._classify_fuel_categoria("ETANOL COMUM") == "ETANOL"
    assert FrotaService._classify_fuel_categoria("ETANOL ADITIVADO") == "ETANOL"
    assert FrotaService._classify_fuel_categoria("DIESEL COMUM") == "DIESEL"
    assert FrotaService._classify_fuel_categoria("LAVADA SIMPLES") == "SERVICOS"
    assert FrotaService._classify_fuel_categoria("OLEO DO MOTOR") == "SERVICOS"

    rev_rows = [
        SimpleNamespace(
            placa="ABC1D23",
            modelo="Renault Kwid",
            nome_atp="ATP Curitiba",
            hodometro_atual=19600,
            km_restante_revisao=400,
            status_alerta_revisao="ALERTA_CRITICO",
        ),
        SimpleNamespace(
            placa="DEF4G56",
            modelo="Renault Kwid",
            nome_atp="ATP São Paulo",
            hodometro_atual=12000,
            km_restante_revisao=8000,
            status_alerta_revisao="REGULAR",
        ),
    ]
    comb_rows = [
        SimpleNamespace(tipo="GASOLINA COMUM", qtd=50, total_litros=600.0, valor_total=3600.0),
        SimpleNamespace(tipo="ETANOL COMUM", qtd=20, total_litros=250.0, valor_total=1000.0),
        SimpleNamespace(tipo="ETANOL ADITIVADO", qtd=10, total_litros=150.0, valor_total=645.0),
        SimpleNamespace(tipo="DIESEL COMUM", qtd=5, total_litros=200.0, valor_total=1200.0),
        SimpleNamespace(tipo="LAVADA SIMPLES", qtd=12, total_litros=999.0, valor_total=480.0),
        SimpleNamespace(tipo="OLEO DO MOTOR", qtd=4, total_litros=500.0, valor_total=800.0),
    ]
    veic_rows = [
        SimpleNamespace(
            placa="ABC1D23",
            modelo="Renault Kwid",
            base_nome="ATP Curitiba",
            base_cidade="Curitiba",
            base_uf="PR",
            base_regiao="SUL",
            hodometro_atual=19600,
            condutor_atual_nome="Técnico 1",
            franquia_mensal_km=2800,
        ),
        SimpleNamespace(
            placa="DEF4G56",
            modelo="Renault Kwid",
            base_nome="ATP São Paulo",
            base_cidade="São Paulo",
            base_uf="SP",
            base_regiao="SUDESTE",
            hodometro_atual=12000,
            condutor_atual_nome="Técnico 2",
            franquia_mensal_km=2800,
        ),
    ]
    atp_rows = [
        SimpleNamespace(base_cidade="Curitiba", base_uf="PR", base_regiao="SUL", base_nome="ATP Curitiba", veiculos=1),
        SimpleNamespace(base_cidade="São Paulo", base_uf="SP", base_regiao="SUDESTE", base_nome="ATP São Paulo", veiculos=1),
    ]

    def execute_side_effect(query, *args, **kwargs):
        sql_str = str(query)
        result = MagicMock()
        if "vw_frota_alertas_manutencao" in sql_str:
            result.fetchall.return_value = rev_rows
        elif "FROM tb_valecard_transacoes" in sql_str and "GROUP BY tipo_combustivel" in sql_str:
            result.fetchall.return_value = comb_rows
        elif "information_schema.columns" in sql_str:
            result.fetchall.return_value = [("consumo_medio_kml",)]
        elif "AVG(consumo_medio_kml)" in sql_str:
            result.scalar.return_value = 12.34
        elif "vw_frota_painel_geral" in sql_str:
            result.fetchall.return_value = veic_rows
        elif "tb_base_atp" in sql_str:
            result.fetchall.return_value = atp_rows
        else:
            result.fetchall.return_value = []
            result.scalar.return_value = None
        return result

    db_mock = MagicMock()
    db_mock.execute.side_effect = execute_side_effect

    analytics = FrotaService.get_dashboard_analytics(db_mock)
    stats = analytics.combustivelStats
    assert stats is not None

    # Etanol agregado = 250 + 150 = 400.0; Gasolina = 600.0; Flex = 1000.0 -> 40.0% / 60.0%
    assert stats.etanolLitros == 400.0
    assert stats.gasolinaLitros == 600.0
    assert stats.etanolPct == 40.0
    assert stats.gasolinaPct == 60.0
    assert round(stats.etanolPct + stats.gasolinaPct, 1) == 100.0
    assert stats.eficienciaMediaKmL == 12.3
    assert stats.totalCombustivelLitrosFormatado == "1.200 L"  # 600 + 250 + 150 + 200 (sem serviços)

    comb_labels = {item.label for item in stats.combustiveis}
    serv_labels = {item.label for item in stats.servicos}
    assert comb_labels == {"Gasolina Comum", "Etanol Comum", "Etanol Aditivado", "Diesel Comum"}
    assert serv_labels == {"Lavada Simples", "Oleo Do Motor"}
    assert all(item.categoria in ("ETANOL", "GASOLINA", "DIESEL") for item in stats.combustiveis)
    assert all(item.categoria == "SERVICOS" for item in stats.servicos)

    assert analytics.totalAtpsAtivas == 2
    assert analytics.totalVeiculosAtivos == 2
    assert len(analytics.regioesMapa) == 5
    assert all(r.color.upper() != "#8B5CF6" for r in analytics.regioesMapa)
    assert [item.status for item in analytics.revisoesListaCompleta] == ["critica", "regular"]

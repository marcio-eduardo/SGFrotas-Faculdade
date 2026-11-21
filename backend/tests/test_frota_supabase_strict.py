import uuid
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from backend.app.services.frota_service import FrotaService


def test_frota_service_strict_supabase_503_when_db_offline():
    """Garante ausência total de fallback em memória: banco indisponível retorna HTTP 503."""
    broken_db = MagicMock()
    broken_db.execute.side_effect = OperationalError("SELECT 1", {}, Exception("connection refused"))

    with pytest.raises(HTTPException) as kpi_exc:
        FrotaService.get_kpis(broken_db)
    assert kpi_exc.value.status_code == 503
    assert "Supabase" in kpi_exc.value.detail

    with pytest.raises(HTTPException) as list_exc:
        FrotaService.list_veiculos(broken_db)
    assert list_exc.value.status_code == 503
    assert "Supabase" in list_exc.value.detail

    with pytest.raises(HTTPException) as ana_exc:
        FrotaService.get_dashboard_analytics(broken_db)
    assert ana_exc.value.status_code == 503
    assert "Supabase" in ana_exc.value.detail


def test_frota_service_computes_kpis_and_list_strictly_from_db():
    """Valida KPIs e paginação calculados estritamente a partir das linhas retornadas pelo Supabase."""
    row_totais = SimpleNamespace(total=5, em_uso=3, disponiveis=1, manutencao=1, sinistrados=0)
    veiculo_row = SimpleNamespace(
        id_veiculo=uuid.uuid4(),
        placa="VLC0A01",
        modelo="Renault Kwid Zen 1.0",
        marca="RENAULT",
        ano=2025,
        status_operacional="EM_USO",
        hodometro_atual=Decimal("19650.00"),
        franquia_mensal_km=Decimal("2800.00"),
        franquia_final_km=Decimal("100800.00"),
        custo_locacao_mensal=Decimal("1850.00"),
        data_inicio_contrato=date(2025, 1, 15),
        data_fim_contrato=date(2028, 1, 15),
        dias_para_fim_contrato=600,
        status_vigencia_contrato="VIGENTE",
        locadora_nome="Alfa Fleet Locação S.A.",
        base_nome="BOP-01 (Curitiba)",
        base_cidade="Curitiba",
        base_uf="PR",
        base_regiao="SUL",
        base_codigo_atp="BOP-01",
        condutor_atual_id=1,
        condutor_atual_nome="Condutor Sintético 001",
        condutor_atual_matricula="VLC-1001",
        condutor_atual_ativo=True,
    )

    def execute_side_effect(query, *args, **kwargs):
        sql = str(query)
        res = MagicMock()
        if "COUNT(*) FILTER" in sql:
            res.fetchone.return_value = row_totais
        elif "vw_frota_alertas_manutencao" in sql:
            res.scalar.return_value = 1
        elif "tb_frota_multas" in sql:
            res.scalar.return_value = 2
        elif "vw_frota_alerta_condutor_inativo" in sql:
            res.scalar.return_value = 0
        elif "SELECT COUNT(*) FROM vw_frota_painel_geral" in sql:
            res.scalar.return_value = 1
        elif "FROM vw_frota_painel_geral" in sql:
            res.fetchall.return_value = [veiculo_row]
        return res

    db = MagicMock()
    db.execute.side_effect = execute_side_effect

    kpis = FrotaService.get_kpis(db)
    assert kpis.total_veiculos == 5
    assert kpis.em_uso == 3
    assert kpis.taxa_utilizacao_percent == 60.0
    assert kpis.revisoes_urgentes_ou_vencidas == 1
    assert kpis.multas_pendentes_indicacao == 2

    paginated = FrotaService.list_veiculos(db, page=1, page_size=50)
    assert paginated.total == 1
    assert len(paginated.items) == 1
    assert paginated.items[0].placa == "VLC0A01"

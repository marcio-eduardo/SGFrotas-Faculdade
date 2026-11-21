"""
Suíte de testes unitários e de contrato das rotas principais do MVP SGFrotas.
Valida registro OpenAPI/FastAPI, handlers de rota, schemas Pydantic,
regras de negócio (Cautela, Manutenção, Anti-NIC, Técnicos, Auditoria)
e fallback resiliente sem depender de rede externa ou event loop/socketpair.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock
import uuid

from fastapi import HTTPException
from pydantic import TypeAdapter
import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.api.v1.endpoints import (
    cautela as cautela_ep,
    manutencoes as manutencoes_ep,
    multas as multas_ep,
    tecnicos as tecnicos_ep,
    veiculos as veiculos_ep,
)
from backend.app.main import app, healthcheck, root
from backend.app.models.custodia import Custodia
from backend.app.models.multa import Multa
from backend.app.models.tecnico import Tecnico
from backend.app.models.valecard import ValeCardTransacao
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.custodia import CustodiaCreate, CustodiaDevolucao, CustodiaRead, MeuVeiculoResponse
from backend.app.schemas.manutencao import AlertaManutencaoPreventiva
from backend.app.schemas.multa import IdentificacaoCondutorResponse, MultaIndicacaoRequest, MultaRead
from backend.app.schemas.tecnico import TecnicoAptoResponse, TecnicoSimple
from backend.app.schemas.veiculo import DashboardAnalyticsResponse, PaginatedVeiculos, VeiculoKPISummary
from backend.app.services.valecard.audit_engine import ValeCardAuditEngine


def _make_query_mock(model_map):
    """Cria roteador determinístico de db.query(Model) para testes isolados."""

    def _query(model):
        q = MagicMock()
        data = model_map.get(model)
        if callable(data):
            q.filter.return_value.first.side_effect = data
            q.filter.return_value.order_by.return_value.first.side_effect = data
            q.order_by.return_value.all.side_effect = data
            q.order_by.return_value.limit.return_value.all.side_effect = data
            q.filter.return_value.order_by.return_value.limit.return_value.all.side_effect = data
        else:
            q.filter.return_value.first.return_value = data
            q.filter.return_value.order_by.return_value.first.return_value = data
            q.order_by.return_value.all.return_value = data if isinstance(data, list) else []
            q.order_by.return_value.limit.return_value.all.return_value = (
                data if isinstance(data, list) else []
            )
            q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = (
                data if isinstance(data, list) else []
            )
        return q

    return _query


# ---------------------------------------------------------------------------
# 1. Registro de Rotas no App FastAPI & Healthcheck
# ---------------------------------------------------------------------------


def test_mvp_rotas_principais_registradas_no_app():
    rotas = {(tuple(sorted(r.methods or [])), r.path) for r in app.routes if hasattr(r, "methods")}
    esperadas = [
        (("GET",), "/"),
        (("GET",), "/health"),
        (("POST",), "/api/v1/auth/login"),
        (("GET",), "/api/v1/auth/me"),
        (("GET",), "/api/v1/veiculos/kpis"),
        (("GET",), "/api/v1/veiculos/dashboard-analytics"),
        (("GET",), "/api/v1/veiculos"),
        (("GET",), "/api/v1/veiculos/{placa}"),
        (("GET",), "/api/v1/cautela/meu-veiculo"),
        (("POST",), "/api/v1/cautela/alocar"),
        (("POST",), "/api/v1/cautela/devolver"),
        (("GET",), "/api/v1/manutencoes/alertas-preventivos"),
        (("GET",), "/api/v1/multas/pendentes-indicacao"),
        (("GET",), "/api/v1/multas/identificar-condutor"),
        (("POST",), "/api/v1/multas/{id_multa}/indicar-condutor"),
        (("GET",), "/api/v1/tecnicos/aptos-cautela"),
        (("GET",), "/api/v1/tecnicos"),
        (("GET",), "/api/v1/valecard/status-conexao"),
    ]
    for metodo, path in esperadas:
        assert any(path == p and set(metodo).issubset(set(m)) for m, p in rotas), (
            f"Rota esperada ausente: {metodo} {path}"
        )


def test_mvp_root_e_healthcheck():
    res_root = root()
    assert res_root["status"] == "online"
    assert res_root["documentacao_swagger"] == "/docs"

    res_health = healthcheck()
    assert res_health == {"status": "healthy"}


# ---------------------------------------------------------------------------
# 2. Torre de Controle & Veículos (/api/v1/veiculos)
# ---------------------------------------------------------------------------


def test_mvp_veiculos_kpis_analytics_e_listagem_503_quando_supabase_offline():
    mock_db = MagicMock()
    mock_db.execute.side_effect = RuntimeError("DB simulado offline")

    with pytest.raises(HTTPException) as exc_kpi:
        veiculos_ep.get_kpis(db=mock_db)
    assert exc_kpi.value.status_code == 500 or exc_kpi.value.status_code == 503

    with pytest.raises(HTTPException) as exc_ana:
        veiculos_ep.get_dashboard_analytics(db=mock_db)
    assert exc_ana.value.status_code == 500 or exc_ana.value.status_code == 503

    with pytest.raises(HTTPException) as exc_list:
        veiculos_ep.list_veiculos(status=None, base_id=None, busca=None, page=1, page_size=10, db=mock_db)
    assert exc_list.value.status_code == 500 or exc_list.value.status_code == 503


def test_mvp_veiculo_ficha_por_placa_encontrado_e_404():
    veic_id = uuid.uuid4()
    veic_row = MagicMock()
    veic_row.id_veiculo = veic_id
    veic_row._mapping = {
        "id_veiculo": str(veic_id),
        "placa": "VLC1A23",
        "modelo": "Renault Kwid Zen 1.0",
        "status_operacional": "EM_USO",
        "hodometro_atual": 19500.0,
    }

    def execute_side_effect(sql, params=None):
        res = MagicMock()
        sql_txt = str(sql)
        if "vw_frota_painel_geral" in sql_txt:
            res.fetchone.return_value = veic_row if params["placa"] == "VLC1A23" else None
        else:
            res.fetchall.return_value = []
        return res

    mock_db = MagicMock()
    mock_db.execute.side_effect = execute_side_effect

    ficha = veiculos_ep.get_veiculo_por_placa(placa="VLC-1A23", db=mock_db)
    assert ficha["placa"] == "VLC1A23"
    assert ficha["historico_revisoes"] == []
    assert ficha["historico_multas"] == []

    with pytest.raises(HTTPException) as exc:
        veiculos_ep.get_veiculo_por_placa(placa="ZZZ9Z99", db=mock_db)
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# 3. Jornada do Técnico & Regras de Cautela (/api/v1/cautela)
# ---------------------------------------------------------------------------


def test_mvp_cautela_meu_veiculo_ativo_com_alerta():
    veic_id = uuid.uuid4()
    cust_id = uuid.uuid4()
    tecnico = SimpleNamespace(
        id_tecnico=10,
        matricula="VLC-1010",
        nome_completo="Técnico Campo 01",
        cnh_vencimento=date.today() + timedelta(days=120),
    )
    custodia = SimpleNamespace(
        id_custodia=cust_id,
        id_veiculo=veic_id,
        id_tecnico=10,
        data_retirada=datetime(2026, 11, 1, 8, 0, tzinfo=timezone.utc),
        hodometro_retirada=Decimal("19600.00"),
        status="ATIVA",
        observacoes="Retirada BOP-01",
    )
    veiculo = SimpleNamespace(
        id_veiculo=veic_id,
        placa="VLC2B34",
        modelo="Renault Kwid Zen 1.0",
        hodometro_atual=Decimal("19700.00"),
        tanque_capacidade_litros=Decimal("50.00"),
        status_operacional="EM_USO",
    )

    mock_db = MagicMock()
    mock_db.query.side_effect = _make_query_mock({Tecnico: tecnico, Custodia: custodia, Veiculo: veiculo})

    res = cautela_ep.get_meu_veiculo(id_tecnico=10, matricula=None, db=mock_db)
    assert isinstance(res, MeuVeiculoResponse)
    assert res.tem_veiculo_ativo is True
    assert res.veiculo["placa"] == "VLC2B34"
    assert any("Revisão preventiva em 300 km" in a for a in res.alertas)


def test_mvp_cautela_alocar_sucesso_e_devolver_sucesso():
    veic_id = uuid.uuid4()
    cust_id = uuid.uuid4()
    tecnico = SimpleNamespace(
        id_tecnico=20,
        matricula="VLC-2020",
        nome_completo="Técnico Campo 02",
        ativo=True,
        status_colaborador="ATIVO",
        cnh_vencimento=date.today() + timedelta(days=90),
        cnh_pontuacao=4,
    )
    veiculo = SimpleNamespace(
        id_veiculo=veic_id,
        placa="VLC3C45",
        modelo="Renault Kwid Zen 1.0",
        hodometro_atual=Decimal("10000.00"),
        status_operacional="DISPONIVEL",
    )

    def query_alocar(model):
        q = MagicMock()
        if model is Tecnico:
            q.filter.return_value.first.return_value = tecnico
        elif model is Custodia:
            q.filter.return_value.first.return_value = None
        elif model is Veiculo:
            q.filter.return_value.first.return_value = veiculo
        return q

    mock_db_alocar = MagicMock()
    mock_db_alocar.query.side_effect = query_alocar
    mock_db_alocar.refresh.side_effect = lambda obj: setattr(obj, "id_custodia", cust_id)

    res_alocar = cautela_ep.alocar_veiculo(
        dados=CustodiaCreate(
            id_veiculo=veic_id,
            id_tecnico=20,
            hodometro_retirada=Decimal("10200"),
            observacoes="Alocação regular",
        ),
        db=mock_db_alocar,
    )
    assert isinstance(res_alocar, CustodiaRead)
    assert res_alocar.status == "ATIVA"
    assert veiculo.status_operacional == "EM_USO"

    custodia_ativa = SimpleNamespace(
        id_custodia=cust_id,
        id_veiculo=veic_id,
        id_tecnico=20,
        data_retirada=datetime(2026, 11, 20, 9, 0, tzinfo=timezone.utc),
        hodometro_retirada=Decimal("10200.00"),
        data_devolucao=None,
        hodometro_devolucao=None,
        status="ATIVA",
        observacoes="Alocação regular",
    )
    mock_db_dev = MagicMock()
    mock_db_dev.query.side_effect = _make_query_mock({Custodia: custodia_ativa, Veiculo: veiculo, Tecnico: tecnico})

    res_dev = cautela_ep.devolver_veiculo(
        dados=CustodiaDevolucao(
            id_custodia=cust_id,
            hodometro_devolucao=Decimal("10450"),
            observacoes="Sem avarias",
        ),
        db=mock_db_dev,
    )
    assert isinstance(res_dev, CustodiaRead)
    assert res_dev.status == "FINALIZADA"
    assert veiculo.status_operacional == "DISPONIVEL"


@pytest.mark.parametrize(
    "tecnico_kwargs,veiculo_status,custodia_existente,expected_msg",
    [
        (
            {"ativo": False, "status_colaborador": "DESLIGADO"},
            "DISPONIVEL",
            None,
            "Não é permitido cautelar veículo para técnico com status",
        ),
        (
            {"cnh_vencimento": date.today() - timedelta(days=5)},
            "DISPONIVEL",
            None,
            "CNH do técnico está vencida",
        ),
        (
            {"cnh_pontuacao": 22},
            "DISPONIVEL",
            None,
            "limite legal atingido",
        ),
        (
            {},
            "MANUTENCAO",
            None,
            "não pode ser cautelado",
        ),
        (
            {},
            "DISPONIVEL",
            SimpleNamespace(id_custodia=uuid.uuid4(), status="ATIVA"),
            "já possui um veículo sob custódia ativa",
        ),
    ],
)
def test_mvp_cautela_bloqueios_governanca(
    tecnico_kwargs, veiculo_status, custodia_existente, expected_msg
):
    veic_id = uuid.uuid4()
    base_tecnico = {
        "id_tecnico": 30,
        "matricula": "VLC-3030",
        "nome_completo": "Técnico Teste",
        "ativo": True,
        "status_colaborador": "ATIVO",
        "cnh_vencimento": date.today() + timedelta(days=60),
        "cnh_pontuacao": 0,
    }
    base_tecnico.update(tecnico_kwargs)
    tecnico = SimpleNamespace(**base_tecnico)
    veiculo = SimpleNamespace(
        id_veiculo=veic_id,
        placa="VLC4D56",
        modelo="Renault Kwid",
        hodometro_atual=Decimal("5000.00"),
        status_operacional=veiculo_status,
    )

    mock_db = MagicMock()
    mock_db.query.side_effect = _make_query_mock({Tecnico: tecnico, Veiculo: veiculo, Custodia: custodia_existente})

    with pytest.raises(HTTPException) as exc:
        cautela_ep.alocar_veiculo(
            dados=CustodiaCreate(id_veiculo=veic_id, id_tecnico=30, hodometro_retirada=Decimal("5100")),
            db=mock_db,
        )
    assert exc.value.status_code == 422
    assert expected_msg in exc.value.detail


def test_mvp_cautela_devolver_bloqueia_hodometro_regressivo():
    cust_id = uuid.uuid4()
    custodia = SimpleNamespace(
        id_custodia=cust_id,
        id_veiculo=uuid.uuid4(),
        id_tecnico=30,
        hodometro_retirada=Decimal("25000.00"),
        status="ATIVA",
    )
    mock_db = MagicMock()
    mock_db.query.side_effect = _make_query_mock({Custodia: custodia})

    with pytest.raises(HTTPException) as exc:
        cautela_ep.devolver_veiculo(
            dados=CustodiaDevolucao(id_custodia=cust_id, hodometro_devolucao=Decimal("24900")),
            db=mock_db,
        )
    assert exc.value.status_code == 422
    assert "inferior ao de retirada" in exc.value.detail


# ---------------------------------------------------------------------------
# 4. Manutenções Preventivas, Técnicos & Multas Anti-NIC
# ---------------------------------------------------------------------------


def test_mvp_manutencoes_alertas_preventivos():
    row = SimpleNamespace(
        id_veiculo=uuid.uuid4(),
        placa="VLC5E67",
        modelo="Renault Kwid Zen",
        hodometro_atual=Decimal("29650.00"),
        base_nome="BOP-01",
        base_uf="PR",
        proxima_revisao_km=Decimal("30000.00"),
        km_restante_revisao=Decimal("350.00"),
        status_alerta_revisao="ALERTA_CRITICO",
    )
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = [row]

    items = manutencoes_ep.get_alertas_manutencao(status_alerta="ALERTA_CRITICO", db=mock_db)
    validated = TypeAdapter(list[AlertaManutencaoPreventiva]).validate_python(items)
    assert len(validated) == 1
    assert validated[0].status_alerta_revisao == "ALERTA_CRITICO"
    assert float(validated[0].km_restante_revisao) == 350.0


def test_mvp_tecnicos_aptos_e_listagem():
    hoje = date.today()
    tecnicos = [
        SimpleNamespace(
            id_tecnico=1,
            matricula="VLC-001",
            nome_completo="Condutor Apto",
            ativo=True,
            status_colaborador="ATIVO",
            cnh_vencimento=hoje + timedelta(days=180),
            cnh_pontuacao=5,
            cnh_categoria="B",
        ),
        SimpleNamespace(
            id_tecnico=2,
            matricula="VLC-002",
            nome_completo="Condutor CNH Vencida",
            ativo=True,
            status_colaborador="ATIVO",
            cnh_vencimento=hoje - timedelta(days=10),
            cnh_pontuacao=0,
            cnh_categoria="B",
        ),
        SimpleNamespace(
            id_tecnico=3,
            matricula="VLC-003",
            nome_completo="Condutor Desligado",
            ativo=False,
            status_colaborador="DESLIGADO",
            cnh_vencimento=hoje + timedelta(days=90),
            cnh_pontuacao=0,
            cnh_categoria="B",
        ),
    ]
    mock_db = MagicMock()
    mock_db.query.side_effect = _make_query_mock({Tecnico: tecnicos})

    aptos = tecnicos_ep.get_tecnicos_aptos(db=mock_db)
    TypeAdapter(list[TecnicoAptoResponse]).validate_python(aptos)
    data = {t.id_tecnico: t for t in aptos}
    assert data[1].apto_para_cautela is True
    assert data[2].apto_para_cautela is False
    assert "CNH vencida" in data[2].motivo_inaptidao
    assert data[3].apto_para_cautela is False
    assert "DESLIGADO" in data[3].motivo_inaptidao

    listagem = tecnicos_ep.list_tecnicos(status="TODOS", busca=None, limit=100, db=mock_db)
    assert len(listagem) == 3
    TypeAdapter(list[TecnicoSimple]).validate_python(listagem)


def test_mvp_multas_pendentes_identificar_condutor_e_indicar():
    id_multa = uuid.uuid4()
    id_veiculo = uuid.uuid4()
    id_custodia = uuid.uuid4()
    row_multa = SimpleNamespace(
        id_multa=id_multa,
        numero_ait="AIT-2026-9001",
        id_veiculo=id_veiculo,
        veiculo_placa="VLC6F78",
        id_tecnico=None,
        condutor_nome=None,
        condutor_matricula=None,
        data_hora_infracao=datetime(2026, 10, 15, 14, 35, tzinfo=timezone.utc),
        local_infracao="Rodovia BR-116 Km 102",
        codigo_infracao="74550",
        descricao_infracao="Excesso de velocidade até 20%",
        gravidade="MEDIA",
        pontuacao=4,
        valor_original=Decimal("130.16"),
        valor_com_desconto=Decimal("104.13"),
        data_limite_indicacao=date.today() + timedelta(days=3),
        data_limite_pagamento=date.today() + timedelta(days=20),
        condutor_indicado=False,
        link_documento=None,
        status_pagamento="PENDENTE",
        status_cobranca_colaborador="A_DESCONTAR",
        orgao_sigla="PRF",
        dias_para_vencer_indicacao=3,
        gravidade_prazo_indicacao="URGENTE_CRITICO",
    )

    veiculo = SimpleNamespace(id_veiculo=id_veiculo, placa="VLC6F78")
    custodia = SimpleNamespace(
        id_custodia=id_custodia,
        id_veiculo=id_veiculo,
        id_tecnico=44,
        data_retirada=datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc),
        data_devolucao=datetime(2026, 10, 30, 18, 0, tzinfo=timezone.utc),
    )
    tecnico_historico = SimpleNamespace(
        id_tecnico=44,
        nome_completo="Condutor Histórico Desligado",
        matricula="VLC-4400",
        cnh_numero="01234567890",
        cnh_categoria="B",
        cnh_vencimento=date(2028, 5, 10),
        status_colaborador="DESLIGADO",
    )
    multa_obj = SimpleNamespace(
        id_multa=id_multa,
        numero_ait="AIT-2026-9001",
        id_tecnico=None,
        condutor_indicado=False,
        protocolo_indicacao=None,
        data_envio_arval=None,
        observacoes=None,
    )

    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = [row_multa]
    mock_db.query.side_effect = _make_query_mock(
        {Veiculo: veiculo, Custodia: custodia, Tecnico: tecnico_historico, Multa: multa_obj}
    )

    # 1) Listagem de pendentes
    pendentes = multas_ep.get_multas_pendentes_indicacao(db=mock_db)
    TypeAdapter(list[MultaRead]).validate_python(pendentes)
    assert pendentes[0].gravidade_prazo_indicacao == "URGENTE_CRITICO"

    # 2) Motor Anti-NIC: identificação temporal com custódia ativa na data/hora
    ident = multas_ep.identificar_condutor_por_infracao(
        placa="VLC-6F78",
        data_hora=datetime(2026, 10, 15, 14, 35, tzinfo=timezone.utc),
        db=mock_db,
    )
    assert isinstance(ident, IdentificacaoCondutorResponse)
    assert ident.responsavel_tipo == "CONDUTOR_IDENTIFICADO"
    assert ident.id_tecnico == 44
    assert ident.condutor_matricula == "VLC-4400"

    # 3) Indicação formal (permite vincular técnico desligado na época da infração)
    res_ind = multas_ep.indicar_condutor(
        id_multa=id_multa,
        dados=MultaIndicacaoRequest(id_tecnico=44, protocolo_indicacao="DETRAN-2026-XYZ"),
        db=mock_db,
    )
    assert res_ind["condutor_indicado"] is True
    assert multa_obj.condutor_indicado is True

    # 4) Motor Anti-NIC quando carro estava no pátio da base (sem custódia no horário)
    mock_db.query.side_effect = _make_query_mock({Veiculo: veiculo, Custodia: None})
    patio = multas_ep.identificar_condutor_por_infracao(
        placa="VLC6F78",
        data_hora=datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc),
        db=mock_db,
    )
    assert patio.responsavel_tipo == "PATIO_BASE"

    # 5) Placa inexistente -> 404
    mock_db.query.side_effect = _make_query_mock({Veiculo: None})
    with pytest.raises(HTTPException) as exc:
        multas_ep.identificar_condutor_por_infracao(
            placa="XXX0X00",
            data_hora=datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc),
            db=mock_db,
        )
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# 5. Motor Anti-Fraude de Combustível (ValeCardAuditEngine)
# ---------------------------------------------------------------------------


def test_mvp_audit_engine_regras_antifraude_e_aprovado():
    veic_id = uuid.uuid4()
    veiculo = SimpleNamespace(
        id_veiculo=veic_id,
        placa="VLC7G89",
        tanque_capacidade_litros=Decimal("50.00"),
        hodometro_atual=Decimal("40000.00"),
    )
    custodia = SimpleNamespace(
        id_veiculo=veic_id,
        id_tecnico=15,
        data_retirada=datetime(2026, 11, 1, 8, 0, tzinfo=timezone.utc),
        data_devolucao=None,
    )
    db_mock = MagicMock()

    # Cenário A: Tanque excedente + inversão de odômetro + desvio de eficiência
    tx_fraude = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao="NSU-FRAUDE-01",
        placa="VLC7G89",
        id_tecnico=15,
        quantidade_litros=Decimal("60.00"),
        valor_total=Decimal("350.00"),
        hodometro=Decimal("39500.00"),
        consumo_medio_kml=Decimal("2.10"),
        data_hora_transacao=datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc),
    )
    alertas_fraude = ValeCardAuditEngine.audit_transacao(
        db_mock, tx_fraude, veiculo=veiculo, custodias=[custodia]
    )
    tipos = {a.tipo_anomalia for a in alertas_fraude}
    assert {"TANQUE_EXCEDENTE", "INVERSAO_ODOMETRO", "DESVIO_EFICIENCIA"}.issubset(tipos)
    assert tx_fraude.status_auditoria == "ALERTA_FRAUDE"

    # Cenário B: Sem custódia ativa na data do abastecimento
    tx_sem_custodia = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao="NSU-SEMCUST-02",
        placa="VLC7G89",
        id_tecnico=15,
        quantidade_litros=Decimal("35.00"),
        valor_total=Decimal("200.00"),
        hodometro=Decimal("40250.00"),
        consumo_medio_kml=Decimal("11.50"),
        data_hora_transacao=datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc),
    )
    alertas_sem_cust = ValeCardAuditEngine.audit_transacao(
        db_mock, tx_sem_custodia, veiculo=veiculo, custodias=[]
    )
    assert [a.tipo_anomalia for a in alertas_sem_cust] == ["SEM_CUSTODIA_ATIVA"]
    assert tx_sem_custodia.status_auditoria == "ALERTA_FRAUDE"

    # Cenário C: Transação regular aprovada
    tx_ok = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao="NSU-OK-03",
        placa="VLC7G89",
        id_tecnico=15,
        quantidade_litros=Decimal("38.00"),
        valor_total=Decimal("220.00"),
        hodometro=Decimal("40320.00"),
        consumo_medio_kml=Decimal("12.40"),
        data_hora_transacao=datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc),
    )
    alertas_ok = ValeCardAuditEngine.audit_transacao(
        db_mock, tx_ok, veiculo=veiculo, custodias=[custodia]
    )
    assert alertas_ok == []
    assert tx_ok.status_auditoria == "APROVADO"

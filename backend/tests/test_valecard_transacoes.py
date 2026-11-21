import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.veiculo import Veiculo
from backend.app.models.tecnico import Tecnico
from backend.app.models.custodia import Custodia
from backend.app.models.valecard import ValeCardTransacao, FrotaAlertaCombustivel
from backend.app.services.valecard.audit_engine import ValeCardAuditEngine
from backend.app.services.valecard.transacoes_service import ValeCardTransacoesService
from backend.app.core.database import SessionLocal


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_audit_engine_tanque_excedente(db_session):
    veiculo = Veiculo(
        id_veiculo=uuid.uuid4(),
        placa="TST1A01",
        modelo="Renault Kwid",
        tanque_capacidade_litros=Decimal("50.00"),
        hodometro_atual=Decimal("15000.00")
    )
    # Abastecimento de 60L em tanque de 50L (excede 105% = 52.5L)
    transacao = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao=f"NSU_TEST_{uuid.uuid4().hex[:8]}",
        placa="TST1A01",
        quantidade_litros=Decimal("60.000"),
        valor_unitario=Decimal("5.890"),
        valor_total=Decimal("353.40"),
        hodometro=Decimal("15200.00"),
        data_hora_transacao=datetime.now(timezone.utc)
    )

    alertas = ValeCardAuditEngine.audit_transacao(db_session, transacao, veiculo=veiculo)
    assert transacao.status_auditoria == "ALERTA_FRAUDE"
    assert "Tanque Excedente" in transacao.motivo_auditoria
    assert any(a.tipo_anomalia == "TANQUE_EXCEDENTE" for a in alertas)


def test_audit_engine_inversao_odometro(db_session):
    veiculo = Veiculo(
        id_veiculo=uuid.uuid4(),
        placa="TST2B02",
        modelo="Renault Kwid",
        tanque_capacidade_litros=Decimal("50.00"),
        hodometro_atual=Decimal("25000.00")
    )
    # Odômetro informado menor do que o atual
    transacao = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao=f"NSU_TEST_{uuid.uuid4().hex[:8]}",
        placa="TST2B02",
        quantidade_litros=Decimal("35.000"),
        valor_unitario=Decimal("5.890"),
        valor_total=Decimal("206.15"),
        hodometro=Decimal("24500.00"),
        data_hora_transacao=datetime.now(timezone.utc)
    )

    alertas = ValeCardAuditEngine.audit_transacao(db_session, transacao, veiculo=veiculo)
    assert transacao.status_auditoria == "ALERTA_FRAUDE"
    assert "Inversão de Odômetro" in transacao.motivo_auditoria
    assert any(a.tipo_anomalia == "INVERSAO_ODOMETRO" for a in alertas)


def test_audit_engine_desvio_eficiencia(db_session):
    veiculo = Veiculo(
        id_veiculo=uuid.uuid4(),
        placa="TST3C03",
        modelo="Renault Kwid",
        tanque_capacidade_litros=Decimal("50.00"),
        hodometro_atual=Decimal("10000.00")
    )
    # Consumo absurdo: 1.5 Km/L
    transacao = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao=f"NSU_TEST_{uuid.uuid4().hex[:8]}",
        placa="TST3C03",
        quantidade_litros=Decimal("40.000"),
        valor_unitario=Decimal("5.890"),
        valor_total=Decimal("235.60"),
        hodometro=Decimal("10300.00"),
        consumo_medio_kml=Decimal("1.50"),
        data_hora_transacao=datetime.now(timezone.utc)
    )

    alertas = ValeCardAuditEngine.audit_transacao(db_session, transacao, veiculo=veiculo)
    assert transacao.status_auditoria in ("ALERTA_FRAUDE", "PENDENTE_CONCILIACAO")
    assert any(a.tipo_anomalia == "DESVIO_EFICIENCIA" for a in alertas)


def test_api_listar_transacoes(client):
    response = client.get("/api/v1/valecard/transacoes?limit=10")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_api_kpis_resumo(client):
    response = client.get("/api/v1/valecard/transacoes/kpis/resumo")
    assert response.status_code == 200
    data = response.json()
    assert "total_gasto" in data
    assert "total_litros" in data
    assert "preco_medio_litro" in data
    assert "total_transacoes" in data
    assert "total_alertas_pendentes" in data


def test_api_listar_alertas(client):
    response = client.get("/api/v1/valecard/alertas")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_sync_transacoes_mocked(client, db_session):
    test_nsu = f"NSU_SYNC_MOCK_{uuid.uuid4().hex[:6]}"
    mock_payload = {
        "transacoes": [
            {
                "NSUTRANSAÇÃO": test_nsu,
                "PLACA": "MOC-1234",
                "MOTORISTA": "Técnico Mock ValeCard",
                "CPFMOTORISTA": "11122233344",
                "CNPJ": "12345678000100",
                "NOMEFANTASIA": "Posto Shell Rota 2026",
                "PRODUTO": "GASOLINA COMUM",
                "QUANTIDADE": "42,50",
                "VALORUNITÁRIO": "5,89",
                "VALORTOTAL": "250,33",
                "HODÔMETRO": "32100",
                "DISTÂNCIA": "450",
                "CONSUMO": "10,58",
                "DATA": "2026-10-10 10:15:00"
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("POST", "https://mock.test/buscartransacoesfrota")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        payload = {
            "data_inicial": "2026-10-01",
            "data_final": "2026-10-12",
            "tipo_transacao": "TODAS"
        }
        response = client.post("/api/v1/valecard/transacoes/sync", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["total_recebidas"] >= 1
        assert "Sincronização concluída" in data["mensagem"]

    # Limpeza da transação mockada
    tx = db_session.query(ValeCardTransacao).filter(ValeCardTransacao.nsu_transacao == test_nsu).first()
    if tx:
        db_session.delete(tx)
        db_session.commit()

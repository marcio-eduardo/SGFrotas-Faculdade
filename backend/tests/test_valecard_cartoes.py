import pytest
from datetime import datetime, timezone
from decimal import Decimal
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.veiculo import Veiculo
from backend.app.models.tecnico import Tecnico
from backend.app.models.valecard import ValeCardCartao, ValeCardSolicitacaoCartao
from backend.app.services.valecard.cartoes_service import ValeCardCartoesService
from backend.app.schemas.valecard import Solicitar2ViaCartaoRequest
from backend.app.core.database import SessionLocal


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_cartoes_helpers():
    # Helper clean_str
    assert ValeCardCartoesService._clean_str("  Centro de Custo A  ") == "Centro de Custo A"
    assert ValeCardCartoesService._clean_str("   ") is None
    assert ValeCardCartoesService._clean_str(None) is None

    # Helper normalize_placa
    assert ValeCardCartoesService._normalize_placa("abc-1234") == "ABC1234"
    assert ValeCardCartoesService._normalize_placa("ABC1D23") == "ABC1D23"
    assert ValeCardCartoesService._normalize_placa("") == ""

    # Helper parse_decimal
    assert ValeCardCartoesService._parse_decimal("R$ 1.500,50") == Decimal("1500.50")
    assert ValeCardCartoesService._parse_decimal(250.75) == Decimal("250.75")
    assert ValeCardCartoesService._parse_decimal("invalido", Decimal("10.00")) == Decimal("10.00")

    # Helper map_status
    assert ValeCardCartoesService._map_status("A") == "ATIVO"
    assert ValeCardCartoesService._map_status("B") == "BLOQUEADO"
    assert ValeCardCartoesService._map_status("C") == "CANCELADO"
    assert ValeCardCartoesService._map_status("I") == "INATIVO"
    assert ValeCardCartoesService._map_status(None) == "ATIVO"


@pytest.mark.asyncio
async def test_sync_cartoes_service_mocked(db_session):
    test_cartao_num = f"6035{uuid.uuid4().hex[:12].upper()}"
    mock_payload = {
        "cartoes": [
            {
                "numeroCartao": test_cartao_num,
                "placa": "TST-9988",
                "idCartao": "12345",
                "statusCartao": "A",
                "tipoCartao": "T",
                "segundaVia": "N",
                "limite": "2.500,00",
                "saldo": "1.850,50",
                "centroCusto": "CC01",
                "descricaoCentroCusto": "Operações Frota",
                "modeloVeiculo": "Strada 1.3",
                "dataGeracao": "10/10/2026 14:30:00"
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("POST", "https://mock.valecard.test/buscarBasedeCartoes")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        res = await ValeCardCartoesService.sync_cartoes(db=db_session, numero_cartao=test_cartao_num)
        assert res.total_processados == 1
        assert res.total_inseridos == 1
        assert res.total_atualizados == 0

        # Verifica persistência
        c = db_session.query(ValeCardCartao).filter(ValeCardCartao.numero_cartao == test_cartao_num).first()
        assert c is not None
        assert c.placa == "TST9988"
        assert c.limite_atual == Decimal("2500.00")
        assert c.saldo_disponivel == Decimal("1850.50")
        assert c.status_cartao == "ATIVO"

        # Segunda chamada para atualizar o cartão
        mock_payload["cartoes"][0]["saldo"] = "1.200,00"
        mock_resp_update = httpx.Response(
            status_code=200,
            json=mock_payload,
            request=httpx.Request("POST", "https://mock.valecard.test/buscarBasedeCartoes")
        )
        mock_req.return_value = mock_resp_update

        res2 = await ValeCardCartoesService.sync_cartoes(db=db_session, numero_cartao=test_cartao_num)
        assert res2.total_processados == 1
        assert res2.total_inseridos == 0
        assert res2.total_atualizados == 1

        db_session.refresh(c)
        assert c.saldo_disponivel == Decimal("1200.00")

        # Limpeza
        db_session.delete(c)
        db_session.commit()


@pytest.mark.asyncio
async def test_solicitar_2via_service_mocked(db_session):
    test_cartao_num = f"6035{uuid.uuid4().hex[:12].upper()}"
    cartao = ValeCardCartao(
        numero_cartao=test_cartao_num,
        placa="SOL-2VIA",
        status_cartao="ATIVO",
        limite_atual=Decimal("1000.00"),
        saldo_disponivel=Decimal("500.00")
    )
    db_session.add(cartao)
    db_session.commit()

    mock_resp_valecard = {
        "codigo": "00",
        "mensagem": "Solicitacao de 2a via autorizada com sucesso"
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_resp_valecard,
        request=httpx.Request("POST", "https://mock.valecard.test/solicitar2ViaCartao")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        tecnico = db_session.query(Tecnico).first()
        id_tecnico = tecnico.id_tecnico if tecnico else None

        req = Solicitar2ViaCartaoRequest(
            placa="SOL-2VIA",
            numero_cartao=test_cartao_num,
            motivo="Cartão quebrado pelo condutor durante operação",
            solicitado_por=id_tecnico
        )

        res = await ValeCardCartoesService.solicitar_2via(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.numero_cartao_anterior == test_cartao_num
        assert res.id_solicitacao is not None

        # Cartão anterior deve ter sido cancelado preventivamente
        db_session.refresh(cartao)
        assert cartao.status_cartao == "CANCELADO"

        # Solicitação deve estar registrada
        sol = db_session.query(ValeCardSolicitacaoCartao).filter(
            ValeCardSolicitacaoCartao.id_solicitacao == res.id_solicitacao
        ).first()
        assert sol is not None
        assert sol.status_solicitacao == "PROCESSADO"
        assert sol.motivo == "Cartão quebrado pelo condutor durante operação"

        # Limpeza
        db_session.delete(sol)
        db_session.delete(cartao)
        db_session.commit()


@pytest.mark.asyncio
async def test_solicitar_2via_sem_dados(db_session):
    req = Solicitar2ViaCartaoRequest(
        placa=None,
        numero_cartao=None,
        motivo="Perda de cartão sem placa"
    )
    with pytest.raises(ValueError, match="Informe ao menos a placa ou o número do cartão"):
        await ValeCardCartoesService.solicitar_2via(db=db_session, dados=req)


def test_api_listar_cartoes(client):
    response = client.get("/api/v1/valecard/cartoes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_api_listar_solicitacoes_2via(client):
    response = client.get("/api/v1/valecard/cartoes/solicitacoes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_api_sync_cartoes(client):
    mock_payload = {
        "cartoes": []
    }
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("POST", "https://mock.valecard.test/buscarBasedeCartoes")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        response = client.post("/api/v1/valecard/cartoes/sync", json={"placa": "TST0000"})
        assert response.status_code == 200
        data = response.json()
        assert "total_processados" in data
        assert data["total_processados"] == 0


@pytest.mark.asyncio
async def test_api_solicitar_2via(client, db_session):
    mock_resp_valecard = {
        "mensagem": "2a via solicitada com sucesso"
    }
    mock_resp = httpx.Response(
        status_code=200,
        json=mock_resp_valecard,
        request=httpx.Request("POST", "https://mock.valecard.test/solicitar2ViaCartao")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "placa": "API-1234",
            "numero_cartao": "6035123456789012",
            "motivo": "Extravio do cartão na base operacional",
            "solicitado_por": None
        }
        response = client.post("/api/v1/valecard/cartoes/solicitar-2via", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["placa"] == "API1234"

        if data.get("id_solicitacao"):
            sol = db_session.query(ValeCardSolicitacaoCartao).filter(
                ValeCardSolicitacaoCartao.id_solicitacao == data["id_solicitacao"]
            ).first()
            if sol:
                db_session.delete(sol)
                db_session.commit()


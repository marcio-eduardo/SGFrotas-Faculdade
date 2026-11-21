import pytest
from decimal import Decimal
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.valecard import ValeCardVeiculo
from backend.app.models.veiculo import Veiculo
from backend.app.services.valecard.veiculos_service import ValeCardVeiculosService
from backend.app.schemas.valecard import (
    CadastrarVeiculoValeCardRequest,
    AtualizarVeiculoValeCardRequest,
    BloqueioAbastecimentoRequest
)
from backend.app.core.database import SessionLocal


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_veiculos_helpers():
    assert ValeCardVeiculosService._normalize_placa("abc-1234") == "ABC1234"
    assert ValeCardVeiculosService._normalize_placa("ABC1D23") == "ABC1D23"
    assert ValeCardVeiculosService._normalize_placa("") == ""

    assert ValeCardVeiculosService._map_status("1") == ("ATIVO", False)
    assert ValeCardVeiculosService._map_status("2") == ("INATIVO", True)
    assert ValeCardVeiculosService._map_status("10") == ("FORA_DE_USO", True)
    assert ValeCardVeiculosService._map_status("12") == ("EMPRESTADO", False)


@pytest.mark.asyncio
async def test_cadastrar_veiculo_mocked(db_session):
    test_placa = f"CAD{uuid.uuid4().hex[:4].upper()}"

    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Veículo cadastrado na ValeCard"},
        request=httpx.Request("POST", "https://mock.valecard.test/cadastrarVeiculoFrota")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = CadastrarVeiculoValeCardRequest(
            placa=test_placa,
            chassi=f"CHASSI_{test_placa}",
            renavam="1234567890",
            ano=2026,
            cor="BRANCO",
            uf="SP",
            hodometro=Decimal("15000.00"),
            valor_aquisicao=Decimal("85000.00")
        )

        res = await ValeCardVeiculosService.cadastrar_veiculo(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.placa == test_placa
        assert res.status_valecard == "ATIVO"

        v = db_session.query(ValeCardVeiculo).filter(ValeCardVeiculo.placa == test_placa).first()
        assert v is not None
        assert v.bloqueio_abastecimento is False
        assert v.hodometro_cadastrado == Decimal("15000.00")

        # Limpeza
        db_session.delete(v)
        db_session.commit()


@pytest.mark.asyncio
async def test_cadastrar_veiculo_placa_invalida(db_session):
    req = CadastrarVeiculoValeCardRequest(placa="ABC----")
    with pytest.raises(ValueError, match="Placa inválida"):
        await ValeCardVeiculosService.cadastrar_veiculo(db=db_session, dados=req)


@pytest.mark.asyncio
async def test_atualizar_veiculo_mocked(db_session):
    test_placa = f"ATU{uuid.uuid4().hex[:4].upper()}"
    veic = ValeCardVeiculo(
        placa=test_placa,
        codigo_status="1",
        status_valecard="ATIVO",
        bloqueio_abastecimento=False,
        hodometro_cadastrado=Decimal("10000.00")
    )
    db_session.add(veic)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Veículo atualizado com sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarVeiculoFrota")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = AtualizarVeiculoValeCardRequest(
            placa=test_placa,
            codigo_status="1",
            hodometro=Decimal("18500.00")
        )

        res = await ValeCardVeiculosService.atualizar_veiculo(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.placa == test_placa

        db_session.refresh(veic)
        assert veic.hodometro_cadastrado == Decimal("18500.00")

        # Limpeza
        db_session.delete(veic)
        db_session.commit()


@pytest.mark.asyncio
async def test_bloqueio_abastecimento_bomba_mocked(db_session):
    test_placa = f"BLQ{uuid.uuid4().hex[:4].upper()}"
    veic = ValeCardVeiculo(
        placa=test_placa,
        codigo_status="1",
        status_valecard="ATIVO",
        bloqueio_abastecimento=False
    )
    db_session.add(veic)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Status alterado com sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarVeiculoFrota")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        # 1. Bloquear por manutenção corretiva
        req_bloqueio = BloqueioAbastecimentoRequest(
            placa=test_placa,
            bloquear=True,
            motivo="Veículo encaminhado para oficina mecânica com avaria de suspensão"
        )
        res_bloqueio = await ValeCardVeiculosService.gerenciar_bloqueio_bomba(db=db_session, dados=req_bloqueio)
        assert res_bloqueio.sucesso is True
        assert res_bloqueio.bloqueio_ativo is True
        assert res_bloqueio.codigo_status == "10"

        db_session.refresh(veic)
        assert veic.bloqueio_abastecimento is True
        assert veic.status_valecard == "FORA_DE_USO"
        assert "oficina mecânica" in veic.motivo_bloqueio

        # 2. Desbloquear após término da manutenção
        req_desbloqueio = BloqueioAbastecimentoRequest(
            placa=test_placa,
            bloquear=False,
            motivo="Manutenção concluída e aprovada em vistoria"
        )
        res_desbloqueio = await ValeCardVeiculosService.gerenciar_bloqueio_bomba(db=db_session, dados=req_desbloqueio)
        assert res_desbloqueio.sucesso is True
        assert res_desbloqueio.bloqueio_ativo is False
        assert res_desbloqueio.codigo_status == "1"

        db_session.refresh(veic)
        assert veic.bloqueio_abastecimento is False
        assert veic.status_valecard == "ATIVO"

        # Limpeza
        db_session.delete(veic)
        db_session.commit()


def test_api_listar_veiculos(client):
    response = client.get("/api/v1/valecard/veiculos")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_api_cadastrar_veiculo(client, db_session):
    test_placa = f"APV{uuid.uuid4().hex[:4].upper()}"
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Cadastrado"},
        request=httpx.Request("POST", "https://mock.valecard.test/cadastrarVeiculoFrota")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "placa": test_placa,
            "chassi": f"CH_{test_placa}",
            "ano": 2026,
            "cor": "PRATA",
            "hodometro": "21000.00"
        }
        response = client.post("/api/v1/valecard/veiculos/cadastrar", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["placa"] == test_placa

        if data.get("id_valecard_veiculo"):
            v = db_session.query(ValeCardVeiculo).filter(
                ValeCardVeiculo.id_valecard_veiculo == data["id_valecard_veiculo"]
            ).first()
            if v:
                db_session.delete(v)
                db_session.commit()


@pytest.mark.asyncio
async def test_api_atualizar_veiculo(client):
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Atualizado"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarVeiculoFrota")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "placa": "UPD-1234",
            "codigo_status": "1",
            "hodometro": "30000"
        }
        response = client.post("/api/v1/valecard/veiculos/atualizar", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["placa"] == "UPD1234"


@pytest.mark.asyncio
async def test_api_bloqueio_bomba(client, db_session):
    test_placa = f"BOM{uuid.uuid4().hex[:4].upper()}"
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Bloqueado na bomba"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarVeiculoFrota")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "placa": test_placa,
            "bloquear": True,
            "motivo": "Veículo sinistrado em colisão - bloqueio preventivo de combustível"
        }
        response = client.post("/api/v1/valecard/veiculos/bloqueio-bomba", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["bloqueio_ativo"] is True
        assert data["codigo_status"] == "10"

        v = db_session.query(ValeCardVeiculo).filter(ValeCardVeiculo.placa == test_placa).first()
        if v:
            db_session.delete(v)
            db_session.commit()

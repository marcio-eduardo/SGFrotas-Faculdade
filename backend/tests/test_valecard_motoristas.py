import pytest
from datetime import date
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.valecard import ValeCardMotorista
from backend.app.models.tecnico import Tecnico
from backend.app.services.valecard.motoristas_service import ValeCardMotoristasService
from backend.app.schemas.valecard import CadastrarMotoristaRequest, AtualizarMotoristaRequest
from backend.app.core.database import SessionLocal


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_helpers_motoristas():
    assert ValeCardMotoristasService._clean_cpf("123.456.789-00") == "12345678900"
    assert ValeCardMotoristasService._clean_cpf("42268240333") == "42268240333"
    assert ValeCardMotoristasService._clean_cpf(None) == ""

    assert ValeCardMotoristasService._parse_date("2026-10-14") == date(2026, 10, 14)
    assert ValeCardMotoristasService._parse_date("14/10/2026") == date(2026, 10, 14)
    assert ValeCardMotoristasService._parse_date(None) is None

    assert ValeCardMotoristasService._map_status("A") == ("ATIVO", "A")
    assert ValeCardMotoristasService._map_status("B") == ("BLOQUEADO", "B")
    assert ValeCardMotoristasService._map_status("C") == ("CANCELADO", "C")
    assert ValeCardMotoristasService._map_status("I") == ("INATIVO", "I")


@pytest.mark.asyncio
async def test_sync_motoristas_mocked(db_session):
    test_id = int(str(uuid.uuid4().int)[:8])
    test_cpf = f"99{str(uuid.uuid4().int)[:9]}"
    test_mat = f"MAT{uuid.uuid4().hex[:6]}"

    # Limpeza preventiva caso exista resíduo
    db_session.query(ValeCardMotorista).filter(ValeCardMotorista.id_motorista_valecard == test_id).delete()
    db_session.commit()

    mock_payload = [
        {
            "id": test_id,
            "nomeCompleto": "Motorista Sincronizado Teste",
            "cpf": test_cpf,
            "matricula": test_mat,
            "numeroCnh": "98765432100",
            "categoria": "AB",
            "status": "A",
            "statusMotorista": "ATIVO",
            "telefone": "11988887777",
            "cargo": "Motorista Operacional",
            "dataVencimento": "2029-05-20"
        }
    ]

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_payload,
        request=httpx.Request("GET", "https://mock.valecard.test/buscarMotoristas")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        res = await ValeCardMotoristasService.sync_motoristas(db=db_session, cpf=test_cpf)
        assert res.total_processados == 1
        assert res.total_inseridos == 1
        assert res.total_atualizados == 0

        # Verifica no banco
        mot = db_session.query(ValeCardMotorista).filter(ValeCardMotorista.cpf == test_cpf).first()
        assert mot is not None
        assert mot.matricula == test_mat
        assert mot.cnh_numero == "98765432100"
        assert mot.status_motorista == "ATIVO"

        # Segunda sincronização (atualização)
        mock_payload[0]["status"] = "B"
        mock_payload[0]["statusMotorista"] = "BLOQUEADO"
        mock_resp_update = httpx.Response(
            status_code=200,
            json=mock_payload,
            request=httpx.Request("GET", "https://mock.valecard.test/buscarMotoristas")
        )
        mock_req.return_value = mock_resp_update

        res2 = await ValeCardMotoristasService.sync_motoristas(db=db_session, cpf=test_cpf)
        assert res2.total_processados == 1
        assert res2.total_atualizados == 1

        db_session.refresh(mot)
        assert mot.status_motorista == "BLOQUEADO"
        assert mot.status_codigo == "B"

        # Limpeza
        db_session.delete(mot)
        db_session.commit()


@pytest.mark.asyncio
async def test_cadastrar_motorista_mocked(db_session):
    test_cpf = f"88{str(uuid.uuid4().int)[:9]}"
    test_mat = f"MAT{uuid.uuid4().hex[:6]}"

    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Motorista cadastrado com sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/cadastrarMotorista")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = CadastrarMotoristaRequest(
            matricula=test_mat,
            nome_completo="Condutor Novo Cadastrado",
            cpf=test_cpf,
            rg="1234567",
            orgao_emissor="SSP",
            sexo="M",
            cargo="Técnico de Campo",
            numero_cnh="1122334455",
            categoria="B",
            data_vencimento=date(2028, 12, 31),
            status="A"
        )

        res = await ValeCardMotoristasService.cadastrar_motorista(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.cpf == test_cpf
        assert res.matricula == test_mat

        mot = db_session.query(ValeCardMotorista).filter(ValeCardMotorista.cpf == test_cpf).first()
        assert mot is not None
        assert mot.cnh_numero == "1122334455"
        assert mot.status_motorista == "ATIVO"

        # Limpeza
        db_session.delete(mot)
        db_session.commit()


@pytest.mark.asyncio
async def test_cadastrar_motorista_cpf_invalido(db_session):
    req = CadastrarMotoristaRequest(
        matricula="MAT123",
        nome_completo="CPF Curto",
        cpf="12345", # Menos de 11 dígitos
        numero_cnh="11223344",
        categoria="B",
        data_vencimento=date(2028, 1, 1)
    )
    with pytest.raises(ValueError, match="CPF inválido"):
        await ValeCardMotoristasService.cadastrar_motorista(db=db_session, dados=req)


@pytest.mark.asyncio
async def test_atualizar_motorista_mocked(db_session):
    test_mat = f"MAT{uuid.uuid4().hex[:6]}"
    mot = ValeCardMotorista(
        matricula=test_mat,
        cpf=f"77{str(uuid.uuid4().int)[:9]}",
        nome_completo="Motorista para Atualizacao",
        cnh_numero="123123123",
        status_motorista="ATIVO",
        status_codigo="A"
    )
    db_session.add(mot)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Condutor atualizado com sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarMotoristas")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = AtualizarMotoristaRequest(
            matricula=test_mat,
            status="B", # Bloqueia condutor na ValeCard
            data_vencimento=date(2030, 1, 1),
            telefone="11999990000"
        )

        res = await ValeCardMotoristasService.atualizar_motorista(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.matricula == test_mat

        db_session.refresh(mot)
        assert mot.status_motorista == "BLOQUEADO"
        assert mot.status_codigo == "B"
        assert mot.cnh_vencimento == date(2030, 1, 1)
        assert mot.telefone == "11999990000"

        # Limpeza
        db_session.delete(mot)
        db_session.commit()


def test_api_listar_motoristas(client):
    response = client.get("/api/v1/valecard/motoristas")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_api_sync_motoristas(client):
    mock_resp = httpx.Response(
        status_code=200,
        json=[],
        request=httpx.Request("GET", "https://mock.valecard.test/buscarMotoristas")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        response = client.post("/api/v1/valecard/motoristas/sync", json={"cpf": "11122233344"})
        assert response.status_code == 200
        data = response.json()
        assert "total_processados" in data
        assert data["total_processados"] == 0


@pytest.mark.asyncio
async def test_api_cadastrar_motorista(client, db_session):
    test_cpf = f"66{str(uuid.uuid4().int)[:9]}"
    test_mat = f"API{uuid.uuid4().hex[:6]}"
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Cadastrado"},
        request=httpx.Request("POST", "https://mock.valecard.test/cadastrarMotorista")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "matricula": test_mat,
            "nome_completo": "Condutor Via API",
            "cpf": test_cpf,
            "numero_cnh": "55667788",
            "categoria": "B",
            "data_vencimento": "2027-10-10",
            "status": "A"
        }
        response = client.post("/api/v1/valecard/motoristas/cadastrar", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["cpf"] == test_cpf

        if data.get("id_valecard_motorista"):
            m = db_session.query(ValeCardMotorista).filter(
                ValeCardMotorista.id_valecard_motorista == data["id_valecard_motorista"]
            ).first()
            if m:
                db_session.delete(m)
                db_session.commit()


@pytest.mark.asyncio
async def test_api_atualizar_motorista(client):
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Atualizado"},
        request=httpx.Request("POST", "https://mock.valecard.test/atualizarMotoristas")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "matricula": "MAT_API_UPDATE",
            "status": "I",
            "cargo": "Líder Técnico"
        }
        response = client.post("/api/v1/valecard/motoristas/atualizar", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["matricula"] == "MAT_API_UPDATE"

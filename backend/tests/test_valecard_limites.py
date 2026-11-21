import pytest
from decimal import Decimal
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.valecard import ValeCardCartao, ValeCardAlteracaoLimite
from backend.app.models.tecnico import Tecnico
from backend.app.services.valecard.limites_service import ValeCardLimitesService
from backend.app.schemas.valecard import AlterarLimiteRequest
from backend.app.core.database import SessionLocal


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_normalize_placa_and_operacao():
    assert ValeCardLimitesService._normalize_placa("abc-1234") == "ABC1234"
    assert ValeCardLimitesService._normalize_tipo_operacao("aumentar") == ("AUMENTAR", "aumentar")
    assert ValeCardLimitesService._normalize_tipo_operacao("adicionar") == ("AUMENTAR", "aumentar")
    assert ValeCardLimitesService._normalize_tipo_operacao("diminuir") == ("DIMINUIR", "diminuir")
    assert ValeCardLimitesService._normalize_tipo_operacao("alterar") == ("ALTERAR", "alterar")

    with pytest.raises(ValueError, match="Tipo de alteração inválido"):
        ValeCardLimitesService._normalize_tipo_operacao("invalido")


@pytest.mark.asyncio
async def test_alterar_limite_aumentar_mocked(db_session):
    test_cartao_num = f"6035{uuid.uuid4().hex[:12].upper()}"
    cartao = ValeCardCartao(
        numero_cartao=test_cartao_num,
        placa="LIM-1001",
        status_cartao="ATIVO",
        limite_atual=Decimal("1000.00"),
        saldo_disponivel=Decimal("500.00")
    )
    db_session.add(cartao)
    db_session.commit()

    mock_resp_valecard = {
        "codigo": "00",
        "mensagem": "Limite alterado com sucesso"
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=mock_resp_valecard,
        request=httpx.Request("POST", "https://mock.valecard.test/alterarLimiteveiculo")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        tecnico = db_session.query(Tecnico).first()
        id_tecnico = tecnico.id_tecnico if tecnico else None

        req = AlterarLimiteRequest(
            placa="LIM-1001",
            numero_cartao=test_cartao_num,
            tipo_operacao="aumentar",
            valor_alteracao=Decimal("250.00"),
            motivo="Reforço de combustível para deslocamento de emergência",
            solicitado_por=id_tecnico
        )

        res = await ValeCardLimitesService.alterar_limite(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.limite_anterior == Decimal("1000.00")
        assert res.novo_limite == Decimal("1250.00")
        assert res.tipo_operacao == "AUMENTAR"

        # Cartão atualizado
        db_session.refresh(cartao)
        assert cartao.limite_atual == Decimal("1250.00")

        # Registro de auditoria
        audit = db_session.query(ValeCardAlteracaoLimite).filter(
            ValeCardAlteracaoLimite.id_alteracao == res.id_alteracao
        ).first()
        assert audit is not None
        assert audit.status_operacao == "PROCESSADO"
        assert audit.tipo_operacao == "AUMENTAR"
        assert audit.novo_limite == Decimal("1250.00")

        # Limpeza
        db_session.delete(audit)
        db_session.delete(cartao)
        db_session.commit()


@pytest.mark.asyncio
async def test_alterar_limite_diminuir_mocked(db_session):
    test_cartao_num = f"6035{uuid.uuid4().hex[:12].upper()}"
    cartao = ValeCardCartao(
        numero_cartao=test_cartao_num,
        placa="LIM-1002",
        status_cartao="ATIVO",
        limite_atual=Decimal("800.00"),
        saldo_disponivel=Decimal("300.00")
    )
    db_session.add(cartao)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json={"mensagem": "Sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/alterarLimiteveiculo")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = AlterarLimiteRequest(
            placa="LIM-1002",
            tipo_operacao="diminuir",
            valor_alteracao=Decimal("300.00"),
            motivo="Ajuste de limite por encerramento de plantão"
        )

        res = await ValeCardLimitesService.alterar_limite(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.limite_anterior == Decimal("800.00")
        assert res.novo_limite == Decimal("500.00")

        db_session.refresh(cartao)
        assert cartao.limite_atual == Decimal("500.00")

        audit = db_session.query(ValeCardAlteracaoLimite).filter(
            ValeCardAlteracaoLimite.id_alteracao == res.id_alteracao
        ).first()
        if audit:
            db_session.delete(audit)
        db_session.delete(cartao)
        db_session.commit()


@pytest.mark.asyncio
async def test_alterar_limite_alterar_direto_mocked(db_session):
    test_cartao_num = f"6035{uuid.uuid4().hex[:12].upper()}"
    cartao = ValeCardCartao(
        numero_cartao=test_cartao_num,
        placa="LIM-1003",
        status_cartao="ATIVO",
        limite_atual=Decimal("500.00"),
        saldo_disponivel=Decimal("100.00")
    )
    db_session.add(cartao)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json={"mensagem": "Sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/alterarLimiteveiculo")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = AlterarLimiteRequest(
            placa="LIM-1003",
            tipo_operacao="alterar",
            valor_alteracao=Decimal("2000.00"),
            motivo="Definição de novo teto mensal conforme política de frota 2026"
        )

        res = await ValeCardLimitesService.alterar_limite(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.novo_limite == Decimal("2000.00")

        db_session.refresh(cartao)
        assert cartao.limite_atual == Decimal("2000.00")

        audit = db_session.query(ValeCardAlteracaoLimite).filter(
            ValeCardAlteracaoLimite.id_alteracao == res.id_alteracao
        ).first()
        if audit:
            db_session.delete(audit)
        db_session.delete(cartao)
        db_session.commit()


@pytest.mark.asyncio
async def test_alterar_limite_validacoes(db_session):
    # Sem placa e sem cartão
    req1 = AlterarLimiteRequest(
        placa=None,
        numero_cartao=None,
        tipo_operacao="aumentar",
        valor_alteracao=Decimal("100.00"),
        motivo="Teste sem identificador"
    )
    with pytest.raises(ValueError, match="Informe ao menos a placa"):
        await ValeCardLimitesService.alterar_limite(db=db_session, dados=req1)


def test_api_listar_historico_limites(client):
    response = client.get("/api/v1/valecard/limites/historico")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_api_alterar_limite(client, db_session):
    mock_resp = httpx.Response(
        status_code=200,
        json={"codigo": "00", "mensagem": "Limite atualizado"},
        request=httpx.Request("POST", "https://mock.valecard.test/alterarLimiteveiculo")
    )
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp
        payload = {
            "placa": "TST-5544",
            "tipo_operacao": "aumentar",
            "valor_alteracao": "150.00",
            "motivo": "Chamado urgente noturno em outra localidade",
            "solicitado_por": None
        }
        response = client.post("/api/v1/valecard/limites/alterar", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["sucesso"] is True
        assert data["tipo_operacao"] == "AUMENTAR"

        if data.get("id_alteracao"):
            rec = db_session.query(ValeCardAlteracaoLimite).filter(
                ValeCardAlteracaoLimite.id_alteracao == data["id_alteracao"]
            ).first()
            if rec:
                db_session.delete(rec)
                db_session.commit()

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone
import uuid

from backend.app.core.valecard.client_base import (
    ValeCardBaseClient,
    ValeCardAPIError,
    ValeCardTimeoutError,
    ValeCardConnectionError
)
from backend.app.models.valecard import ValeCardTransacao, FrotaAlertaCombustivel


@pytest.mark.asyncio
async def test_valecard_client_headers():
    client = ValeCardBaseClient(
        base_url="https://kissapi.valecard.com.br/core/services/frotaCliente",
        token="TEST_BASIC_TOKEN_MOCK_BASE64==",
        timeout=15
    )
    headers = client._get_headers()
    assert headers["Authorization"] == "Basic TEST_BASIC_TOKEN_MOCK_BASE64=="
    assert headers["Content-Type"] == "application/json"
    assert headers["Accept"] == "application/json"
    assert "SGFrotas" in headers["User-Agent"]


def test_valecard_client_sanitization():
    client = ValeCardBaseClient()
    payload = {
        "numeroCartao": "123456",
        "tokenAcesso": "SECRET_VALUE_123",
        "senhaMotorista": "PASSWORD_999",
        "nested": {
            "token": "INNER_TOKEN",
            "valor": 150.00
        }
    }
    sanitized = client._sanitize_log_data(payload)
    assert sanitized["tokenAcesso"] == "***REDACTED***"
    assert sanitized["senhaMotorista"] == "***REDACTED***"
    assert sanitized["nested"]["token"] == "***REDACTED***"
    assert sanitized["nested"]["valor"] == 150.00
    assert sanitized["numeroCartao"] == "123456"


@pytest.mark.asyncio
async def test_valecard_client_post_success():
    client = ValeCardBaseClient(token="test-basic-token", max_retries=1)
    mock_response = httpx.Response(
        status_code=200,
        json={"codigoRetorno": "00", "mensagem": "Transações obtidas com sucesso", "transacoes": []},
        request=httpx.Request("POST", "https://mock.test/buscartransacoesfrota")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        result = await client.post("buscartransacoesfrota", {"contrato": "000000"})
        assert result["codigoRetorno"] == "00"
        assert result["mensagem"] == "Transações obtidas com sucesso"
        assert mock_request.call_count == 1
    await client.close()


@pytest.mark.asyncio
async def test_valecard_client_api_error_400():
    client = ValeCardBaseClient(token="test-basic-token", max_retries=1)
    mock_response = httpx.Response(
        status_code=400,
        json={"codigoRetorno": "99", "mensagem": "Parâmetros inválidos"},
        request=httpx.Request("POST", "https://mock.test/alterarLimiteveiculo")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_request:
        mock_request.return_value = mock_response
        with pytest.raises(ValeCardAPIError) as exc_info:
            await client.post("alterarLimiteveiculo", {})
        assert exc_info.value.status_code == 400
        assert "Parâmetros inválidos" in str(exc_info.value)
    await client.close()


def test_valecard_orm_model_instantiation():
    transacao = ValeCardTransacao(
        id_transacao=uuid.uuid4(),
        nsu_transacao="NSU_TEST_2026_001",
        placa="ABC1D23",
        cpf_motorista="12345678900",
        nome_motorista="Motorista Teste",
        posto_cnpj="12345678000199",
        posto_nome_fantasia="Posto Ipiranga Central",
        tipo_combustivel="GASOLINA",
        quantidade_litros=45.500,
        valor_unitario=5.890,
        valor_total=267.99,
        hodometro=45230.00,
        status_auditoria="APROVADO",
        data_hora_transacao=datetime.now(timezone.utc),
        payload_raw={"raw": "test"}
    )
    assert transacao.nsu_transacao == "NSU_TEST_2026_001"
    assert transacao.placa == "ABC1D23"
    assert float(transacao.quantidade_litros) == 45.500
    assert float(transacao.valor_unitario) == 5.890
    assert float(transacao.valor_total) == 267.99

    alerta = FrotaAlertaCombustivel(
        id_alerta=uuid.uuid4(),
        id_transacao=transacao.id_transacao,
        tipo_anomalia="TANQUE_EXCEDENTE",
        detalhes="Abastecimento de 65L excedeu capacidade máxima de 50L",
        status_resolucao="PENDENTE"
    )
    assert alerta.tipo_anomalia == "TANQUE_EXCEDENTE"
    assert alerta.status_resolucao == "PENDENTE"

import re
import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, Response
import httpx
import pytest
from pydantic import TypeAdapter
from sqlalchemy.exc import OperationalError

from backend.app.api.v1.endpoints import valecard as valecard_ep
from backend.app.core.valecard.client_base import ValeCardAPIError, ValeCardBaseClient
from backend.app.schemas.valecard import (
    AlterarLimiteRequest,
    FrotaAlertaCombustivelResponse,
    ResolverAlertaRequest,
    SincronizacaoEstornosRequest,
    SincronizacaoFaturamentoRequest,
    ValeCardAlteracaoLimiteResponse,
    ValeCardCartaoResponse,
    ValeCardEstornoResponse,
    ValeCardFaturamentoResponse,
    ValeCardKPIsResponse,
    ValeCardMotoristaResponse,
    ValeCardResponsavelResponse,
    ValeCardSolicitacaoCartaoResponse,
    ValeCardTransacaoResponse,
    ValeCardVeiculoResponse,
    ValeCardVinculoResponse,
)
from backend.app.services.valecard.faturamento_service import ValeCardFaturamentoService


def _run_mocked_coro(coro):
    """Executa corrotina puramente mockada (sem I/O de rede real) sem depender de socketpair do SO."""
    try:
        coro.send(None)
    except StopIteration as exc:
        return exc.value
    raise AssertionError("Corrotina suspendeu inesperadamente em chamada assíncrona não mockada.")


def test_valecard_client_requires_token():
    client = ValeCardBaseClient(
        base_url="https://kissapi.valecard.com.br/core/services/frotaCliente",
        token="",
        max_retries=0,
    )
    with pytest.raises(ValeCardAPIError) as exc:
        _run_mocked_coro(client.post("buscartransacoesfrota", {"contratoCliente": "000000"}))
    assert exc.value.status_code == 401
    assert "VALECARD_API_TOKEN" in str(exc.value)


def test_faturamento_and_estorno_urls_not_duplicated():
    assert ValeCardFaturamentoService.ENDPOINT_FATURAMENTO == "buscarDadosFaturamento"
    assert ValeCardFaturamentoService.ENDPOINT_ESTORNO == "buscarEstorno"

    captured_urls = []

    async def fake_request(method, url, json=None, params=None):
        captured_urls.append(url)
        return httpx.Response(
            status_code=200,
            json=[],
            request=httpx.Request(method, url),
        )

    mock_http_client = MagicMock()
    mock_http_client.is_closed = False
    mock_http_client.request = AsyncMock(side_effect=fake_request)
    mock_db = MagicMock()

    with patch("backend.app.core.valecard.client_base.settings.VALECARD_API_TOKEN", "test-token"), \
         patch("httpx.AsyncClient", return_value=mock_http_client):
        _run_mocked_coro(
            ValeCardFaturamentoService.conciliar_faturamento(
                db=mock_db,
                dados=SincronizacaoFaturamentoRequest(
                    data_inicio=date(2026, 10, 1),
                    data_fim=date(2026, 10, 15),
                    numero_titulo="NF-TESTE",
                ),
            )
        )
        _run_mocked_coro(
            ValeCardFaturamentoService.sincronizar_estornos(
                db=mock_db,
                dados=SincronizacaoEstornosRequest(
                    data_inicial=date(2026, 10, 1),
                    data_final=date(2026, 10, 15),
                ),
            )
        )

    assert len(captured_urls) == 2
    assert captured_urls[0].endswith("/core/services/frotaCliente/buscarDadosFaturamento")
    assert captured_urls[1].endswith("/core/services/frotaCliente/buscarEstorno")
    assert "/core/services/frotaCliente/core/services/" not in captured_urls[0]
    assert "/core/services/frotaCliente/core/services/" not in captured_urls[1]


def test_valecard_request_schemas_match_frontend_contracts():
    alerta_req = ResolverAlertaRequest(
        status_resolucao="CONFIRMADO_FRAUDE",
        justificativa_gestor="Volume incompatível com capacidade física do tanque.",
        resolvido_por=None,
    )
    assert alerta_req.status_resolucao == "CONFIRMADO_FRAUDE"

    limite_req = AlterarLimiteRequest(
        placa="VLC0A01",
        numero_cartao="6035000011112222",
        tipo_operacao="aumentar",
        valor_alteracao=Decimal("250.00"),
        motivo="Reforço emergencial de rota interestadual",
    )
    assert limite_req.valor_alteracao == Decimal("250.00")
    assert uuid.uuid4()


def _make_broken_db():
    mock_db = MagicMock()
    err = OperationalError("SELECT 1", {}, Exception("ENOTFOUND tenant/user postgres.test not found"))
    mock_db.query.side_effect = err
    mock_db.execute.side_effect = err
    return mock_db


@pytest.mark.parametrize(
    "caller",
    [
        lambda r, db: valecard_ep.obter_kpis(response=r, db=db, data_inicio=None, data_fim=None),
        lambda r, db: valecard_ep.listar_transacoes(response=r, db=db, skip=0, limit=100, placa=None, cpf_motorista=None, status_auditoria=None, data_inicio=None, data_fim=None),
        lambda r, db: valecard_ep.obter_transacao(response=r, id_transacao=uuid.uuid4(), db=db),
        lambda r, db: valecard_ep.listar_alertas(response=r, db=db, skip=0, limit=200, status_resolucao="PENDENTE"),
        lambda r, db: valecard_ep.listar_cartoes(response=r, db=db, skip=0, limit=100, placa=None, status_cartao=None, numero_cartao=None),
        lambda r, db: valecard_ep.listar_solicitacoes_2via(response=r, db=db, skip=0, limit=50, placa=None),
        lambda r, db: valecard_ep.listar_historico_limites(response=r, db=db, skip=0, limit=20, placa=None, tipo_operacao=None),
        lambda r, db: valecard_ep.listar_motoristas(response=r, db=db, skip=0, limit=20, cpf=None, matricula=None, status_motorista=None, somente_com_tecnico=False),
        lambda r, db: valecard_ep.listar_veiculos(response=r, db=db, skip=0, limit=200, placa=None, status_valecard=None, somente_bloqueados=False),
        lambda r, db: valecard_ep.listar_vinculos(response=r, db=db, skip=0, limit=20, placa=None, matricula=None, status_vinculo=None),
        lambda r, db: valecard_ep.listar_responsaveis(response=r, db=db, skip=0, limit=20, cpf=None, matricula=None, termo=None),
        lambda r, db: valecard_ep.listar_faturamentos(response=r, db=db, skip=0, limit=20, numero_titulo=None, status_faturamento=None, data_inicio=None, data_fim=None),
        lambda r, db: valecard_ep.listar_estornos(response=r, db=db, skip=0, limit=20, placa=None, nsu=None),
    ],
)
def test_valecard_get_routes_return_503_on_db_error(caller):
    res = Response()
    with pytest.raises(HTTPException) as exc:
        caller(res, _make_broken_db())
    assert exc.value.status_code == 503
    assert "Supabase" in exc.value.detail
    assert "ENOTFOUND" in exc.value.detail
    assert "password" not in exc.value.detail.lower()


def test_valecard_status_conexao_reports_db_offline_without_leaking_secrets():
    body = valecard_ep.obter_status_conexao(db=_make_broken_db())
    assert body["banco_conectado"] is False
    assert "ENOTFOUND" in (body["banco_erro"] or "")
    assert "password" not in str(body).lower()


def test_valecard_post_sync_returns_semantic_503_on_db_error():
    with pytest.raises(HTTPException) as exc:
        _run_mocked_coro(valecard_ep.sincronizar_transacoes(payload=None, db=_make_broken_db()))
    assert exc.value.status_code == 503
    assert "Supabase" in exc.value.detail


def test_v5_seed_columns_match_v2_schema():
    with open("db/migrations/V2__valecard_estrutura_tabelas.sql", encoding="utf-8") as f:
        v2_sql = f.read()
    with open("db/migrations/V5__valecard_seed_contingencia.sql", encoding="utf-8") as f:
        v5_sql = f.read()

    v2_tables = {}
    for table_name, body in re.findall(r"CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\((.*?)\);", v2_sql, re.S):
        cols = {
            line.strip().split()[0]
            for line in body.splitlines()
            if line.strip()
            and not line.strip().startswith("--")
            and not line.strip().startswith("CONSTRAINT")
            and not line.strip().startswith(")")
        }
        v2_tables[table_name] = cols

    inserts = re.findall(r"INSERT INTO\s+(\w+)\s*\((.*?)\)\s*(?:VALUES|SELECT)", v5_sql, re.S)
    assert len(inserts) >= 5
    for table_name, cols_block in inserts:
        assert table_name in v2_tables, f"Tabela {table_name} ausente em V2"
        insert_cols = [c.strip() for c in cols_block.split(",") if c.strip()]
        for col in insert_cols:
            assert col in v2_tables[table_name], f"Coluna {col} de V5 não existe em V2.{table_name}"


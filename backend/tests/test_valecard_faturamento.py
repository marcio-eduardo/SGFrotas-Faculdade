import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.valecard import (
    ValeCardFaturamento,
    ValeCardFaturamentoItem,
    ValeCardEstorno,
    ValeCardTransacao
)
from backend.app.services.valecard.faturamento_service import ValeCardFaturamentoService
from backend.app.schemas.valecard import (
    SincronizacaoFaturamentoRequest,
    SincronizacaoEstornosRequest
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


def test_faturamento_helpers():
    assert ValeCardFaturamentoService._normalize_placa("xyz-9988") == "XYZ9988"
    assert ValeCardFaturamentoService._normalize_placa("") == ""

    assert ValeCardFaturamentoService._parse_decimal("R$ 150,50") == Decimal("150.50")
    assert ValeCardFaturamentoService._parse_decimal("1200.75") == Decimal("1200.75")
    assert ValeCardFaturamentoService._parse_decimal(None) == Decimal("0.00")

    dt = ValeCardFaturamentoService._parse_datetime("2026-10-14 15:30:00")
    assert dt.year == 2026
    assert dt.month == 10


@pytest.mark.asyncio
async def test_conciliar_faturamento_mocked(db_session):
    test_titulo = f"NF-{str(uuid.uuid4().int)[:6]}"
    test_placa = f"FAT{uuid.uuid4().hex[:4].upper()}"

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {
                "DATA": "2026-10-01 10:00:00",
                "MOTORISTA": "Condutor Faturado",
                "NUMERO FROTA": "F01",
                "PLACA": test_placa,
                "MODELO": "Strada 1.3",
                "HODOMETRO": "45000",
                "NOME FANTASIA": "Posto Shell Central",
                "ESTADO": "SP",
                "CIDADE": "São Paulo",
                "PRODUTO": "GASOLINA COMUM",
                "QUANTIDADE": "40.000",
                "VALOR UNITARIO": "5.500",
                "VALOR TOTAL": "220.00",
                "NUMERO TITULO": test_titulo,
                "VALOR LIQUIDO": "220.00"
            }
        ],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarDadosFaturamento")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = SincronizacaoFaturamentoRequest(
            data_inicio=date(2026, 10, 1),
            data_fim=date(2026, 10, 15),
            numero_titulo=test_titulo
        )

        res = await ValeCardFaturamentoService.conciliar_faturamento(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.numero_titulo == test_titulo
        assert res.total_itens_processados == 1
        assert res.valor_total_transacoes == Decimal("220.00")
        assert res.divergencia_contabil == Decimal("0.00")
        assert res.status_faturamento == "FECHADO"

        fat = db_session.query(ValeCardFaturamento).filter(ValeCardFaturamento.numero_titulo == test_titulo).first()
        assert fat is not None
        assert fat.total_transacoes == 1
        assert len(fat.itens) == 1
        assert fat.itens[0].placa == test_placa
        assert fat.itens[0].valor_total == Decimal("220.00")

        # Limpeza
        db_session.delete(fat)
        db_session.commit()


@pytest.mark.asyncio
async def test_conciliar_faturamento_divergente_mocked(db_session):
    test_titulo = f"DIV-{str(uuid.uuid4().int)[:6]}"
    test_placa = f"DIV{uuid.uuid4().hex[:4].upper()}"

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {
                "DATA": "2026-10-02 12:00:00",
                "MOTORISTA": "Condutor Teste",
                "PLACA": test_placa,
                "PRODUTO": "DIESEL S10",
                "QUANTIDADE": "50.000",
                "VALOR UNITARIO": "6.000",
                "VALOR TOTAL": "300.00",
                "NUMERO TITULO": test_titulo,
                "VALOR LIQUIDO": "350.00" # Divergência de R$ 50,00
            }
        ],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarDadosFaturamento")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = SincronizacaoFaturamentoRequest(
            data_inicio=date(2026, 10, 1),
            data_fim=date(2026, 10, 15),
            numero_titulo=test_titulo
        )

        res = await ValeCardFaturamentoService.conciliar_faturamento(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.status_faturamento == "DIVERGENTE"
        assert res.divergencia_contabil == Decimal("-50.00")

        fat = db_session.query(ValeCardFaturamento).filter(ValeCardFaturamento.numero_titulo == test_titulo).first()
        assert fat is not None
        assert fat.status_faturamento == "DIVERGENTE"

        # Limpeza
        db_session.delete(fat)
        db_session.commit()


@pytest.mark.asyncio
async def test_conciliar_faturamento_retorno_vazio(db_session):
    mock_resp = httpx.Response(
        status_code=200,
        json=[],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarDadosFaturamento")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = SincronizacaoFaturamentoRequest(
            data_inicio=date(2026, 9, 1),
            data_fim=date(2026, 9, 15)
        )

        res = await ValeCardFaturamentoService.conciliar_faturamento(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.total_itens_processados == 0
        assert res.status_faturamento == "FECHADO"


@pytest.mark.asyncio
async def test_conciliar_faturamento_validacoes(db_session):
    # Data início posterior à data fim
    with pytest.raises(ValueError, match="início não pode ser maior"):
        await ValeCardFaturamentoService.conciliar_faturamento(
            db=db_session,
            dados=SincronizacaoFaturamentoRequest(
                data_inicio=date(2026, 10, 15),
                data_fim=date(2026, 10, 1)
            )
        )


def test_listar_faturamentos(db_session):
    test_titulo = f"LST-{str(uuid.uuid4().int)[:6]}"

    fat = ValeCardFaturamento(
        numero_titulo=test_titulo,
        data_inicio=date(2026, 8, 1),
        data_fim=date(2026, 8, 15),
        valor_liquido=Decimal("500.00"),
        valor_total_transacoes=Decimal("500.00"),
        divergencia_contabil=Decimal("0.00"),
        total_transacoes=2,
        status_faturamento="FECHADO"
    )
    db_session.add(fat)
    db_session.commit()

    lista = ValeCardFaturamentoService.listar_faturamentos(db=db_session, numero_titulo=test_titulo)
    assert len(lista) == 1
    assert lista[0].numero_titulo == test_titulo

    lista_status = ValeCardFaturamentoService.listar_faturamentos(db=db_session, status="FECHADO")
    assert any(x.numero_titulo == test_titulo for x in lista_status)

    # Limpeza
    db_session.delete(fat)
    db_session.commit()


@pytest.mark.asyncio
async def test_sincronizar_estornos_mocked(db_session):
    test_nsu = f"NSU{str(uuid.uuid4().int)[:8]}"
    test_placa = f"EST{uuid.uuid4().hex[:4].upper()}"

    # Criar transação original na base
    trans_orig = ValeCardTransacao(
        nsu_transacao=test_nsu,
        placa=test_placa,
        data_hora_transacao=datetime(2026, 9, 10, 14, 0, tzinfo=timezone.utc),
        quantidade_litros=Decimal("35.000"),
        valor_unitario=Decimal("5.200"),
        valor_total=Decimal("182.00")
    )
    db_session.add(trans_orig)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {
                "ID": test_nsu,
                "DATA ESTORNO": "2026-09-11 16:30:00",
                "DATA TRANSACAO": "2026-09-10 14:00:00",
                "PLACA": test_placa,
                "MODELO": "Gol 1.0",
                "MOTORISTA": "Condutor Estornado",
                "PRODUTO": "GASOLINA",
                "QUANTIDADE": "35.000",
                "VALOR UNITARIO": "5.200",
                "VALOR TOTAL": "182.00",
                "HODOMETRO": "52000",
                "NOME FANTASIA": "Posto Ipiranga",
                "TERMINAL": "TERM-01"
            }
        ],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarEstorno")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = SincronizacaoEstornosRequest(
            data_inicial=date(2026, 9, 1),
            data_final=date(2026, 9, 30)
        )

        res = await ValeCardFaturamentoService.sincronizar_estornos(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.total_estornos_inseridos == 1
        assert res.total_transacoes_vinculadas == 1

        est = db_session.query(ValeCardEstorno).filter(ValeCardEstorno.nsu_transacao == test_nsu).first()
        assert est is not None
        assert est.placa == test_placa
        assert est.id_transacao == trans_orig.id_transacao
        assert est.valor_total == Decimal("182.00")

        # Limpeza
        db_session.delete(est)
        db_session.delete(trans_orig)
        db_session.commit()


@pytest.mark.asyncio
async def test_sincronizar_estornos_intervalo_invalido(db_session):
    # Intervalo superior a 91 dias (Regra oficial ValeCard PDF 10)
    with pytest.raises(ValueError, match="limite máximo permitido de 91 dias"):
        await ValeCardFaturamentoService.sincronizar_estornos(
            db=db_session,
            dados=SincronizacaoEstornosRequest(
                data_inicial=date(2026, 1, 1),
                data_final=date(2026, 5, 1) # ~120 dias
            )
        )

    # Data inicial posterior à data final
    with pytest.raises(ValueError, match="inicial não pode ser superior"):
        await ValeCardFaturamentoService.sincronizar_estornos(
            db=db_session,
            dados=SincronizacaoEstornosRequest(
                data_inicial=date(2026, 10, 20),
                data_final=date(2026, 10, 10)
            )
        )


def test_listar_estornos(db_session):
    test_nsu = f"NSU{str(uuid.uuid4().int)[:8]}"
    test_placa = f"LST{uuid.uuid4().hex[:4].upper()}"

    est = ValeCardEstorno(
        nsu_transacao=test_nsu,
        placa=test_placa,
        data_estorno=datetime(2026, 8, 10, tzinfo=timezone.utc),
        data_transacao=datetime(2026, 8, 9, tzinfo=timezone.utc),
        quantidade_litros=Decimal("20.000"),
        valor_unitario=Decimal("5.000"),
        valor_total=Decimal("100.00")
    )
    db_session.add(est)
    db_session.commit()

    lista = ValeCardFaturamentoService.listar_estornos(db=db_session, placa=test_placa)
    assert len(lista) == 1
    assert lista[0].placa == test_placa

    lista_nsu = ValeCardFaturamentoService.listar_estornos(db=db_session, nsu=test_nsu)
    assert len(lista_nsu) == 1

    # Limpeza
    db_session.delete(est)
    db_session.commit()

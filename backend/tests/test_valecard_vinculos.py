import pytest
from datetime import date
import uuid
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.models.valecard import ValeCardVinculo, ValeCardResponsavel
from backend.app.models.veiculo import Veiculo
from backend.app.services.valecard.vinculos_service import ValeCardVinculosService
from backend.app.schemas.valecard import (
    VincularMotoristaRequest,
    ValeCardVinculoItem,
    CadastrarResponsavelRequest
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


def test_vinculos_helpers():
    assert ValeCardVinculosService._normalize_placa("abc-1234") == "ABC1234"
    assert ValeCardVinculosService._normalize_placa("BRA2E19") == "BRA2E19"
    assert ValeCardVinculosService._normalize_placa("") == ""

    assert ValeCardVinculosService._clean_numeric("123.456.789-00") == "12345678900"
    assert ValeCardVinculosService._clean_numeric("04101-000") == "04101000"
    assert ValeCardVinculosService._clean_numeric("(11) 98765-4321") == "11987654321"
    assert ValeCardVinculosService._clean_numeric(None) == ""


@pytest.mark.asyncio
async def test_processar_vinculos_vincular_mocked(db_session):
    test_placa = f"VNC{uuid.uuid4().hex[:4].upper()}"
    test_mat = f"MAT{str(uuid.uuid4().int)[:6]}"

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {
                "matriculaMotorista": test_mat,
                "mensagem": "Ação realizada com sucesso",
                "placa": test_placa
            }
        ],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarBasedeCartoes")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = VincularMotoristaRequest(
            vinculos=[
                ValeCardVinculoItem(
                    placa=test_placa,
                    matricula_motorista=[test_mat],
                    operacao="V"
                )
            ],
            motivo="Alocação de veículo em projeto"
        )

        res = await ValeCardVinculosService.processar_vinculos(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.total_processados == 1
        assert res.total_sucesso == 1
        assert res.total_falhas == 0

        vinc = db_session.query(ValeCardVinculo).filter(
            ValeCardVinculo.placa == test_placa,
            ValeCardVinculo.matricula_motorista == test_mat
        ).first()

        assert vinc is not None
        assert vinc.operacao == "V"
        assert vinc.status_vinculo == "ATIVO"
        assert vinc.sucesso is True
        assert vinc.motivo == "Alocação de veículo em projeto"

        # Limpeza
        db_session.delete(vinc)
        db_session.commit()


@pytest.mark.asyncio
async def test_processar_desvinculo_mocked(db_session):
    test_placa = f"DSV{uuid.uuid4().hex[:4].upper()}"
    test_mat = f"MAT{str(uuid.uuid4().int)[:6]}"

    # Criar vínculo ativo prévio
    vinc_antigo = ValeCardVinculo(
        placa=test_placa,
        matricula_motorista=test_mat,
        operacao="V",
        status_vinculo="ATIVO",
        sucesso=True,
        motivo="Vínculo original"
    )
    db_session.add(vinc_antigo)
    db_session.commit()

    mock_resp = httpx.Response(
        status_code=200,
        json=[
            {
                "matriculaMotorista": test_mat,
                "mensagem": "Ação realizada com sucesso",
                "placa": test_placa
            }
        ],
        request=httpx.Request("POST", "https://mock.valecard.test/buscarBasedeCartoes")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = VincularMotoristaRequest(
            vinculos=[
                ValeCardVinculoItem(
                    placa=test_placa,
                    matricula_motorista=[test_mat],
                    operacao="D"
                )
            ],
            motivo="Devolução de veículo"
        )

        res = await ValeCardVinculosService.processar_vinculos(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.total_sucesso == 1

        # Verificar que o antigo foi marcado como DESVINCULADO
        db_session.refresh(vinc_antigo)
        assert vinc_antigo.status_vinculo == "DESVINCULADO"

        # Limpeza
        db_session.query(ValeCardVinculo).filter(ValeCardVinculo.placa == test_placa).delete()
        db_session.commit()


@pytest.mark.asyncio
async def test_processar_vinculos_falha_webservice(db_session):
    test_placa = f"FLH{uuid.uuid4().hex[:4].upper()}"
    test_mat = f"MAT{str(uuid.uuid4().int)[:6]}"

    with patch("httpx.AsyncClient.request", side_effect=Exception("Timeout no gateway ValeCard")):
        req = VincularMotoristaRequest(
            vinculos=[
                ValeCardVinculoItem(
                    placa=test_placa,
                    matricula_motorista=[test_mat],
                    operacao="V"
                )
            ]
        )

        res = await ValeCardVinculosService.processar_vinculos(db=db_session, dados=req)
        assert res.sucesso is False
        assert res.total_falhas == 1

        vinc = db_session.query(ValeCardVinculo).filter(
            ValeCardVinculo.placa == test_placa,
            ValeCardVinculo.matricula_motorista == test_mat
        ).first()

        assert vinc is not None
        assert vinc.status_vinculo == "FALHA"
        assert vinc.sucesso is False

        # Limpeza
        db_session.delete(vinc)
        db_session.commit()


@pytest.mark.asyncio
async def test_processar_vinculos_validacoes(db_session):
    # Lista vazia
    with pytest.raises(ValueError, match="vazia"):
        await ValeCardVinculosService.processar_vinculos(
            db=db_session,
            dados=VincularMotoristaRequest(vinculos=[])
        )

    # Placa inválida
    with pytest.raises(ValueError, match="Placa inválida"):
        await ValeCardVinculosService.processar_vinculos(
            db=db_session,
            dados=VincularMotoristaRequest(
                vinculos=[ValeCardVinculoItem(placa="ABC", matricula_motorista=["123"], operacao="V")]
            )
        )

    # Operação inválida
    with pytest.raises(ValueError, match="Operação inválida"):
        await ValeCardVinculosService.processar_vinculos(
            db=db_session,
            dados=VincularMotoristaRequest(
                vinculos=[ValeCardVinculoItem(placa="ABC1234", matricula_motorista=["123"], operacao="X")]
            )
        )


def test_listar_vinculos(db_session):
    test_placa = f"LST{uuid.uuid4().hex[:4].upper()}"
    test_mat = f"MAT{str(uuid.uuid4().int)[:6]}"

    v1 = ValeCardVinculo(
        placa=test_placa,
        matricula_motorista=test_mat,
        operacao="V",
        status_vinculo="ATIVO",
        sucesso=True
    )
    db_session.add(v1)
    db_session.commit()

    lista = ValeCardVinculosService.listar_vinculos(db=db_session, placa=test_placa)
    assert len(lista) >= 1
    assert lista[0].placa == test_placa

    lista_mat = ValeCardVinculosService.listar_vinculos(db=db_session, matricula=test_mat)
    assert len(lista_mat) >= 1

    lista_status = ValeCardVinculosService.listar_vinculos(db=db_session, status="ATIVO")
    assert any(x.placa == test_placa for x in lista_status)

    # Limpeza
    db_session.delete(v1)
    db_session.commit()


@pytest.mark.asyncio
async def test_cadastrar_responsavel_mocked(db_session):
    # Gerar CPF numérico estrito de 11 dígitos
    test_cpf = f"99{str(uuid.uuid4().int)[:9]}"
    test_mat = f"RESP{str(uuid.uuid4().int)[:5]}"

    mock_resp = httpx.Response(
        status_code=200,
        json={"mensagem": "Responsável cadastrado com sucesso"},
        request=httpx.Request("POST", "https://mock.valecard.test/cadastrarResponsavel")
    )

    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_req.return_value = mock_resp

        req = CadastrarResponsavelRequest(
            nome_responsavel="Carlos Gestor Frota",
            matricula=test_mat,
            cpf=test_cpf,
            rg="12.345.678-9",
            data_nascimento=date(1985, 6, 15),
            telefone="11988887777",
            email="carlos.gestor@empresa.com.br",
            cep="04101-000",
            tipo_logradouro="Avenida",
            logradouro="Paulista",
            numero="1000",
            complemento="Andar 12",
            bairro="Bela Vista",
            cidade="São Paulo",
            estado="SP"
        )

        res = await ValeCardVinculosService.cadastrar_responsavel(db=db_session, dados=req)
        assert res.sucesso is True
        assert res.matricula == test_mat
        assert res.cpf == test_cpf
        assert res.nome_responsavel == "Carlos Gestor Frota"

        resp = db_session.query(ValeCardResponsavel).filter(ValeCardResponsavel.cpf == test_cpf).first()
        assert resp is not None
        assert resp.cidade == "São Paulo"
        assert resp.cep == "04101000"
        assert resp.telefone == "11988887777"
        assert resp.status_cadastro == "CADASTRADO"

        # Testar atualização idempotente do mesmo responsável
        req.nome_responsavel = "Carlos Gestor Frota Junior"
        res_up = await ValeCardVinculosService.cadastrar_responsavel(db=db_session, dados=req)
        assert res_up.sucesso is True

        db_session.refresh(resp)
        assert resp.nome_responsavel == "Carlos Gestor Frota Junior"

        # Limpeza
        db_session.delete(resp)
        db_session.commit()


@pytest.mark.asyncio
async def test_cadastrar_responsavel_validacoes(db_session):
    # CPF inválido
    with pytest.raises(ValueError, match="CPF inválido"):
        await ValeCardVinculosService.cadastrar_responsavel(
            db=db_session,
            dados=CadastrarResponsavelRequest(
                nome_responsavel="Teste",
                matricula="123",
                cpf="123", # < 11
                rg="123",
                data_nascimento=date(1990, 1, 1),
                telefone="11999998888",
                email="teste@teste.com",
                cep="01001000",
                tipo_logradouro="Rua",
                logradouro="Teste",
                numero="1",
                bairro="Centro",
                cidade="SP",
                estado="SP"
            )
        )

    # CEP inválido
    with pytest.raises(ValueError, match="CEP inválido"):
        await ValeCardVinculosService.cadastrar_responsavel(
            db=db_session,
            dados=CadastrarResponsavelRequest(
                nome_responsavel="Teste",
                matricula="123",
                cpf="12345678901",
                rg="123",
                data_nascimento=date(1990, 1, 1),
                telefone="11999998888",
                email="teste@teste.com",
                cep="01001", # < 8
                tipo_logradouro="Rua",
                logradouro="Teste",
                numero="1",
                bairro="Centro",
                cidade="SP",
                estado="SP"
            )
        )

    # Telefone inválido
    with pytest.raises(ValueError, match="Telefone inválido"):
        await ValeCardVinculosService.cadastrar_responsavel(
            db=db_session,
            dados=CadastrarResponsavelRequest(
                nome_responsavel="Teste",
                matricula="123",
                cpf="12345678901",
                rg="123",
                data_nascimento=date(1990, 1, 1),
                telefone="123", # < 10
                email="teste@teste.com",
                cep="01001000",
                tipo_logradouro="Rua",
                logradouro="Teste",
                numero="1",
                bairro="Centro",
                cidade="SP",
                estado="SP"
            )
        )


def test_listar_responsaveis(db_session):
    test_cpf = f"99{str(uuid.uuid4().int)[:9]}"
    test_mat = f"RSP{str(uuid.uuid4().int)[:5]}"

    r = ValeCardResponsavel(
        nome_responsavel="Maria Gestora Central",
        matricula=test_mat,
        cpf=test_cpf,
        rg="98.765.432-1",
        data_nascimento=date(1982, 3, 20),
        telefone="21977776666",
        email="gestora.frota@velocetech.com.br",
        cep="20000000",
        tipo_logradouro="Rua",
        logradouro="Rio Branco",
        numero="500",
        bairro="Centro",
        cidade="Rio de Janeiro",
        estado="RJ"
    )
    db_session.add(r)
    db_session.commit()

    lista = ValeCardVinculosService.listar_responsaveis(db=db_session, cpf=test_cpf)
    assert len(lista) == 1
    assert lista[0].cpf == test_cpf

    lista_mat = ValeCardVinculosService.listar_responsaveis(db=db_session, matricula=test_mat)
    assert len(lista_mat) == 1

    lista_termo = ValeCardVinculosService.listar_responsaveis(db=db_session, termo="Gestora")
    assert any(x.cpf == test_cpf for x in lista_termo)

    # Limpeza
    db_session.delete(r)
    db_session.commit()

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardVeiculo
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.valecard import (
    CadastrarVeiculoValeCardRequest,
    CadastrarVeiculoValeCardResponse,
    AtualizarVeiculoValeCardRequest,
    AtualizarVeiculoValeCardResponse,
    BloqueioAbastecimentoRequest,
    BloqueioAbastecimentoResponse
)

logger = logging.getLogger("valecard.veiculos")


class ValeCardVeiculosService:
    """
    Serviço para sincronização, cadastro e bloqueio preventivo de veículos na ValeCard
    (PDFs: 06 - cadastrarveiculos e 07 - atualizarveiculos).
    """

    @staticmethod
    def _normalize_placa(placa: Any) -> str:
        if not placa:
            return ""
        return re.sub(r"[^A-Za-z0-9]", "", str(placa)).upper()

    @staticmethod
    def _map_status(codigo: str) -> Tuple[str, bool]:
        """
        Retorna (status_valecard, bloqueio_abastecimento).
        1: Ativo (desbloqueado)
        2: Inativo (bloqueado)
        10: Fora de Uso (bloqueado por manutenção/sinistro)
        12: Emprestado (desbloqueado)
        """
        c = str(codigo).strip()
        if c == "1":
            return "ATIVO", False
        if c == "2":
            return "INATIVO", True
        if c == "10":
            return "FORA_DE_USO", True
        if c == "12":
            return "EMPRESTADO", False
        return "ATIVO", False

    @classmethod
    async def cadastrar_veiculo(
        cls,
        db: Session,
        dados: CadastrarVeiculoValeCardRequest
    ) -> CadastrarVeiculoValeCardResponse:
        """
        Cadastra um veículo da frota no webservice da ValeCard (06 - cadastrarVeiculoFrota).
        """
        placa_norm = cls._normalize_placa(dados.placa)
        if len(placa_norm) < 7:
            raise ValueError(f"Placa inválida: '{dados.placa}'. Informe ao menos 7 caracteres alfanuméricos.")

        veiculo = db.query(Veiculo).filter(
            func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
        ).first()

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        cod_status = dados.codigo_status or "1"
        status_desc, is_bloqueado = cls._map_status(cod_status)

        renavam = dados.renavam or (veiculo.renavam if veiculo else "000000000")
        chassi = dados.chassi or (veiculo.chassi if veiculo else None)
        hodometro = dados.hodometro or (veiculo.hodometro_atual if veiculo else Decimal("0.00"))
        valor_aq = dados.valor_aquisicao or Decimal("0.00")

        # Payload esperado pela API cadastrarVeiculoFrota (PDF 06)
        veiculo_dto = {
            "id": None,
            "codigoStatus": str(cod_status),
            "filial": "302",
            "placa": placa_norm,
            "codigo": "18",
            "codigoModelo": "2909",
            "codigoCentroResultado": "1302612",
            "codigoResponsavel": "100955",
            "cor": dados.cor or "BRANCO",
            "ano": str(dados.ano or (veiculo.ano if veiculo else 2026)),
            "ufVeiculo": dados.uf or "SP",
            "codigoCentroCusto": "134306",
            "propriedade": dados.propriedade or "LEASING",
            "renavam": renavam,
            "codigoFilial": "274423",
            "qtdDigitosHodometro": "4",
            "valorAquisicao": f"{valor_aq:.2f}".replace(".", ","),
            "hodometro": str(int(hodometro)),
            "modeloVeiculoCliente": "2909",
            "nrChassi": chassi,
            "combustivel": dados.combustivel or "FLEX"
        }

        payload = {
            "contratoCliente": str(contrato),
            "veiculoDto": veiculo_dto
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("cadastrarVeiculoFrota", payload)

        # Atualiza ou cria o espelho local em tb_valecard_veiculos
        valecard_veic = db.query(ValeCardVeiculo).filter(ValeCardVeiculo.placa == placa_norm).first()
        is_new = False
        if not valecard_veic:
            valecard_veic = ValeCardVeiculo(placa=placa_norm)
            is_new = True

        valecard_veic.id_veiculo = veiculo.id_veiculo if veiculo else None
        valecard_veic.codigo_status = str(cod_status)
        valecard_veic.status_valecard = status_desc
        valecard_veic.bloqueio_abastecimento = is_bloqueado
        valecard_veic.hodometro_cadastrado = hodometro
        valecard_veic.valor_aquisicao = valor_aq
        valecard_veic.codigo_filial = "274423"
        valecard_veic.codigo_centro_custo = "134306"
        valecard_veic.codigo_centro_resultado = "1302612"
        valecard_veic.propriedade = dados.propriedade or "LEASING"
        valecard_veic.payload_cadastro = resp_valecard
        valecard_veic.sincronizado_em = datetime.now(timezone.utc)

        if is_new:
            db.add(valecard_veic)

        db.commit()
        db.refresh(valecard_veic)

        msg = "Veículo cadastrado com sucesso na ValeCard."
        if isinstance(resp_valecard, dict) and "mensagem" in resp_valecard:
            msg = str(resp_valecard["mensagem"])

        return CadastrarVeiculoValeCardResponse(
            sucesso=True,
            mensagem=msg,
            id_valecard_veiculo=valecard_veic.id_valecard_veiculo,
            placa=placa_norm,
            status_valecard=status_desc
        )

    @classmethod
    async def atualizar_veiculo(
        cls,
        db: Session,
        dados: AtualizarVeiculoValeCardRequest
    ) -> AtualizarVeiculoValeCardResponse:
        """
        Atualiza dados cadastrais ou status de veículo na ValeCard (07 - atualizarVeiculoFrota).
        """
        placa_norm = cls._normalize_placa(dados.placa)
        if not placa_norm:
            raise ValueError("A placa do veículo é obrigatória para atualização.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        veiculo_dto: Dict[str, Any] = {
            "id": None,
            "placa": placa_norm
        }

        if dados.codigo_status:
            veiculo_dto["codigoStatus"] = str(dados.codigo_status)
        if dados.hodometro is not None:
            veiculo_dto["hodometro"] = str(int(dados.hodometro))
        if dados.cor:
            veiculo_dto["cor"] = dados.cor.strip().upper()
        if dados.combustivel:
            veiculo_dto["combustivel"] = dados.combustivel.strip().upper()

        payload = {
            "contratoCliente": str(contrato),
            "veiculoDto": veiculo_dto
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("atualizarVeiculoFrota", payload)

        valecard_veic = db.query(ValeCardVeiculo).filter(ValeCardVeiculo.placa == placa_norm).first()
        if valecard_veic:
            if dados.codigo_status:
                status_desc, is_bloqueado = cls._map_status(dados.codigo_status)
                valecard_veic.codigo_status = str(dados.codigo_status)
                valecard_veic.status_valecard = status_desc
                valecard_veic.bloqueio_abastecimento = is_bloqueado
            if dados.hodometro is not None:
                valecard_veic.hodometro_cadastrado = dados.hodometro

            valecard_veic.payload_atualizacao = resp_valecard
            valecard_veic.updated_at = datetime.now(timezone.utc)
            db.commit()

        msg = "Veículo atualizado com sucesso na ValeCard."
        if isinstance(resp_valecard, dict) and "mensagem" in resp_valecard:
            msg = str(resp_valecard["mensagem"])

        return AtualizarVeiculoValeCardResponse(
            sucesso=True,
            mensagem=msg,
            placa=placa_norm,
            codigo_status=dados.codigo_status
        )

    @classmethod
    async def gerenciar_bloqueio_bomba(
        cls,
        db: Session,
        dados: BloqueioAbastecimentoRequest
    ) -> BloqueioAbastecimentoResponse:
        """
        Bloqueia ou desbloqueia preventivamente o abastecimento de um veículo na bomba (ValeCard).
        Se bloquear: define status '10' (Fora de Uso).
        Se desbloquear: define status '1' (Ativo).
        """
        placa_norm = cls._normalize_placa(dados.placa)
        if not placa_norm:
            raise ValueError("Placa é obrigatória para alteração de bloqueio de bomba.")

        codigo_status = "10" if dados.bloquear else "1"
        contrato = settings.VALECARD_CONTRATO_CLIENTE

        payload = {
            "contratoCliente": str(contrato),
            "veiculoDto": {
                "id": None,
                "placa": placa_norm,
                "codigoStatus": codigo_status
            }
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("atualizarVeiculoFrota", payload)

        # Atualiza a base de dados local
        valecard_veic = db.query(ValeCardVeiculo).filter(ValeCardVeiculo.placa == placa_norm).first()
        if not valecard_veic:
            veiculo = db.query(Veiculo).filter(
                func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
            ).first()
            valecard_veic = ValeCardVeiculo(
                id_veiculo=veiculo.id_veiculo if veiculo else None,
                placa=placa_norm
            )
            db.add(valecard_veic)

        valecard_veic.codigo_status = codigo_status
        valecard_veic.status_valecard = "FORA_DE_USO" if dados.bloquear else "ATIVO"
        valecard_veic.bloqueio_abastecimento = dados.bloquear
        valecard_veic.motivo_bloqueio = dados.motivo if dados.bloquear else None
        valecard_veic.payload_atualizacao = resp_valecard
        valecard_veic.updated_at = datetime.now(timezone.utc)

        db.commit()

        acao = "bloqueado" if dados.bloquear else "desbloqueado"
        return BloqueioAbastecimentoResponse(
            sucesso=True,
            mensagem=f"Veículo {placa_norm} {acao} na bomba ValeCard com sucesso.",
            placa=placa_norm,
            bloqueio_ativo=dados.bloquear,
            codigo_status=codigo_status,
            motivo=dados.motivo
        )

    @staticmethod
    def get_veiculos(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        placa: Optional[str] = None,
        status_valecard: Optional[str] = None,
        somente_bloqueados: bool = False
    ) -> Tuple[List[ValeCardVeiculo], int]:
        query = db.query(ValeCardVeiculo)
        if placa:
            clean_placa = re.sub(r"[^A-Za-z0-9]", "", placa).upper()
            query = query.filter(func.replace(func.upper(ValeCardVeiculo.placa), "-", "").like(f"%{clean_placa}%"))
        if status_valecard:
            query = query.filter(ValeCardVeiculo.status_valecard == status_valecard.upper())
        if somente_bloqueados:
            query = query.filter(ValeCardVeiculo.bloqueio_abastecimento.is_(True))

        total = query.count()
        items = query.order_by(desc(ValeCardVeiculo.created_at)).offset(skip).limit(limit).all()
        return items, total

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardCartao, ValeCardAlteracaoLimite
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.valecard import AlterarLimiteRequest, AlterarLimiteResponse

logger = logging.getLogger("valecard.limites")


class ValeCardLimitesService:
    """
    Serviço para gestão e alteração de limites e saldo de combustível de veículos (01 - alterarlimiteveiculo).
    """

    @staticmethod
    def _normalize_placa(placa: Any) -> str:
        if not placa:
            return ""
        return re.sub(r"[^A-Za-z0-9]", "", str(placa)).upper()

    @staticmethod
    def _normalize_tipo_operacao(tipo: str) -> Tuple[str, str]:
        """
        Retorna (tipo_canonico_db, tipo_api_valecard).
        Opções aceitas: 'aumentar', 'adicionar', 'diminuir', 'alterar'.
        """
        t = str(tipo).strip().lower()
        if t in ("aumentar", "adicionar"):
            return "AUMENTAR", "aumentar"
        if t in ("diminuir", "reduzir"):
            return "DIMINUIR", "diminuir"
        if t in ("alterar", "definir", "setar"):
            return "ALTERAR", "alterar"
        raise ValueError(f"Tipo de alteração inválido: '{tipo}'. Utilize 'aumentar', 'diminuir' ou 'alterar'.")

    @classmethod
    async def alterar_limite(
        cls,
        db: Session,
        dados: AlterarLimiteRequest
    ) -> AlterarLimiteResponse:
        """
        Executa alteração de limite junto à ValeCard e registra trilha de auditoria contábil.
        """
        if not dados.placa and not dados.numero_cartao:
            raise ValueError("Informe ao menos a placa do veículo ou o número do cartão para alterar o limite.")

        if dados.valor_alteracao <= Decimal("0.00"):
            raise ValueError("O valor de alteração deve ser maior que zero.")

        placa_norm = cls._normalize_placa(dados.placa) if dados.placa else ""
        num_cartao = dados.numero_cartao.strip() if dados.numero_cartao else None
        tipo_db, tipo_valecard = cls._normalize_tipo_operacao(dados.tipo_operacao)

        # 1. Localiza cartão e veículo associados na base local
        cartao = None
        if num_cartao:
            cartao = db.query(ValeCardCartao).filter(ValeCardCartao.numero_cartao == num_cartao).first()
        elif placa_norm:
            cartao = db.query(ValeCardCartao).filter(
                func.replace(func.upper(ValeCardCartao.placa), "-", "") == placa_norm
            ).first()

        if cartao:
            placa_norm = placa_norm or cartao.placa
            num_cartao = num_cartao or cartao.numero_cartao

        veiculo = None
        if placa_norm:
            veiculo = db.query(Veiculo).filter(
                func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
            ).first()

        limite_anterior = cartao.limite_atual if cartao else Decimal("0.00")

        # 2. Calcula novo limite projetado
        if tipo_db == "AUMENTAR":
            novo_limite = limite_anterior + dados.valor_alteracao
        elif tipo_db == "DIMINUIR":
            novo_limite = max(Decimal("0.00"), limite_anterior - dados.valor_alteracao)
        else: # ALTERAR
            novo_limite = dados.valor_alteracao

        # 3. Prepara chamada ao webservice ValeCard
        contrato = settings.VALECARD_CONTRATO_CLIENTE
        payload = {
            "contratoCliente": str(contrato),
            "veiculoId": None,
            "placa": placa_norm or None,
            "numeroCartao": num_cartao or None,
            "valorAlteracao": str(dados.valor_alteracao),
            "tipoAlteracao": tipo_valecard,
            "periodo": dados.periodo or "atual",
            "motivo": dados.motivo,
            "modulo": dados.modulo or "abastecimento"
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("alterarLimiteveiculo", payload)

        # 4. Trilha de auditoria persistida
        registro_auditoria = ValeCardAlteracaoLimite(
            id_veiculo=veiculo.id_veiculo if veiculo else (cartao.id_veiculo if cartao else None),
            id_cartao=cartao.id_cartao if cartao else None,
            placa=placa_norm or "N/D",
            numero_cartao=num_cartao,
            tipo_operacao=tipo_db,
            valor_alteracao=dados.valor_alteracao,
            limite_anterior=limite_anterior,
            novo_limite=novo_limite,
            periodo=dados.periodo or "atual",
            modulo=dados.modulo or "abastecimento",
            motivo=dados.motivo,
            solicitado_por=dados.solicitado_por,
            status_operacao="PROCESSADO",
            payload_requisicao=payload,
            payload_resposta=resp_valecard
        )
        db.add(registro_auditoria)

        # 5. Atualização atômica do saldo/limite no cartão cadastrado
        if cartao:
            cartao.limite_atual = novo_limite

        db.commit()
        db.refresh(registro_auditoria)

        msg = "Limite do veículo alterado com sucesso."
        if isinstance(resp_valecard, dict) and "mensagem" in resp_valecard:
            msg = str(resp_valecard["mensagem"])

        return AlterarLimiteResponse(
            sucesso=True,
            mensagem=msg,
            id_alteracao=registro_auditoria.id_alteracao,
            placa=placa_norm,
            numero_cartao=num_cartao,
            tipo_operacao=tipo_db,
            valor_alteracao=dados.valor_alteracao,
            limite_anterior=limite_anterior,
            novo_limite=novo_limite
        )

    @staticmethod
    def get_alteracoes(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        placa: Optional[str] = None,
        tipo_operacao: Optional[str] = None
    ) -> Tuple[List[ValeCardAlteracaoLimite], int]:
        query = db.query(ValeCardAlteracaoLimite)
        if placa:
            clean_placa = re.sub(r"[^A-Za-z0-9]", "", placa).upper()
            query = query.filter(func.replace(func.upper(ValeCardAlteracaoLimite.placa), "-", "").like(f"%{clean_placa}%"))
        if tipo_operacao:
            query = query.filter(ValeCardAlteracaoLimite.tipo_operacao == tipo_operacao.upper())

        total = query.count()
        items = query.order_by(desc(ValeCardAlteracaoLimite.created_at)).offset(skip).limit(limit).all()
        return items, total

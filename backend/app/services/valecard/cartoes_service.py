import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardCartao, ValeCardSolicitacaoCartao
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.valecard import (
    SincronizacaoCartoesResponse,
    Solicitar2ViaCartaoRequest,
    Solicitar2ViaCartaoResponse
)

logger = logging.getLogger("valecard.cartoes")


class ValeCardCartoesService:
    """
    Serviço para gestão da base de cartões da frota e solicitações de 2ª via.
    """

    @staticmethod
    def _clean_str(val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        return s if s else None

    @staticmethod
    def _normalize_placa(placa: Any) -> str:
        if not placa:
            return ""
        return re.sub(r"[^A-Za-z0-9]", "", str(placa)).upper()

    @staticmethod
    def _parse_decimal(val: Any, default: Decimal = Decimal("0.00")) -> Decimal:
        if val is None:
            return default
        if isinstance(val, (int, float, Decimal)):
            try:
                return Decimal(str(val))
            except Exception:
                return default
        try:
            s = str(val).strip().replace("R$", "").replace(" ", "")
            if "," in s:
                s = s.replace(".", "").replace(",", ".")
            return Decimal(s)
        except Exception:
            return default

    @staticmethod
    def _parse_datetime(val: Any) -> Optional[datetime]:
        if isinstance(val, datetime):
            return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        if not val:
            return None
        s = str(val).strip()
        for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None

    @staticmethod
    def _map_status(status_raw: Any) -> str:
        if not status_raw:
            return "ATIVO"
        s = str(status_raw).strip().upper()
        if s in ("A", "ATIVO", "1"):
            return "ATIVO"
        if s in ("B", "BLOQUEADO"):
            return "BLOQUEADO"
        if s in ("C", "CANCELADO"):
            return "CANCELADO"
        if s in ("I", "INATIVO", "0"):
            return "INATIVO"
        return "ATIVO"

    @classmethod
    async def sync_cartoes(
        cls,
        db: Session,
        numero_cartao: Optional[str] = None,
        placa: Optional[str] = None
    ) -> SincronizacaoCartoesResponse:
        """
        Sincroniza a base de cartões via webservice ValeCard (buscarBasedeCartoes).
        """
        client = ValeCardBaseClient()
        contrato = settings.VALECARD_CONTRATO_CLIENTE

        payload = {
            "contratoCliente": str(contrato),
            "numeroCartao": numero_cartao,
            "placa": placa
        }

        async with client:
            res = await client.post("buscarBasedeCartoes", payload)

        items: List[Dict[str, Any]] = []
        if isinstance(res, list):
            items = res
        elif isinstance(res, dict):
            for key in ("cartoes", "dados", "resultado"):
                if key in res and isinstance(res[key], list):
                    items = res[key]
                    break
            if not items and "numeroCartao" in res:
                items = [res]

        total_processados = 0
        total_inseridos = 0
        total_atualizados = 0

        for raw in items:
            num_cartao = raw.get("numeroCartao") or raw.get("cartao") or raw.get("NUMEROCARTAO")
            if not num_cartao:
                continue

            num_cartao_str = str(num_cartao).strip()
            total_processados += 1

            raw_placa = raw.get("placa") or raw.get("PLACA")
            placa_norm = cls._normalize_placa(raw_placa)

            veiculo = None
            if placa_norm:
                veiculo = db.query(Veiculo).filter(
                    func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
                ).first()

            cartao = db.query(ValeCardCartao).filter(
                ValeCardCartao.numero_cartao == num_cartao_str
            ).first()

            is_new = False
            if not cartao:
                cartao = ValeCardCartao(numero_cartao=num_cartao_str)
                is_new = True

            cartao.id_veiculo = veiculo.id_veiculo if veiculo else None
            cartao.placa = placa_norm or (veiculo.placa if veiculo else "SEM_PLACA")
            cartao.id_cartao_valecard = int(raw.get("idCartao")) if raw.get("idCartao") else None
            cartao.status_cartao = cls._map_status(raw.get("statusCartao"))
            cartao.tipo_cartao = "TITULAR" if str(raw.get("tipoCartao", "")).upper() == "T" else "TITULAR"
            cartao.is_segunda_via = True if str(raw.get("segundaVia", "")).upper() == "S" else False

            cartao.limite_atual = cls._parse_decimal(raw.get("limite"))
            cartao.saldo_disponivel = cls._parse_decimal(raw.get("saldo"))
            cartao.novo_limite = cls._parse_decimal(raw.get("novoLimite")) if raw.get("novoLimite") else None

            cartao.centro_custo_codigo = cls._clean_str(raw.get("centroCusto"))
            cartao.centro_custo_descricao = cls._clean_str(raw.get("descricaoCentroCusto"))
            cartao.centro_resultado_codigo = cls._clean_str(raw.get("centroResultado"))
            cartao.centro_resultado_descricao = cls._clean_str(raw.get("descricaoCentroResultado"))
            cartao.filial_descricao = cls._clean_str(raw.get("descricaoFilial"))

            cartao.modelo_veiculo_valecard = cls._clean_str(raw.get("modeloVeiculo"))
            cartao.status_veiculo_valecard = cls._clean_str(raw.get("statusVeiculo"))
            cartao.data_geracao_valecard = cls._parse_datetime(raw.get("dataGeracao"))
            cartao.payload_raw = raw

            if is_new:
                db.add(cartao)
                total_inseridos += 1
            else:
                total_atualizados += 1

        db.commit()

        return SincronizacaoCartoesResponse(
            total_processados=total_processados,
            total_inseridos=total_inseridos,
            total_atualizados=total_atualizados,
            mensagem="Sincronização de cartões realizada com sucesso."
        )

    @classmethod
    async def solicitar_2via(
        cls,
        db: Session,
        dados: Solicitar2ViaCartaoRequest
    ) -> Solicitar2ViaCartaoResponse:
        """
        Executa a solicitação de 2ª via de cartão junto ao webservice da ValeCard (solicitar2ViaCartao).
        """
        if not dados.placa and not dados.numero_cartao:
            raise ValueError("Informe ao menos a placa ou o número do cartão para solicitar a 2ª via.")

        placa_norm = cls._normalize_placa(dados.placa) if dados.placa else ""
        num_cartao = dados.numero_cartao.strip() if dados.numero_cartao else None

        # Localiza o cartão existente na base local
        cartao_existente = None
        if num_cartao:
            cartao_existente = db.query(ValeCardCartao).filter(ValeCardCartao.numero_cartao == num_cartao).first()
        elif placa_norm:
            cartao_existente = db.query(ValeCardCartao).filter(
                func.replace(func.upper(ValeCardCartao.placa), "-", "") == placa_norm
            ).first()

        if cartao_existente:
            placa_norm = placa_norm or cartao_existente.placa
            num_cartao = num_cartao or cartao_existente.numero_cartao

        veiculo = None
        if placa_norm:
            veiculo = db.query(Veiculo).filter(
                func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
            ).first()

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        payload = {
            "contratoCliente": str(contrato),
            "veiculoId": None,
            "placa": placa_norm or None,
            "numeroCartao": num_cartao
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("solicitar2ViaCartao", payload)

        # Trilha de auditoria da solicitação
        solicitacao = ValeCardSolicitacaoCartao(
            id_cartao=cartao_existente.id_cartao if cartao_existente else None,
            id_veiculo=veiculo.id_veiculo if veiculo else None,
            placa=placa_norm or "N/D",
            numero_cartao_anterior=num_cartao,
            motivo=dados.motivo,
            solicitado_por=dados.solicitado_por,
            status_solicitacao="PROCESSADO",
            payload_resposta=resp_valecard
        )
        db.add(solicitacao)

        # Se o cartão existia, marca como cancelado/bloqueado preventivamente
        if cartao_existente:
            cartao_existente.status_cartao = "CANCELADO"

        db.commit()
        db.refresh(solicitacao)

        msg = resp_valecard.get("mensagem") if isinstance(resp_valecard, dict) else "Solicitação de 2ª via enviada com sucesso."

        return Solicitar2ViaCartaoResponse(
            sucesso=True,
            mensagem=str(msg),
            id_solicitacao=solicitacao.id_solicitacao,
            placa=placa_norm,
            numero_cartao_anterior=num_cartao
        )

    @staticmethod
    def get_cartoes(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        placa: Optional[str] = None,
        status_cartao: Optional[str] = None,
        numero_cartao: Optional[str] = None
    ) -> Tuple[List[ValeCardCartao], int]:
        query = db.query(ValeCardCartao)
        if placa:
            clean_placa = re.sub(r"[^A-Za-z0-9]", "", placa).upper()
            query = query.filter(func.replace(func.upper(ValeCardCartao.placa), "-", "").like(f"%{clean_placa}%"))
        if status_cartao:
            query = query.filter(ValeCardCartao.status_cartao == status_cartao.upper())
        if numero_cartao:
            query = query.filter(ValeCardCartao.numero_cartao.like(f"%{numero_cartao.strip()}%"))

        total = query.count()
        items = query.order_by(desc(ValeCardCartao.created_at)).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def get_solicitacoes(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        placa: Optional[str] = None
    ) -> Tuple[List[ValeCardSolicitacaoCartao], int]:
        query = db.query(ValeCardSolicitacaoCartao)
        if placa:
            clean_placa = re.sub(r"[^A-Za-z0-9]", "", placa).upper()
            query = query.filter(func.replace(func.upper(ValeCardSolicitacaoCartao.placa), "-", "").like(f"%{clean_placa}%"))
        total = query.count()
        items = query.order_by(desc(ValeCardSolicitacaoCartao.created_at)).offset(skip).limit(limit).all()
        return items, total

from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.models.custodia import Custodia
from backend.app.models.tecnico import Tecnico
from backend.app.models.veiculo import Veiculo
from backend.app.schemas.multa import IdentificacaoCondutorResponse


class MultaService:
    """Regras de negócio de prevenção a multas NIC e cruzamento temporal de custódias."""

    @staticmethod
    def _normalize_utc(dt: datetime) -> datetime:
        """Garante comparação temporal consistente em UTC."""
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def identificar_condutor_por_infracao(
        db: Session,
        placa: str,
        data_hora: datetime,
    ) -> IdentificacaoCondutorResponse:
        """
        Identifica o condutor responsável na data/hora da autuação via janela temporal:
        data_retirada <= data_hora_infracao <= coalesce(data_devolucao, infinito).
        """
        placa_clean = placa.strip().upper().replace("-", "")
        veiculo = db.query(Veiculo).filter(Veiculo.placa == placa_clean).first()
        if not veiculo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Veículo com placa '{placa_clean}' não encontrado.",
            )

        alvo_utc = MultaService._normalize_utc(data_hora)

        custodia = (
            db.query(Custodia)
            .filter(
                Custodia.id_veiculo == veiculo.id_veiculo,
                Custodia.data_retirada <= alvo_utc,
                or_(
                    Custodia.data_devolucao.is_(None),
                    Custodia.data_devolucao >= alvo_utc,
                ),
            )
            .order_by(Custodia.data_retirada.desc())
            .first()
        )

        if not custodia:
            return IdentificacaoCondutorResponse(
                placa=veiculo.placa,
                id_veiculo=veiculo.id_veiculo,
                data_hora_infracao=alvo_utc,
                responsavel_tipo="PATIO_BASE",
                mensagem=(
                    f"Nenhuma custódia ativa encontrada para {veiculo.placa} em "
                    f"{alvo_utc.strftime('%d/%m/%Y %H:%M UTC')}. Responsabilidade atribuída ao pátio da base."
                ),
            )

        tecnico = db.query(Tecnico).filter(Tecnico.id_tecnico == custodia.id_tecnico).first()
        return IdentificacaoCondutorResponse(
            placa=veiculo.placa,
            id_veiculo=veiculo.id_veiculo,
            data_hora_infracao=alvo_utc,
            responsavel_tipo="CONDUTOR_IDENTIFICADO",
            id_custodia=custodia.id_custodia,
            id_tecnico=custodia.id_tecnico,
            condutor_nome=tecnico.nome_completo if tecnico else None,
            condutor_matricula=tecnico.matricula if tecnico else None,
            cnh_numero=tecnico.cnh_numero if tecnico else None,
            cnh_categoria=tecnico.cnh_categoria if tecnico else None,
            cnh_vencimento=tecnico.cnh_vencimento if tecnico else None,
            status_colaborador=tecnico.status_colaborador if tecnico else None,
            data_retirada=custodia.data_retirada,
            data_devolucao=custodia.data_devolucao,
            mensagem=(
                f"Condutor identificado via custódia temporal: "
                f"{tecnico.nome_completo if tecnico else custodia.id_tecnico}."
            ),
        )

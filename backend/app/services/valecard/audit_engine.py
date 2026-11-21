from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.app.models.valecard import ValeCardTransacao, FrotaAlertaCombustivel
from backend.app.models.veiculo import Veiculo
from backend.app.models.tecnico import Tecnico
from backend.app.models.custodia import Custodia


class ValeCardAuditEngine:
    """
    Motor de Auditoria e Prevenção de Fraudes em Abastecimentos de Combustível.
    Analisa cada transação recebida contra regras de negócio, telemetria física do veículo
    e histórico de custódias ativas.
    """

    @staticmethod
    def audit_transacao(
        db: Session,
        transacao: ValeCardTransacao,
        veiculo: Optional[Veiculo] = None,
        tecnico: Optional[Tecnico] = None,
        custodias: Optional[List[Custodia]] = None
    ) -> List[FrotaAlertaCombustivel]:
        alertas: List[FrotaAlertaCombustivel] = []
        motivos_auditoria: List[str] = []
        is_fraude = False
        is_pendente = False

        # --- REGRA 1: TANQUE EXCEDENTE ---
        # Abastecimento acima de 105% da capacidade do tanque
        if veiculo and veiculo.tanque_capacidade_litros and transacao.quantidade_litros:
            capacidade = Decimal(str(veiculo.tanque_capacidade_litros))
            litros = Decimal(str(transacao.quantidade_litros))
            limite_maximo = capacidade * Decimal("1.05")

            if litros > limite_maximo:
                detalhe = (
                    f"Volume abastecido ({litros:.2f}L) excedeu em mais de 5% a capacidade "
                    f"do tanque ({capacidade:.2f}L) do veículo {veiculo.placa}."
                )
                motivos_auditoria.append("Tanque Excedente")
                is_fraude = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="TANQUE_EXCEDENTE",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))

        # --- REGRA 2: INVERSÃO DE ODÔMETRO ---
        # Odômetro na bomba menor do que o odômetro já registrado
        if veiculo and veiculo.hodometro_atual and transacao.hodometro:
            hod_veiculo = Decimal(str(veiculo.hodometro_atual))
            hod_transacao = Decimal(str(transacao.hodometro))

            # Ignora odômetro zerado caso a bomba não capture
            if hod_transacao > 0 and hod_transacao < hod_veiculo:
                detalhe = (
                    f"Hodômetro informado na bomba ({hod_transacao:.0f} km) é inferior ao "
                    f"hodômetro atual do veículo ({hod_veiculo:.0f} km)."
                )
                motivos_auditoria.append("Inversão de Odômetro")
                is_fraude = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="INVERSAO_ODOMETRO",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))

        # --- REGRA 3: DESVIO CRÍTICO DE EFICIÊNCIA (Km/L) ---
        if transacao.consumo_medio_kml:
            kml = Decimal(str(transacao.consumo_medio_kml))
            if kml < Decimal("3.0") or kml > Decimal("28.0"):
                detalhe = f"Consumo médio de {kml:.2f} Km/L incompatível com o padrão operacional da frota."
                motivos_auditoria.append("Desvio de Eficiência")
                is_pendente = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo if veiculo else None,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="DESVIO_EFICIENCIA",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))

        # --- REGRA 4: CUSTÓDIA ATIVA / MOTORISTA DIVERGENTE ---
        if veiculo and transacao.data_hora_transacao:
            # Busca custódia válida no momento da transação (em memória se fornecido)
            if custodias is not None:
                custodia_ativa = next((
                    c for c in custodias
                    if c.id_veiculo == veiculo.id_veiculo
                    and c.data_retirada <= transacao.data_hora_transacao
                    and (c.data_devolucao is None or c.data_devolucao >= transacao.data_hora_transacao)
                ), None)
            else:
                custodia_ativa = db.query(Custodia).filter(
                    Custodia.id_veiculo == veiculo.id_veiculo,
                    Custodia.data_retirada <= transacao.data_hora_transacao,
                    (Custodia.data_devolucao == None) | (Custodia.data_devolucao >= transacao.data_hora_transacao)
                ).first()

            if not custodia_ativa:
                detalhe = (
                    f"Veículo {veiculo.placa} abastecido sem cautela ativa registrada "
                    f"na data {transacao.data_hora_transacao.strftime('%d/%m/%Y %H:%M')}."
                )
                motivos_auditoria.append("Sem Custódia Ativa")
                is_fraude = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="SEM_CUSTODIA_ATIVA",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))
            elif transacao.id_tecnico and custodia_ativa.id_tecnico != transacao.id_tecnico:
                detalhe = (
                    f"Condutor da transação (ID {transacao.id_tecnico}) difere do técnico "
                    f"com custódia ativa (ID {custodia_ativa.id_tecnico}) na data do abastecimento."
                )
                motivos_auditoria.append("Condutor Divergente de Custódia")
                is_fraude = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="SEM_CUSTODIA_ATIVA",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))

        # --- REGRA 5: VALOR UNITÁRIO SUSPEITO ---
        if transacao.valor_unitario:
            unit = Decimal(str(transacao.valor_unitario))
            if unit < Decimal("2.000") or unit > Decimal("12.000"):
                detalhe = f"Preço unitário registrado (R$ {unit:.3f}/L) fora dos limites de mercado."
                motivos_auditoria.append("Valor Unitário Suspeito")
                is_pendente = True
                alertas.append(FrotaAlertaCombustivel(
                    id_transacao=transacao.id_transacao,
                    id_veiculo=veiculo.id_veiculo if veiculo else None,
                    id_tecnico=transacao.id_tecnico,
                    tipo_anomalia="VALOR_UNITARIO_SUSPEITO",
                    detalhes=detalhe,
                    status_resolucao="PENDENTE"
                ))

        # Atualiza status da transação
        if is_fraude:
            transacao.status_auditoria = "ALERTA_FRAUDE"
        elif is_pendente:
            transacao.status_auditoria = "PENDENTE_CONCILIACAO"
        else:
            transacao.status_auditoria = "APROVADO"

        if motivos_auditoria:
            transacao.motivo_auditoria = "; ".join(motivos_auditoria)
        else:
            transacao.motivo_auditoria = None

        return alertas

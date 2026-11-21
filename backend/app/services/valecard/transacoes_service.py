import logging
import re
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardTransacao, FrotaAlertaCombustivel
from backend.app.models.veiculo import Veiculo
from backend.app.models.tecnico import Tecnico
from backend.app.models.custodia import Custodia
from backend.app.schemas.valecard import (
    SincronizacaoResponse,
    ValeCardKPIsResponse,
    ResolverAlertaRequest
)
from backend.app.services.valecard.audit_engine import ValeCardAuditEngine

logger = logging.getLogger("valecard.transacoes")


class ValeCardTransacoesService:
    """
    Serviço central de ingestão, normalização, auditoria e consulta de abastecimentos ValeCard.
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
    def _normalize_cpf(cpf: Any) -> Optional[str]:
        if not cpf:
            return None
        digits = re.sub(r"\D", "", str(cpf))
        if len(digits) == 11:
            return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
        return digits if digits else None

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
    def _parse_datetime(val: Any) -> datetime:
        if isinstance(val, datetime):
            return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        if not val:
            return datetime.now(timezone.utc)
        s = str(val).strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(s, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return datetime.now(timezone.utc)

    @staticmethod
    def _extract_item_value(item: Dict[str, Any], *possible_keys: str) -> Any:
        normalized_dict = {re.sub(r"[^a-zA-Z0-9]", "", k).lower(): v for k, v in item.items()}
        for key in possible_keys:
            clean_key = re.sub(r"[^a-zA-Z0-9]", "", key).lower()
            if clean_key in normalized_dict:
                return normalized_dict[clean_key]
        return None

    @classmethod
    async def sync_transacoes(
        cls,
        db: Session,
        data_inicio: date,
        data_fim: date,
        tipo_transacao: str = "TODAS",
        placa: Optional[str] = None
    ) -> SincronizacaoResponse:
        """
        Sincroniza abastecimentos com a ValeCard de forma particionada (janelas de até 30 dias).
        """
        if data_inicio > data_fim:
            raise ValueError("Data inicial não pode ser maior que a data final.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        client = ValeCardBaseClient()

        total_recebidas = 0
        total_inseridas = 0
        total_atualizadas = 0
        total_alertas_gerados = 0

        # Particionamento de janelas em no máximo 30 dias (conforme exigência da API ValeCard)
        cur_inicio = data_inicio
        chunks: List[Tuple[date, date]] = []
        while cur_inicio <= data_fim:
            cur_fim = min(cur_inicio + timedelta(days=29), data_fim)
            chunks.append((cur_inicio, cur_fim))
            cur_inicio = cur_fim + timedelta(days=1)

        # Otimização de Performance: Pré-carregamento em memória para evitar milhares de queries remotas
        veiculos_list = db.query(Veiculo).all()
        veiculos_map = {
            re.sub(r"[^A-Za-z0-9]", "", v.placa).upper(): v
            for v in veiculos_list if v.placa
        }

        tecnicos_list = db.query(Tecnico).all()
        tecnicos_cpf_map = {t.cpf: t for t in tecnicos_list if t.cpf}
        tecnicos_mat_map = {t.matricula: t for t in tecnicos_list if t.matricula}

        custodias_list = db.query(Custodia).all()

        existing_transacoes = {t.nsu_transacao: t for t in db.query(ValeCardTransacao).all()}
        existing_alertas = set(
            (a.id_transacao, a.tipo_anomalia)
            for a in db.query(FrotaAlertaCombustivel.id_transacao, FrotaAlertaCombustivel.tipo_anomalia).all()
        )

        async with client:
            for c_ini, c_fim in chunks:
                payload = {
                    "contratoCliente": str(contrato),
                    "dataInicial": c_ini.strftime("%Y-%m-%d"),
                    "dataFinal": c_fim.strftime("%Y-%m-%d"),
                    "tipotransacao": tipo_transacao
                }
                if placa:
                    payload["placa"] = placa

                try:
                    res = await client.post("buscartransacoesfrota", payload)
                except Exception as e:
                    logger.error(f"[ValeCard Sync] Falha ao consultar janela {c_ini} a {c_fim}: {e}")
                    continue

                items: List[Dict[str, Any]] = []
                if isinstance(res, list):
                    items = res
                elif isinstance(res, dict):
                    for key in ("transacoes", "dados", "resultado", "transacoesFrota"):
                        if key in res and isinstance(res[key], list):
                            items = res[key]
                            break

                for raw_item in items:
                    total_recebidas += 1
                    nsu = cls._extract_item_value(raw_item, "NSUTRANSAÇÃO", "nsuTransacao", "nsu", "id")
                    if not nsu:
                        continue

                    nsu_str = str(nsu).strip()
                    item_placa = cls._normalize_placa(cls._extract_item_value(raw_item, "PLACA", "placa"))
                    cpf_raw = cls._extract_item_value(raw_item, "CPFMOTORISTA", "cpfMotorista", "cpf")
                    cpf_norm = cls._normalize_cpf(cpf_raw)
                    matricula = cls._clean_str(cls._extract_item_value(raw_item, "MATRICULA", "matriculaMotorista"))

                    # Resolução do Veículo e Técnico em memória
                    veiculo = veiculos_map.get(item_placa)
                    tecnico = None
                    if cpf_norm and cpf_norm in tecnicos_cpf_map:
                        tecnico = tecnicos_cpf_map[cpf_norm]
                    elif matricula and matricula in tecnicos_mat_map:
                        tecnico = tecnicos_mat_map[matricula]

                    data_transacao = cls._parse_datetime(
                        cls._extract_item_value(raw_item, "DATA", "dataHora", "dataTransacao")
                    )

                    quantidade_litros = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "QUANTIDADE", "quantidade", "litros")
                    )
                    valor_unitario = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "VALORUNITÁRIO", "valorUnitario", "precoUnitario")
                    )
                    valor_total = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "VALORTOTAL", "valorTotal")
                    )
                    hodometro = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "HODÔMETRO", "hodometro", "odometro")
                    )
                    distancia = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "DISTÂNCIA", "distancia", "distanciaPercorrida")
                    )
                    consumo = cls._parse_decimal(
                        cls._extract_item_value(raw_item, "CONSUMO", "consumo", "consumoMedio")
                    )

                    # Idempotência por NSU com cache em memória
                    transacao = existing_transacoes.get(nsu_str)
                    is_new = False
                    if not transacao:
                        transacao = ValeCardTransacao(
                            id_transacao=uuid.uuid4(),
                            nsu_transacao=nsu_str
                        )
                        is_new = True
                        existing_transacoes[nsu_str] = transacao
                        db.add(transacao)
                        total_inseridas += 1
                    else:
                        total_atualizadas += 1

                    # Atualiza dados da transação
                    transacao.id_veiculo = veiculo.id_veiculo if veiculo else None
                    transacao.id_tecnico = tecnico.id_tecnico if tecnico else None
                    transacao.numero_cartao = cls._clean_str(cls._extract_item_value(raw_item, "NÚMEROCARTAO", "numeroCartao"))
                    transacao.placa = item_placa or "SEM_PLACA"
                    transacao.cpf_motorista = cpf_norm
                    transacao.nome_motorista = cls._clean_str(cls._extract_item_value(raw_item, "MOTORISTA", "nomeMotorista"))
                    transacao.matricula_motorista = matricula
                    transacao.posto_cnpj = cls._clean_str(cls._extract_item_value(raw_item, "CNPJ", "cnpj"))
                    transacao.posto_nome_fantasia = cls._clean_str(cls._extract_item_value(raw_item, "NOMEFANTASIA", "nomeFantasia"))
                    transacao.posto_cidade = cls._clean_str(cls._extract_item_value(raw_item, "CIDADE", "cidade"))
                    transacao.posto_uf = cls._clean_str(cls._extract_item_value(raw_item, "ESTADO", "uf"))
                    transacao.tipo_combustivel = cls._clean_str(cls._extract_item_value(raw_item, "PRODUTO", "combustivel"))
                    transacao.quantidade_litros = round(quantidade_litros, 3)
                    transacao.valor_unitario = round(valor_unitario, 3)
                    transacao.valor_total = round(valor_total, 2)
                    transacao.hodometro = round(hodometro, 2) if (hodometro and 0 <= hodometro < 10000000) else None
                    transacao.distancia_percorrida = round(distancia, 2) if (distancia and 0 <= distancia < 10000000) else None
                    transacao.consumo_medio_kml = round(consumo, 2) if (consumo and 0 < consumo < 1000) else None
                    transacao.data_hora_transacao = data_transacao
                    transacao.payload_raw = raw_item
                    transacao.origem_ingestao = "API_REST"

                    # Executa Motor de Auditoria Anti-Fraude com busca em memória
                    novos_alertas = ValeCardAuditEngine.audit_transacao(
                        db, transacao, veiculo, tecnico, custodias=custodias_list
                    )
                    for alerta in novos_alertas:
                        chave_alerta = (transacao.id_transacao, alerta.tipo_anomalia)
                        if chave_alerta not in existing_alertas:
                            db.add(alerta)
                            existing_alertas.add(chave_alerta)
                            total_alertas_gerados += 1

                    # Atualização atômica do odômetro do veículo se for maior
                    if veiculo and hodometro and hodometro > (veiculo.hodometro_atual or Decimal("0")):
                        veiculo.hodometro_atual = hodometro

                db.commit()

        return SincronizacaoResponse(
            total_recebidas=total_recebidas,
            total_inseridas=total_inseridas,
            total_atualizadas=total_atualizadas,
            total_alertas_gerados=total_alertas_gerados,
            periodo_consultado=f"{data_inicio.strftime('%d/%m/%Y')} a {data_fim.strftime('%d/%m/%Y')}",
            mensagem="Sincronização concluída com sucesso."
        )

    @staticmethod
    def get_transacoes(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        placa: Optional[str] = None,
        cpf_motorista: Optional[str] = None,
        status_auditoria: Optional[str] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None
    ) -> Tuple[List[ValeCardTransacao], int]:
        query = db.query(ValeCardTransacao)

        if placa:
            clean_placa = re.sub(r"[^A-Za-z0-9]", "", placa).upper()
            query = query.filter(func.replace(func.upper(ValeCardTransacao.placa), "-", "").like(f"%{clean_placa}%"))

        if cpf_motorista:
            query = query.filter(ValeCardTransacao.cpf_motorista == cpf_motorista)

        if status_auditoria:
            query = query.filter(ValeCardTransacao.status_auditoria == status_auditoria)

        if data_inicio:
            query = query.filter(func.date(ValeCardTransacao.data_hora_transacao) >= data_inicio)

        if data_fim:
            query = query.filter(func.date(ValeCardTransacao.data_hora_transacao) <= data_fim)

        total = query.count()
        items = query.order_by(desc(ValeCardTransacao.data_hora_transacao)).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def get_kpis(
        db: Session,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None
    ) -> ValeCardKPIsResponse:
        query = db.query(ValeCardTransacao)
        if data_inicio:
            query = query.filter(func.date(ValeCardTransacao.data_hora_transacao) >= data_inicio)
        if data_fim:
            query = query.filter(func.date(ValeCardTransacao.data_hora_transacao) <= data_fim)

        total_transacoes = query.count()
        total_gasto = query.with_entities(func.coalesce(func.sum(ValeCardTransacao.valor_total), 0)).scalar()
        total_litros = query.with_entities(func.coalesce(func.sum(ValeCardTransacao.quantidade_litros), 0)).scalar()
        preco_medio = Decimal("0.00")
        if total_litros and total_litros > 0:
            preco_medio = Decimal(str(total_gasto)) / Decimal(str(total_litros))

        consumo_medio = query.filter(ValeCardTransacao.consumo_medio_kml > 0).with_entities(
            func.avg(ValeCardTransacao.consumo_medio_kml)
        ).scalar()

        total_alertas_pendentes = db.query(FrotaAlertaCombustivel).filter(
            FrotaAlertaCombustivel.status_resolucao == "PENDENTE"
        ).count()

        return ValeCardKPIsResponse(
            total_gasto=Decimal(str(total_gasto)).quantize(Decimal("0.01")),
            total_litros=Decimal(str(total_litros)).quantize(Decimal("0.001")),
            preco_medio_litro=Decimal(str(preco_medio)).quantize(Decimal("0.001")),
            consumo_medio_frota_kml=Decimal(str(consumo_medio)).quantize(Decimal("0.01")) if consumo_medio else None,
            total_transacoes=total_transacoes,
            total_alertas_pendentes=total_alertas_pendentes
        )

    @staticmethod
    def get_alertas(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        status_resolucao: Optional[str] = None
    ) -> Tuple[List[FrotaAlertaCombustivel], int]:
        query = db.query(FrotaAlertaCombustivel)
        if status_resolucao:
            query = query.filter(FrotaAlertaCombustivel.status_resolucao == status_resolucao)
        total = query.count()
        items = query.order_by(desc(FrotaAlertaCombustivel.created_at)).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def resolver_alerta(
        db: Session,
        id_alerta: Any,
        dados: ResolverAlertaRequest
    ) -> FrotaAlertaCombustivel:
        alerta = db.query(FrotaAlertaCombustivel).filter(FrotaAlertaCombustivel.id_alerta == id_alerta).first()
        if not alerta:
            raise ValueError(f"Alerta com ID {id_alerta} não encontrado.")

        alerta.status_resolucao = dados.status_resolucao
        alerta.justificativa_gestor = dados.justificativa_gestor
        alerta.resolvido_por = dados.resolvido_por
        alerta.data_resolucao = datetime.now(timezone.utc)
        db.commit()
        db.refresh(alerta)
        return alerta

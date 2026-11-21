import logging
import re
from datetime import datetime, date, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardMotorista
from backend.app.models.tecnico import Tecnico
from backend.app.schemas.valecard import (
    SincronizacaoMotoristasResponse,
    CadastrarMotoristaRequest,
    CadastrarMotoristaResponse,
    AtualizarMotoristaRequest,
    AtualizarMotoristaResponse
)

logger = logging.getLogger("valecard.motoristas")


class ValeCardMotoristasService:
    """
    Serviço para sincronização, cadastro e atualização de motoristas/condutores junto à ValeCard
    (PDFs: 14 - buscarMotoristas, 03 - cadastrarMotorista, 04 - AtualizarMotorista).
    """

    @staticmethod
    def _clean_str(val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip()
        return s if s else None

    @staticmethod
    def _clean_cpf(val: Any) -> str:
        if not val:
            return ""
        return re.sub(r"[^0-9]", "", str(val))

    @staticmethod
    def _parse_date(val: Any) -> Optional[date]:
        if isinstance(val, date) and not isinstance(val, datetime):
            return val
        if isinstance(val, datetime):
            return val.date()
        if not val:
            return None
        s = str(val).strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _map_status(status_raw: Any) -> Tuple[str, str]:
        """
        Retorna (status_motorista, status_codigo).
        Exemplos: ('ATIVO', 'A'), ('BLOQUEADO', 'B'), ('CANCELADO', 'C'), ('INATIVO', 'I').
        """
        if not status_raw:
            return "ATIVO", "A"
        s = str(status_raw).strip().upper()
        if s in ("A", "ATIVO", "1"):
            return "ATIVO", "A"
        if s in ("B", "BLOQUEADO"):
            return "BLOQUEADO", "B"
        if s in ("C", "CANCELADO"):
            return "CANCELADO", "C"
        if s in ("I", "INATIVO", "0"):
            return "INATIVO", "I"
        return "ATIVO", "A"

    @classmethod
    async def sync_motoristas(
        cls,
        db: Session,
        cpf: Optional[str] = None,
        matricula: Optional[str] = None,
        nome_completo: Optional[str] = None
    ) -> SincronizacaoMotoristasResponse:
        """
        Consome a API buscarMotoristas da ValeCard e sincroniza a base local com os técnicos.
        """
        contrato = settings.VALECARD_CONTRATO_CLIENTE
        clean_cpf = cls._clean_cpf(cpf) if cpf else None

        params: Dict[str, Any] = {
            "contratoCliente": str(contrato)
        }
        if clean_cpf:
            params["cpf"] = clean_cpf
        if matricula:
            params["matricula"] = str(matricula).strip()
        if nome_completo:
            params["nomeCompleto"] = str(nome_completo).strip()

        client = ValeCardBaseClient()
        async with client:
            res = await client.get("buscarMotoristas", params=params)

        items: List[Dict[str, Any]] = []
        if isinstance(res, list):
            items = res
        elif isinstance(res, dict):
            for k in ("motoristas", "dados", "resultado"):
                if k in res and isinstance(res[k], list):
                    items = res[k]
                    break
            if not items and ("cpf" in res or "matricula" in res):
                items = [res]

        total_processados = 0
        total_inseridos = 0
        total_atualizados = 0
        total_vinculados_tecnicos = 0

        for raw in items:
            raw_cpf = raw.get("cpf") or raw.get("CPF")
            cpf_limpo = cls._clean_cpf(raw_cpf)
            raw_mat = raw.get("matricula") or raw.get("MATRICULA")
            mat_limpa = str(raw_mat).strip() if raw_mat else ""

            if not cpf_limpo and not mat_limpa:
                continue

            total_processados += 1

            # Localiza técnico correspondente na base do SGFrotas
            tecnico = None
            if cpf_limpo:
                tecnico = db.query(Tecnico).filter(
                    func.replace(func.replace(func.replace(Tecnico.cpf, ".", ""), "-", ""), "/", "") == cpf_limpo
                ).first()
            if not tecnico and mat_limpa:
                tecnico = db.query(Tecnico).filter(Tecnico.matricula == mat_limpa).first()

            if tecnico:
                total_vinculados_tecnicos += 1

            id_valecard = int(raw.get("id")) if raw.get("id") else None

            # Busca motorista existente na tabela espelho
            mot = None
            if id_valecard:
                mot = db.query(ValeCardMotorista).filter(ValeCardMotorista.id_motorista_valecard == id_valecard).first()
            if not mot and cpf_limpo:
                mot = db.query(ValeCardMotorista).filter(ValeCardMotorista.cpf == cpf_limpo).first()
            if not mot and mat_limpa:
                mot = db.query(ValeCardMotorista).filter(ValeCardMotorista.matricula == mat_limpa).first()

            is_new = False
            if not mot:
                mot = ValeCardMotorista(
                    matricula=mat_limpa or (tecnico.matricula if tecnico else "N/D"),
                    cpf=cpf_limpo or (tecnico.cpf if tecnico else "00000000000"),
                    nome_completo=cls._clean_str(raw.get("nomeCompleto") or raw.get("NOMECOMPLETO")) or (tecnico.nome_completo if tecnico else "N/D")
                )
                is_new = True

            mot.id_motorista_valecard = id_valecard
            mot.id_tecnico = tecnico.id_tecnico if tecnico else mot.id_tecnico
            mot.nome_completo = cls._clean_str(raw.get("nomeCompleto") or raw.get("NOMECOMPLETO")) or mot.nome_completo
            mot.matricula = mat_limpa or mot.matricula
            mot.cpf = cpf_limpo or mot.cpf

            mot.rg = cls._clean_str(raw.get("rg"))
            mot.orgao_emissor = cls._clean_str(raw.get("orgaoEmissor"))
            mot.sexo = cls._clean_str(raw.get("sexo"))
            mot.cargo = cls._clean_str(raw.get("cargo"))

            mot.cnh_numero = cls._clean_str(raw.get("numeroCnh") or raw.get("cnh"))
            mot.cnh_categoria = cls._clean_str(raw.get("categoria"))
            mot.cnh_vencimento = cls._parse_date(raw.get("dataVencimento"))
            mot.cnh_primeira_habilitacao = cls._parse_date(raw.get("dataPrimeiraHabilitacao"))
            mot.data_nascimento = cls._parse_date(raw.get("dataNascimento"))
            mot.data_admissao = cls._parse_date(raw.get("dataAdmissao"))

            status_desc, status_cod = cls._map_status(raw.get("status") or raw.get("statusMotorista"))
            mot.status_motorista = status_desc
            mot.status_codigo = status_cod

            mot.telefone = cls._clean_str(raw.get("telefone"))
            mot.celular = cls._clean_str(raw.get("celular"))
            mot.email = cls._clean_str(raw.get("email"))
            mot.centro_custo_codigo = cls._clean_str(raw.get("centroCustoCodigo"))
            mot.centro_resultado_codigo = cls._clean_str(raw.get("centroResultadoCodigo"))
            mot.codigo_filial_frota = cls._clean_str(raw.get("codigoFilialFrota"))
            mot.descricao_filial = cls._clean_str(raw.get("descricaoFilial"))

            mot.payload_raw = raw
            mot.sincronizado_em = datetime.now(timezone.utc)

            if is_new:
                db.add(mot)
                total_inseridos += 1
            else:
                total_atualizados += 1

        db.commit()

        return SincronizacaoMotoristasResponse(
            total_processados=total_processados,
            total_inseridos=total_inseridos,
            total_atualizados=total_atualizados,
            total_vinculados_tecnicos=total_vinculados_tecnicos,
            mensagem="Sincronização de motoristas ValeCard concluída com sucesso."
        )

    @classmethod
    async def cadastrar_motorista(
        cls,
        db: Session,
        dados: CadastrarMotoristaRequest
    ) -> CadastrarMotoristaResponse:
        """
        Cadastra um novo motorista na ValeCard (03 - cadastrarMotorista) e salva na base local.
        """
        cpf_limpo = cls._clean_cpf(dados.cpf)
        if len(cpf_limpo) != 11:
            raise ValueError(f"CPF inválido: '{dados.cpf}'. O CPF deve conter 11 dígitos numéricos.")

        mat_limpa = str(dados.matricula).strip()
        contrato = settings.VALECARD_CONTRATO_CLIENTE

        # Formato esperado pela API cadastrarMotorista (PDF 03)
        motorista_dict = {
            "id": None,
            "matricula": mat_limpa,
            "nomeCompleto": dados.nome_completo.strip(),
            "telefone": dados.telefone,
            "celular": dados.celular,
            "email": dados.email,
            "dataNascimento": dados.data_nascimento.strftime("%Y-%m-%d") if dados.data_nascimento else None,
            "rg": dados.rg,
            "orgaoEmissor": dados.orgao_emissor,
            "cpf": cpf_limpo,
            "cargo": dados.cargo or "Motorista",
            "sexo": (dados.sexo or "M").upper(),
            "dataAdmissao": dados.data_admissao.strftime("%Y-%m-%d") if dados.data_admissao else None,
            "numeroCnh": dados.numero_cnh.strip(),
            "categoria": dados.categoria.strip().upper(),
            "dataVencimento": dados.data_vencimento.strftime("%Y-%m-%d") if dados.data_vencimento else None,
            "dataPrimeiraHabilitacao": dados.data_primeira_habilitacao.strftime("%Y-%m-%d") if dados.data_primeira_habilitacao else None,
            "filial": None,
            "codigo": None,
            "status": (dados.status or "A").upper(),
            "dataDesativacao": None,
            "registro": None,
            "codigoFilialFrota": None,
            "clienteId": None,
            "senha": 1234,
            "centroCustoId": None,
            "dataGeracaoSenha": None,
            "dataEntradaSistema": None,
            "memberId": None,
            "matriculaTitular": None,
            "login": None
        }

        payload = {
            "contratoCliente": str(contrato),
            "motoristaString": motorista_dict
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("cadastrarMotorista", payload)

        # Localiza técnico correspondente na base do SGFrotas
        tecnico = db.query(Tecnico).filter(
            func.replace(func.replace(func.replace(Tecnico.cpf, ".", ""), "-", ""), "/", "") == cpf_limpo
        ).first()

        status_desc, status_cod = cls._map_status(dados.status)

        # Salva na base de espelho local
        mot = db.query(ValeCardMotorista).filter(ValeCardMotorista.cpf == cpf_limpo).first()
        is_new = False
        if not mot:
            mot = ValeCardMotorista(
                matricula=mat_limpa,
                cpf=cpf_limpo,
                nome_completo=dados.nome_completo.strip()
            )
            is_new = True

        mot.id_tecnico = tecnico.id_tecnico if tecnico else None
        mot.rg = dados.rg
        mot.orgao_emissor = dados.orgao_emissor
        mot.sexo = (dados.sexo or "M").upper()
        mot.cargo = dados.cargo or "Motorista"
        mot.cnh_numero = dados.numero_cnh
        mot.cnh_categoria = dados.categoria
        mot.cnh_vencimento = dados.data_vencimento
        mot.cnh_primeira_habilitacao = dados.data_primeira_habilitacao
        mot.data_nascimento = dados.data_nascimento
        mot.data_admissao = dados.data_admissao
        mot.status_motorista = status_desc
        mot.status_codigo = status_cod
        mot.telefone = dados.telefone
        mot.celular = dados.celular
        mot.email = dados.email
        mot.payload_raw = resp_valecard
        mot.sincronizado_em = datetime.now(timezone.utc)

        if is_new:
            db.add(mot)

        db.commit()
        db.refresh(mot)

        msg = "Motorista cadastrado com sucesso na ValeCard."
        if isinstance(resp_valecard, dict) and "mensagem" in resp_valecard:
            msg = str(resp_valecard["mensagem"])

        return CadastrarMotoristaResponse(
            sucesso=True,
            mensagem=msg,
            id_valecard_motorista=mot.id_valecard_motorista,
            matricula=mat_limpa,
            cpf=cpf_limpo,
            nome_completo=dados.nome_completo
        )

    @classmethod
    async def atualizar_motorista(
        cls,
        db: Session,
        dados: AtualizarMotoristaRequest
    ) -> AtualizarMotoristaResponse:
        """
        Atualiza dados de condutor na ValeCard (04 - AtualizarMotorista).
        """
        mat_limpa = str(dados.matricula).strip()
        if not mat_limpa:
            raise ValueError("A matrícula é obrigatória para atualizar o motorista na ValeCard.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE

        # Monta payload específico para atualização
        motorista_dict: Dict[str, Any] = {
            "id": None,
            "matricula": mat_limpa
        }
        if dados.nome_completo:
            motorista_dict["nomeCompleto"] = dados.nome_completo.strip()
        if dados.telefone:
            motorista_dict["telefone"] = dados.telefone.strip()
        if dados.celular:
            motorista_dict["celular"] = dados.celular.strip()
        if dados.email:
            motorista_dict["email"] = dados.email.strip()
        if dados.numero_cnh:
            motorista_dict["numeroCnh"] = dados.numero_cnh.strip()
        if dados.categoria:
            motorista_dict["categoria"] = dados.categoria.strip().upper()
        if dados.data_vencimento:
            motorista_dict["dataVencimento"] = dados.data_vencimento.strftime("%Y-%m-%d")
        if dados.data_primeira_habilitacao:
            motorista_dict["dataPrimeiraHabilitacao"] = dados.data_primeira_habilitacao.strftime("%Y-%m-%d")
        if dados.status:
            motorista_dict["status"] = dados.status.strip().upper()
        if dados.cargo:
            motorista_dict["cargo"] = dados.cargo.strip()

        payload = {
            "contratoCliente": str(contrato),
            "motoristaString": motorista_dict
        }

        client = ValeCardBaseClient()
        async with client:
            resp_valecard = await client.post("atualizarMotoristas", payload)

        # Atualiza a base de espelho local se o motorista existir
        mot = db.query(ValeCardMotorista).filter(ValeCardMotorista.matricula == mat_limpa).first()
        if mot:
            if dados.nome_completo:
                mot.nome_completo = dados.nome_completo.strip()
            if dados.telefone:
                mot.telefone = dados.telefone.strip()
            if dados.celular:
                mot.celular = dados.celular.strip()
            if dados.email:
                mot.email = dados.email.strip()
            if dados.numero_cnh:
                mot.cnh_numero = dados.numero_cnh.strip()
            if dados.categoria:
                mot.cnh_categoria = dados.categoria.strip().upper()
            if dados.data_vencimento:
                mot.cnh_vencimento = dados.data_vencimento
            if dados.data_primeira_habilitacao:
                mot.cnh_primeira_habilitacao = dados.data_primeira_habilitacao
            if dados.status:
                status_desc, status_cod = cls._map_status(dados.status)
                mot.status_motorista = status_desc
                mot.status_codigo = status_cod
            if dados.cargo:
                mot.cargo = dados.cargo.strip()

            mot.payload_raw = resp_valecard
            mot.updated_at = datetime.now(timezone.utc)
            db.commit()

        msg = "Motorista atualizado com sucesso na ValeCard."
        if isinstance(resp_valecard, dict) and "mensagem" in resp_valecard:
            msg = str(resp_valecard["mensagem"])

        return AtualizarMotoristaResponse(
            sucesso=True,
            mensagem=msg,
            matricula=mat_limpa,
            status=dados.status
        )

    @staticmethod
    def get_motoristas(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        cpf: Optional[str] = None,
        matricula: Optional[str] = None,
        status_motorista: Optional[str] = None,
        somente_com_tecnico: bool = False
    ) -> Tuple[List[ValeCardMotorista], int]:
        query = db.query(ValeCardMotorista)
        if cpf:
            clean_cpf = re.sub(r"[^0-9]", "", cpf)
            query = query.filter(ValeCardMotorista.cpf.like(f"%{clean_cpf}%"))
        if matricula:
            query = query.filter(ValeCardMotorista.matricula.like(f"%{matricula.strip()}%"))
        if status_motorista:
            query = query.filter(ValeCardMotorista.status_motorista == status_motorista.upper())
        if somente_com_tecnico:
            query = query.filter(ValeCardMotorista.id_tecnico.isnot(None))

        total = query.count()
        items = query.order_by(desc(ValeCardMotorista.created_at)).offset(skip).limit(limit).all()
        return items, total

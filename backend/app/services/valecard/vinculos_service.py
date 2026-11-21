import logging
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.core.valecard.client_base import ValeCardBaseClient
from backend.app.core.config import settings
from backend.app.models.valecard import ValeCardVinculo, ValeCardResponsavel, ValeCardMotorista
from backend.app.models.veiculo import Veiculo
from backend.app.models.tecnico import Tecnico
from backend.app.schemas.valecard import (
    VincularMotoristaRequest,
    ValeCardVinculoResponse,
    ProcessarVinculosResponse,
    CadastrarResponsavelRequest,
    CadastrarResponsavelResponse
)

logger = logging.getLogger("valecard.vinculos")


class ValeCardVinculosService:
    """
    Serviço para gerenciamento de Vínculos Veículo x Motorista e Cadastro de Responsáveis
    (PDFs: 13 - vinculoVeiculoMotorista e 11 - cadastrarResponsavel).
    """

    ENDPOINT_VINCULO = "/core/services/frotaCliente/buscarBasedeCartoes"
    ENDPOINT_RESPONSAVEL = "/core/services/frotaCliente/cadastrarResponsavel"

    @staticmethod
    def _normalize_placa(placa: Any) -> str:
        if not placa:
            return ""
        return re.sub(r"[^A-Za-z0-9]", "", str(placa)).upper()

    @staticmethod
    def _clean_numeric(value: Any) -> str:
        if not value:
            return ""
        return re.sub(r"[^0-9]", "", str(value))

    @classmethod
    async def processar_vinculos(
        cls,
        db: Session,
        dados: VincularMotoristaRequest
    ) -> ProcessarVinculosResponse:
        """
        Executa operações de vínculo ('V') ou desvínculo ('D') de motoristas a veículos
        conforme especificação oficial do webservice ValeCard (PDF 13).
        """
        if not dados.vinculos:
            raise ValueError("A lista de vínculos para processamento não pode ser vazia.")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        payload_items = []
        operacoes_map = []

        for item in dados.vinculos:
            placa_norm = cls._normalize_placa(item.placa)
            if len(placa_norm) < 7:
                raise ValueError(f"Placa inválida: '{item.placa}'.")

            op = item.operacao.upper().strip()
            if op not in ["V", "D"]:
                raise ValueError(f"Operação inválida '{item.operacao}' para a placa {item.placa}. Use 'V' ou 'D'.")

            # Localizar veículo na frota central
            veiculo = db.query(Veiculo).filter(
                func.replace(func.upper(Veiculo.placa), "-", "") == placa_norm
            ).first()

            for mat in item.matricula_motorista:
                mat_str = str(mat).strip()
                # Tentar localizar técnico pelo id ou matrícula
                tecnico = db.query(Tecnico).filter(Tecnico.matricula == mat_str).first()

                operacoes_map.append({
                    "placa": item.placa,
                    "placa_norm": placa_norm,
                    "id_veiculo": veiculo.id_veiculo if veiculo else None,
                    "matricula": mat_str,
                    "id_tecnico": tecnico.id_tecnico if tecnico else None,
                    "operacao": op
                })

            payload_items.append({
                "placa": item.placa,
                "matriculaMotorista": [str(m).strip() for m in item.matricula_motorista],
                "operacao": op
            })

        payload = {
            "contratoCliente": contrato,
            "vincularMotorista": payload_items
        }

        client = ValeCardBaseClient()
        sucesso_geral = True
        res_data: Any = None
        erro_msg = None

        try:
            logger.info(f"[ValeCard Vinculos] Enviando requisição de {len(payload_items)} operação(ões)...")
            res_data = await client.post(cls.ENDPOINT_VINCULO, payload=payload)
        except Exception as e:
            logger.error(f"[ValeCard Vinculos] Falha na comunicação com o webservice: {str(e)}")
            sucesso_geral = False
            erro_msg = str(e)
            res_data = {"error": erro_msg}

        # Analisar resultados
        resultados = []
        total_sucesso = 0
        total_falhas = 0

        # ValeCard retorna array de objetos com [matriculaMotorista, mensagem, placa]
        res_list = res_data if isinstance(res_data, list) else []

        for op in operacoes_map:
            # Buscar resposta específica para esta placa e matrícula se disponível
            msg_retorno = "Operação executada com sucesso" if sucesso_geral else (erro_msg or "Falha no webservice")
            op_sucesso = sucesso_geral

            for r in res_list:
                if isinstance(r, dict):
                    r_placa = cls._normalize_placa(r.get("placa"))
                    r_mat = str(r.get("matriculaMotorista", "")).strip()
                    if r_placa == op["placa_norm"] and (not r_mat or r_mat == op["matricula"]):
                        msg_retorno = r.get("mensagem", msg_retorno)
                        if "erro" in msg_retorno.lower() or "inval" in msg_retorno.lower():
                            op_sucesso = False
                        break

            if op_sucesso:
                total_sucesso += 1
                status_vinc = "ATIVO" if op["operacao"] == "V" else "DESVINCULADO"
            else:
                total_falhas += 1
                status_vinc = "FALHA"

            # Se for desvínculo com sucesso, inativar vínculos anteriores deste par veículo/motorista
            if op["operacao"] == "D" and op_sucesso:
                db.query(ValeCardVinculo).filter(
                    ValeCardVinculo.placa == op["placa"],
                    ValeCardVinculo.matricula_motorista == op["matricula"],
                    ValeCardVinculo.status_vinculo == "ATIVO"
                ).update({"status_vinculo": "DESVINCULADO", "updated_at": datetime.now(timezone.utc)})

            novo_vinculo = ValeCardVinculo(
                id_veiculo=op["id_veiculo"],
                id_tecnico=op["id_tecnico"],
                placa=op["placa"],
                matricula_motorista=op["matricula"],
                operacao=op["operacao"],
                status_vinculo=status_vinc,
                motivo=dados.motivo,
                solicitado_por=dados.solicitado_por,
                sucesso=op_sucesso,
                mensagem_retorno=msg_retorno,
                payload_requisicao=payload,
                payload_resposta=res_data if isinstance(res_data, (dict, list)) else {"raw": str(res_data)}
            )
            db.add(novo_vinculo)

            resultados.append({
                "placa": op["placa"],
                "matricula": op["matricula"],
                "operacao": op["operacao"],
                "sucesso": op_sucesso,
                "status_vinculo": status_vinc,
                "mensagem": msg_retorno
            })

        db.commit()

        return ProcessarVinculosResponse(
            sucesso=total_falhas == 0,
            total_processados=len(operacoes_map),
            total_sucesso=total_sucesso,
            total_falhas=total_falhas,
            resultados=resultados,
            mensagem=f"Processamento concluído: {total_sucesso} sucesso(s), {total_falhas} falha(s)."
        )

    @classmethod
    def listar_vinculos(
        cls,
        db: Session,
        placa: Optional[str] = None,
        matricula: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ValeCardVinculo]:
        """
        Consulta histórico de vínculos e desvínculos com paginação e filtros.
        """
        query = db.query(ValeCardVinculo)
        if placa:
            p_norm = cls._normalize_placa(placa)
            query = query.filter(func.replace(func.upper(ValeCardVinculo.placa), "-", "") == p_norm)
        if matricula:
            query = query.filter(ValeCardVinculo.matricula_motorista == str(matricula).strip())
        if status:
            query = query.filter(ValeCardVinculo.status_vinculo == status.upper().strip())

        return query.order_by(desc(ValeCardVinculo.created_at)).offset(skip).limit(limit).all()

    @classmethod
    async def cadastrar_responsavel(
        cls,
        db: Session,
        dados: CadastrarResponsavelRequest
    ) -> CadastrarResponsavelResponse:
        """
        Cadastra um gestor/responsável de frota no SIAG ValeCard (PDF 11 - cadastrarResponsavel).
        """
        cpf_clean = cls._clean_numeric(dados.cpf)
        if len(cpf_clean) != 11:
            raise ValueError(f"CPF inválido: '{dados.cpf}'. Deve conter exatamente 11 dígitos numéricos.")

        cep_clean = cls._clean_numeric(dados.cep)
        if len(cep_clean) != 8:
            raise ValueError(f"CEP inválido: '{dados.cep}'. Deve conter 8 dígitos numéricos.")

        tel_clean = cls._clean_numeric(dados.telefone)
        if len(tel_clean) < 10:
            raise ValueError(f"Telefone inválido: '{dados.telefone}'. Informe DDD e número (mínimo 10 dígitos).")

        contrato = settings.VALECARD_CONTRATO_CLIENTE
        data_nasc_valecard = dados.data_nascimento.strftime("%d-%m-%Y")

        payload = {
            "contratoCliente": contrato,
            "responsavelString": {
                "nomeResponsavel": dados.nome_responsavel.strip(),
                "matricula": dados.matricula.strip(),
                "cpf": cpf_clean,
                "rg": dados.rg.strip(),
                "dataNascimento": data_nasc_valecard,
                "telefone": tel_clean,
                "email": dados.email.strip().lower(),
                "cep": cep_clean,
                "tipoLogradouro": dados.tipo_logradouro.strip(),
                "logradouro": dados.logradouro.strip(),
                "numero": dados.numero.strip(),
                "complemento": (dados.complemento or "").strip(),
                "bairro": dados.bairro.strip(),
                "cidade": dados.cidade.strip(),
                "estado": dados.estado.strip().upper()
            }
        }

        client = ValeCardBaseClient()
        logger.info(f"[ValeCard Responsavel] Cadastrando {dados.nome_responsavel} (CPF: {cpf_clean})...")
        res_data = await client.post(cls.ENDPOINT_RESPONSAVEL, payload=payload)

        # Tratar vínculo com técnico se não informado
        id_tecnico = dados.id_tecnico
        if not id_tecnico:
            tec = db.query(Tecnico).filter(
                (func.replace(func.replace(func.replace(Tecnico.cpf, ".", ""), "-", ""), " ", "") == cpf_clean) |
                (Tecnico.matricula == dados.matricula.strip())
            ).first()
            if tec:
                id_tecnico = tec.id_tecnico

        # Localizar ou criar em tb_valecard_responsaveis
        resp = db.query(ValeCardResponsavel).filter(
            (ValeCardResponsavel.cpf == cpf_clean) |
            (ValeCardResponsavel.matricula == dados.matricula.strip())
        ).first()

        if not resp:
            resp = ValeCardResponsavel(
                id_tecnico=id_tecnico,
                nome_responsavel=dados.nome_responsavel.strip(),
                matricula=dados.matricula.strip(),
                cpf=cpf_clean,
                rg=dados.rg.strip(),
                data_nascimento=dados.data_nascimento,
                telefone=tel_clean,
                email=dados.email.strip().lower(),
                cep=cep_clean,
                tipo_logradouro=dados.tipo_logradouro.strip(),
                logradouro=dados.logradouro.strip(),
                numero=dados.numero.strip(),
                complemento=(dados.complemento or "").strip(),
                bairro=dados.bairro.strip(),
                cidade=dados.cidade.strip(),
                estado=dados.estado.strip().upper(),
                status_cadastro="CADASTRADO",
                payload_requisicao=payload,
                payload_resposta=res_data if isinstance(res_data, dict) else {"raw": str(res_data)}
            )
            db.add(resp)
        else:
            resp.id_tecnico = id_tecnico
            resp.nome_responsavel = dados.nome_responsavel.strip()
            resp.rg = dados.rg.strip()
            resp.data_nascimento = dados.data_nascimento
            resp.telefone = tel_clean
            resp.email = dados.email.strip().lower()
            resp.cep = cep_clean
            resp.tipo_logradouro = dados.tipo_logradouro.strip()
            resp.logradouro = dados.logradouro.strip()
            resp.numero = dados.numero.strip()
            resp.complemento = (dados.complemento or "").strip()
            resp.bairro = dados.bairro.strip()
            resp.cidade = dados.cidade.strip()
            resp.estado = dados.estado.strip().upper()
            resp.status_cadastro = "CADASTRADO"
            resp.payload_requisicao = payload
            resp.payload_resposta = res_data if isinstance(res_data, dict) else {"raw": str(res_data)}
            resp.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(resp)

        msg = "Responsável cadastrado com sucesso"
        if isinstance(res_data, dict) and "mensagem" in res_data:
            msg = res_data["mensagem"]

        return CadastrarResponsavelResponse(
            sucesso=True,
            mensagem=msg,
            id_valecard_responsavel=resp.id_valecard_responsavel,
            matricula=resp.matricula,
            cpf=resp.cpf,
            nome_responsavel=resp.nome_responsavel
        )

    @classmethod
    def listar_responsaveis(
        cls,
        db: Session,
        cpf: Optional[str] = None,
        matricula: Optional[str] = None,
        termo: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ValeCardResponsavel]:
        """
        Consulta responsáveis de frota cadastrados com paginação e filtros.
        """
        query = db.query(ValeCardResponsavel)
        if cpf:
            c_clean = cls._clean_numeric(cpf)
            query = query.filter(ValeCardResponsavel.cpf == c_clean)
        if matricula:
            query = query.filter(ValeCardResponsavel.matricula == str(matricula).strip())
        if termo:
            t = f"%{termo.strip()}%"
            query = query.filter(
                (ValeCardResponsavel.nome_responsavel.ilike(t)) |
                (ValeCardResponsavel.cidade.ilike(t)) |
                (ValeCardResponsavel.email.ilike(t))
            )

        return query.order_by(desc(ValeCardResponsavel.created_at)).offset(skip).limit(limit).all()

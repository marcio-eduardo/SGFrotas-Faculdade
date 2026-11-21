import uuid
from sqlalchemy import Column, Integer, BigInteger, String, Numeric, DateTime, Date, ForeignKey, Text, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class ValeCardTransacao(Base):
    """
    Modelo ORM para transações de combustível da ValeCard.
    Tabela: tb_valecard_transacoes
    Regras de Database Design aplicadas: precisão monetária/volumétrica, imutabilidade contábil e auditoria JSONB.
    """
    __tablename__ = "tb_valecard_transacoes"

    id_transacao = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nsu_transacao = Column(String(60), unique=True, nullable=False, index=True)

    # Vínculos relacionais (ON DELETE SET NULL)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)
    id_tecnico = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True, index=True)

    # Snapshot histórico denormalizado
    numero_cartao = Column(String(30), nullable=True)
    placa = Column(String(10), nullable=False, index=True)
    cpf_motorista = Column(String(14), nullable=True, index=True)
    nome_motorista = Column(String(150), nullable=True)
    matricula_motorista = Column(String(50), nullable=True)

    # Dados do Posto
    posto_cnpj = Column(String(18), nullable=True)
    posto_nome_fantasia = Column(String(150), nullable=True)
    posto_cidade = Column(String(100), nullable=True)
    posto_uf = Column(String(2), nullable=True)

    # Combustível e Odômetro com precisão exata
    tipo_combustivel = Column(String(50), nullable=True)
    quantidade_litros = Column(Numeric(8, 3), nullable=False)
    valor_unitario = Column(Numeric(10, 3), nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)
    hodometro = Column(Numeric(10, 2), nullable=True)
    distancia_percorrida = Column(Numeric(10, 2), nullable=True)
    consumo_medio_kml = Column(Numeric(6, 2), nullable=True)

    # Auditoria e Status
    status_auditoria = Column(String(30), nullable=False, default="APROVADO", index=True)
    motivo_auditoria = Column(Text, nullable=True)
    origem_ingestao = Column(String(30), nullable=False, default="API_REST")

    # Payload Bruto
    payload_raw = Column(JSONB, nullable=True)

    # Timestamps
    data_hora_transacao = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    tecnico = relationship("Tecnico", foreign_keys=[id_tecnico])
    alertas = relationship("FrotaAlertaCombustivel", back_populates="transacao", cascade="all, delete-orphan")


class FrotaAlertaCombustivel(Base):
    """
    Modelo ORM para alertas e anomalias de combustível detectadas pelo motor anti-fraude.
    Tabela: tb_frota_alertas_combustivel
    """
    __tablename__ = "tb_frota_alertas_combustivel"

    id_alerta = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_transacao = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_transacoes.id_transacao", ondelete="CASCADE"), nullable=False, index=True)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True)
    id_tecnico = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True)

    tipo_anomalia = Column(String(50), nullable=False)
    detalhes = Column(Text, nullable=False)

    status_resolucao = Column(String(30), nullable=False, default="PENDENTE", index=True)
    justificativa_gestor = Column(Text, nullable=True)
    resolvido_por = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True)
    data_resolucao = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    transacao = relationship("ValeCardTransacao", back_populates="alertas")
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    tecnico = relationship("Tecnico", foreign_keys=[id_tecnico])
    gestor_resolucao = relationship("Tecnico", foreign_keys=[resolvido_por])


class ValeCardCartao(Base):
    """
    Modelo ORM para cartões de combustível da frota ValeCard.
    Tabela: tb_valecard_cartoes
    """
    __tablename__ = "tb_valecard_cartoes"

    id_cartao = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_cartao = Column(String(30), unique=True, nullable=False, index=True)
    id_cartao_valecard = Column(Integer, nullable=True)

    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)
    placa = Column(String(10), nullable=False, index=True)

    status_cartao = Column(String(20), nullable=False, default="ATIVO", index=True)
    tipo_cartao = Column(String(20), nullable=False, default="TITULAR")
    is_segunda_via = Column(Boolean, nullable=False, default=False)

    limite_atual = Column(Numeric(10, 2), nullable=False, default=0.00)
    saldo_disponivel = Column(Numeric(10, 2), nullable=False, default=0.00)
    novo_limite = Column(Numeric(10, 2), nullable=True)

    centro_custo_codigo = Column(String(50), nullable=True)
    centro_custo_descricao = Column(String(150), nullable=True)
    centro_resultado_codigo = Column(String(50), nullable=True)
    centro_resultado_descricao = Column(String(150), nullable=True)
    filial_descricao = Column(String(150), nullable=True)

    modelo_veiculo_valecard = Column(String(100), nullable=True)
    status_veiculo_valecard = Column(String(50), nullable=True)

    data_geracao_valecard = Column(DateTime(timezone=True), nullable=True)
    payload_raw = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    solicitacoes = relationship("ValeCardSolicitacaoCartao", back_populates="cartao")


class ValeCardSolicitacaoCartao(Base):
    """
    Modelo ORM para registro de solicitações de 2ª via de cartão.
    Tabela: tb_valecard_solicitacoes_cartao
    """
    __tablename__ = "tb_valecard_solicitacoes_cartao"

    id_solicitacao = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_cartao = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_cartoes.id_cartao", ondelete="SET NULL"), nullable=True)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True)

    placa = Column(String(10), nullable=False, index=True)
    numero_cartao_anterior = Column(String(30), nullable=True)
    motivo = Column(Text, nullable=False)

    solicitado_por = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True)
    status_solicitacao = Column(String(30), nullable=False, default="PROCESSADO")
    payload_resposta = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    cartao = relationship("ValeCardCartao", back_populates="solicitacoes")
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    tecnico = relationship("Tecnico", foreign_keys=[solicitado_por])


class ValeCardAlteracaoLimite(Base):
    """
    Modelo ORM para registro de alterações e ajustes de limites na ValeCard.
    Tabela: tb_valecard_alteracoes_limite
    """
    __tablename__ = "tb_valecard_alteracoes_limite"

    id_alteracao = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)
    id_cartao = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_cartoes.id_cartao", ondelete="SET NULL"), nullable=True, index=True)
    placa = Column(String(10), nullable=False, index=True)
    numero_cartao = Column(String(30), nullable=True)

    tipo_operacao = Column(String(20), nullable=False) # AUMENTAR, DIMINUIR, ALTERAR
    valor_alteracao = Column(Numeric(10, 2), nullable=False)
    limite_anterior = Column(Numeric(10, 2), nullable=True)
    novo_limite = Column(Numeric(10, 2), nullable=True)

    periodo = Column(String(20), nullable=False, default="atual")
    modulo = Column(String(30), nullable=False, default="abastecimento")
    motivo = Column(Text, nullable=False)

    solicitado_por = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True)
    status_operacao = Column(String(20), nullable=False, default="PROCESSADO")
    payload_requisicao = Column(JSONB, nullable=True)
    payload_resposta = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    cartao = relationship("ValeCardCartao", foreign_keys=[id_cartao])
    solicitante = relationship("Tecnico", foreign_keys=[solicitado_por])


class ValeCardMotorista(Base):
    """
    Modelo ORM para condutores e motoristas autorizados na ValeCard.
    Tabela: tb_valecard_motoristas
    """
    __tablename__ = "tb_valecard_motoristas"

    id_valecard_motorista = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_motorista_valecard = Column(BigInteger, unique=True, nullable=True, index=True)
    id_tecnico = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True, index=True)

    matricula = Column(String(50), nullable=False, index=True)
    nome_completo = Column(String(200), nullable=False)
    cpf = Column(String(14), nullable=False, index=True)

    rg = Column(String(30), nullable=True)
    orgao_emissor = Column(String(20), nullable=True)
    sexo = Column(String(1), nullable=True)
    cargo = Column(String(100), nullable=True)

    cnh_numero = Column(String(30), nullable=True)
    cnh_categoria = Column(String(10), nullable=True)
    cnh_vencimento = Column(Date, nullable=True, index=True)
    cnh_primeira_habilitacao = Column(Date, nullable=True)

    data_nascimento = Column(Date, nullable=True)
    data_admissao = Column(Date, nullable=True)

    status_motorista = Column(String(20), nullable=False, default="ATIVO", index=True)
    status_codigo = Column(String(5), nullable=False, default="A")

    telefone = Column(String(30), nullable=True)
    celular = Column(String(30), nullable=True)
    email = Column(String(150), nullable=True)
    centro_custo_codigo = Column(String(50), nullable=True)
    centro_resultado_codigo = Column(String(50), nullable=True)
    codigo_filial_frota = Column(String(50), nullable=True)
    descricao_filial = Column(String(150), nullable=True)

    payload_raw = Column(JSONB, nullable=True)
    sincronizado_em = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    tecnico = relationship("Tecnico", foreign_keys=[id_tecnico])


class ValeCardVeiculo(Base):
    """
    Modelo ORM para espelho e controle de status de abastecimento de veículos na ValeCard.
    Tabela: tb_valecard_veiculos
    """
    __tablename__ = "tb_valecard_veiculos"

    id_valecard_veiculo = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="CASCADE"), nullable=True, index=True)
    placa = Column(String(10), unique=True, nullable=False, index=True)

    codigo_status = Column(String(5), nullable=False, default="1")
    status_valecard = Column(String(20), nullable=False, default="ATIVO", index=True)
    bloqueio_abastecimento = Column(Boolean, nullable=False, default=False, index=True)
    motivo_bloqueio = Column(Text, nullable=True)

    hodometro_cadastrado = Column(Numeric(10, 2), nullable=False, default=0.00)
    valor_aquisicao = Column(Numeric(10, 2), nullable=False, default=0.00)
    codigo_filial = Column(String(50), nullable=True)
    codigo_centro_custo = Column(String(50), nullable=True)
    codigo_centro_resultado = Column(String(50), nullable=True)
    propriedade = Column(String(30), nullable=False, default="LEASING")

    payload_cadastro = Column(JSONB, nullable=True)
    payload_atualizacao = Column(JSONB, nullable=True)
    sincronizado_em = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])


class ValeCardVinculo(Base):
    """
    Modelo ORM para histórico e estado de vínculos Veículo x Motorista na ValeCard.
    Tabela: tb_valecard_vinculos
    """
    __tablename__ = "tb_valecard_vinculos"

    id_vinculo = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)
    id_tecnico = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True, index=True)

    placa = Column(String(10), nullable=False, index=True)
    matricula_motorista = Column(String(50), nullable=False, index=True)
    operacao = Column(String(5), nullable=False) # 'V': Vínculo, 'D': Desvínculo
    status_vinculo = Column(String(20), nullable=False, default="ATIVO", index=True) # ATIVO, DESVINCULADO, FALHA
    motivo = Column(Text, nullable=True)

    solicitado_por = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True)
    sucesso = Column(Boolean, nullable=False, default=True)
    mensagem_retorno = Column(Text, nullable=True)
    payload_requisicao = Column(JSONB, nullable=True)
    payload_resposta = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])
    tecnico = relationship("Tecnico", foreign_keys=[id_tecnico])
    solicitante = relationship("Tecnico", foreign_keys=[solicitado_por])


class ValeCardResponsavel(Base):
    """
    Modelo ORM para gestores e responsáveis cadastrados no SIAG ValeCard.
    Tabela: tb_valecard_responsaveis
    """
    __tablename__ = "tb_valecard_responsaveis"

    id_valecard_responsavel = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_tecnico = Column(Integer, ForeignKey("tb_tecnico.id_tecnico", ondelete="SET NULL"), nullable=True, index=True)

    nome_responsavel = Column(String(100), nullable=False)
    matricula = Column(String(50), unique=True, nullable=False, index=True)
    cpf = Column(String(14), unique=True, nullable=False, index=True)
    rg = Column(String(30), nullable=False)
    data_nascimento = Column(Date, nullable=False)
    telefone = Column(String(25), nullable=False)
    email = Column(String(200), nullable=False)

    cep = Column(String(10), nullable=False)
    tipo_logradouro = Column(String(40), nullable=False)
    logradouro = Column(String(120), nullable=False)
    numero = Column(String(20), nullable=False)
    complemento = Column(String(50), nullable=True)
    bairro = Column(String(100), nullable=False)
    cidade = Column(String(100), nullable=False)
    estado = Column(String(2), nullable=False)

    status_cadastro = Column(String(20), nullable=False, default="CADASTRADO")
    payload_requisicao = Column(JSONB, nullable=True)
    payload_resposta = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    tecnico = relationship("Tecnico", foreign_keys=[id_tecnico])


class ValeCardFaturamento(Base):
    """
    Modelo ORM para faturamento e fechamento fiscal consolidado da ValeCard.
    Tabela: tb_valecard_faturamento
    """
    __tablename__ = "tb_valecard_faturamento"

    id_faturamento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_titulo = Column(String(50), nullable=False, index=True)
    data_inicio = Column(Date, nullable=False, index=True)
    data_fim = Column(Date, nullable=False, index=True)

    valor_liquido = Column(Numeric(10, 2), nullable=False, default=0.00)
    valor_total_transacoes = Column(Numeric(10, 2), nullable=False, default=0.00)
    divergencia_contabil = Column(Numeric(10, 2), nullable=False, default=0.00)
    total_transacoes = Column(Integer, nullable=False, default=0)

    status_faturamento = Column(String(30), nullable=False, default="FECHADO", index=True)
    observacoes_conciliacao = Column(Text, nullable=True)

    payload_raw = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    itens = relationship("ValeCardFaturamentoItem", back_populates="faturamento", cascade="all, delete-orphan")


class ValeCardFaturamentoItem(Base):
    """
    Modelo ORM para detalhamento de transações faturadas em cada título ValeCard.
    Tabela: tb_valecard_faturamento_itens
    """
    __tablename__ = "tb_valecard_faturamento_itens"

    id_item_faturamento = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_faturamento = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_faturamento.id_faturamento", ondelete="CASCADE"), nullable=False, index=True)
    id_transacao = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_transacoes.id_transacao", ondelete="SET NULL"), nullable=True, index=True)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)

    placa = Column(String(10), nullable=False, index=True)
    numero_cartao = Column(String(30), nullable=True)
    cpf_motorista = Column(String(14), nullable=True)
    nome_motorista = Column(String(150), nullable=True)
    data_transacao = Column(DateTime(timezone=True), nullable=False)

    tipo_combustivel = Column(String(50), nullable=True)
    quantidade_litros = Column(Numeric(10, 3), nullable=False)
    valor_unitario = Column(Numeric(10, 3), nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)

    hodometro = Column(Numeric(10, 2), nullable=True)
    distancia_km = Column(Numeric(10, 2), nullable=True)
    consumo_kml = Column(Numeric(10, 2), nullable=True)
    reais_por_km = Column(Numeric(10, 3), nullable=True)

    posto_cnpj = Column(String(18), nullable=True)
    posto_nome_fantasia = Column(String(150), nullable=True)
    posto_cidade = Column(String(100), nullable=True)
    posto_uf = Column(String(2), nullable=True)

    payload_raw = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    faturamento = relationship("ValeCardFaturamento", back_populates="itens")
    transacao = relationship("ValeCardTransacao", foreign_keys=[id_transacao])
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])


class ValeCardEstorno(Base):
    """
    Modelo ORM para registro e auditoria de transações de combustível estornadas.
    Tabela: tb_valecard_estornos
    """
    __tablename__ = "tb_valecard_estornos"

    id_estorno = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nsu_transacao = Column(String(60), nullable=False, index=True)
    id_transacao = Column(UUID(as_uuid=True), ForeignKey("tb_valecard_transacoes.id_transacao", ondelete="SET NULL"), nullable=True, index=True)
    id_veiculo = Column(UUID(as_uuid=True), ForeignKey("tb_frota_veiculos.id_veiculo", ondelete="SET NULL"), nullable=True, index=True)
    placa = Column(String(10), nullable=False, index=True)

    data_estorno = Column(DateTime(timezone=True), nullable=False, index=True)
    data_transacao = Column(DateTime(timezone=True), nullable=False)

    nome_motorista = Column(String(150), nullable=True)
    produto = Column(String(50), nullable=True)
    quantidade_litros = Column(Numeric(10, 3), nullable=False)
    valor_unitario = Column(Numeric(10, 3), nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)
    hodometro = Column(Numeric(10, 2), nullable=True)

    posto_nome_fantasia = Column(String(150), nullable=True)
    posto_terminal = Column(String(50), nullable=True)

    status_estorno = Column(String(30), nullable=False, default="PROCESSADO")
    payload_raw = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False)

    # Relacionamentos
    transacao = relationship("ValeCardTransacao", foreign_keys=[id_transacao])
    veiculo = relationship("Veiculo", foreign_keys=[id_veiculo])

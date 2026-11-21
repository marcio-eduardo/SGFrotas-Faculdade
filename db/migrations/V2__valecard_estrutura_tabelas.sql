-- =====================================================================
-- Migration V2: Módulo Integrado de Combustível ValeCard REST
-- Sistema: SGFrotas (VeloceTech Serviços Técnicos & Conectividade S.A.)
-- Database: PostgreSQL 15+ (Schema public)
-- =====================================================================

-- >>> V82__frota_valecard_transacoes_core.sql >>>
-- =====================================================================
-- Migration: V82__frota_valecard_transacoes_core.sql
-- Descrição: Criação das tabelas core de integração ValeCard e
--            rastreamento de anomalias/fraudes de combustível.
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

-- 1. TABELA PRINCIPAL DE TRANSAÇÕES VALECARD (ABASTECIMENTOS & TELEMETRIA)
CREATE TABLE IF NOT EXISTS tb_valecard_transacoes (
    -- Identificador Primário Imutável
    id_transacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Chave Natural Única (Idempotência Absoluta da ValeCard)
    nsu_transacao VARCHAR(60) NOT NULL UNIQUE,

    -- Chaves Estrangeiras Opcionais (comportamento desacoplado)
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    id_tecnico INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,

    -- Snapshot Histórico Fiscais/Bomba (Imutabilidade Contábil)
    numero_cartao VARCHAR(30),
    placa VARCHAR(10) NOT NULL,
    cpf_motorista VARCHAR(14),
    nome_motorista VARCHAR(150),
    matricula_motorista VARCHAR(50),

    -- Dados do Estabelecimento / Posto Credenciado
    posto_cnpj VARCHAR(18),
    posto_nome_fantasia VARCHAR(150),
    posto_cidade VARCHAR(100),
    posto_uf VARCHAR(2),

    -- Dados da Transação e Combustível (Zero Ponto Flutuante)
    tipo_combustivel VARCHAR(50),
    quantidade_litros NUMERIC(8, 3) NOT NULL,
    valor_unitario NUMERIC(10, 3) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    hodometro NUMERIC(10, 2),
    distancia_percorrida NUMERIC(10, 2),
    consumo_medio_kml NUMERIC(6, 2),

    -- Motor de Auditoria e Status
    status_auditoria VARCHAR(30) NOT NULL DEFAULT 'APROVADO',
    motivo_auditoria TEXT,
    origem_ingestao VARCHAR(30) NOT NULL DEFAULT 'API_REST',

    -- Trilha de Auditoria Integral e Compliance (Payload Bruto JSON)
    payload_raw JSONB,

    -- Timestamps com Fuso Horário
    data_hora_transacao TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    -- Constraints Defensivas
    CONSTRAINT chk_valecard_litros_positivo CHECK (quantidade_litros > 0),
    CONSTRAINT chk_valecard_valor_total_valido CHECK (valor_total >= 0),
    CONSTRAINT chk_valecard_valor_unitario_valido CHECK (valor_unitario >= 0),
    CONSTRAINT chk_valecard_status_auditoria CHECK (
        status_auditoria IN ('APROVADO', 'ALERTA_FRAUDE', 'PENDENTE_CONCILIACAO', 'ESTORNADO')
    ),
    CONSTRAINT chk_valecard_origem_ingestao CHECK (
        origem_ingestao IN ('API_REST', 'IMPORTACAO_CSV', 'MANUAL')
    )
);

-- Comentários de Governança
COMMENT ON TABLE tb_valecard_transacoes IS 'Registro imutável de transações e abastecimentos de combustível integrados via webservice ValeCard.';
COMMENT ON COLUMN tb_valecard_transacoes.nsu_transacao IS 'Identificador único da transação gerado pela rede autorizadora ValeCard (chave natural de idempotência).';
COMMENT ON COLUMN tb_valecard_transacoes.payload_raw IS 'Payload JSON completo recebido da API ValeCard para auditoria contábil e compliance.';

-- 2. ÍNDICES DE ALTA PERFORMANCE (tb_valecard_transacoes)
-- Consulta histórica por veículo na linha do tempo
CREATE INDEX IF NOT EXISTS idx_valecard_transacoes_veiculo_data 
    ON tb_valecard_transacoes(id_veiculo, data_hora_transacao DESC);

-- Extrato de abastecimentos por motorista / CPF
CREATE INDEX IF NOT EXISTS idx_valecard_transacoes_motorista_data 
    ON tb_valecard_transacoes(cpf_motorista, data_hora_transacao DESC);

-- Agrupamentos de Dashboard e Fechamento Mensal
CREATE INDEX IF NOT EXISTS idx_valecard_transacoes_data_status 
    ON tb_valecard_transacoes(data_hora_transacao DESC, status_auditoria);

-- Índice Parcial de Alto Desempenho para Transações com Anomalias/Fraude
CREATE INDEX IF NOT EXISTS idx_valecard_transacoes_alertas 
    ON tb_valecard_transacoes(status_auditoria) 
    WHERE status_auditoria != 'APROVADO';

-- Índice GIN para busca avançada dentro do payload JSONB
CREATE INDEX IF NOT EXISTS idx_valecard_transacoes_payload 
    ON tb_valecard_transacoes USING GIN (payload_raw);


-- 3. TABELA DE RASTREAMENTO DE ANOMALIAS E AUDITORIA DE COMBUSTÍVEL
CREATE TABLE IF NOT EXISTS tb_frota_alertas_combustivel (
    id_alerta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_transacao UUID NOT NULL REFERENCES tb_valecard_transacoes(id_transacao) ON DELETE CASCADE,
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    id_tecnico INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,

    -- Tipo de Inconsistência Detectada
    tipo_anomalia VARCHAR(50) NOT NULL,
    detalhes TEXT NOT NULL,

    -- Workflow de Análise e Resolução pelo Gestor
    status_resolucao VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    justificativa_gestor TEXT,
    resolvido_por INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    data_resolucao TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT chk_alerta_tipo_anomalia CHECK (
        tipo_anomalia IN (
            'TANQUE_EXCEDENTE', 
            'INVERSAO_ODOMETRO', 
            'DESVIO_EFICIENCIA', 
            'SEM_CUSTODIA_ATIVA',
            'ABASTECIMENTO_DUPLICADO',
            'VALOR_UNITARIO_SUSPEITO'
        )
    ),
    CONSTRAINT chk_alerta_status_resolucao CHECK (
        status_resolucao IN ('PENDENTE', 'JUSTIFICADO', 'CONFIRMADO_FRAUDE', 'ARQUIVADO')
    )
);

-- Comentários
COMMENT ON TABLE tb_frota_alertas_combustivel IS 'Fila de auditoria e resolução de inconsistências/fraudes detectadas no abastecimento.';

-- Índices para painel de resolução
CREATE INDEX IF NOT EXISTS idx_frota_alertas_status_data 
    ON tb_frota_alertas_combustivel(status_resolucao, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_frota_alertas_transacao 
    ON tb_frota_alertas_combustivel(id_transacao);


-- >>> V83__frota_valecard_cartoes.sql >>>
-- =====================================================================
-- Migration: V83__frota_valecard_cartoes.sql
-- Descrição: Criação das tabelas de Gestão de Cartões de Combustível da Frota
--            e Trilha de Auditoria de Solicitação de 2ª Via.
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

-- 1. TABELA DE CARTÕES DA FROTA VALECARD
CREATE TABLE IF NOT EXISTS tb_valecard_cartoes (
    id_cartao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identificadores Naturais e Integrados
    numero_cartao VARCHAR(30) NOT NULL UNIQUE,
    id_cartao_valecard BIGINT,
    
    -- Vínculo com a Frota
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    placa VARCHAR(10) NOT NULL,
    
    -- Status e Tipagem do Cartão
    status_cartao VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    tipo_cartao VARCHAR(20) NOT NULL DEFAULT 'TITULAR',
    is_segunda_via BOOLEAN NOT NULL DEFAULT false,
    
    -- Limites e Saldos Financeiros (Zero Ponto Flutuante)
    limite_atual NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    saldo_disponivel NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    novo_limite NUMERIC(10, 2),
    
    -- Classificação Organizacional SIAG
    centro_custo_codigo VARCHAR(50),
    centro_custo_descricao VARCHAR(150),
    centro_resultado_codigo VARCHAR(50),
    centro_resultado_descricao VARCHAR(150),
    filial_descricao VARCHAR(150),
    
    -- Metadados do Veículo na ValeCard
    modelo_veiculo_valecard VARCHAR(100),
    status_veiculo_valecard VARCHAR(50),
    
    -- Auditoria e Timestamps
    data_geracao_valecard TIMESTAMPTZ,
    payload_raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    -- Constraints Defensivas
    CONSTRAINT chk_valecard_cartao_status CHECK (
        status_cartao IN ('ATIVO', 'BLOQUEADO', 'CANCELADO', 'INATIVO')
    ),
    CONSTRAINT chk_valecard_cartao_limite_positivo CHECK (limite_atual >= 0.00)
);

COMMENT ON TABLE tb_valecard_cartoes IS 'Cadastro sincronizado de cartões de combustível vinculados aos veículos da frota.';
COMMENT ON COLUMN tb_valecard_cartoes.numero_cartao IS 'Número de identificação do cartão de abastecimento com 16 dígitos.';
COMMENT ON COLUMN tb_valecard_cartoes.saldo_disponivel IS 'Saldo remanescente para abastecimento informado pelo gateway da ValeCard.';

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_valecard_cartoes_veiculo 
    ON tb_valecard_cartoes(id_veiculo);

CREATE INDEX IF NOT EXISTS idx_valecard_cartoes_placa 
    ON tb_valecard_cartoes(placa);

CREATE INDEX IF NOT EXISTS idx_valecard_cartoes_status 
    ON tb_valecard_cartoes(status_cartao);


-- 2. TABELA DE SOLICITAÇÕES DE 2ª VIA DE CARTÃO
CREATE TABLE IF NOT EXISTS tb_valecard_solicitacoes_cartao (
    id_solicitacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cartao UUID REFERENCES tb_valecard_cartoes(id_cartao) ON DELETE SET NULL,
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    
    placa VARCHAR(10) NOT NULL,
    numero_cartao_anterior VARCHAR(30),
    motivo TEXT NOT NULL,
    
    solicitado_por INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    status_solicitacao VARCHAR(30) NOT NULL DEFAULT 'PROCESSADO',
    payload_resposta JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    
    CONSTRAINT chk_solicitacao_status CHECK (
        status_solicitacao IN ('PROCESSADO', 'ERRO', 'AGUARDANDO_EMISSAO')
    )
);

COMMENT ON TABLE tb_valecard_solicitacoes_cartao IS 'Trilha de auditoria das emissões de 2ª via de cartões solicitadas ao webservice ValeCard.';

CREATE INDEX IF NOT EXISTS idx_valecard_solic_placa 
    ON tb_valecard_solicitacoes_cartao(placa);

CREATE INDEX IF NOT EXISTS idx_valecard_solic_data 
    ON tb_valecard_solicitacoes_cartao(created_at DESC);


-- >>> V84__frota_valecard_alteracoes_limite.sql >>>
-- =====================================================================
-- Migration: V84__frota_valecard_alteracoes_limite.sql
-- Descrição: Criação da tabela de Auditoria e Histórico de Alterações de Limite de Combustível
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

-- TABELA DE ALTERAÇÕES DE LIMITE VALECARD
CREATE TABLE IF NOT EXISTS tb_valecard_alteracoes_limite (
    id_alteracao UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vínculos relacionais (ON DELETE SET NULL para histórico imutável)
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    id_cartao UUID REFERENCES tb_valecard_cartoes(id_cartao) ON DELETE SET NULL,
    placa VARCHAR(10) NOT NULL,
    numero_cartao VARCHAR(30),

    -- Operação Financeira (Zero Ponto Flutuante)
    tipo_operacao VARCHAR(20) NOT NULL, -- 'AUMENTAR', 'DIMINUIR', 'ALTERAR'
    valor_alteracao NUMERIC(10, 2) NOT NULL,
    limite_anterior NUMERIC(10, 2),
    novo_limite NUMERIC(10, 2),

    -- Parâmetros da Requisição ValeCard
    periodo VARCHAR(20) NOT NULL DEFAULT 'atual',
    modulo VARCHAR(30) NOT NULL DEFAULT 'abastecimento',
    motivo TEXT NOT NULL,

    -- Trilha de Auditoria
    solicitado_por INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    status_operacao VARCHAR(20) NOT NULL DEFAULT 'PROCESSADO', -- 'PROCESSADO', 'PENDENTE', 'FALHA'
    payload_requisicao JSONB,
    payload_resposta JSONB,

    -- Auditoria Temporal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices de Performance e Consulta Operacional
CREATE INDEX IF NOT EXISTS idx_valecard_alt_limite_placa ON tb_valecard_alteracoes_limite(placa);
CREATE INDEX IF NOT EXISTS idx_valecard_alt_limite_created ON tb_valecard_alteracoes_limite(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_valecard_alt_limite_veiculo ON tb_valecard_alteracoes_limite(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_valecard_alt_limite_cartao ON tb_valecard_alteracoes_limite(id_cartao);

-- Documentação de Catálogo
COMMENT ON TABLE tb_valecard_alteracoes_limite IS 'Trilha de auditoria e histórico de alterações de limites de saldo em cartões e veículos na ValeCard.';
COMMENT ON COLUMN tb_valecard_alteracoes_limite.tipo_operacao IS 'Tipo da alteração solicitada: AUMENTAR, DIMINUIR ou ALTERAR.';
COMMENT ON COLUMN tb_valecard_alteracoes_limite.valor_alteracao IS 'Valor numérico financeiro da alteração com 2 casas decimais.';
COMMENT ON COLUMN tb_valecard_alteracoes_limite.limite_anterior IS 'Snapshot do limite antes da confirmação da operação.';
COMMENT ON COLUMN tb_valecard_alteracoes_limite.novo_limite IS 'Novo limite efetivo após aplicação da operação.';


-- >>> V85__frota_valecard_motoristas.sql >>>
-- =====================================================================
-- Migration: V85__frota_valecard_motoristas.sql
-- Descrição: Criação da tabela de Gestão e Sincronização de Condutores/Motoristas ValeCard
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_valecard_motoristas (
    id_valecard_motorista UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificadores Naturais e Integrados
    id_motorista_valecard BIGINT UNIQUE,
    id_tecnico INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    matricula VARCHAR(50) NOT NULL,
    nome_completo VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) NOT NULL,

    -- Documentação Pessoal e Profissional
    rg VARCHAR(30),
    orgao_emissor VARCHAR(20),
    sexo VARCHAR(1), -- 'M' ou 'F'
    cargo VARCHAR(100),

    -- Carteira Nacional de Habilitação (CNH)
    cnh_numero VARCHAR(30),
    cnh_categoria VARCHAR(10),
    cnh_vencimento DATE,
    cnh_primeira_habilitacao DATE,

    -- Datas Cadastrais
    data_nascimento DATE,
    data_admissao DATE,

    -- Status Operacional na ValeCard
    status_motorista VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'BLOQUEADO', 'INATIVO', 'CANCELADO'
    status_codigo VARCHAR(5) NOT NULL DEFAULT 'A', -- 'A', 'B', 'I', 'C'

    -- Contato e Localização Corporativa
    telefone VARCHAR(30),
    celular VARCHAR(30),
    email VARCHAR(150),
    centro_custo_codigo VARCHAR(50),
    centro_resultado_codigo VARCHAR(50),
    codigo_filial_frota VARCHAR(50),
    descricao_filial VARCHAR(150),

    -- Auditoria e Snapshot JSONB
    payload_raw JSONB,
    sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices de Consulta Rápida e Relacionamento
CREATE INDEX IF NOT EXISTS idx_valecard_mot_cpf ON tb_valecard_motoristas(cpf);
CREATE INDEX IF NOT EXISTS idx_valecard_mot_matricula ON tb_valecard_motoristas(matricula);
CREATE INDEX IF NOT EXISTS idx_valecard_mot_tecnico ON tb_valecard_motoristas(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_valecard_mot_status ON tb_valecard_motoristas(status_motorista);
CREATE INDEX IF NOT EXISTS idx_valecard_mot_cnh_venc ON tb_valecard_motoristas(cnh_vencimento);

-- Documentação de Catálogo
COMMENT ON TABLE tb_valecard_motoristas IS 'Espelho dos motoristas e condutores autorizados na ValeCard vinculado à base de técnicos do SGFrotas.';
COMMENT ON COLUMN tb_valecard_motoristas.id_motorista_valecard IS 'Identificador numérico único do motorista no sistema ValeCard.';
COMMENT ON COLUMN tb_valecard_motoristas.status_motorista IS 'Status textual do condutor (ATIVO, BLOQUEADO, INATIVO, CANCELADO).';
COMMENT ON COLUMN tb_valecard_motoristas.status_codigo IS 'Código de status da ValeCard (A, B, I, C).';


-- >>> V86__frota_valecard_veiculos.sql >>>
-- =====================================================================
-- Migration: V86__frota_valecard_veiculos.sql
-- Descrição: Criação da tabela de Sincronização e Bloqueio de Veículos ValeCard
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_valecard_veiculos (
    id_valecard_veiculo UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vínculo com a Frota
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    placa VARCHAR(10) NOT NULL UNIQUE,

    -- Status e Bloqueio Preventivo na Bomba
    codigo_status VARCHAR(5) NOT NULL DEFAULT '1', -- 1: Ativo, 2: Inativo, 10: Fora de Uso, 12: Emprestado
    status_valecard VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- ATIVO, INATIVO, FORA_DE_USO, EMPRESTADO
    bloqueio_abastecimento BOOLEAN NOT NULL DEFAULT false,
    motivo_bloqueio TEXT,

    -- Metadados Técnicos e Contábeis ValeCard
    hodometro_cadastrado NUMERIC(10, 2) DEFAULT 0.00,
    valor_aquisicao NUMERIC(10, 2) DEFAULT 0.00,
    codigo_filial VARCHAR(50),
    codigo_centro_custo VARCHAR(50),
    codigo_centro_resultado VARCHAR(50),
    propriedade VARCHAR(30) DEFAULT 'LEASING',

    -- Auditoria e Snapshot JSONB
    payload_cadastro JSONB,
    payload_atualizacao JSONB,
    sincronizado_em TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices Operacionais
CREATE INDEX IF NOT EXISTS idx_valecard_veic_placa ON tb_valecard_veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_valecard_veic_veiculo ON tb_valecard_veiculos(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_valecard_veic_bloqueio ON tb_valecard_veiculos(bloqueio_abastecimento);
CREATE INDEX IF NOT EXISTS idx_valecard_veic_status ON tb_valecard_veiculos(status_valecard);

-- Documentação de Catálogo
COMMENT ON TABLE tb_valecard_veiculos IS 'Espelho e controle de status de abastecimento de veículos na ValeCard com suporte a bloqueio preventivo para manutenção e sinistros.';
COMMENT ON COLUMN tb_valecard_veiculos.codigo_status IS 'Código de status da ValeCard: 1-Ativo, 2-Inativo, 10-Fora de Uso, 12-Emprestado.';
COMMENT ON COLUMN tb_valecard_veiculos.bloqueio_abastecimento IS 'Sinalizador booleano de bloqueio ativo na bomba de combustível.';


-- >>> V87__frota_valecard_vinculos_e_responsaveis.sql >>>
-- =====================================================================
-- Migration: V87__frota_valecard_vinculos_e_responsaveis.sql
-- Descrição: Criação das tabelas de Vínculo Veículo x Motorista e Responsáveis ValeCard
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

-- 1. Tabela de Histórico e Estado de Vínculos Veículo x Motorista
CREATE TABLE IF NOT EXISTS tb_valecard_vinculos (
    id_vinculo UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relação com entidades centrais
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    id_tecnico INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,

    -- Dados da Operação ValeCard
    placa VARCHAR(10) NOT NULL,
    matricula_motorista VARCHAR(50) NOT NULL,
    operacao VARCHAR(5) NOT NULL, -- 'V': Vínculo, 'D': Desvínculo
    status_vinculo VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- 'ATIVO', 'DESVINCULADO', 'FALHA'
    motivo TEXT,

    -- Auditoria e Retorno da ValeCard
    solicitado_por INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    sucesso BOOLEAN NOT NULL DEFAULT true,
    mensagem_retorno TEXT,
    payload_requisicao JSONB,
    payload_resposta JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices Operacionais para Vínculos
CREATE INDEX IF NOT EXISTS idx_valecard_vinc_placa ON tb_valecard_vinculos(placa);
CREATE INDEX IF NOT EXISTS idx_valecard_vinc_matricula ON tb_valecard_vinculos(matricula_motorista);
CREATE INDEX IF NOT EXISTS idx_valecard_vinc_status ON tb_valecard_vinculos(status_vinculo);
CREATE INDEX IF NOT EXISTS idx_valecard_vinc_veiculo ON tb_valecard_vinculos(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_valecard_vinc_tecnico ON tb_valecard_vinculos(id_tecnico);

-- 2. Tabela de Cadastro de Responsáveis de Frota no SIAG ValeCard
CREATE TABLE IF NOT EXISTS tb_valecard_responsaveis (
    id_valecard_responsavel UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vinculação opcional com tb_tecnico se for colaborador interno
    id_tecnico INTEGER REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,

    -- Dados Pessoais do Responsável
    nome_responsavel VARCHAR(100) NOT NULL,
    matricula VARCHAR(50) NOT NULL UNIQUE,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(30) NOT NULL,
    data_nascimento DATE NOT NULL,
    telefone VARCHAR(25) NOT NULL,
    email VARCHAR(200) NOT NULL,

    -- Endereço Completo
    cep VARCHAR(10) NOT NULL,
    tipo_logradouro VARCHAR(40) NOT NULL,
    logradouro VARCHAR(120) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(50),
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,

    -- Status e Auditoria
    status_cadastro VARCHAR(20) NOT NULL DEFAULT 'CADASTRADO',
    payload_requisicao JSONB,
    payload_resposta JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices Operacionais para Responsáveis
CREATE INDEX IF NOT EXISTS idx_valecard_resp_cpf ON tb_valecard_responsaveis(cpf);
CREATE INDEX IF NOT EXISTS idx_valecard_resp_matricula ON tb_valecard_responsaveis(matricula);
CREATE INDEX IF NOT EXISTS idx_valecard_resp_tecnico ON tb_valecard_responsaveis(id_tecnico);

-- Documentação de Catálogo
COMMENT ON TABLE tb_valecard_vinculos IS 'Histórico e espelho operacional de vínculos e desvínculos entre veículos e condutores na ValeCard.';
COMMENT ON COLUMN tb_valecard_vinculos.operacao IS 'Código de operação ValeCard: V (Vínculo) ou D (Desvínculo).';
COMMENT ON COLUMN tb_valecard_vinculos.status_vinculo IS 'Status do vínculo no sistema: ATIVO, DESVINCULADO ou FALHA.';

COMMENT ON TABLE tb_valecard_responsaveis IS 'Registro e espelho de gestores e responsáveis cadastrados no SIAG ValeCard.';
COMMENT ON COLUMN tb_valecard_responsaveis.cpf IS 'Número de CPF único do responsável da frota.';


-- >>> V88__frota_valecard_faturamento_estornos.sql >>>
-- =====================================================================
-- Migration: V88__frota_valecard_faturamento_estornos.sql
-- Descrição: Tabelas de Fechamento Contábil, Faturamento e Estornos ValeCard
-- Autor: SGFrotas Backend Team
-- Data: 2026-10-14
-- Princípios: Database Design Best Practices (@skills/database-design)
-- =====================================================================

-- 1. Tabela Principal de Faturamento / Fechamento Fiscal (Notas Fiscais da ValeCard)
CREATE TABLE IF NOT EXISTS tb_valecard_faturamento (
    id_faturamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação Fiscal e Período de Apuração
    numero_titulo VARCHAR(50) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,

    -- Valores Contábeis com Precisão Monetária Exata
    valor_liquido NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    valor_total_transacoes NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    divergencia_contabil NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_transacoes INTEGER NOT NULL DEFAULT 0,

    -- Status da Conciliação
    status_faturamento VARCHAR(30) NOT NULL DEFAULT 'FECHADO', -- 'FECHADO', 'PROCESSADO', 'DIVERGENTE'
    observacoes_conciliacao TEXT,

    -- Auditoria e Snapshot
    payload_raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices Operacionais para Faturamento
CREATE INDEX IF NOT EXISTS idx_valecard_fat_titulo ON tb_valecard_faturamento(numero_titulo);
CREATE INDEX IF NOT EXISTS idx_valecard_fat_datas ON tb_valecard_faturamento(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_valecard_fat_status ON tb_valecard_faturamento(status_faturamento);

-- 2. Tabela de Detalhes / Itens da Fatura (Transações Faturadas)
CREATE TABLE IF NOT EXISTS tb_valecard_faturamento_itens (
    id_item_faturamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vínculos Estruturais
    id_faturamento UUID NOT NULL REFERENCES tb_valecard_faturamento(id_faturamento) ON DELETE CASCADE,
    id_transacao UUID REFERENCES tb_valecard_transacoes(id_transacao) ON DELETE SET NULL,
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,

    -- Identificação Operacional
    placa VARCHAR(10) NOT NULL,
    numero_cartao VARCHAR(30),
    cpf_motorista VARCHAR(14),
    nome_motorista VARCHAR(150),
    data_transacao TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Combustível e Valores
    tipo_combustivel VARCHAR(50),
    quantidade_litros NUMERIC(10, 3) NOT NULL,
    valor_unitario NUMERIC(10, 3) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,

    -- Telemetria e Rendimento no Fechamento
    hodometro NUMERIC(10, 2),
    distancia_km NUMERIC(10, 2),
    consumo_kml NUMERIC(10, 2),
    reais_por_km NUMERIC(10, 3),

    -- Estabelecimento
    posto_cnpj VARCHAR(18),
    posto_nome_fantasia VARCHAR(150),
    posto_cidade VARCHAR(100),
    posto_uf VARCHAR(2),

    -- Auditoria
    payload_raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_valecard_fat_itens_fat ON tb_valecard_faturamento_itens(id_faturamento);
CREATE INDEX IF NOT EXISTS idx_valecard_fat_itens_placa ON tb_valecard_faturamento_itens(placa);
CREATE INDEX IF NOT EXISTS idx_valecard_fat_itens_transacao ON tb_valecard_faturamento_itens(id_transacao);

-- 3. Tabela de Estornos de Transações de Combustível
CREATE TABLE IF NOT EXISTS tb_valecard_estornos (
    id_estorno UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação da Transação Original
    nsu_transacao VARCHAR(60) NOT NULL,
    id_transacao UUID REFERENCES tb_valecard_transacoes(id_transacao) ON DELETE SET NULL,
    id_veiculo UUID REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE SET NULL,
    placa VARCHAR(10) NOT NULL,

    -- Datas Críticas
    data_estorno TIMESTAMP WITH TIME ZONE NOT NULL,
    data_transacao TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Detalhes do Estorno
    nome_motorista VARCHAR(150),
    produto VARCHAR(50),
    quantidade_litros NUMERIC(10, 3) NOT NULL,
    valor_unitario NUMERIC(10, 3) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    hodometro NUMERIC(10, 2),

    -- Posto / Terminal
    posto_nome_fantasia VARCHAR(150),
    posto_terminal VARCHAR(50),

    -- Status e Auditoria
    status_estorno VARCHAR(30) NOT NULL DEFAULT 'PROCESSADO',
    payload_raw JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL
);

-- Índices Operacionais para Estornos
CREATE INDEX IF NOT EXISTS idx_valecard_est_nsu ON tb_valecard_estornos(nsu_transacao);
CREATE INDEX IF NOT EXISTS idx_valecard_est_placa ON tb_valecard_estornos(placa);
CREATE INDEX IF NOT EXISTS idx_valecard_est_data_estorno ON tb_valecard_estornos(data_estorno);
CREATE INDEX IF NOT EXISTS idx_valecard_est_transacao ON tb_valecard_estornos(id_transacao);

-- Documentação de Catálogo
COMMENT ON TABLE tb_valecard_faturamento IS 'Controle e conciliação contábil de notas fiscais e fechamentos de combustível da ValeCard.';
COMMENT ON COLUMN tb_valecard_faturamento.divergencia_contabil IS 'Diferença entre a soma dos itens faturados e o valor líquido da nota fiscal.';
COMMENT ON TABLE tb_valecard_estornos IS 'Registro auditado de transações de combustível canceladas/estornadas na ValeCard.';


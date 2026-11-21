-- =====================================================================
-- Migration V1: Estrutura Core de Frota & Autenticação RBAC Corporativa
-- Sistema: SGFrotas (VeloceTech Serviços Técnicos & Conectividade S.A.)
-- Database: PostgreSQL 15+ (Schema public)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. AUTENTICAÇÃO, ROLES & CONTROLE DE ACESSO (RBAC)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_perfis (
    id_perfil SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    nivel_acesso INT NOT NULL DEFAULT 1,
    permissoes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- =====================================================================
-- 2. CENTROS DE CUSTO & BASES ATP
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_centro_custo (
    id_centro_custo SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nome_operacao VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS tb_base_atp (
    id_base SERIAL PRIMARY KEY,
    ct_codigo VARCHAR(20) UNIQUE,
    nome_atp VARCHAR(200) NOT NULL,
    cidade VARCHAR(100),
    uf VARCHAR(2) NOT NULL,
    regiao VARCHAR(50),
    supervisor VARCHAR(150),
    supervisor_nome VARCHAR(100),
    coordenador_nome VARCHAR(100),
    ativa BOOLEAN DEFAULT TRUE,
    opera_frota BOOLEAN DEFAULT TRUE,
    status_base VARCHAR(30) DEFAULT 'OPERACIONAL',
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_base_atp_uf ON tb_base_atp(uf);
CREATE INDEX IF NOT EXISTS idx_base_atp_ativa ON tb_base_atp(ativa);
CREATE INDEX IF NOT EXISTS idx_base_atp_opera_frota ON tb_base_atp(opera_frota);

-- =====================================================================
-- 3. TÉCNICOS DE CAMPO & CONDUTORES
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_tecnico (
    id_tecnico SERIAL PRIMARY KEY,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    nome_completo VARCHAR(200) NOT NULL,
    cargo VARCHAR(100),
    status_colaborador VARCHAR(30) DEFAULT 'ATIVO',
    ativo BOOLEAN DEFAULT TRUE,
    cpf VARCHAR(20),
    rg VARCHAR(30),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    base_nome VARCHAR(100),
    projeto VARCHAR(100),
    gestor_rh VARCHAR(100),
    email VARCHAR(150),
    email_corporativo VARCHAR(150),
    celular_corporativo VARCHAR(30),
    cnh_numero VARCHAR(30),
    cnh_categoria VARCHAR(10),
    cnh_vencimento DATE,
    cnh_pontuacao INT DEFAULT 0,
    codigo_sap_fornecedor VARCHAR(50),
    id_centro_custo INT REFERENCES tb_centro_custo(id_centro_custo) ON DELETE SET NULL,
    id_base INT REFERENCES tb_base_atp(id_base) ON DELETE SET NULL,
    data_admissao DATE,
    data_demissao DATE,
    data_nascimento DATE,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_tecnico_matricula ON tb_tecnico(matricula);
CREATE INDEX IF NOT EXISTS idx_tecnico_nome ON tb_tecnico(nome_completo);
CREATE INDEX IF NOT EXISTS idx_tecnico_status ON tb_tecnico(ativo, status_colaborador);
CREATE INDEX IF NOT EXISTS idx_tecnico_cpf ON tb_tecnico(cpf);
CREATE INDEX IF NOT EXISTS idx_tecnico_cnh_vencimento ON tb_tecnico(cnh_vencimento);

-- =====================================================================
-- 4. USUÁRIOS DO SISTEMA & SESSÕES (Timeout 15 Minutos de Inatividade)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    matricula VARCHAR(30) UNIQUE NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_perfil INT NOT NULL REFERENCES tb_perfis(id_perfil),
    id_base INT REFERENCES tb_base_atp(id_base) ON DELETE SET NULL,
    id_tecnico INT REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    departamento VARCHAR(100),
    ativo BOOLEAN DEFAULT TRUE,
    ultimo_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON tb_usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON tb_usuarios(matricula);

CREATE TABLE IF NOT EXISTS tb_sessoes_ativas (
    id_sessao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL REFERENCES tb_usuarios(id_usuario) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    ultimo_acesso_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    expira_em TIMESTAMPTZ NOT NULL,
    revogado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_token ON tb_sessoes_ativas(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON tb_sessoes_ativas(id_usuario, revogado);

-- =====================================================================
-- 5. LOCADORAS & VEÍCULOS DA FROTA
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_locadoras (
    id_locadora SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    cnpj VARCHAR(18),
    contato_suporte VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS tb_frota_veiculos (
    id_veiculo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(10) UNIQUE NOT NULL,
    chassi VARCHAR(30),
    renavam VARCHAR(20),
    marca VARCHAR(50) DEFAULT 'RENAULT',
    modelo VARCHAR(120) NOT NULL DEFAULT 'RENAULT KWID HATCHBACK 1.0 Zen',
    ano INT DEFAULT 2026,
    id_locadora INT REFERENCES tb_frota_locadoras(id_locadora) ON DELETE SET NULL,
    id_base INT REFERENCES tb_base_atp(id_base) ON DELETE SET NULL,
    id_centro_custo INT REFERENCES tb_centro_custo(id_centro_custo) ON DELETE SET NULL,
    status_operacional VARCHAR(30) NOT NULL DEFAULT 'DISPONIVEL'
        CHECK (status_operacional IN ('DISPONIVEL', 'EM_USO', 'MANUTENCAO', 'PATIO', 'OFICINA', 'SINISTRADO', 'DEVOLVIDO')),
    hodometro_atual NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tanque_capacidade_litros NUMERIC(6,2) DEFAULT 50.00,
    franquia_mensal_km NUMERIC(10,2) DEFAULT 2800.00,
    franquia_final_km NUMERIC(10,2) DEFAULT 100800.00,
    custo_locacao_mensal NUMERIC(10,2) DEFAULT 1933.53,
    data_inicio_contrato DATE,
    data_fim_contrato DATE,
    meses_contrato INT DEFAULT 36,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON tb_frota_veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON tb_frota_veiculos(status_operacional);
CREATE INDEX IF NOT EXISTS idx_veiculos_base ON tb_frota_veiculos(id_base);

-- =====================================================================
-- 6. CUSTÓDIAS DE VEÍCULOS (VÍNCULO VEÍCULO X CONDUTOR)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_custodias (
    id_custodia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    id_tecnico INT NOT NULL REFERENCES tb_tecnico(id_tecnico) ON DELETE CASCADE,
    data_retirada TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    hodometro_retirada NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    data_devolucao TIMESTAMPTZ,
    hodometro_devolucao NUMERIC(10,2),
    status VARCHAR(30) NOT NULL DEFAULT 'ATIVA'
        CHECK (status IN ('ATIVA', 'ENCERRADA', 'PENDENTE')),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_custodias_veiculo ON tb_frota_custodias(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_custodias_tecnico ON tb_frota_custodias(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_custodias_status ON tb_frota_custodias(status);

-- =====================================================================
-- 7. MANUTENÇÕES PREVENTIVAS & OFICINAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_oficinas (
    id_oficina SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(20),
    telefone VARCHAR(30),
    email VARCHAR(150),
    endereco TEXT,
    cidade VARCHAR(100),
    uf VARCHAR(2),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS tb_frota_manutencoes (
    id_manutencao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    id_oficina INT REFERENCES tb_frota_oficinas(id_oficina) ON DELETE SET NULL,
    tipo_manutencao VARCHAR(30) NOT NULL DEFAULT 'PREVENTIVA'
        CHECK (tipo_manutencao IN ('PREVENTIVA', 'CORRETIVA', 'SINISTRO', 'GARANTIA')),
    ciclo_km INT,
    odometro_momento NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    proxima_revisao_km NUMERIC(10,2),
    data_agendamento DATE,
    data_realizacao DATE,
    valor_total NUMERIC(10,2) DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('AGENDADA', 'PENDENTE', 'CONCLUIDA', 'CANCELADA')),
    ordem_servico_numero VARCHAR(50),
    descricao_servico TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo ON tb_frota_manutencoes(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status ON tb_frota_manutencoes(status);

-- =====================================================================
-- 8. INFRAÇÕES DE TRÂNSITO, ÓRGÃOS & NOTIFICAÇÕES (PREVENÇÃO NIC)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_orgaos_autuadores (
    id_orgao SERIAL PRIMARY KEY,
    sigla VARCHAR(30) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    esfera VARCHAR(20) DEFAULT 'MUNICIPAL'
        CHECK (esfera IN ('MUNICIPAL', 'ESTADUAL', 'FEDERAL')),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS tb_frota_multas (
    id_multa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_ait VARCHAR(60) UNIQUE NOT NULL,
    id_veiculo UUID NOT NULL REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    id_tecnico INT REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    id_orgao INT REFERENCES tb_frota_orgaos_autuadores(id_orgao) ON DELETE SET NULL,
    data_hora_infracao TIMESTAMPTZ NOT NULL,
    local_infracao VARCHAR(250),
    codigo_infracao VARCHAR(30),
    descricao_infracao TEXT NOT NULL,
    gravidade VARCHAR(20) NOT NULL DEFAULT 'MEDIA'
        CHECK (gravidade IN ('LEVE', 'MEDIA', 'MÉDIA', 'GRAVE', 'GRAVISSIMA', 'GRAVÍSSIMA')),
    pontuacao INT NOT NULL DEFAULT 4,
    valor_original NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    valor_com_desconto NUMERIC(10,2),
    data_limite_indicacao DATE,
    data_limite_pagamento DATE,
    condutor_indicado BOOLEAN DEFAULT FALSE,
    data_envio_arval DATE,
    protocolo_indicacao VARCHAR(100),
    link_documento TEXT,
    status_pagamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_pagamento IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    status_cobranca_colaborador VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_ANALISE'
        CHECK (status_cobranca_colaborador IN ('PENDENTE_ANALISE', 'ISENTO', 'AUTORIZADO_DESCONTO', 'DESCONTADO_FOLHA', 'A_DESCONTAR')),
    mes_desconto_folha VARCHAR(7),
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_multas_ait ON tb_frota_multas(numero_ait);
CREATE INDEX IF NOT EXISTS idx_multas_veiculo ON tb_frota_multas(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_multas_tecnico ON tb_frota_multas(id_tecnico);
CREATE INDEX IF NOT EXISTS idx_multas_prazo ON tb_frota_multas(data_limite_indicacao, condutor_indicado);

-- =====================================================================
-- 9. GESTÃO DE SINISTROS, FURTOS & BOLETINS DE OCORRÊNCIA
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_sinistros (
    id_sinistro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    id_tecnico INT REFERENCES tb_tecnico(id_tecnico) ON DELETE SET NULL,
    numero_boletim_ocorrencia VARCHAR(50),
    arquivo_bo_pdf VARCHAR(150),
    data_hora_sinistro TIMESTAMPTZ NOT NULL,
    tipo_sinistro VARCHAR(30) NOT NULL DEFAULT 'FURTO'
        CHECK (tipo_sinistro IN ('FURTO', 'ROUBO', 'COLISAO_PT', 'COLISAO_PARCIAL', 'OFICINA_SINISTRO', 'AVARIA', 'OUTRO')),
    descricao_ocorrido TEXT,
    local_sinistro TEXT,
    houve_vitimas BOOLEAN DEFAULT FALSE,
    acionamento_seguro BOOLEAN DEFAULT TRUE,
    numero_sinistro_seguradora VARCHAR(50),
    franquia_cobrada BOOLEAN DEFAULT FALSE,
    valor_franquia NUMERIC(10,2) DEFAULT 0.00,
    situacao VARCHAR(30) NOT NULL DEFAULT 'EM_ANALISE_SEGURADORA'
        CHECK (situacao IN ('ABERTO', 'EM_ANALISE_SEGURADORA', 'INDENIZADO', 'RECUPERADO', 'ENCERRADO')),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_sinistros_veiculo ON tb_frota_sinistros(id_veiculo);
CREATE INDEX IF NOT EXISTS idx_sinistros_situacao ON tb_frota_sinistros(situacao);

-- =====================================================================
-- 10. TELEMETRIA DE FROTA (GPS / HODÔMETRO)
-- =====================================================================

CREATE TABLE IF NOT EXISTS tb_frota_telemetria (
    id_telemetria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_veiculo UUID NOT NULL REFERENCES tb_frota_veiculos(id_veiculo) ON DELETE CASCADE,
    data_leitura TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    hodometro_gps NUMERIC(10,2),
    score_conducao NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_telemetria_veiculo ON tb_frota_telemetria(id_veiculo);


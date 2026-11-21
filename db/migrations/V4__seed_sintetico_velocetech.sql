-- =====================================================================
-- Migration V4: Carga Inicial 100% Sintética (VeloceTech - LGPD)
-- Sistema: SGFrotas (VeloceTech Serviços Técnicos & Conectividade S.A.)
-- Database: PostgreSQL 15+ (Schema public)
-- Schema de referência: V1__init_frota_e_auth_core.sql
-- =====================================================================

-- 1. Perfis RBAC
INSERT INTO tb_perfis (codigo, nome, descricao, nivel_acesso) VALUES
('TI_ADMIN', 'TI - Administrador', 'Administração de infraestrutura, integrações e auditoria', 100),
('GESTOR_SUPERVISOR', 'Supervisor de Frota', 'Torre de controle, custódias, multas Anti-NIC e revisões', 50),
('TECNICO_OPERACIONAL', 'Técnico de Campo', 'Consulta de viatura cautelada e ocorrências', 10)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Locadora Parceira (Anonimizada)
INSERT INTO tb_frota_locadoras (nome, cnpj, contato_suporte) VALUES
('Alfa Fleet Locação S.A.', '00.000.000/0001-99', 'suporte@alfafleet.example.com')
ON CONFLICT (nome) DO NOTHING;

-- 3. 17 Bases Operacionais Regionais (BOP-01 a BOP-17)
INSERT INTO tb_base_atp (ct_codigo, nome_atp, cidade, uf, regiao, supervisor, ativa, opera_frota) VALUES
('BOP-01', 'BOP-01 (Curitiba)', 'Curitiba', 'PR', 'SUL', 'Sup. Regional Sul 01', TRUE, TRUE),
('BOP-02', 'BOP-02 (São Paulo)', 'São Paulo', 'SP', 'SUDESTE', 'Sup. Regional Sudeste 01', TRUE, TRUE),
('BOP-03', 'BOP-03 (Rio de Janeiro)', 'Rio de Janeiro', 'RJ', 'SUDESTE', 'Sup. Regional Sudeste 02', TRUE, TRUE),
('BOP-04', 'BOP-04 (Belo Horizonte)', 'Belo Horizonte', 'MG', 'SUDESTE', 'Sup. Regional Sudeste 03', TRUE, TRUE),
('BOP-05', 'BOP-05 (Campinas)', 'Campinas', 'SP', 'SUDESTE', 'Sup. Regional Sudeste 04', TRUE, TRUE),
('BOP-06', 'BOP-06 (Porto Alegre)', 'Porto Alegre', 'RS', 'SUL', 'Sup. Regional Sul 02', TRUE, TRUE),
('BOP-07', 'BOP-07 (Ribeirão Preto)', 'Ribeirão Preto', 'SP', 'SUDESTE', 'Sup. Regional Sudeste 05', TRUE, TRUE),
('BOP-08', 'BOP-08 (Florianópolis)', 'Florianópolis', 'SC', 'SUL', 'Sup. Regional Sul 03', TRUE, TRUE),
('BOP-09', 'BOP-09 (Londrina)', 'Londrina', 'PR', 'SUL', 'Sup. Regional Sul 04', TRUE, TRUE),
('BOP-10', 'BOP-10 (Salvador)', 'Salvador', 'BA', 'NORDESTE', 'Sup. Regional Nordeste 01', TRUE, TRUE),
('BOP-11', 'BOP-11 (Recife)', 'Recife', 'PE', 'NORDESTE', 'Sup. Regional Nordeste 02', TRUE, TRUE),
('BOP-12', 'BOP-12 (Vitória)', 'Vitória', 'ES', 'SUDESTE', 'Sup. Regional Sudeste 06', TRUE, TRUE),
('BOP-13', 'BOP-13 (Brasília)', 'Brasília', 'DF', 'CENTRO-OESTE', 'Sup. Regional Centro-Oeste 01', TRUE, TRUE),
('BOP-14', 'BOP-14 (Fortaleza)', 'Fortaleza', 'CE', 'NORDESTE', 'Sup. Regional Nordeste 03', TRUE, TRUE),
('BOP-15', 'BOP-15 (Manaus)', 'Manaus', 'AM', 'NORTE', 'Sup. Regional Norte 01', TRUE, TRUE),
('BOP-16', 'BOP-16 (Goiânia)', 'Goiânia', 'GO', 'CENTRO-OESTE', 'Sup. Regional Centro-Oeste 02', TRUE, TRUE),
('BOP-17', 'BOP-17 (Natal)', 'Natal', 'RN', 'NORDESTE', 'Sup. Regional Nordeste 04', TRUE, TRUE)
ON CONFLICT (ct_codigo) DO NOTHING;

-- 4. Condutores Sintéticos (Ativos e Histórico para Testes de Governança)
INSERT INTO tb_tecnico (
    matricula, nome_completo, cargo, status_colaborador, ativo,
    cpf, cnh_numero, cnh_categoria, cnh_vencimento, cnh_pontuacao, id_base
) VALUES
('VLC-1001', 'Condutor Sintético 001', 'Técnico de Campo', 'ATIVO', TRUE, '000.000.001-01', '10000000001', 'B', '2028-06-30', 0, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-01')),
('VLC-1002', 'Condutor Sintético 002', 'Técnico de Campo', 'ATIVO', TRUE, '000.000.002-02', '10000000002', 'B', '2028-09-15', 4, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-02')),
('VLC-1003', 'Condutor Sintético 003', 'Técnico de Campo', 'ATIVO', TRUE, '000.000.003-03', '10000000003', 'B', '2027-12-20', 0, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-04')),
('VLC-1004', 'Condutor Sintético 004', 'Técnico de Campo', 'ATIVO', TRUE, '000.000.004-04', '10000000004', 'B', '2028-03-10', 6, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-05')),
('VLC-1005', 'Condutor Sintético 005', 'Técnico de Campo', 'DESLIGADO', FALSE, '000.000.005-05', '10000000005', 'B', '2027-01-10', 0, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-11')),
('VLC-10492', 'Rafael Costa', 'Técnico de Telecomunicações Pl.', 'ATIVO', TRUE, '000.000.092-92', '10000000092', 'B', '2028-11-30', 0, (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-01'))
ON CONFLICT (matricula) DO NOTHING;

-- 4.1. Usuários de Acesso RBAC (tb_usuarios - senha sintética de demonstração: veloce@2026)
INSERT INTO tb_usuarios (
    nome_completo, email, matricula, password_hash, id_perfil, id_base, id_tecnico, departamento, ativo
) VALUES
(
    'Ana Beatriz Souza',
    'ti.admin@velocetech.com.br',
    'VLC-90812',
    'pbkdf2_sha256$sgfrotas-velocetech-2026$120000$87214552d4145978ab0b63217db10d150dc92c9cc0a05ee895153a542a7115ac',
    (SELECT id_perfil FROM tb_perfis WHERE codigo = 'TI_ADMIN'),
    (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-01'),
    NULL,
    'Tecnologia da Informação & Infraestrutura',
    TRUE
),
(
    'Marcos Vinícius Lima',
    'supervisor.frota@velocetech.com.br',
    'VLC-44105',
    'pbkdf2_sha256$sgfrotas-velocetech-2026$120000$87214552d4145978ab0b63217db10d150dc92c9cc0a05ee895153a542a7115ac',
    (SELECT id_perfil FROM tb_perfis WHERE codigo = 'GESTOR_SUPERVISOR'),
    (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-02'),
    NULL,
    'Gestão de Frota & Logística Regional',
    TRUE
),
(
    'Rafael Costa',
    'rafael.costa@velocetech.com.br',
    'VLC-10492',
    'pbkdf2_sha256$sgfrotas-velocetech-2026$120000$87214552d4145978ab0b63217db10d150dc92c9cc0a05ee895153a542a7115ac',
    (SELECT id_perfil FROM tb_perfis WHERE codigo = 'TECNICO_OPERACIONAL'),
    (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-01'),
    (SELECT id_tecnico FROM tb_tecnico WHERE matricula = 'VLC-10492'),
    'Operações de Campo - Sul',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- 5. Veículos Sintéticos (Frota Modelo VeloceTech)
INSERT INTO tb_frota_veiculos (
    placa, marca, modelo, ano, id_locadora, id_base, status_operacional,
    hodometro_atual, tanque_capacidade_litros, data_inicio_contrato, data_fim_contrato
) VALUES
('VLC0A01', 'RENAULT', 'Renault Kwid Zen 1.0', 2025, (SELECT id_locadora FROM tb_frota_locadoras LIMIT 1), (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-01'), 'EM_USO', 19650.00, 50.00, '2025-01-15', '2028-01-15'),
('VLC0A02', 'FIAT', 'Fiat Mobi Like 1.0', 2025, (SELECT id_locadora FROM tb_frota_locadoras LIMIT 1), (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-02'), 'EM_USO', 17350.00, 47.00, '2025-01-15', '2028-01-15'),
('VLC0A03', 'FIAT', 'Fiat Fiorino Endurance 1.4', 2024, (SELECT id_locadora FROM tb_frota_locadoras LIMIT 1), (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-04'), 'EM_USO', 28910.00, 58.00, '2024-06-01', '2027-06-01'),
('VLC0A04', 'RENAULT', 'Renault Kwid Zen 1.0', 2025, (SELECT id_locadora FROM tb_frota_locadoras LIMIT 1), (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-05'), 'DISPONIVEL', 12400.00, 50.00, '2025-03-01', '2028-03-01'),
('VLC0A05', 'RENAULT', 'Renault Kwid Zen 1.0', 2024, (SELECT id_locadora FROM tb_frota_locadoras LIMIT 1), (SELECT id_base FROM tb_base_atp WHERE ct_codigo = 'BOP-11'), 'MANUTENCAO', 30150.00, 50.00, '2024-04-10', '2027-04-10')
ON CONFLICT (placa) DO NOTHING;

-- 6. Órgãos Autuadores & Multa Sintética para Testes Anti-NIC
INSERT INTO tb_frota_orgaos_autuadores (sigla, nome, esfera) VALUES
('PRF', 'Polícia Rodoviária Federal', 'FEDERAL'),
('DETRAN-PR', 'Departamento de Trânsito do Paraná', 'ESTADUAL'),
('CET-SP', 'Companhia de Engenharia de Tráfego', 'MUNICIPAL')
ON CONFLICT (sigla) DO NOTHING;

INSERT INTO tb_frota_multas (
    numero_ait, id_veiculo, id_tecnico, id_orgao, data_hora_infracao,
    local_infracao, codigo_infracao, descricao_infracao, gravidade, pontuacao,
    valor_original, data_limite_indicacao, condutor_indicado
)
SELECT
    'AIT-VLC-2026-001',
    v.id_veiculo,
    NULL,
    (SELECT id_orgao FROM tb_frota_orgaos_autuadores WHERE sigla = 'PRF'),
    '2026-11-10 14:35:00+00',
    'Rodovia BR-116 Km 102',
    '74550',
    'Transitar em velocidade superior à máxima permitida em até 20%',
    'MEDIA',
    4,
    130.16,
    CURRENT_DATE + INTERVAL '4 days',
    FALSE
FROM tb_frota_veiculos v
WHERE v.placa = 'VLC0A01'
ON CONFLICT (numero_ait) DO NOTHING;

-- 7. Custódias Ativas Sintéticas (Garante vínculo temporal Anti-NIC e ranking inicial)
INSERT INTO tb_frota_custodias (
    id_veiculo, id_tecnico, data_retirada, hodometro_retirada, status, observacoes
)
SELECT v.id_veiculo, t.id_tecnico, '2026-01-15 08:00:00+00', 12000.00, 'ATIVA', 'Cautela operacional inicial VeloceTech'
FROM tb_frota_veiculos v
JOIN tb_tecnico t ON t.matricula = 'VLC-1001'
WHERE v.placa = 'VLC0A01'
  AND NOT EXISTS (
      SELECT 1 FROM tb_frota_custodias c WHERE c.id_veiculo = v.id_veiculo AND c.status = 'ATIVA'
  );

INSERT INTO tb_frota_custodias (
    id_veiculo, id_tecnico, data_retirada, hodometro_retirada, status, observacoes
)
SELECT v.id_veiculo, t.id_tecnico, '2026-02-01 08:30:00+00', 11000.00, 'ATIVA', 'Cautela operacional inicial VeloceTech'
FROM tb_frota_veiculos v
JOIN tb_tecnico t ON t.matricula = 'VLC-1002'
WHERE v.placa = 'VLC0A02'
  AND NOT EXISTS (
      SELECT 1 FROM tb_frota_custodias c WHERE c.id_veiculo = v.id_veiculo AND c.status = 'ATIVA'
  );

INSERT INTO tb_frota_custodias (
    id_veiculo, id_tecnico, data_retirada, hodometro_retirada, status, observacoes
)
SELECT v.id_veiculo, t.id_tecnico, '2026-02-10 09:00:00+00', 18000.00, 'ATIVA', 'Cautela operacional inicial VeloceTech'
FROM tb_frota_veiculos v
JOIN tb_tecnico t ON t.matricula = 'VLC-1003'
WHERE v.placa = 'VLC0A03'
  AND NOT EXISTS (
      SELECT 1 FROM tb_frota_custodias c WHERE c.id_veiculo = v.id_veiculo AND c.status = 'ATIVA'
  );

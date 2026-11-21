-- =====================================================================
-- Migration V5: Seed Sintético de Contingência (Combustível & Faturas)
-- Sistema: SGFrotas (VeloceTech Serviços Técnicos & Conectividade S.A.)
-- Database: PostgreSQL 15+ (Schema public)
-- Schema de referência: V2__valecard_estrutura_tabelas.sql
-- =====================================================================

-- 1. Gestores Responsáveis (tb_valecard_responsaveis)
INSERT INTO tb_valecard_responsaveis (
    nome_responsavel, matricula, cpf, rg, data_nascimento, telefone, email,
    cep, tipo_logradouro, logradouro, numero, bairro, cidade, estado, status_cadastro
) VALUES
(
    'Gestor Frota Regional', 'RESP001', '000.000.001-01', '00.000.001-0', '1988-05-15',
    '(41) 90000-0001', 'frota.gestao@velocetech.com.br',
    '80000-000', 'Avenida', 'Modelo Central', '100', 'Centro', 'Curitiba', 'PR', 'CADASTRADO'
),
(
    'Coordenação Operacional Frota', 'RESP002', '000.000.002-02', '00.000.002-0', '1985-09-20',
    '(41) 90000-0002', 'ti.frota@velocetech.com.br',
    '80000-000', 'Avenida', 'Modelo Central', '100', 'Centro', 'Curitiba', 'PR', 'CADASTRADO'
)
ON CONFLICT (matricula) DO NOTHING;

-- 2. Base de Cartões de Combustível & Controle Preventivo de Bomba
INSERT INTO tb_valecard_cartoes (
    numero_cartao, placa, status_cartao, tipo_cartao, is_segunda_via,
    limite_atual, saldo_disponivel, filial_descricao, modelo_veiculo_valecard, status_veiculo_valecard
) VALUES
('6035.1234.0001.9901', 'VLC0A01', 'ATIVO', 'TITULAR', FALSE, 2500.00, 1450.00, 'BOP-01 (Curitiba - PR)', 'Renault Kwid Zen 1.0', 'ATIVO'),
('6035.1234.0002.9902', 'VLC0A02', 'ATIVO', 'TITULAR', FALSE, 2500.00, 1820.00, 'BOP-02 (São Paulo - SP)', 'Fiat Mobi Like 1.0', 'ATIVO'),
('6035.1234.0003.9903', 'VLC0A03', 'ATIVO', 'TITULAR', FALSE, 2500.00, 980.50, 'BOP-04 (Belo Horizonte - MG)', 'Fiorino Endurance 1.4', 'ATIVO'),
('6035.1234.0004.9904', 'VLC0A04', 'ATIVO', 'TITULAR', FALSE, 2500.00, 2100.00, 'BOP-05 (Campinas - SP)', 'Renault Kwid Zen 1.0', 'ATIVO'),
('6035.1234.0005.9905', 'VLC0A05', 'ATIVO', 'TITULAR', FALSE, 2500.00, 1150.00, 'BOP-11 (Recife - PE)', 'Renault Kwid Zen 1.0', 'ATIVO')
ON CONFLICT (numero_cartao) DO NOTHING;

INSERT INTO tb_valecard_veiculos (
    placa, codigo_status, status_valecard, bloqueio_abastecimento, motivo_bloqueio, propriedade
) VALUES
('VLC0A01', '1', 'ATIVO', FALSE, NULL, 'LEASING'),
('VLC0A02', '1', 'ATIVO', FALSE, NULL, 'LEASING'),
('VLC0A03', '1', 'ATIVO', FALSE, NULL, 'LEASING'),
('VLC0A04', '1', 'ATIVO', FALSE, NULL, 'LEASING'),
('VLC0A05', '10', 'FORA_DE_USO', TRUE, 'Veículo em manutenção preventiva programada (oficina credenciada)', 'LEASING')
ON CONFLICT (placa) DO NOTHING;

-- 3. Transações Sintéticas de Abastecimento
INSERT INTO tb_valecard_transacoes (
    nsu_transacao, numero_cartao, placa, nome_motorista,
    posto_cnpj, posto_nome_fantasia, posto_cidade, posto_uf,
    tipo_combustivel, quantidade_litros, valor_unitario, valor_total,
    hodometro, distancia_percorrida, consumo_medio_kml,
    status_auditoria, motivo_auditoria, origem_ingestao, data_hora_transacao
) VALUES
('TX-VC-1001', '6035.1234.0001.9901', 'VLC0A01', 'Condutor Sintético 001', '00.000.001/0001-01', 'POSTO MODELO SUL', 'Curitiba', 'PR', 'GASOLINA', 35.500, 5.800, 205.90, 15420.00, 390.00, 10.99, 'APROVADO', NULL, 'API_REST', '2026-09-02 08:35:00+00'),
('TX-VC-1002', '6035.1234.0002.9902', 'VLC0A02', 'Condutor Sintético 002', '00.000.002/0001-02', 'POSTO MODELO CENTRO', 'São Paulo', 'SP', 'GASOLINA', 37.200, 5.790, 215.39, 16840.00, 410.00, 11.02, 'APROVADO', NULL, 'API_REST', '2026-09-05 17:15:00+00'),
('TX-VC-1003', '6035.1234.0003.9903', 'VLC0A03', 'Condutor Sintético 003', '00.000.003/0001-03', 'POSTO MODELO MG', 'Belo Horizonte', 'MG', 'GASOLINA', 32.000, 5.850, 187.20, 18910.00, 368.00, 11.50, 'APROVADO', NULL, 'API_REST', '2026-09-08 11:20:00+00'),
('TX-VC-1004', '6035.1234.0004.9904', 'VLC0A04', 'Condutor Sintético 004', '00.000.004/0001-04', 'POSTO MODELO INTERIOR', 'Campinas', 'SP', 'GASOLINA', 36.800, 5.750, 211.60, 22140.00, 412.00, 11.20, 'APROVADO', NULL, 'API_REST', '2026-09-12 14:40:00+00'),
('TX-VC-1005', '6035.1234.0005.9905', 'VLC0A05', 'Condutor Sintético 005', '00.000.005/0001-05', 'POSTO MODELO NE', 'Recife', 'PE', 'GASOLINA', 34.000, 5.820, 197.88, 14200.00, 374.00, 11.00, 'APROVADO', NULL, 'API_REST', '2026-09-15 09:10:00+00'),
('TX-VC-1006', '6035.1234.0001.9901', 'VLC0A01', 'Condutor Sintético 001', '00.000.001/0001-01', 'POSTO MODELO SUL', 'Curitiba', 'PR', 'GASOLINA', 35.000, 5.800, 203.00, 15890.00, 470.00, 13.43, 'APROVADO', NULL, 'API_REST', '2026-09-20 16:50:00+00'),
('TX-VC-1007', '6035.1234.0002.9902', 'VLC0A02', 'Condutor Sintético 002', '00.000.002/0001-02', 'POSTO MODELO CENTRO', 'São Paulo', 'SP', 'GASOLINA', 74.000, 5.780, 427.72, 17350.00, 510.00, 6.89, 'ALERTA_FRAUDE', 'Volume abastecido (74.00 L) acima da capacidade nominal do tanque e eficiência abaixo do esperado.', 'API_REST', '2026-09-25 10:30:00+00'),
('TX-VC-2004', '6035.1234.0001.9901', 'VLC0A01', 'Condutor Sintético 001', '00.000.006/0001-06', 'POSTO MODELO NORTE PR', 'Maringá', 'PR', 'ETANOL', 34.800, 3.880, 135.02, 15650.00, 230.00, 6.61, 'ALERTA_FRAUDE', 'Desvio de eficiência energética detectado no trajeto.', 'API_REST', '2026-09-16 08:00:00+00')
ON CONFLICT (nsu_transacao) DO NOTHING;

-- 4. Fila de Auditoria Anti-Fraude (tb_frota_alertas_combustivel)
INSERT INTO tb_frota_alertas_combustivel (
    id_transacao, tipo_anomalia, detalhes, status_resolucao
)
SELECT
    t.id_transacao,
    'TANQUE_EXCEDENTE',
    'Abastecimento de 74,00 L registrado na bomba para a placa VLC0A02 acima do limite nominal do reservatório.',
    'PENDENTE'
FROM tb_valecard_transacoes t
WHERE t.nsu_transacao = 'TX-VC-1007'
  AND NOT EXISTS (
      SELECT 1 FROM tb_frota_alertas_combustivel a
      WHERE a.id_transacao = t.id_transacao AND a.tipo_anomalia = 'TANQUE_EXCEDENTE'
  );

INSERT INTO tb_frota_alertas_combustivel (
    id_transacao, tipo_anomalia, detalhes, status_resolucao
)
SELECT
    t.id_transacao,
    'DESVIO_EFICIENCIA',
    'Rendimento calculado em 6,61 km/L abaixo da média esperada da frota para a placa VLC0A01.',
    'PENDENTE'
FROM tb_valecard_transacoes t
WHERE t.nsu_transacao = 'TX-VC-2004'
  AND NOT EXISTS (
      SELECT 1 FROM tb_frota_alertas_combustivel a
      WHERE a.id_transacao = t.id_transacao AND a.tipo_anomalia = 'DESVIO_EFICIENCIA'
  );

-- 5. Faturas de Conciliação Fiscal Sintéticas (tb_valecard_faturamento)
INSERT INTO tb_valecard_faturamento (
    numero_titulo, data_inicio, data_fim,
    valor_liquido, valor_total_transacoes, divergencia_contabil, total_transacoes,
    status_faturamento, observacoes_conciliacao
)
SELECT
    'FAT-VC-2026-09-A', '2026-09-01', '2026-09-15',
    18450.80, 18450.80, 0.00, 89,
    'PROCESSADO', 'Conciliação fiscal validada sem divergência contábil.'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_valecard_faturamento WHERE numero_titulo = 'FAT-VC-2026-09-A'
);

INSERT INTO tb_valecard_faturamento (
    numero_titulo, data_inicio, data_fim,
    valor_liquido, valor_total_transacoes, divergencia_contabil, total_transacoes,
    status_faturamento, observacoes_conciliacao
)
SELECT
    'FAT-VC-2026-09-B', '2026-09-16', '2026-09-30',
    21320.10, 21195.60, 124.50, 104,
    'DIVERGENTE', 'Diferença apurada aguardando conferência de cupons estornados.'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_valecard_faturamento WHERE numero_titulo = 'FAT-VC-2026-09-B'
);

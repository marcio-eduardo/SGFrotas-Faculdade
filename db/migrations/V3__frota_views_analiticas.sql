-- =====================================================================
-- Migration V3: Visões Analíticas, Alertas de Inativos e BI de Frota
-- Sistema: SGFrotas (VeloceTech Serviços Técnicos & Conectividade S.A.)
-- Database: PostgreSQL 15+ (Schema public)
-- =====================================================================

-- 1. Painel Geral da Frota (Veículos + ATPs + Condutor Sob Custódia Ativa)
DROP VIEW IF EXISTS vw_frota_painel_geral CASCADE;
CREATE OR REPLACE VIEW vw_frota_painel_geral AS
SELECT 
    v.id_veiculo,
    v.placa,
    v.chassi,
    v.renavam,
    v.marca,
    v.modelo,
    v.ano,
    v.status_operacional,
    v.hodometro_atual,
    v.franquia_mensal_km,
    v.franquia_final_km,
    v.custo_locacao_mensal,
    v.data_inicio_contrato,
    v.data_fim_contrato,
    (v.data_fim_contrato - CURRENT_DATE) AS dias_para_fim_contrato,
    CASE 
        WHEN v.data_fim_contrato IS NULL THEN 'SEM_CONTRATO'
        WHEN (v.data_fim_contrato - CURRENT_DATE) < 0 THEN 'CONTRATO_EXPIRADO'
        WHEN (v.data_fim_contrato - CURRENT_DATE) <= 60 THEN 'RENOVACAO_URGENTE'
        WHEN (v.data_fim_contrato - CURRENT_DATE) <= 120 THEN 'RENOVACAO_PROXIMA'
        ELSE 'VIGENTE'
    END AS status_vigencia_contrato,
    l.id_locadora,
    l.nome AS locadora_nome,
    b.id_base,
    b.ct_codigo AS base_codigo_atp,
    b.nome_atp AS base_nome,
    b.cidade AS base_cidade,
    b.uf AS base_uf,
    b.regiao AS base_regiao,
    COALESCE(b.supervisor_nome, b.supervisor) AS supervisor_base,
    b.coordenador_nome AS coordenador_base,
    t.id_tecnico AS condutor_atual_id,
    t.matricula AS condutor_atual_matricula,
    t.nome_completo AS condutor_atual_nome,
    t.ativo AS condutor_atual_ativo,
    t.status_colaborador AS condutor_atual_status,
    t.cpf AS condutor_atual_cpf,
    c.id_custodia,
    c.data_retirada AS condutor_data_retirada
FROM tb_frota_veiculos v
LEFT JOIN tb_frota_locadoras l ON v.id_locadora = l.id_locadora
LEFT JOIN tb_base_atp b ON v.id_base = b.id_base
LEFT JOIN LATERAL (
    SELECT c_inner.id_custodia, c_inner.id_tecnico, c_inner.data_retirada
    FROM tb_frota_custodias c_inner
    WHERE c_inner.id_veiculo = v.id_veiculo AND c_inner.status = 'ATIVA'
    ORDER BY c_inner.data_retirada DESC NULLS LAST, c_inner.id_custodia DESC
    LIMIT 1
) c ON TRUE
LEFT JOIN tb_tecnico t ON c.id_tecnico = t.id_tecnico;

-- 2. Alerta Crítico: Veículo com Condutor Inativado ou Desligado
CREATE OR REPLACE VIEW vw_frota_alerta_condutor_inativo AS
SELECT 
    v.id_veiculo,
    v.placa,
    v.modelo,
    v.status_operacional,
    t.id_tecnico,
    t.matricula,
    t.nome_completo AS tecnico_nome,
    t.ativo AS tecnico_ativo,
    t.status_colaborador,
    c.id_custodia,
    c.data_retirada,
    b.nome_atp,
    b.uf,
    'DESMOBILIZAR_VEICULO' AS acao_requerida
FROM tb_frota_veiculos v
JOIN tb_frota_custodias c ON v.id_veiculo = c.id_veiculo AND c.status = 'ATIVA'
JOIN tb_tecnico t ON c.id_tecnico = t.id_tecnico
LEFT JOIN tb_base_atp b ON v.id_base = b.id_base
WHERE t.ativo = FALSE OR t.status_colaborador IN ('DESLIGADO', 'AFASTADO', 'INATIVO');

-- 3. Alertas de Manutenção Preventiva por Odômetro (Ciclos de 10.000 km Arval)
CREATE OR REPLACE VIEW vw_frota_alertas_manutencao AS
WITH ultimas_manutencoes AS (
    SELECT DISTINCT ON (id_veiculo)
        id_veiculo,
        id_manutencao,
        tipo_manutencao,
        ciclo_km,
        odometro_momento,
        proxima_revisao_km,
        data_realizacao,
        status
    FROM tb_frota_manutencoes
    ORDER BY id_veiculo, created_at DESC
)
SELECT 
    v.id_veiculo,
    v.placa,
    v.modelo,
    v.hodometro_atual,
    b.nome_atp,
    b.uf,
    um.ciclo_km AS ultimo_ciclo_revisao,
    um.data_realizacao AS ultima_revisao_data,
    COALESCE(um.proxima_revisao_km, (CEIL(GREATEST(v.hodometro_atual, 1) / 10000.0) * 10000.0)) AS proxima_revisao_km,
    (COALESCE(um.proxima_revisao_km, (CEIL(GREATEST(v.hodometro_atual, 1) / 10000.0) * 10000.0)) - v.hodometro_atual) AS km_restante_revisao,
    CASE 
        WHEN (COALESCE(um.proxima_revisao_km, (CEIL(GREATEST(v.hodometro_atual, 1) / 10000.0) * 10000.0)) - v.hodometro_atual) <= 0 THEN 'REVISAO_VENCIDA'
        WHEN (COALESCE(um.proxima_revisao_km, (CEIL(GREATEST(v.hodometro_atual, 1) / 10000.0) * 10000.0)) - v.hodometro_atual) <= 500 THEN 'ALERTA_CRITICO'
        WHEN (COALESCE(um.proxima_revisao_km, (CEIL(GREATEST(v.hodometro_atual, 1) / 10000.0) * 10000.0)) - v.hodometro_atual) <= 1500 THEN 'PROGRAMAR_REVISAO'
        ELSE 'REGULAR'
    END AS status_alerta_revisao
FROM tb_frota_veiculos v
LEFT JOIN tb_base_atp b ON v.id_base = b.id_base
LEFT JOIN ultimas_manutencoes um ON v.id_veiculo = um.id_veiculo
WHERE v.status_operacional NOT IN ('SINISTRADO', 'PATIO');

-- 4. Notificações de Multas Pendentes de Indicação (Risco Multa NIC)
CREATE OR REPLACE VIEW vw_frota_multas_pendentes_indicacao AS
SELECT 
    m.id_multa,
    m.numero_ait,
    m.codigo_infracao,
    m.descricao_infracao,
    m.valor_original,
    m.valor_com_desconto,
    m.data_hora_infracao,
    m.data_limite_indicacao,
    (m.data_limite_indicacao - CURRENT_DATE) AS dias_para_vencer_indicacao,
    CASE 
        WHEN (m.data_limite_indicacao - CURRENT_DATE) < 0 THEN 'PRAZO_ESTOURADO_RISCO_NIC'
        WHEN (m.data_limite_indicacao - CURRENT_DATE) <= 5 THEN 'URGENTE_CRITICO'
        WHEN (m.data_limite_indicacao - CURRENT_DATE) <= 15 THEN 'ALERTA_MODERADO'
        ELSE 'NO_PRAZO'
    END AS gravidade_prazo_indicacao,
    v.id_veiculo,
    v.placa,
    v.modelo AS veiculo_modelo,
    t.id_tecnico,
    t.nome_completo AS condutor_nome,
    t.matricula AS condutor_matricula,
    t.cpf AS condutor_cpf,
    t.ativo AS condutor_ativo,
    t.status_colaborador AS condutor_status,
    oa.sigla AS orgao_autuador,
    m.link_documento,
    m.status_cobranca_colaborador
FROM tb_frota_multas m
JOIN tb_frota_veiculos v ON m.id_veiculo = v.id_veiculo
LEFT JOIN tb_tecnico t ON m.id_tecnico = t.id_tecnico
LEFT JOIN tb_frota_orgaos_autuadores oa ON m.id_orgao = oa.id_orgao
WHERE m.condutor_indicado = FALSE
ORDER BY m.data_limite_indicacao ASC NULLS LAST;

-- 5. Visão Consolidada de Sinistros e Perdas da Frota
CREATE OR REPLACE VIEW vw_frota_sinistros_detalhado AS
SELECT 
    s.id_sinistro,
    v.id_veiculo,
    v.placa,
    v.modelo AS veiculo_modelo,
    v.status_operacional,
    s.tipo_sinistro,
    s.situacao AS status_sinistro,
    s.data_hora_sinistro,
    s.numero_boletim_ocorrencia,
    s.arquivo_bo_pdf,
    s.local_sinistro,
    s.descricao_ocorrido,
    s.acionamento_seguro,
    s.valor_franquia,
    b.nome_atp,
    b.uf AS base_uf,
    t.id_tecnico,
    t.nome_completo AS condutor_nome,
    t.matricula AS condutor_matricula
FROM tb_frota_sinistros s
JOIN tb_frota_veiculos v ON s.id_veiculo = v.id_veiculo
LEFT JOIN tb_base_atp b ON v.id_base = b.id_base
LEFT JOIN tb_tecnico t ON s.id_tecnico = t.id_tecnico;

-- 6. Resumo de Combustível por Tipo e Volume
CREATE OR REPLACE VIEW vw_frota_resumo_combustivel AS
SELECT 
    COALESCE(tipo_combustivel, 'GASOLINA') AS tipo_combustivel,
    COUNT(*) AS total_abastecimentos,
    COALESCE(SUM(quantidade_litros), 0.00) AS total_litros,
    COALESCE(SUM(valor_total), 0.00) AS valor_total_gasto
FROM tb_valecard_transacoes
GROUP BY tipo_combustivel;


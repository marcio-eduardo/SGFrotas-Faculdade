-- =====================================================================
-- SCRIPT DE RESET SEGURO DO SCHEMA - SG FROTAS (EXCLUSIVO SGFROTAS)
-- Executa a limpeza completa das tabelas da frota, valecard,
-- remanescentes legados do Brilha Mais e histórico antigo do Flyway.
-- Permite recriação canônica limpa a partir de V1.
-- =====================================================================

-- 1. Dropar views analíticas (incluindo view legada do Brilha Mais caso exista)
DROP VIEW IF EXISTS vw_frota_sinistros_detalhado CASCADE;
DROP VIEW IF EXISTS vw_frota_resumo_combustivel CASCADE;
DROP VIEW IF EXISTS vw_frota_painel_geral CASCADE;
DROP VIEW IF EXISTS vw_frota_alertas_manutencao CASCADE;
DROP VIEW IF EXISTS vw_frota_multas_pendentes_indicacao CASCADE;
DROP VIEW IF EXISTS vw_frota_alerta_condutor_inativo CASCADE;
DROP VIEW IF EXISTS vw_frota_brilha_mais_integrado CASCADE;

-- 2. Dropar tabelas de Autenticação e RBAC
DROP TABLE IF EXISTS tb_sessoes_ativas CASCADE;
DROP TABLE IF EXISTS tb_usuarios CASCADE;
DROP TABLE IF EXISTS tb_perfis CASCADE;

-- 3. Dropar tabelas do módulo ValeCard
DROP TABLE IF EXISTS tb_valecard_estornos CASCADE;
DROP TABLE IF EXISTS tb_valecard_faturamento_itens CASCADE;
DROP TABLE IF EXISTS tb_valecard_faturamento CASCADE;
DROP TABLE IF EXISTS tb_valecard_responsaveis CASCADE;
DROP TABLE IF EXISTS tb_valecard_vinculos CASCADE;
DROP TABLE IF EXISTS tb_valecard_veiculos CASCADE;
DROP TABLE IF EXISTS tb_valecard_motoristas CASCADE;
DROP TABLE IF EXISTS tb_valecard_alteracoes_limite CASCADE;
DROP TABLE IF EXISTS tb_valecard_solicitacoes_cartao CASCADE;
DROP TABLE IF EXISTS tb_valecard_cartoes CASCADE;
DROP TABLE IF EXISTS tb_frota_alertas_combustivel CASCADE;
DROP TABLE IF EXISTS tb_valecard_transacoes CASCADE;

-- 4. Dropar tabelas Core de Frota
DROP TABLE IF EXISTS tb_frota_sinistros CASCADE;
DROP TABLE IF EXISTS tb_frota_telemetria CASCADE;
DROP TABLE IF EXISTS tb_frota_multas CASCADE;
DROP TABLE IF EXISTS tb_frota_orgaos_autuadores CASCADE;
DROP TABLE IF EXISTS tb_frota_manutencoes CASCADE;
DROP TABLE IF EXISTS tb_frota_oficinas CASCADE;
DROP TABLE IF EXISTS tb_frota_custodias CASCADE;
DROP TABLE IF EXISTS tb_frota_veiculos CASCADE;
DROP TABLE IF EXISTS tb_frota_locadoras CASCADE;
DROP TABLE IF EXISTS tb_tecnico CASCADE;
DROP TABLE IF EXISTS tb_base_atp CASCADE;
DROP TABLE IF EXISTS tb_centro_custo CASCADE;

-- 5. Dropar tabelas legadas herdadas do Brilha Mais / DigitalTwin
DROP TABLE IF EXISTS tb_tecnico_base CASCADE;
DROP TABLE IF EXISTS tb_base_atp_municipios CASCADE;
DROP TABLE IF EXISTS tb_foto_perfil CASCADE;
DROP TABLE IF EXISTS tb_sessao_acesso CASCADE;
DROP TABLE IF EXISTS tb_backup_senhas_migracao CASCADE;
DROP TABLE IF EXISTS tb_sync_status CASCADE;
DROP TABLE IF EXISTS tb_supervisor CASCADE;
DROP TABLE IF EXISTS tb_coordenador CASCADE;
DROP TABLE IF EXISTS tb_gerente CASCADE;
DROP TABLE IF EXISTS tb_usuario CASCADE;

-- 6. Zerar histórico antigo do Flyway para permitir que V1 a V5 rodem limpos
DROP TABLE IF EXISTS flyway_schema_history CASCADE;


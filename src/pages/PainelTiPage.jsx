import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Terminal,
  Server,
  Database,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Layers,
  AlertTriangle,
  Play,
} from 'lucide-react';

export function PainelTiPage() {
  const { user } = useAuth();
  const [syncLoading, setSyncLoading] = useState(null);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const [diagLoading, setDiagLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState(null);
  const [conexaoInfo, setConexaoInfo] = useState(null);
  const [diagError, setDiagError] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);

  const appendLog = useCallback((endpoint, statusText, tipo = 'SUCCESS') => {
    setExecutionLogs((prev) => [
      {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        usuario: user?.email || 'sistema@velocetech.com.br',
        role: user?.role || 'TI_ADMIN',
        endpoint,
        status: statusText,
        tipo,
      },
      ...prev.slice(0, 19),
    ]);
  }, [user]);

  const carregarDiagnostico = useCallback(async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      const [healthRes, connRes] = await Promise.all([
        api.getHealth(),
        api.getValeCardStatusConexao(),
      ]);
      setHealthInfo(healthRes);
      setConexaoInfo(connRes);
      appendLog(
        'GET /api/v1/valecard/status-conexao',
        connRes?.banco_conectado ? '200 OK (Supabase Conectado)' : '503 Banco Indisponível',
        connRes?.banco_conectado ? 'SUCCESS' : 'DENIED'
      );
    } catch (err) {
      setHealthInfo(null);
      setConexaoInfo(null);
      setDiagError(err.message || 'Falha ao consultar diagnóstico do backend FastAPI / Supabase.');
      appendLog('GET /health + /valecard/status-conexao', 'ERRO', 'DENIED');
    } finally {
      setDiagLoading(false);
    }
  }, [appendLog]);

  useEffect(() => {
    carregarDiagnostico();
  }, [carregarDiagnostico]);

  const handleForcedSync = async (serviceKey, serviceName) => {
    setSyncLoading(serviceKey);
    setSyncFeedback(null);
    const hoje = new Date().toISOString().slice(0, 10);
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    try {
      if (serviceKey === 'transacoes') {
        await api.syncValeCardTransacoes({ dataInicio: trintaDiasAtras, dataFim: hoje });
      } else if (serviceKey === 'cartoes') {
        await api.syncValeCardCartoes();
      } else if (serviceKey === 'motoristas') {
        await api.syncValeCardMotoristas();
      } else if (serviceKey === 'faturamento') {
        await api.conciliarFaturamentoValeCard({ dataInicio: trintaDiasAtras, dataFim: hoje });
      }

      setSyncFeedback({
        type: 'success',
        text: `Sincronização real [${serviceName}] persistida com sucesso no Supabase.`,
      });
      appendLog(`POST /api/v1/valecard/${serviceKey}`, '200 OK', 'SUCCESS');
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        text: `Falha ao executar [${serviceName}]: ${err.message}`,
      });
      appendLog(`POST /api/v1/valecard/${serviceKey}`, 'ERRO API/Banco', 'DENIED');
    } finally {
      setSyncLoading(null);
    }
  };

  const bancoOnline = Boolean(conexaoInfo?.banco_conectado);
  const apiOnline = healthInfo?.status === 'healthy';
  const kissApiConfigured = Boolean(conexaoInfo?.kissapi_configurada);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho do Painel de TI */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-ti-panel-glow opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Terminal className="w-3.5 h-3.5" />
              <span>Módulo Exclusivo de Engenharia & TI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Painel de Manutenção & Infraestrutura
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Diagnóstico ao vivo da API FastAPI, conectividade real com o Supabase PostgreSQL, estado da integração ValeCard KissAPI e registro de execuções.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={carregarDiagnostico}
              disabled={diagLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
              <span>Reverificar Conexão</span>
            </button>
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-right">
              <div className="text-[10px] text-indigo-200 uppercase font-bold tracking-wider">
                Operador Ativo
              </div>
              <div className="text-xs font-bold text-white">{user?.name}</div>
              <div className="text-[10px] text-emerald-400 font-mono">Privilégios: {user?.role}</div>
            </div>
          </div>
        </div>
      </div>

      {diagError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{diagError}</span>
          </div>
        </div>
      )}

      {syncFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fadeIn ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{syncFeedback.text}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-xs hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 4 Cards de Saúde dos Serviços (Dados ao vivo do Backend/Supabase) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                apiOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}
            >
              {diagLoading ? 'Verificando...' : apiOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">API REST FastAPI</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">GET /health</div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Status real:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {healthInfo?.status || 'indisponível'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                bancoOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}
            >
              {diagLoading ? 'Verificando...' : bancoOnline ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">Supabase PostgreSQL</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
            {conexaoInfo?.banco_host || 'Host não reportado'}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between gap-2">
            <span>Diagnóstico:</span>
            <span className={`font-bold truncate ${bancoOnline ? 'text-emerald-600' : 'text-rose-500'}`}>
              {bancoOnline ? 'SELECT 1 OK' : conexaoInfo?.banco_erro || 'Offline'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                kissApiConfigured
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {kissApiConfigured ? 'Token Ativo' : 'Somente Supabase'}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">ValeCard KissAPI REST</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">Integração Externa</div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Contrato:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {conexaoInfo?.contrato_cliente || 'Não configurado'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Sessão Atual
            </span>
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-white">Autenticação RBAC</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">tb_usuarios (Supabase)</div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Perfil ativo:</span>
            <span className="font-bold text-indigo-600 font-mono text-[10px]">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Seção 2: Gatilhos Reais de Sincronização KissAPI -> Supabase */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-600" />
              <span>Gatilhos Manuais de Sincronização KissAPI (REST → Supabase)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dispara requisições reais para os endpoints de ingestão no backend e grava diretamente no Supabase.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'transacoes', title: 'Transações & Abastecimento', code: '02 - buscartransacoesfrota' },
            { key: 'cartoes', title: 'Base de Cartões & Limites', code: '05 - buscarbasedecartoes' },
            { key: 'motoristas', title: 'Condutores & Vínculos', code: '14 - BuscarMotoristas' },
            { key: 'faturamento', title: 'Conciliação de Faturamento', code: '09 - buscardadosfaturamento' },
          ].map((srv) => (
            <button
              key={srv.key}
              type="button"
              disabled={syncLoading !== null}
              onClick={() => handleForcedSync(srv.key, srv.code)}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-brand-50/30 text-left transition-all flex flex-col justify-between group disabled:opacity-50"
            >
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-brand-600">
                  {srv.title}
                </div>
                <div className="text-[10px] text-slate-500">{srv.code}</div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-brand-600">
                {syncLoading === srv.key ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Disparar Ingestão</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Seção 3: Registro Real de Chamadas Executadas nesta Sessão */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Registro de Operações desta Sessão</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Histórico real das verificações de diagnóstico e sincronizações executadas contra a API e o Supabase.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {executionLogs.length} eventos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Hora</th>
                <th className="py-3 px-3">Usuário / E-mail</th>
                <th className="py-3 px-3">Perfil</th>
                <th className="py-3 px-3">Operação / Endpoint</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {executionLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                    Nenhuma operação registrada ainda nesta sessão.
                  </td>
                </tr>
              ) : (
                executionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">{log.timestamp}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {log.usuario}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {log.endpoint}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.tipo === 'SUCCESS'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

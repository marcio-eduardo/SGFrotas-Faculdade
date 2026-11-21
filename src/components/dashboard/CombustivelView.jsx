import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Fuel, ShieldAlert, CreditCard, Lock, FileCheck2, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { api } from '../../services/api';
import { CombustivelKpis } from './combustivel/CombustivelKpis';
import { CombustivelTransacoes } from './combustivel/CombustivelTransacoes';
import { CombustivelCartoes } from './combustivel/CombustivelCartoes';
import { CombustivelBloqueio } from './combustivel/CombustivelBloqueio';
import { CombustivelFiscal } from './combustivel/CombustivelFiscal';
import { ModalResolverAlerta } from './combustivel/ModalResolverAlerta';

export const CombustivelView = ({ searchTerm = '', selectedRegiao = 'TODAS' }) => {
  // Aba ativa: 'transacoes' | 'cartoes' | 'bloqueio' | 'fiscal'
  const [subAba, setSubAba] = useState('transacoes');
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  // Estados de dados da API
  const [kpis, setKpis] = useState(null);
  const [transacoes, setTransacoes] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [solicitacoes2Via, setSolicitacoes2Via] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [faturamentos, setFaturamentos] = useState([]);
  const [estornos, setEstornos] = useState([]);

  // Estados de controle e feedback
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [conexaoStatus, setConexaoStatus] = useState(null);
  const [errosCarregamento, setErrosCarregamento] = useState([]);

  // Filtros de Transações
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [busca, setBusca] = useState(searchTerm || '');

  // Sincroniza busca externa da Topbar com o filtro interno
  useEffect(() => {
    if (searchTerm !== undefined) {
      setBusca(searchTerm);
    }
  }, [searchTerm]);

  // Fecha o dropdown ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    const handleClickFora = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDropdownAberto(false);
    };

    if (dropdownAberto) {
      document.addEventListener('mousedown', handleClickFora);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownAberto]);

  // Modal de Auditoria de Alerta
  const [alertaParaAuditar, setAlertaParaAuditar] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Carregar dados reais da API FastAPI (PostgreSQL Central)
  const carregarDadosCompletos = useCallback(async () => {
    setLoading(true);
    setErrosCarregamento([]);
    try {
      const [
        kpisRes,
        transRes,
        alertasRes,
        cartoesRes,
        sol2ViaRes,
        vcVeicRes,
        veicRes,
        fatRes,
        estornosRes,
        statusRes,
      ] = await Promise.allSettled([
        api.getValeCardKPIs(),
        api.getValeCardTransacoes({ limit: 100 }),
        api.getValeCardAlertas({ statusAlerta: 'PENDENTE', limit: 200 }),
        api.getValeCardCartoes({ limit: 100 }),
        api.getValeCardSolicitacoes2Via({ limit: 50 }),
        api.getValeCardVeiculos({ limit: 200 }),
        api.getVeiculos({ pageSize: 300 }),
        api.getValeCardFaturamentos({ limit: 20 }),
        api.getValeCardEstornos({ limit: 50 }),
        api.getValeCardStatusConexao(),
      ]);

      const labels = [
        'KPIs ValeCard',
        'Transações',
        'Alertas Anti-Fraude',
        'Cartões',
        'Solicitações 2ª Via',
        'Veículos ValeCard',
        'Frota Geral',
        'Faturamentos',
        'Estornos',
        'Diagnóstico de Conexão',
      ];
      const resultados = [
        kpisRes,
        transRes,
        alertasRes,
        cartoesRes,
        sol2ViaRes,
        vcVeicRes,
        veicRes,
        fatRes,
        estornosRes,
        statusRes,
      ];
      const falhas = resultados
        .map((res, idx) =>
          res.status === 'rejected'
            ? `${labels[idx]}: ${res.reason?.message || 'Erro de comunicação'}`
            : null
        )
        .filter(Boolean);
      setErrosCarregamento(falhas);

      if (statusRes.status === 'fulfilled') {
        setConexaoStatus(statusRes.value);
      }

      if (kpisRes.status === 'fulfilled') setKpis(kpisRes.value);

      const alertasList =
        alertasRes.status === 'fulfilled'
          ? alertasRes.value?.items || (Array.isArray(alertasRes.value) ? alertasRes.value : [])
          : [];
      const alertasByTransacao = new Map();
      alertasList.forEach((a) => {
        if (a.id_transacao && !alertasByTransacao.has(a.id_transacao)) {
          alertasByTransacao.set(a.id_transacao, a);
        }
      });

      if (transRes.status === 'fulfilled') {
        const items = transRes.value?.items || (Array.isArray(transRes.value) ? transRes.value : []);
        const enriched = items.map((t) => {
          const alerta = alertasByTransacao.get(t.id_transacao);
          return alerta
            ? {
                ...t,
                id_alerta: alerta.id_alerta,
                tipo_alerta: alerta.tipo_anomalia,
                descricao_alerta: alerta.detalhes,
                status_alerta: alerta.status_resolucao,
              }
            : t;
        });
        setTransacoes(enriched);
      }

      if (cartoesRes.status === 'fulfilled') {
        const items = cartoesRes.value?.items || (Array.isArray(cartoesRes.value) ? cartoesRes.value : []);
        setCartoes(items);
      }

      if (sol2ViaRes.status === 'fulfilled') {
        const items = sol2ViaRes.value?.items || (Array.isArray(sol2ViaRes.value) ? sol2ViaRes.value : []);
        setSolicitacoes2Via(items);
      }

      const vcVeiculosList =
        vcVeicRes.status === 'fulfilled'
          ? vcVeicRes.value?.items || (Array.isArray(vcVeicRes.value) ? vcVeicRes.value : [])
          : [];
      const vcMap = new Map();
      vcVeiculosList.forEach((vv) => {
        const key = (vv.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (key) vcMap.set(key, vv);
      });

      if (veicRes.status === 'fulfilled') {
        const frotaItems = veicRes.value?.items || [];
        if (frotaItems.length > 0) {
          const merged = frotaItems.map((v) => {
            const key = (v.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const vc = vcMap.get(key);
            return vc
              ? {
                  ...v,
                  codigo_status: vc.codigo_status,
                  status_valecard: vc.status_valecard,
                  bloqueio_abastecimento: vc.bloqueio_abastecimento,
                  motivo_bloqueio: vc.motivo_bloqueio,
                }
              : v;
          });
          setVeiculos(merged);
        } else if (vcVeiculosList.length > 0) {
          setVeiculos(vcVeiculosList);
        }
      } else if (vcVeiculosList.length > 0) {
        setVeiculos(vcVeiculosList);
      }

      if (fatRes.status === 'fulfilled') {
        const items = fatRes.value?.items || (Array.isArray(fatRes.value) ? fatRes.value : []);
        setFaturamentos(items);
      }

      if (estornosRes.status === 'fulfilled') {
        const items = estornosRes.value?.items || (Array.isArray(estornosRes.value) ? estornosRes.value : []);
        setEstornos(items);
      }
    } catch (err) {
      console.warn('[CombustivelView] Erro ao carregar dados:', err);
      showToast('Aviso: Conectando aos serviços de combustível...', 'warning');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosCompletos();
  }, [carregarDadosCompletos]);

  // Sincronização Sob Demanda de Transações
  const handleSyncTransacoes = async () => {
    setSyncing(true);
    try {
      const res = await api.syncValeCardTransacoes();
      const inseridas = res?.total_inseridas ?? res?.novas_transacoes ?? 0;
      const atualizadas = res?.total_atualizadas ?? 0;
      const recebidas = res?.total_recebidas ?? res?.total ?? inseridas + atualizadas;
      showToast(
        `Sincronização concluída! ${recebidas} cupons processados (${inseridas} novos, ${atualizadas} atualizados).`
      );
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha na sincronização: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Sincronização Dedicada de Cartões
  const handleSyncCartoes = async () => {
    setSyncing(true);
    try {
      const res = await api.syncValeCardCartoes();
      const inseridos = res?.total_inseridos ?? 0;
      const atualizados = res?.total_atualizados ?? 0;
      showToast(`Base de cartões sincronizada! ${inseridos} novos, ${atualizados} atualizados.`);
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha ao sincronizar cartões: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Resolução Auditada de Alerta Anti-Fraude
  const handleResolverAlerta = async (idAlerta, payload) => {
    if (!idAlerta) {
      showToast('Não há ID de alerta pendente vinculado a esta transação.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.resolverAlertaValeCard(idAlerta, payload);
      showToast(`Alerta de Fraude #${idAlerta} auditado com sucesso!`);
      setAlertaParaAuditar(null);
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Erro ao registrar resolução: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Alteração de Limite na Bomba
  const handleAlterarLimite = async (payload) => {
    setActionLoading(true);
    try {
      await api.alterarLimiteValeCard(payload);
      showToast(`Limite do veículo ${payload.placa} atualizado na ValeCard com sucesso!`);
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha ao alterar limite: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Solicitação de 2ª Via de Cartão
  const handleSolicitar2Via = async (payload) => {
    setActionLoading(true);
    try {
      await api.solicitar2ViaValeCard(payload);
      showToast(`2ª Via do cartão da placa ${payload.placa} solicitada com sucesso!`);
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha ao pedir 2ª via: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Bloqueio de Bomba
  const handleBloquearBomba = async (payload) => {
    setActionLoading(true);
    try {
      await api.bloquearBombaValeCard(payload);
      showToast(
        payload.bloquear
          ? `Bomba travada para o veículo ${payload.placa} (Status 10 na oficina).`
          : `Bomba liberada para o veículo ${payload.placa}.`
      );
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha ao alterar status de bomba: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Conciliação Fiscal
  const handleConciliarFiscal = async (payload) => {
    setActionLoading(true);
    try {
      const res = await api.conciliarFaturamentoValeCard(payload);
      const statusFat = res?.status_faturamento || res?.status_conciliacao;
      const divergenciaVal = Number(res?.divergencia_contabil ?? res?.divergencia ?? 0);
      const isDiv = statusFat === 'DIVERGENTE';
      showToast(
        isDiv
          ? `Auditoria concluída com divergência de R$ ${divergenciaVal.toFixed(2)}.`
          : res?.mensagem || 'Conciliação contábil aprovada sem divergências!',
        isDiv ? 'warning' : 'success'
      );
      await carregarDadosCompletos();
    } catch (err) {
      showToast(`Falha na conciliação: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtro de Transações
  const transacoesFiltradas = transacoes.filter((t) => {
    const isAlerta =
      ['ALERTA_FRAUDE', 'PENDENTE_CONCILIACAO', 'ALERTA'].includes(t.status_auditoria) ||
      t.status === 'alerta';
    if (filtroStatus === 'APROVADO' && isAlerta) return false;
    if (filtroStatus === 'ALERTA' && !isAlerta) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const matchPlaca = t.placa && t.placa.toLowerCase().includes(q);
      const matchPosto = (t.posto_nome_fantasia || t.nome_posto || t.posto || '').toLowerCase().includes(q);
      if (!matchPlaca && !matchPosto) return false;
    }
    return true;
  });

  const SUB_ABAS = [
    {
      id: 'transacoes',
      label: 'Abastecimentos & Anti-Fraude',
      descricao: 'Feed auditado de cupons e motor de anomalias',
      icon: ShieldAlert,
      count: transacoes.length,
    },
    {
      id: 'cartoes',
      label: 'Base de Cartões & Limites',
      descricao: 'Cartões ativos, alteração de limites e 2ª via',
      icon: CreditCard,
      count: cartoes.length,
    },
    {
      id: 'bloqueio',
      label: 'Bloqueio na Bomba (Oficina)',
      descricao: 'Veículos recolhidos bloqueados preventivamente',
      icon: Lock,
      count: veiculos.length,
    },
    {
      id: 'fiscal',
      label: 'Conciliação Fiscal de NF',
      descricao: 'Faturamento contábil e auditoria de títulos',
      icon: FileCheck2,
      count: faturamentos.length,
    },
  ];

  const abaAtivaObj = SUB_ABAS.find((a) => a.id === subAba) || SUB_ABAS[0];
  const AbaIcon = abaAtivaObj.icon;

  return (
    <div className="space-y-5 animate-fadeUp">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 transition-all animate-fadeUp ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-500 text-slate-900 border-amber-600'
              : 'bg-emerald-600 text-white border-emerald-700'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Banner de Diagnóstico de Conexão Supabase / API */}
      {(errosCarregamento.length > 0 || (conexaoStatus && conexaoStatus.banco_conectado === false)) && (
        <div className="p-4 rounded-2xl border border-amber-300/80 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {conexaoStatus && conexaoStatus.banco_conectado === false
                  ? 'Banco de Dados Supabase Indisponível — Modo Contingência Ativo'
                  : 'Falha ao carregar parte dos serviços ValeCard'}
              </p>
              {conexaoStatus?.banco_erro && (
                <p className="text-[11px] opacity-90">
                  Diagnóstico ({conexaoStatus.banco_host}): {conexaoStatus.banco_erro}
                </p>
              )}
              {errosCarregamento.length > 0 && (
                <p className="text-[11px] opacity-90">
                  Falhas ({errosCarregamento.length}): {errosCarregamento[0]}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={carregarDadosCompletos}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap self-start sm:self-center disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* KPIs Dinâmicos de Combustível */}
      <CombustivelKpis kpis={kpis} loading={loading} />

      {/* Seletor Executivo de Sub-Módulo (Dropdown) & Ação de Sincronização */}
      <div className="relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-200/50 dark:bg-app-darkSurface2/60 backdrop-blur-md rounded-2xl border border-slate-300/60 dark:border-white/5">
        {/* Dropdown Container */}
        <div ref={dropdownRef} className="relative w-full sm:w-[360px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 px-1">
            Módulo Operacional
          </label>

          <button
            type="button"
            onClick={() => setDropdownAberto(!dropdownAberto)}
            aria-expanded={dropdownAberto}
            aria-haspopup="listbox"
            className="flex items-center justify-between gap-3 w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-app-darkSurface border border-slate-200/90 dark:border-white/10 hover:border-brand-500/60 dark:hover:border-brand-500/60 shadow-sm transition-all text-xs font-semibold text-slate-800 dark:text-white group focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <AbaIcon className="w-4 h-4" />
              </div>
              <span className="truncate text-left font-bold">{abaAtivaObj.label}</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {abaAtivaObj.count !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                  {abaAtivaObj.count}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-transform duration-200 ${
                  dropdownAberto ? 'rotate-180 text-brand-500' : ''
                }`}
              />
            </div>
          </button>

          {/* Menu Flutuante (Popover) */}
          {dropdownAberto && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-2 w-full sm:w-[380px] rounded-2xl bg-white dark:bg-app-darkSurface border border-slate-200/90 dark:border-white/10 shadow-2xl ring-1 ring-black/5 p-1.5 z-50 animate-fadeUp origin-top-left"
            >
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Selecione a visualização
              </div>
              <div className="space-y-1">
                {SUB_ABAS.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = subAba === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSubAba(tab.id);
                        setDropdownAberto(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-bold border border-brand-200/60 dark:border-brand-500/30'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold leading-tight">{tab.label}</p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-tight truncate">
                            {tab.descricao}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {tab.count !== undefined && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isSelected
                                ? 'bg-brand-200/60 dark:bg-brand-500/30 text-brand-800 dark:text-brand-200'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {tab.count}
                          </span>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botão de Sincronização */}
        <button
          onClick={handleSyncTransacoes}
          disabled={syncing || loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-sm shadow-brand-500/20 disabled:opacity-50 whitespace-nowrap self-end sm:self-end mb-0.5"
          title="Sincronizar novos dados com a base"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>
      </div>

      {/* Renderização Condicional da Sub-Aba Ativa */}
      {subAba === 'transacoes' && (
        <CombustivelTransacoes
          transacoes={transacoesFiltradas}
          loading={loading}
          syncing={syncing}
          onSync={handleSyncTransacoes}
          onAuditar={(transacao) => setAlertaParaAuditar(transacao)}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          busca={busca}
          setBusca={setBusca}
        />
      )}

      {subAba === 'cartoes' && (
        <CombustivelCartoes
          cartoes={cartoes}
          solicitacoes={solicitacoes2Via}
          loading={loading || syncing}
          onSyncCartoes={handleSyncCartoes}
          onAlterarLimite={handleAlterarLimite}
          onSolicitar2Via={handleSolicitar2Via}
          actionLoading={actionLoading}
        />
      )}

      {subAba === 'bloqueio' && (
        <CombustivelBloqueio
          veiculos={veiculos}
          loading={loading}
          onBloquearBomba={handleBloquearBomba}
          actionLoading={actionLoading}
        />
      )}

      {subAba === 'fiscal' && (
        <CombustivelFiscal
          faturamentos={faturamentos}
          estornos={estornos}
          loading={loading}
          onConciliar={handleConciliarFiscal}
          conciliando={actionLoading}
        />
      )}

      {/* Modal de Auditoria de Alerta */}
      {alertaParaAuditar && (
        <ModalResolverAlerta
          alerta={alertaParaAuditar}
          onClose={() => setAlertaParaAuditar(null)}
          onResolve={handleResolverAlerta}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

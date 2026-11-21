import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, ChevronRight, Fuel } from 'lucide-react';
import { Pagination } from '../../common/Pagination';

export const CombustivelTransacoes = ({
  transacoes = [],
  loading = false,
  syncing = false,
  onSync,
  onAuditar,
  filtroStatus,
  setFiltroStatus,
  busca,
  setBusca,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // Reseta para a página 1 ao alterar filtros, buscas ou lista
  useEffect(() => {
    setCurrentPage(1);
  }, [transacoes.length, filtroStatus, busca]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedTransacoes = transacoes.slice(startIndex, startIndex + PAGE_SIZE);
  return (
    <div className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-card overflow-hidden">
      {/* Header com Filtros e Ações */}
      <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <span>Feed de Abastecimentos</span>
              <span className="text-[11px] font-semibold text-slate-400">
                ({transacoes.length} registros)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Registros auditados pelo motor de conformidade da frota
            </div>
          </div>
        </div>

        {/* Barra de Ações: Busca + Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca por Placa / Posto */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por placa ou posto..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-app-darkSurface2 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 w-48 lg:w-56"
            />
          </div>

          {/* Filtro Status */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-app-darkSurface2 rounded-xl border border-slate-200/60 dark:border-white/5 text-[11px]">
            {['TODOS', 'APROVADO', 'ALERTA'].map((status) => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filtroStatus === status
                    ? 'bg-white dark:bg-app-darkSurface3 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status === 'ALERTA' ? '⚠️ Com Alerta' : status === 'APROVADO' ? '✅ Aprovados' : 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-500" />
            <p>Carregando registros da frota...</p>
          </div>
        ) : transacoes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <div className="font-semibold text-slate-600 dark:text-slate-300 text-sm">
              Nenhuma transação encontrada
            </div>
            <p className="text-[11px] max-w-sm mx-auto">
              Clique em "Sincronizar" para consultar novos abastecimentos ou ajuste os filtros de busca.
            </p>
          </div>
        ) : (
          paginatedTransacoes.map((t) => {
            const hasAlert =
              ['ALERTA_FRAUDE', 'PENDENTE_CONCILIACAO', 'ALERTA'].includes(t.status_auditoria) ||
              t.status === 'alerta';
            const isResolved = t.status_auditoria === 'JUSTIFICADO' || t.status_alerta === 'JUSTIFICADO';

            return (
              <div
                key={t.id_transacao || t.id}
                className="p-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  {/* Ícone de Status */}
                  <div
                    className={`p-2.5 rounded-xl flex-shrink-0 ${
                      hasAlert
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : isResolved
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {hasAlert ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                  </div>

                  {/* Informações Centrais */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-app-darkSurface2 border border-slate-300 dark:border-white/10 text-xs">
                        {t.placa}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {t.posto_nome_fantasia || t.nome_posto || t.posto || 'Posto de Abastecimento'}
                      </span>
                      {hasAlert && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse">
                          Requer Auditoria
                        </span>
                      )}
                      {isResolved && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          Justificado
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                      <span>{t.data_hora_transacao ? new Date(t.data_hora_transacao).toLocaleString('pt-BR') : t.data_transacao || t.data || 'Data não informada'}</span>
                      <span>•</span>
                      <span>{t.tipo_combustivel || t.combustivel || 'Combustível'}</span>
                      <span>•</span>
                      <span>
                        Hodômetro na Bomba:{' '}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Number(t.hodometro || t.kmBomba || 0).toLocaleString('pt-BR')} km
                        </span>
                      </span>
                      {Number(t.valor_unitario || 0) > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            Preço/L:{' '}
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              R$ {Number(t.valor_unitario).toFixed(2)}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Descrição do Alerta Anti-Fraude */}
                    {(t.motivo_auditoria || t.motivo_alerta || t.motivo) && (
                      <div className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Alerta: {t.motivo_auditoria || t.motivo_alerta || t.motivo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Valores & Botão de Auditoria */}
                <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-white/5 gap-2">
                  <div className="text-right">
                    <div className="font-mono font-black text-slate-900 dark:text-white text-base">
                      R$ {Number(t.valor_total || t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {Number(t.quantidade_litros || t.litros || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros
                    </div>
                  </div>

                  {hasAlert && (
                    <button
                      onClick={() => onAuditar(t)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-sm shadow-rose-500/20 flex items-center gap-1"
                    >
                      <span>Auditar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra de Paginação (15 abastecimentos por página) */}
      <Pagination
        currentPage={currentPage}
        totalItems={transacoes.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
        itemLabel="abastecimentos"
      />
    </div>
  );
};

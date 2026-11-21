import React from 'react';
import { Calendar, Download, RefreshCw } from 'lucide-react';

export const PeriodSelector = ({ 
  selectedPeriod = '30d', 
  onSelectPeriod, 
  onRefresh, 
  loading = false,
  onExport 
}) => {
  const periods = [
    { id: 'hoje', label: 'Hoje' },
    { id: '7d', label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: 'mes', label: 'Mês Atual' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs">
      {/* Seletor de Período em Pílulas */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase px-2 mr-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Período:</span>
        </div>
        {periods.map((p) => {
          const isActive = selectedPeriod === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPeriod && onSelectPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25'
                  : 'bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Ações Rápidas: Atualizar & Extrair Relatório */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 shadow-xs transition-colors"
            title="Recarregar indicadores"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-500' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/25 transition-all"
          title="Exportar dados consolidados em relatório"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Extrair Relatório</span>
        </button>
      </div>
    </div>
  );
};


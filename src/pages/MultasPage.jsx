import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { MultasView } from '../components/dashboard/MultasView';

export const MultasPage = ({ searchTerm = '', selectedRegiao = 'TODAS', onBackToDashboard }) => {
  return (
    <div className="space-y-6 animate-fadeUp">
      {/* Header Executivo da Página de Central de Multas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center gap-1 hover:text-brand-500 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}
            {onBackToDashboard && <span>/</span>}
            <span className="text-slate-700 dark:text-slate-300">Torre de Controle</span>
            <span>/</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">Central de Multas (NIC)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Central de Multas & Notificações (NIC)
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Prevenção Multa NIC</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Controle de autos de infração (AIT), prazos fatais para indicação de condutor junto aos órgãos autuadores e acompanhamento de repasse RH.
          </p>
        </div>
      </div>

      {/* Conteúdo Principal do Módulo de Multas */}
      <MultasView searchTerm={searchTerm} selectedRegiao={selectedRegiao} />
    </div>
  );
};

export default MultasPage;


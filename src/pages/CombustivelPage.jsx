import React from 'react';
import { Fuel, ShieldCheck, ArrowLeft, RefreshCw, Zap, ExternalLink } from 'lucide-react';
import { CombustivelView } from '../components/dashboard/CombustivelView';

export const CombustivelPage = ({ searchTerm = '', selectedRegiao = 'TODAS', onBackToDashboard }) => {
  return (
    <div className="space-y-6 animate-fadeUp">
      {/* Header Executivo da Página de Combustível */}
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
            <span className="text-brand-600 dark:text-brand-400 font-bold">Gestão de Combustível</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Combustível & Cartões Frota
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Monitoramento em tempo real de abastecimentos, motor anti-fraude, conciliação fiscal e gestão de cartões da frota.
          </p>
        </div>
      </div>

      {/* Conteúdo Principal do Módulo ValeCard */}
      <CombustivelView searchTerm={searchTerm} selectedRegiao={selectedRegiao} />
    </div>
  );
};

export default CombustivelPage;

import React, { useState } from 'react';
import { Truck, User, ChevronRight, Fuel, Clock, Calendar } from 'lucide-react';

export const FleetUsageRankingCard = ({
  veiculosRanking = [],
  condutoresRanking = [],
  franquiaStats,
}) => {
  const [activeTab, setActiveTab] = useState('veiculos'); // 'veiculos' | 'condutores'
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = franquiaStats || {
    franquiaContratada: '2.800',
    mediaRealizada: '1.850',
    utilizacaoPct: '66.1',
    totalKm: '85.141',
  };

  const rawList = activeTab === 'veiculos' ? veiculosRanking : condutoresRanking;
  const displayList = isExpanded ? rawList.slice(0, 10) : rawList.slice(0, 5);
  const maxKm = Math.max(...rawList.map((item) => item.km || 1), 1);

  return (
    <div className="fleet-card-surface rounded-2xl p-5">
      {/* Cabeçalho do Card com Abas de Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ranking de Utilização da Frota
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
            Quilometragem acumulada em rotas de atendimento técnico
          </p>
        </div>

        {/* Abas Pílula */}
        <div className="inline-flex items-center p-1 fleet-surface-muted rounded-xl">
          <button
            onClick={() => setActiveTab('veiculos')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'veiculos'
                ? 'bg-white dark:bg-fleet-charcoal text-slate-900 dark:text-white border border-slate-200/80 dark:border-fleet-titanium/60 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Veículos</span>
          </button>
          <button
            onClick={() => setActiveTab('condutores')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'condutores'
                ? 'bg-white dark:bg-fleet-charcoal text-slate-900 dark:text-white border border-slate-200/80 dark:border-fleet-titanium/60 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Condutores</span>
          </button>
        </div>
      </div>

      {/* Grid Principal: Lista Ranqueada + Painel Lateral de Detalhamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Coluna 1 & 2: Lista com Barras Proporcionais */}
        <div className="lg:col-span-2 space-y-3">
          {displayList.map((item, idx) => {
            const pct = Math.min(Math.round((item.km / maxKm) * 100), 100);
            const rankFormatted = (idx + 1).toString().padStart(2, '0');

            return (
              <div
                key={item.id || idx}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-colors"
              >
                {/* Posição Numérica */}
                <span className="font-mono text-xs font-extrabold text-slate-400 dark:text-slate-500 w-6 text-center">
                  {rankFormatted}
                </span>

                {/* Ícone */}
                <div className="p-1.5 rounded-lg fleet-surface-muted text-slate-600 dark:text-slate-300 shrink-0">
                  {activeTab === 'veiculos' ? (
                    <Truck className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Identificação & Barra de Progresso */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.title}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono shrink-0">
                      {item.kmFormatted || `${item.km.toLocaleString('pt-BR')} Km`}
                    </span>
                  </div>

                  {/* Barra de Progresso Proporcional (tom fosco alinhado ao tema) */}
                  <div className="h-1.5 w-full bg-slate-200/80 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-600 dark:bg-fleet-bronze/85 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {item.subtitle && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Botão de Expansão Top 5 -> Top 10 */}
          {rawList.length > 5 && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-fleet-bronze hover:text-slate-900 dark:hover:text-white hover:underline transition-colors"
              >
                <span>{isExpanded ? 'Ver Menos (Top 5)' : `Ver Todos (${rawList.length} Registros)`}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
              </button>
            </div>
          )}
        </div>

        {/* Coluna 3: Painel Lateral de Controle de Franquia Contratada Arval */}
        <div className="fleet-surface-muted rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-fleet-charcoal text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-fleet-titanium/50 text-xs font-extrabold w-fit mb-4">
              <Fuel className="w-3.5 h-3.5 text-slate-500 dark:text-fleet-bronze" />
              <span>Controle de Franquia</span>
            </div>

            <div className="space-y-3.5">
              {/* Franquia Média Contratada */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-fleet-charcoal/85 border border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Franquia Contratada
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    {stats.franquiaContratada} Km/mês
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-400">
                  Limite padrão por contrato Arval
                </div>
              </div>

              {/* Média Realizada da Frota */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-fleet-charcoal/85 border border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Média Realizada
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {stats.mediaRealizada} Km/mês
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-400">
                  Consumo médio por veículo em campo
                </div>
              </div>

              {/* Taxa de Consumo da Franquia */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-fleet-charcoal/85 border border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Utilização Franquia
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {stats.utilizacaoPct}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-fleet-bronze font-semibold">
                  Sem risco de km excedente
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">Total Acumulado:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
              {stats.totalKm} Km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


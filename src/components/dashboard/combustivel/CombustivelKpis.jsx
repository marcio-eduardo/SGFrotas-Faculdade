import React from 'react';
import { DollarSign, Droplet, Gauge, ShieldAlert } from 'lucide-react';

export const CombustivelKpis = ({ kpis, loading }) => {
  const totalGasto = Number(kpis?.total_gasto ?? kpis?.total_valor ?? 0);
  const totalLitros = Number(kpis?.total_litros ?? 0);
  const consumoMedio = Number(kpis?.consumo_medio_frota_kml ?? kpis?.km_por_litro_medio ?? 0);
  const totalTransacoes = Number(kpis?.total_transacoes ?? 0);
  const alertasPendentes = Number(kpis?.total_alertas_pendentes ?? kpis?.alertas_pendentes ?? 0);

  const cards = [
    {
      title: 'Total Faturado no Mês',
      value: `R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${totalTransacoes.toLocaleString('pt-BR')} abastecimentos registrados`,
      color: 'blue',
      icon: DollarSign,
      textColor: 'text-brand-600 dark:text-brand-400',
      iconBg: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
      borderStripe: 'border-l-4 border-l-brand-500',
    },
    {
      title: 'Volume Consumido',
      value: `${totalLitros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`,
      sub: 'Litros abastecidos no período',
      color: 'amber',
      icon: Droplet,
      textColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      borderStripe: 'border-l-4 border-l-amber-500',
    },
    {
      title: 'Eficiência Média da Frota',
      value: consumoMedio > 0
        ? `${consumoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/L`
        : '— km/L',
      sub: consumoMedio > 0 ? 'Média de autonomia por veículo' : 'Sem leituras válidas de km/L',
      color: 'green',
      icon: Gauge,
      textColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      borderStripe: 'border-l-4 border-l-emerald-500',
    },
    {
      title: 'Alertas Anti-Fraude Ativos',
      value: alertasPendentes.toLocaleString('pt-BR'),
      sub: alertasPendentes > 0 ? `${alertasPendentes.toLocaleString('pt-BR')} anomalias requerem auditoria` : 'Nenhuma fraude detectada',
      color: 'red',
      icon: ShieldAlert,
      textColor: alertasPendentes > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400',
      iconBg: alertasPendentes > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse' : 'bg-slate-500/10 text-slate-500',
      borderStripe: 'border-l-4 border-l-rose-500',
      badge: alertasPendentes > 0 ? 'AUDITORIA' : 'NORMAL',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`relative overflow-hidden bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-card hover:shadow-md transition-all duration-200 ${c.borderStripe}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                {c.title}
              </span>
              <div className={`p-2 rounded-xl ${c.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <div className={`font-mono text-2xl font-black tracking-tight ${c.textColor}`}>
                {loading ? (
                  <span className="inline-block w-24 h-7 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                ) : (
                  c.value
                )}
              </div>
              {c.badge && !loading && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    c.badge === 'AUDITORIA'
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {c.badge}
                </span>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
              {c.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
};

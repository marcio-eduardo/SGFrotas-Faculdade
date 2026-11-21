import React from 'react';

const neutralCardTokens = {
  text: 'text-slate-900 dark:text-slate-100',
  iconBg: 'fleet-surface-muted text-slate-600 dark:text-slate-300',
  badge: 'fleet-surface-muted text-slate-700 dark:text-slate-300',
};

const colorStyles = {
  blue: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-blue',
    dot: 'bg-region-norte-hover',
    bar: 'bg-region-norte-hover/85',
  },
  green: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-green',
    dot: 'bg-alert-em-dia',
    bar: 'bg-alert-em-dia',
  },
  sky: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-blue',
    dot: 'bg-fleet-bronze',
    bar: 'bg-fleet-bronze/70',
  },
  amber: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-amber',
    dot: 'bg-alert-proxima',
    bar: 'bg-alert-proxima/80',
  },
  red: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-red',
    dot: 'bg-alert-vencida',
    bar: 'bg-alert-vencida',
  },
  purple: {
    ...neutralCardTokens,
    stripe: 'kpi-stripe-purple',
    dot: 'bg-fleet-titanium',
    bar: 'bg-fleet-titanium',
  },
};

export const KpiCard = ({
  title,
  value,
  sub,
  percentage,
  percentageLabel,
  color = 'blue',
  icon: Icon,
  trend,
  isActiveFilter = false,
  onClick,
  variant = 'default',
  className = '',
}) => {
  const current = colorStyles[color] || colorStyles.blue;
  const numericPct = typeof percentage === 'number' || !isNaN(Number(percentage)) ? Number(percentage) : null;
  const isClickable = Boolean(onClick);
  const isHero = variant === 'hero';

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`group relative overflow-hidden fleet-card-surface rounded-2xl ${
        isHero ? 'p-4 sm:p-5 flex flex-col justify-between h-full' : 'p-3.5 sm:p-4'
      } transition-all duration-200 ${
        current.stripe
      } ${
        isActiveFilter
          ? 'ring-1 ring-slate-400 dark:ring-fleet-bronze border-slate-400 dark:border-fleet-bronze shadow-md bg-slate-50/60 dark:bg-fleet-graphite/40'
          : isClickable
          ? 'hover:border-slate-300 dark:hover:border-fleet-titanium/80 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
          : ''
      } ${className}`}
    >
      {/* Cabeçalho do Card: Título + Ícone */}
      <div className="flex items-center justify-between mb-2">
        <span className={`${isHero ? 'text-xs' : 'text-[11px]'} font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase`}>
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${current.iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Linha de Valor Principal & Badge Percentual */}
      <div className={`flex items-baseline justify-between gap-2 ${isHero ? 'my-auto py-3' : 'mt-1'}`}>
        <div
          className={`font-mono font-extrabold tracking-tight ${current.text} ${
            isHero ? 'text-4xl xl:text-5xl' : 'text-2xl xl:text-3xl'
          }`}
        >
          {value}
        </div>

        {numericPct !== null && (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${current.badge}`}
            title={`Representa ${numericPct}% da frota total`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />
            <span>{numericPct}%</span>
            {percentageLabel && <span className="hidden xl:inline text-[9px] font-normal opacity-80">{percentageLabel}</span>}
          </div>
        )}
      </div>

      {/* Subtítulo / Contexto Operacional */}
      {(sub || trend) && (
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">{sub}</span>
          {trend && (
            <span
              className={`font-semibold shrink-0 ${
                trend.positive ? 'text-slate-700 dark:text-slate-200' : 'text-alert-vencida dark:text-fleet-bronze'
              }`}
            >
              {trend.value}
            </span>
          )}
          {isActiveFilter && (
            <span className="text-[10px] font-bold text-slate-700 dark:text-fleet-bronze shrink-0">
              ● Ativo
            </span>
          )}
        </div>
      )}

      {/* Mini Barra de Progresso Proporcional */}
      {numericPct !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${current.bar}`}
            style={{ width: `${Math.min(Math.max(numericPct, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

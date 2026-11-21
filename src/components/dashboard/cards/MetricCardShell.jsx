import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * Invólucro padrão dos cards gráficos do Dashboard Executivo.
 * Garante altura uniforme (h-full), contraste WCAG AA (Light/Dark),
 * botão de detalhamento acessível no canto superior direito e rodapé enxuto.
 */
export const MetricCardShell = ({
  title,
  subtitle,
  icon: Icon,
  headerBadge,
  onOpenDetails,
  detailLabel = 'Detalhar indicador',
  footer,
  children,
  className = '',
  bodyClassName = '',
  compact = false,
}) => {
  return (
    <section
      aria-label={title}
      className={`fleet-card-surface rounded-2xl ${
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
      } flex flex-col justify-between h-full ${className}`}
    >
      {/* Cabeçalho do Card */}
      <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-light-jet dark:text-white tracking-tight truncate">
              {title}
            </h3>
            {headerBadge}
          </div>
          {subtitle && (
            <p className="text-[11px] text-light-mutedText dark:text-slate-400 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>

        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            title={detailLabel}
            aria-label={detailLabel}
            className={`${
              compact ? 'min-w-[32px] min-h-[32px] px-2 py-1' : 'min-w-[36px] min-h-[36px] px-2.5 py-1.5'
            } rounded-xl shrink-0 inline-flex items-center justify-center gap-1 bg-app-surface2 dark:bg-fleet-graphite/80 text-light-jet dark:text-slate-300 border border-app-surface3 dark:border-fleet-titanium/50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 dark:hover:bg-fleet-copper/15 dark:hover:text-fleet-copperGlow dark:hover:border-fleet-copper/45 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-fleet-copperGlow focus-visible:ring-offset-2 dark:focus-visible:ring-offset-fleet-charcoal group/detail`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
            <ArrowUpRight
              className="w-3.5 h-3.5 opacity-60 group-hover/detail:opacity-100 motion-safe:group-hover/detail:translate-x-0.5 motion-safe:group-hover/detail:-translate-y-0.5 motion-safe:transition-transform"
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Área Visual Principal */}
      <div
        className={`flex-1 flex flex-col justify-center ${
          compact ? 'min-h-0' : 'min-h-[190px]'
        } ${bodyClassName}`}
      >
        {children}
      </div>

      {/* Rodapé Enxuto (1 linha) */}
      {footer && (
        <div
          className={`${
            compact ? 'mt-2 pt-2' : 'mt-3 pt-2.5'
          } border-t border-app-surface3/80 dark:border-white/5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]`}
        >
          <div className="text-light-charcoalText dark:text-slate-400 font-medium min-w-0">
            {footer}
          </div>
        </div>
      )}
    </section>
  );
};

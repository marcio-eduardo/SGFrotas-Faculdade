import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { MetricCardShell } from './MetricCardShell';
import { BrazilRegionsSvg, buildBrazilRegions } from './BrazilRegionsSvg';

export const BrasilRegioesMapCard = ({
  regioesMapa = [],
  donutRegioes = [],
  totalAtpsAtivas,
  totalVeiculosAtivos,
  onOpenDetails,
  className = '',
  variant = 'default',
}) => {
  const isHero = variant === 'hero';
  const regions = useMemo(
    () => buildBrazilRegions(regioesMapa, donutRegioes),
    [regioesMapa, donutRegioes]
  );

  const topRegion = useMemo(() => {
    return [...regions].sort((a, b) => b.veiculos - a.veiculos)[0] || regions[3];
  }, [regions]);

  const [activeCode, setActiveCode] = useState(null);
  const currentRegion =
    regions.find((r) => r.codigo === activeCode) || topRegion;

  const totalVeiculos =
    totalVeiculosAtivos != null
      ? Number(totalVeiculosAtivos)
      : regions.reduce((acc, r) => acc + r.veiculos, 0);

  const totalAtps =
    totalAtpsAtivas != null
      ? Number(totalAtpsAtivas)
      : regions.reduce((acc, r) => acc + r.atpsAtivas, 0);

  const handleRegionClick = (codigo) => {
    setActiveCode(codigo);
    if (onOpenDetails) onOpenDetails(codigo);
  };

  return (
    <MetricCardShell
      title="Distribuição Geográfica"
      subtitle="Frota distribuída pelas 5 macro-regiões"
      icon={MapPin}
      onOpenDetails={() => onOpenDetails?.()}
      detailLabel="Abrir detalhamento geográfico de regiões e 17 ATPs"
      className={className}
      bodyClassName={isHero ? 'min-h-[340px] sm:min-h-[380px] xl:min-h-[420px] flex flex-col justify-center' : ''}
      headerBadge={
        <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full fleet-surface-muted text-slate-700 dark:text-slate-200">
          {totalVeiculos} veíc. • {totalAtps} ATPs
        </span>
      }
    >
      <div
        className={
          isHero
            ? 'relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1'
            : 'flex flex-col sm:flex-row sm:items-end justify-between gap-3'
        }
      >
        {/* Mapa Vetorial Estilizado do Brasil (5 Macro-Regiões) em destaque */}
        <div
          className={`flex items-center justify-center ${
            isHero ? 'sm:flex-1 sm:justify-start' : 'sm:flex-1'
          }`}
        >
          <BrazilRegionsSvg
            regions={regions}
            highlightedCode={activeCode}
            dimInactive={Boolean(activeCode)}
            onHoverChange={setActiveCode}
            onSelectRegion={handleRegionClick}
            className={`w-full h-auto select-none overflow-visible ${
              isHero
                ? 'max-w-[350px] sm:max-w-[390px] xl:max-w-[435px]'
                : 'max-w-[260px] xl:max-w-[300px]'
            }`}
          />
        </div>

        {/* Readout / Tooltip Contextual Interativo posicionado no canto inferior direito */}
        <div
          className={
            isHero
              ? 'w-full sm:w-[215px] xl:w-[245px] shrink-0 sm:absolute sm:right-0 sm:bottom-1 z-10'
              : 'w-full sm:w-[195px] shrink-0'
          }
        >
          <div
            aria-live="polite"
            className="p-3 rounded-xl bg-app-surface2/90 dark:bg-app-darkSurface2/95 border border-app-surface3 dark:border-white/10 space-y-2 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    activeCode === currentRegion?.codigo
                      ? (currentRegion?.hoverColor || currentRegion?.color)
                      : currentRegion?.color,
                }}
              />
              <span className="text-xs font-extrabold text-light-jet dark:text-white truncate">
                {currentRegion?.label}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[10px] font-semibold text-light-mutedText dark:text-slate-400">
                  Veículos
                </span>
                <span className="text-sm font-black font-mono text-light-jet dark:text-white">
                  {currentRegion?.veiculos ?? 0}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[10px] font-semibold text-light-mutedText dark:text-slate-400">
                  Frota
                </span>
                <span className="text-xs font-extrabold font-mono text-light-jet dark:text-slate-100">
                  {Number(currentRegion?.percentage ?? 0).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[10px] font-semibold text-light-mutedText dark:text-slate-400">
                  ATPs
                </span>
                <span className="text-xs font-bold font-mono text-light-charcoalText dark:text-slate-300">
                  {currentRegion?.atpsAtivas ?? 0}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-app-surface3 dark:border-white/10 flex flex-wrap gap-1">
              {(currentRegion?.siglasUfs || []).slice(0, 5).map((uf) => (
                <span
                  key={uf}
                  className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-app-surface dark:bg-white/5 text-light-jet dark:text-slate-300 border border-app-surface3 dark:border-white/10"
                >
                  {uf}
                </span>
              ))}
              {(currentRegion?.siglasUfs || []).length > 5 && (
                <span className="text-[9px] font-mono font-bold px-1 text-slate-400">
                  +{currentRegion.siglasUfs.length - 5}
                </span>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center leading-tight">
            Passe ou navegue (Tab) nas regiões
          </p>
        </div>
      </div>
    </MetricCardShell>
  );
};

import React, { useId, useMemo, useEffect, useState } from 'react';
import { Fuel } from 'lucide-react';
import { MetricCardShell } from './MetricCardShell';

const parseLiters = (valueStr) => {
  if (typeof valueStr === 'number') return valueStr;
  const cleaned = String(valueStr || '0')
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(cleaned) || 0;
};

const formatLiters = (liters) =>
  `${Math.round(Number(liters || 0)).toLocaleString('pt-BR')} L`;

const FuelPumpSvg = ({
  uid,
  nameplate,
  percentage,
  palette,
  hoseSide = 'right',
  animateLevel,
  compact = false,
}) => {
  const clipId = `pump-tank-${uid}-${palette.key}`;
  const liquidGradId = `pump-liq-${uid}-${palette.key}`;
  const canopyGradId = `pump-canopy-${uid}-${palette.key}`;
  const bodyGradId = `pump-body-${uid}-${palette.key}`;

  // Altura útil da janela de vidro (y: 78 .. 144 => altura 66)
  const gaugeX = 28;
  const gaugeY = 76;
  const gaugeW = 54;
  const gaugeH = 68;

  const targetPct = Math.max(0, Math.min(100, Number(percentage) || 0));
  // Mantém mínimo visual de 7% quando > 0 para o nível permanecer perceptível no visor
  const visualPct =
    targetPct <= 0 ? 0 : Math.max(7, Math.min(100, targetPct));
  const fillHeight = animateLevel ? (visualPct / 100) * gaugeH : 0;
  const fillY = gaugeY + gaugeH - fillHeight;

  const isLeftHose = hoseSide === 'left';

  return (
    <svg
      viewBox="0 0 132 174"
      className={`${
        compact
          ? 'w-[76px] h-[96px] sm:w-[84px] sm:h-[106px]'
          : 'w-28 h-36 sm:w-[126px] sm:h-[162px] xl:w-[138px] xl:h-[176px]'
      } select-none overflow-visible`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={gaugeX} y={gaugeY} width={gaugeW} height={gaugeH} rx="6" />
        </clipPath>
        <linearGradient id={liquidGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.liquidTop} />
          <stop offset="100%" stopColor={palette.liquidBottom} />
        </linearGradient>
        <linearGradient id={canopyGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.canopyStart} />
          <stop offset="100%" stopColor={palette.canopyEnd} />
        </linearGradient>
        <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      {/* Mangueira curva + bico acoplado na lateral */}
      {isLeftHose ? (
        <g>
          {/* Suporte lateral esquerdo */}
          <rect
            x="11"
            y="62"
            width="9"
            height="22"
            rx="3"
            className="fill-slate-300 dark:fill-slate-700"
          />
          {/* Bico abastecedor */}
          <path
            d="M 16 66 L 11 54 L 6 52 L 8 47 L 16 50 L 20 65 Z"
            fill={palette.canopyStart}
          />
          {/* Mangueira emborrachada */}
          <path
            d="M 15 84 C 3 96, 3 136, 19 144"
            fill="none"
            className="stroke-slate-700 dark:stroke-slate-400"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g>
          {/* Suporte lateral direito */}
          <rect
            x="92"
            y="62"
            width="9"
            height="22"
            rx="3"
            className="fill-slate-300 dark:fill-slate-700"
          />
          {/* Bico abastecedor */}
          <path
            d="M 96 66 L 101 54 L 106 52 L 104 47 L 96 50 L 92 65 Z"
            fill={palette.canopyStart}
          />
          {/* Mangueira emborrachada */}
          <path
            d="M 97 84 C 111 96, 111 136, 93 144"
            fill="none"
            className="stroke-slate-700 dark:stroke-slate-400"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Deslocamento horizontal para centralizar corpo da bomba considerando o lado da mangueira */}
      <g transform={isLeftHose ? 'translate(8, 0)' : 'translate(0, 0)'}>
        {/* Pedestal / base da bomba */}
        <rect
          x="14"
          y="156"
          width="82"
          height="10"
          rx="3"
          className="fill-slate-300 dark:fill-slate-700"
        />
        <rect
          x="10"
          y="164"
          width="90"
          height="5"
          rx="2.5"
          className="fill-slate-400 dark:fill-slate-600"
        />

        {/* Gabinete principal da bomba */}
        <rect
          x="18"
          y="14"
          width="74"
          height="143"
          rx="10"
          className="fill-slate-100 dark:fill-app-darkSurface2 stroke-slate-300 dark:stroke-white/15"
          strokeWidth="1.5"
        />
        <rect
          x="18"
          y="14"
          width="74"
          height="143"
          rx="10"
          fill={`url(#${bodyGradId})`}
          className="text-slate-900 dark:text-sky-200 pointer-events-none"
        />

        {/* Letreiro luminoso superior (Canopy) */}
        <rect
          x="22"
          y="18"
          width="66"
          height="20"
          rx="6"
          fill={`url(#${canopyGradId})`}
        />
        <text
          x="55"
          y="31.5"
          textAnchor="middle"
          fill="var(--sheen-white)"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="0.8"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          {nameplate}
        </text>

        {/* Visor Digital LCD escuro com % real */}
        <rect
          x="25"
          y="43"
          width="60"
          height="26"
          rx="5"
          fill="var(--pump-lcd-bg)"
          stroke={palette.canopyEnd}
          strokeOpacity="0.45"
          strokeWidth="1.2"
        />
        {/* Reflexo sutil no LCD */}
        <path
          d="M 27 45 L 83 45 L 74 52 L 27 52 Z"
          fill="var(--sheen-white)"
          opacity="0.06"
        />
        <text
          x="55"
          y="60.5"
          textAnchor="middle"
          fill={palette.lcdText}
          fontSize="12.5"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {targetPct.toFixed(1)}%
        </text>

        {/* Janela de vidro do nível de combustível */}
        <rect
          x={gaugeX}
          y={gaugeY}
          width={gaugeW}
          height={gaugeH}
          rx="6"
          className="fill-slate-200/80 dark:fill-slate-900/90 stroke-slate-300 dark:stroke-white/15"
          strokeWidth="1.2"
        />

        {/* Líquido animado dentro do clipPath */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={gaugeX}
            y={fillY}
            width={gaugeW}
            height={fillHeight + 2}
            fill={`url(#${liquidGradId})`}
            className="motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out"
          />
          {/* Menisco luminoso no topo da coluna líquida */}
          {fillHeight > 2 && (
            <rect
              x={gaugeX}
              y={fillY}
              width={gaugeW}
              height="3"
              fill="var(--sheen-white)"
              opacity="0.35"
              className="motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out"
            />
          )}
        </g>

        {/* Régua / marcas de nível 25%, 50%, 75% */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const tickY = gaugeY + gaugeH * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={gaugeX + 3}
              y1={tickY}
              x2={gaugeX + 11}
              y2={tickY}
              className="stroke-slate-500/60 dark:stroke-white/35"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Brilho vertical no vidro */}
        <rect
          x={gaugeX + gaugeW - 8}
          y={gaugeY + 4}
          width="3"
          height={gaugeH - 8}
          rx="1.5"
          fill="var(--sheen-white)"
          opacity="0.22"
        />
      </g>
    </svg>
  );
};

export const CombustivelPumpsCard = ({
  combustivelStats,
  donutCombustivel = [],
  onOpenDetails,
  compact = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const [animateLevel, setAnimateLevel] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateLevel(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const stats = useMemo(() => {
    if (combustivelStats) {
      const etanolLitros = Number(combustivelStats.etanolLitros || 0);
      const gasolinaLitros = Number(combustivelStats.gasolinaLitros || 0);
      const hasSecondary =
        (combustivelStats.combustiveis || []).some(
          (c) => !/ETANOL|GASOLINA/i.test(c.categoria || '')
        ) || (combustivelStats.servicos || []).length > 0;

      return {
        etanolLitros,
        etanolFormatado:
          combustivelStats.etanolFormatado || formatLiters(etanolLitros),
        etanolPct: Number(combustivelStats.etanolPct || 0),
        gasolinaLitros,
        gasolinaFormatado:
          combustivelStats.gasolinaFormatado || formatLiters(gasolinaLitros),
        gasolinaPct: Number(combustivelStats.gasolinaPct || 0),
        totalFormatado:
          combustivelStats.totalCombustivelLitrosFormatado ||
          formatLiters(etanolLitros + gasolinaLitros),
        eficienciaMediaKmL: combustivelStats.eficienciaMediaKmL,
        hasSecondary,
      };
    }

    // Fallback resiliente a partir de donutCombustivel caso API esteja offline
    const etanolSeg = donutCombustivel.find((d) => /etanol/i.test(d.label || ''));
    const gasolinaSeg = donutCombustivel.find((d) =>
      /gasolina/i.test(d.label || '')
    );
    const etanolLitros = parseLiters(etanolSeg?.value);
    const gasolinaLitros = parseLiters(gasolinaSeg?.value);
    const sum = etanolLitros + gasolinaLitros;

    return {
      etanolLitros,
      etanolFormatado: etanolSeg?.value || formatLiters(etanolLitros),
      etanolPct:
        etanolSeg?.percentage ?? (sum > 0 ? (etanolLitros / sum) * 100 : 0),
      gasolinaLitros,
      gasolinaFormatado: gasolinaSeg?.value || formatLiters(gasolinaLitros),
      gasolinaPct:
        gasolinaSeg?.percentage ?? (sum > 0 ? (gasolinaLitros / sum) * 100 : 0),
      totalFormatado: formatLiters(
        donutCombustivel.reduce((acc, d) => acc + parseLiters(d.value), 0)
      ),
      eficienciaMediaKmL: null,
      hasSecondary: donutCombustivel.some(
        (d) => !/etanol|gasolina/i.test(d.label || '')
      ),
    };
  }, [combustivelStats, donutCombustivel]);

  const etanolPalette = {
    key: 'etanol',
    canopyStart: 'var(--pump-etanol-canopy-start)',
    canopyEnd: 'var(--pump-etanol-canopy-end)',
    liquidTop: 'var(--pump-etanol-liquid-top)',
    liquidBottom: 'var(--pump-etanol-liquid-bottom)',
    lcdText: 'var(--pump-etanol-lcd-text)',
  };

  const gasolinaPalette = {
    key: 'gasolina',
    canopyStart: 'var(--pump-gasolina-canopy-start)',
    canopyEnd: 'var(--pump-gasolina-canopy-end)',
    liquidTop: 'var(--pump-gasolina-liquid-top)',
    liquidBottom: 'var(--pump-gasolina-liquid-bottom)',
    lcdText: 'var(--pump-gasolina-lcd-text)',
  };

  return (
    <MetricCardShell
      title="Combustível ValeCard"
      subtitle="Volume abastecido por combustível principal"
      icon={Fuel}
      compact={compact}
      onOpenDetails={onOpenDetails}
      detailLabel="Abrir detalhamento completo de abastecimentos e serviços ValeCard"
      headerBadge={
        stats.eficienciaMediaKmL != null ? (
          <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full fleet-surface-muted text-slate-700 dark:text-slate-200">
            {Number(stats.eficienciaMediaKmL).toFixed(1)} km/L
          </span>
        ) : (
          <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full fleet-surface-muted text-slate-700 dark:text-slate-200">
            {stats.totalFormatado}
          </span>
        )
      }
      footer={
        <span>
          <strong className="font-mono text-slate-800 dark:text-slate-200">
            {stats.totalFormatado}
          </strong>
          <span className="ml-1">abastecidos</span>
          {stats.hasSecondary ? ' • +Diesel/serv.' : ''}
        </span>
      }
    >
      <div className={`grid grid-cols-2 ${compact ? 'gap-2.5' : 'gap-3'} items-center`}>
        {/* Bomba Esquerda: Etanol */}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`Etanol: ${stats.etanolFormatado}, ${stats.etanolPct.toFixed(1)}% do volume. Clique para detalhar.`}
          className={`group/pump flex flex-col items-center ${
            compact ? 'p-1.5' : 'p-2'
          } rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-fleet-titanium/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fleet-bronze`}
        >
          <FuelPumpSvg
            uid={uid}
            nameplate="ETANOL"
            percentage={stats.etanolPct}
            palette={etanolPalette}
            hoseSide="left"
            animateLevel={animateLevel}
            compact={compact}
          />
          <div className="mt-1 text-center">
            <div className={`${compact ? 'text-xs sm:text-sm' : 'text-sm'} font-black font-mono text-slate-900 dark:text-white leading-tight`}>
              {stats.etanolFormatado}
            </div>
            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              Etanol Hidratado
            </div>
          </div>
        </button>

        {/* Bomba Direita: Gasolina */}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`Gasolina: ${stats.gasolinaFormatado}, ${stats.gasolinaPct.toFixed(1)}% do volume. Clique para detalhar.`}
          className={`group/pump flex flex-col items-center ${
            compact ? 'p-1.5' : 'p-2'
          } rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-fleet-titanium/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fleet-bronze`}
        >
          <FuelPumpSvg
            uid={uid}
            nameplate="GASOLINA"
            percentage={stats.gasolinaPct}
            palette={gasolinaPalette}
            hoseSide="right"
            animateLevel={animateLevel}
            compact={compact}
          />
          <div className="mt-1 text-center">
            <div className={`${compact ? 'text-xs sm:text-sm' : 'text-sm'} font-black font-mono text-slate-900 dark:text-white leading-tight`}>
              {stats.gasolinaFormatado}
            </div>
            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              Gasolina Comum
            </div>
          </div>
        </button>
      </div>
    </MetricCardShell>
  );
};

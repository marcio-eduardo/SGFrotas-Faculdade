import React, { useEffect, useId, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { MetricCardShell } from './MetricCardShell';

const parseCount = (segment) => {
  if (!segment) return 0;
  if (typeof segment.count === 'number') return segment.count;
  const raw = String(segment.value || '0').replace(/\./g, '');
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const build12PointRingPath = (cx, cy, rOuter, rInner) => {
  const points = [];
  const totalVertices = 24;
  for (let i = 0; i < totalVertices; i += 1) {
    const angle = (i * Math.PI) / 12 - Math.PI / 2;
    const radius = i % 2 === 0 ? rOuter : rInner;
    const x = (cx + Math.cos(angle) * radius).toFixed(2);
    const y = (cy + Math.sin(angle) * radius).toFixed(2);
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${points.join(' ')} Z`;
};

const WRENCH_OUTER_PATH = `
  M 31 14
  L 36.5 12
  L 38.5 26.5
  L 45 33
  L 53.5 31
  L 57 22
  L 52.5 9.5
  L 58.5 10.5
  C 69.5 15, 72 28, 66 39
  C 62 45.5, 57 49.5, 55.5 55
  L 56.8 121
  C 57.5 124, 60 126.5, 62 129
  C 65.5 134, 66 144, 61 151
  C 57 156, 52.5 157.5, 48 157.5
  C 43.5 157.5, 39 156, 35 151
  C 30 144, 30.5 134, 34 129
  C 36 126.5, 38.5 124, 39.2 121
  L 40.5 55
  C 39 50.5, 34 47.5, 29.5 42
  C 24 34, 24.5 21, 31 14
  Z
`;

const RING_12PT_CUTOUT_PATH = build12PointRingPath(48, 141, 8.4, 7.2);
const WRENCH_SILHOUETTE_PATH = `${WRENCH_OUTER_PATH} ${RING_12PT_CUTOUT_PATH}`;

const WrenchSvg = ({ tone, percentage, animateFill, uid, compact = false }) => {
  const clipId = `wrench-clip-${uid}-${tone.key}`;

  // Dimensões verticais da silhueta: y=9.5 (topo da mandíbula inclinada) até y=157.5 (base do olhal) => altura 148
  const topY = 9.5;
  const bottomY = 157.5;
  const bodyHeight = bottomY - topY;
  const rawPct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const visualPct = rawPct <= 0 ? 0 : rawPct < 8 ? 8 : rawPct;
  const fillHeight = animateFill ? (visualPct / 100) * bodyHeight : 0;
  const fillY = bottomY - fillHeight;

  return (
    <svg
      viewBox="0 0 96 164"
      className={`${compact
        ? 'w-12 h-[82px] sm:w-[54px] sm:h-[92px]'
        : 'w-16 h-28 sm:w-[76px] sm:h-[130px] xl:w-[84px] xl:h-[144px]'
        } select-none overflow-visible motion-safe:transition-transform motion-safe:duration-300 ${tone.hoverMotion}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={WRENCH_SILHOUETTE_PATH} clipRule="evenodd" />
        </clipPath>
      </defs>

      {/* Camada 1: Silhueta flat vazia (sem contorno e sem efeito metálico) */}
      <path
        d={WRENCH_SILHOUETTE_PATH}
        fillRule="evenodd"
        className="fill-slate-200/75 dark:fill-white/10"
      />

      {/* Camada 2: Preenchimento sólido proporcional de baixo para cima */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="20"
          y={fillY}
          width="56"
          height={fillHeight + 2}
          fill={tone.fill}
          className="motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out"
        />
      </g>
    </svg>
  );
};

export const RevisoesWrenchCard = ({
  revisoesConformidadePct,
  revisoesTotalAtivos,
  donutRevisoes = [],
  onOpenDetails,
  compact = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const [animateFill, setAnimateFill] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimateFill(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const summary = useMemo(() => {
    const segEmDia =
      donutRevisoes.find((s) => /dia/i.test(s.label || '')) || donutRevisoes[0];
    const segProxima =
      donutRevisoes.find((s) => /pr[oó]xima|aten/i.test(s.label || '')) ||
      donutRevisoes[1];
    const segVencida =
      donutRevisoes.find((s) => /vencid/i.test(s.label || '')) || donutRevisoes[2];

    const items = [
      {
        key: 'em_dia',
        shortLabel: 'Em dia',
        rangeLabel: '> 1.000 km',
        count: parseCount(segEmDia),
        percentage: Number(segEmDia?.percentage ?? 0),
        tone: {
          key: 'emdia',
          fill: 'var(--wrench-emdia-fill)',
          hoverMotion: 'motion-safe:group-hover/wrench:-rotate-6',
          badgeClass: 'fleet-alert-em-dia',
        },
      },
      {
        key: 'proxima',
        shortLabel: 'Próxima',
        rangeLabel: '≤ 1.000 km',
        count: parseCount(segProxima),
        percentage: Number(segProxima?.percentage ?? 0),
        tone: {
          key: 'proxima',
          fill: 'var(--wrench-proxima-fill)',
          hoverMotion: 'motion-safe:group-hover/wrench:-translate-y-1',
          badgeClass: 'fleet-alert-proxima',
        },
      },
      {
        key: 'vencida',
        shortLabel: 'Vencida',
        rangeLabel: 'Atrasada',
        count: parseCount(segVencida),
        percentage: Number(segVencida?.percentage ?? 0),
        tone: {
          key: 'vencida',
          fill: 'var(--wrench-vencida-fill)',
          hoverMotion: 'motion-safe:group-hover/wrench:rotate-6',
          badgeClass: 'fleet-alert-vencida',
        },
      },
    ];

    const computedTotal =
      revisoesTotalAtivos != null
        ? Number(revisoesTotalAtivos)
        : items.reduce((acc, it) => acc + it.count, 0);

    const conformidadePct =
      revisoesConformidadePct != null
        ? Number(revisoesConformidadePct)
        : items[0].percentage;

    return { items, computedTotal, conformidadePct };
  }, [donutRevisoes, revisoesConformidadePct, revisoesTotalAtivos]);

  const conformidadeBadgeTone =
    summary.conformidadePct >= 80
      ? 'fleet-alert-em-dia'
      : summary.conformidadePct >= 60
        ? 'fleet-alert-proxima'
        : 'fleet-alert-vencida';

  return (
    <MetricCardShell
      title="Status de Revisões Arval"
      subtitle="Ciclo preventivo de 10.000 Km contratual"
      icon={Wrench}
      compact={compact}
      onOpenDetails={() => onOpenDetails?.({ mode: 'overview' })}
      detailLabel="Abrir detalhamento completo de revisões preventivas Arval"
      headerBadge={
        <span
          className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full border ${conformidadeBadgeTone}`}
        >
          {summary.conformidadePct.toFixed(1)}% em dia
        </span>
      }
      footer={null}
    >
      <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-2.5'} items-end`}>
        {summary.items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenDetails?.({ mode: 'single', status: item.key })}
            aria-label={`Abrir detalhamento de revisões ${item.shortLabel} (${item.rangeLabel}): ${item.count} veículos, ${item.percentage.toFixed(1)}% do total de ${summary.computedTotal} ativos.`}
            title={`${item.shortLabel} (${item.rangeLabel}) • ${item.count} veíc. (${item.percentage.toFixed(1)}%)`}
            className={`group/wrench flex flex-col items-center text-center ${compact ? 'p-1.5' : 'p-2'
              } rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
          >
            {/* Contagem numérica acima da chave */}
            <div className="mb-1">
              <span
                className={`${compact ? 'text-sm' : 'text-base'
                  } font-black font-mono leading-none text-slate-900 dark:text-white`}
              >
                {item.count}
              </span>
            </div>

            {/* Chave combinada industrial com preenchimento proporcional */}
            <WrenchSvg
              tone={item.tone}
              percentage={item.percentage}
              animateFill={animateFill}
              uid={uid}
              compact={compact}
            />

            {/* Status único abaixo da chave */}
            <div className="mt-1.5">
              <span
                className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${item.tone.badgeClass}`}
              >
                {item.shortLabel}
              </span>
            </div>
          </button>
        ))}
      </div>
    </MetricCardShell>
  );
};

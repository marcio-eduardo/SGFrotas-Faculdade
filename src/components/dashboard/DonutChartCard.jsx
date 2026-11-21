import React from 'react';

export const DonutChartCard = ({
  title,
  subtitle,
  centerValue,
  centerLabel,
  segments = [],
  icon: Icon,
}) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.292

  // Calcula o offset acumulado para cada fatia do donut
  let cumulativePercentage = 0;
  const renderedSegments = segments.map((seg) => {
    const strokeDasharray = `${(seg.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
    cumulativePercentage += seg.percentage;

    return {
      ...seg,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="bg-white dark:bg-app-darkSurface border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Donut SVG Centralizado */}
      <div className="relative flex items-center justify-center my-2">
        <svg
          viewBox="0 0 160 160"
          className="w-44 h-44 transform -rotate-90"
        >
          {/* Círculo de trilho/fundo */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="18"
            className="text-slate-100 dark:text-white/5"
          />

          {/* Fatias coloridas */}
          {renderedSegments.map((seg, i) => (
            <circle
              key={i}
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap={seg.percentage < 99 ? 'round' : 'butt'}
              className="transition-all duration-700 ease-out"
            />
          ))}
        </svg>

        {/* Informação Centralizada no Miolo do Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white font-mono leading-tight">
            {centerValue}
          </span>
          {centerLabel && (
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 max-w-[100px] leading-tight">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Legenda Informativa */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-1.5">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                {seg.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {seg.value && (
                <span className="text-slate-500 dark:text-slate-400 text-[10px] font-mono">
                  {seg.value}
                </span>
              )}
              <span className="font-bold text-slate-900 dark:text-white text-[11px] font-mono min-w-[36px] text-right">
                {seg.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


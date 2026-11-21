import React from 'react';

const SIZE_STYLES = {
  xs: {
    wrapper: 'w-[86px] rounded-[5px]',
    header: 'h-[13px] px-1.5',
    brandText: 'text-[6px] tracking-[0.18em]',
    emblem: 'w-2.5 h-2',
    flag: 'w-3 h-2',
    body: 'h-[26px] px-1.5',
    brText: 'text-[6px] left-1 bottom-[1px]',
    plateText: 'text-[13px] tracking-[0.05em]',
  },
  sm: {
    wrapper: 'w-[105px] rounded-[6px]',
    header: 'h-[16px] px-2',
    brandText: 'text-[7.5px] tracking-[0.2em]',
    emblem: 'w-3.5 h-3',
    flag: 'w-4 h-2.5',
    body: 'h-[35px] px-2',
    brText: 'text-[7px] left-1.5 bottom-[1px]',
    plateText: 'text-[17px] tracking-[0.06em]',
  },
  md: {
    wrapper: 'w-[144px] rounded-[7px]',
    header: 'h-[20px] px-2.5',
    brandText: 'text-[9.5px] tracking-[0.22em]',
    emblem: 'w-4 h-3.5',
    flag: 'w-4.5 h-3.5',
    body: 'h-[40px] px-2.5',
    brText: 'text-[9px] left-2 bottom-[4px]',
    plateText: 'text-[21px] tracking-[0.08em]',
  },
  lg: {
    wrapper: 'w-[176px] rounded-[8px]',
    header: 'h-[24px] px-3',
    brandText: 'text-[11px] tracking-[0.24em]',
    emblem: 'w-5 h-4',
    flag: 'w-5.5 h-4',
    body: 'h-[48px] px-3',
    brText: 'text-[11px] left-2.5 bottom-[5px]',
    plateText: 'text-[26px] tracking-[0.1em]',
  },
};

/**
 * Componente visual no padrão da Placa Mercosul Brasileira (azul oficial Mercosul + fundo branco + fonte preta).
 * Proporção e altura calibradas para alta legibilidade e destaque visual.
 */
export const MercosulPlate = ({ placa, size = 'sm', className = '' }) => {
  const normalizedPlate = String(placa || '---').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const s = SIZE_STYLES[size] || SIZE_STYLES.sm;

  return (
    <div
      aria-label={`Placa ${normalizedPlate}`}
      className={`inline-flex flex-col overflow-hidden bg-white border-[1.5px] border-slate-900 dark:border-slate-300 shadow-sm select-all flex-shrink-0 ${s.wrapper} ${className}`}
    >
      {/* Tarja azul padrão Mercosul */}
      <div className={`bg-mercosul-blue text-white flex items-center justify-between gap-1 select-none ${s.header}`}>
        <svg viewBox="0 0 16 10" className={`${s.emblem} flex-shrink-0`} aria-hidden="true">
          <circle cx="4" cy="3" r="0.9" fill="var(--mercosul-star)" />
          <circle cx="7" cy="2.2" r="0.9" fill="var(--mercosul-star)" />
          <circle cx="10" cy="3" r="0.9" fill="var(--mercosul-star)" />
          <circle cx="7" cy="4.8" r="0.9" fill="var(--mercosul-star)" />
          <path d="M2 8 Q8 6 14 8" stroke="var(--mercosul-arc)" strokeWidth="1" fill="none" />
        </svg>

        <span className={`font-sans font-black uppercase leading-none ${s.brandText}`}>
          BRASIL
        </span>

        <svg viewBox="0 0 16 11" className={`${s.flag} flex-shrink-0 rounded-[1px] shadow-plate-flag`} aria-hidden="true">
          <rect width="16" height="11" fill="var(--mercosul-flag-green)" />
          <polygon points="8,1.5 14.2,5.5 8,9.5 1.8,5.5" fill="var(--mercosul-flag-yellow)" />
          <circle cx="8" cy="5.5" r="2.2" fill="var(--mercosul-flag-blue)" />
        </svg>
      </div>

      {/* Corpo branco da placa com código em preto e marca BR */}
      <div className={`relative flex items-center justify-center bg-white ${s.body}`}>
        <span
          className={`absolute font-sans font-black text-slate-700 leading-none select-none ${s.brText}`}
          aria-hidden="true"
        >
          BR
        </span>
        <span className={`font-mono font-black text-slate-950 leading-none select-all ${s.plateText}`}>
          {normalizedPlate}
        </span>
      </div>
    </div>
  );
};


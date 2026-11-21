import React, { useId } from 'react';
import sgFrotasLogoLight from '../../assets/logos/sgfrotas-logo-light.png';
import sgFrotasLogoDark from '../../assets/logos/sgfrotas-logo-dark.png';

/**
 * Silhueta vetorial do Renault Kwid com linhas de velocidade,
 * adaptada 100% às variáveis CSS do `tailwind.config.js` (`--kwid-*`).
 */
export const KwidLogoSvg = ({ className = 'h-9 w-auto', compactIcon = false, monochrome = false }) => {
  const uid = useId().replace(/:/g, '');
  const bodyGradId = `kwid-body-${uid}`;
  const streakGradId = `kwid-streak-${uid}`;
  const mainStroke = monochrome ? '11.5' : compactIcon ? '4.4' : '2.5';
  const detailStroke = monochrome ? '9.5' : compactIcon ? '3.4' : '2.0';
  const streakBase = compactIcon ? 4.2 : 2.5;

  if (monochrome) {
    return (
      <svg
        viewBox="20 -16 180 106"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} select-none`}
        aria-hidden="true"
      >
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <line x1="28" y1="22" x2="47" y2="22" strokeWidth="9.5" />
          <line x1="22" y1="32" x2="43" y2="32" strokeWidth="9.5" />
          <line x1="26" y1="42" x2="43" y2="42" strokeWidth="9.5" />
          <path
            d="M 55 11
               Q 75 5 112 5
               Q 125 6 144 23
               Q 166 25 186 30
               Q 193 33 194 42
               Q 195 52 187 56
               L 175 56
               A 16 16 0 0 0 143 57
               L 80 57
               A 16 16 0 0 0 48 56
               L 45 53
               Q 42 43 44 33
               L 52 17
               Z"
            strokeWidth={mainStroke}
          />
          <path
            d="M 73 22
               L 79 11
               L 113 11
               L 136 24
               Q 122 25 74 25
               Z"
            strokeWidth={detailStroke}
          />
          <circle cx="64" cy="57" r="13.8" strokeWidth={mainStroke} />
          <circle cx="159" cy="57" r="13.8" strokeWidth={mainStroke} />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 202 74"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} select-none overflow-visible`}
      role="img"
      aria-label="Logo Frota Kwid SGFrotas"
    >
      <defs>
        <linearGradient id={bodyGradId} x1="25%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="var(--kwid-stroke-top)" />
          <stop offset="100%" stopColor="var(--kwid-stroke-bottom)" />
        </linearGradient>
        <linearGradient id={streakGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--kwid-streak)" stopOpacity="0.15" />
          <stop offset="45%" stopColor="var(--kwid-stroke-top)" stopOpacity="0.78" />
          <stop offset="100%" stopColor="var(--kwid-stroke-top)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Linhas de velocidade traseiras */}
      <g stroke={`url(#${streakGradId})`} strokeLinecap="round">
        <line x1="34" y1="13" x2="56" y2="13" strokeWidth={streakBase * 0.85} />
        <line x1="29" y1="19" x2="52" y2="19" strokeWidth={streakBase * 0.65} />
        <line x1="14" y1="25" x2="75" y2="25" strokeWidth={streakBase * 1.2} />
        <line x1="26" y1="31" x2="114" y2="31" strokeWidth={streakBase * 1.2} />
        <line x1="4" y1="37" x2="107" y2="37" strokeWidth={streakBase * 1.15} />
        <line x1="18" y1="45" x2="45" y2="45" strokeWidth={streakBase * 0.78} />
        <line x1="22" y1="52" x2="44" y2="52" strokeWidth={streakBase * 0.9} />
        {!compactIcon && (
          <>
            <line x1="10" y1="52" x2="13" y2="52" strokeWidth="1.8" />
            <line x1="16" y1="52" x2="18" y2="52" strokeWidth="1.8" />
          </>
        )}
      </g>

      {/* Contorno principal da carroceria do Kwid */}
      <g stroke={`url(#${bodyGradId})`} strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M 55 11
             Q 75 5 112 5
             Q 125 6 144 23
             Q 166 25 186 30
             Q 193 33 194 42
             Q 195 52 187 56
             L 175 56
             A 16 16 0 0 0 143 57
             L 80 57
             A 16 16 0 0 0 48 56
             L 45 53
             Q 42 43 44 33
             L 52 17
             Z"
          strokeWidth={mainStroke}
        />

        {/* Janela lateral característica do Kwid */}
        <path
          d="M 73 22
             L 79 11
             L 113 11
             L 136 24
             Q 122 25 74 25
             Z"
          strokeWidth={detailStroke}
        />

        {/* Moldura inferior protetora da porta */}
        {!compactIcon && (
          <>
            <path
              d="M 85 48
                 Q 85 44 96 44
                 L 128 45
                 Q 138 46 138 49
                 Q 138 52 128 52
                 L 94 52
                 Q 85 51 85 48
                 Z"
              strokeWidth="1.8"
            />
            {/* Farol dianteiro e lanterna traseira */}
            <path d="M 173 35 L 190 35 Q 189 41 183 41 L 173 39 Z" strokeWidth="1.7" />
            <path d="M 45 30 L 55 30 L 53 36 L 45 35 Z" strokeWidth="1.5" />
          </>
        )}

        {/* Rodas dianteira e traseira (pneu + aro interno) */}
        <circle cx="64" cy="57" r="13.8" strokeWidth={mainStroke} />
        {!compactIcon && <circle cx="64" cy="57" r="8.2" strokeWidth="1.3" opacity="0.65" />}
        <circle cx="159" cy="57" r="13.8" strokeWidth={mainStroke} />
        {!compactIcon && <circle cx="159" cy="57" r="8.2" strokeWidth="1.3" opacity="0.65" />}
      </g>
    </svg>
  );
};

export const KwidMenuIcon = ({ className = 'w-4 h-4' }) => (
  <KwidLogoSvg compactIcon monochrome className={className} />
);

const SGFrotasLogoImage = ({ className = 'w-full max-w-[216px] h-auto' }) => (
  <>
    <img
      src={sgFrotasLogoLight}
      alt="SGFrotas"
      className={`${className} object-contain dark:hidden select-none`}
    />
    <img
      src={sgFrotasLogoDark}
      alt="SGFrotas"
      className={`${className} object-contain hidden dark:block select-none`}
    />
  </>
);

/**
 * Lockup oficial de marca: Logo integrado SGFrotas + Kwid com identidade parceira VeloceTech (LGPD).
 */
export const BrandLogo = ({ variant = 'sidebar' }) => {
  if (variant === 'positivo' || variant === 'partner') {
    return (
      <div className="inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border border-app-surface3 dark:border-fleet-titanium/45 bg-app-surface2/60 dark:bg-fleet-graphite/50 text-center select-none">
        <span className="text-[11px] font-black tracking-wider uppercase text-light-jet dark:text-white">
          VeloceTech
        </span>
        <span className="text-[9px] font-medium text-light-mutedText dark:text-fleet-bronze">
          Serviços Técnicos S.A.
        </span>
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className="flex flex-col items-center text-center gap-2.5 mb-6">
        <SGFrotasLogoImage className="h-12 sm:h-14 w-auto max-w-full mx-auto" />
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-fleet-copper/15 text-brand-700 dark:text-fleet-copperGlow border border-brand-200 dark:border-fleet-copper/35">
            VeloceTech • 17 BOPs
          </span>
          <span className="text-xs text-light-charcoalText dark:text-fleet-bronze font-medium">
            Gestão Integrada de Frotas &amp; Operações de Campo
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'topbar') {
    return (
      <div className="lg:hidden flex items-center shrink-0">
        <SGFrotasLogoImage className="h-7 sm:h-8 w-auto shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <SGFrotasLogoImage className="w-full max-w-[250px] h-auto -translate-x-[5%]" />
    </div>
  );
};

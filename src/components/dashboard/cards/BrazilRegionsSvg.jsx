import React from 'react';

export const REGION_META = {
  NORTE: {
    codigo: 'NORTE',
    label: 'Norte',
    short: 'N',
    color: 'var(--region-norte)',
    hoverColor: 'var(--region-norte-hover)',
    siglasUfs: ['AM', 'PA', 'RO', 'TO', 'AC', 'RR', 'AP'],
    centroid: { x: 162, y: 113 },
    path: 'M 146.6 15.5 L 152.4 16.0 L 151.9 20.8 L 155.1 24.5 L 155.1 27.7 L 151.9 37.8 L 163.0 52.6 L 183.2 47.3 L 194.3 47.3 L 193.8 43.1 L 203.9 40.9 L 213.5 43.1 L 229.9 42.0 L 238.9 26.1 L 241.6 25.6 L 248.5 45.2 L 255.9 49.4 L 255.9 51.6 L 250.6 58.5 L 252.2 67.0 L 269.2 70.1 L 269.2 72.3 L 261.8 83.9 L 266.5 83.9 L 278.2 74.9 L 296.3 78.6 L 296.3 81.3 L 283.0 108.9 L 272.9 116.3 L 281.4 121.6 L 278.7 139.1 L 284.6 146.6 L 290.4 146.6 L 284.6 158.2 L 295.7 171.5 L 295.7 174.2 L 289.4 181.6 L 292.0 197.0 L 269.2 201.2 L 262.8 194.9 L 257.0 197.5 L 254.9 197.5 L 252.7 193.3 L 248.5 194.9 L 247.4 175.8 L 251.1 164.1 L 188.0 160.9 L 177.4 152.9 L 173.6 141.8 L 172.0 143.4 L 168.3 155.1 L 138.1 155.6 L 139.1 177.4 L 154.5 177.9 L 154.0 185.3 L 155.6 191.2 L 148.2 203.4 L 111.0 192.2 L 102.0 181.6 L 101.5 166.2 L 85.5 169.4 L 70.7 179.5 L 49.4 180.5 L 48.9 164.6 L 31.9 170.5 L 14.9 149.8 L 15.5 142.9 L 22.4 137.5 L 22.4 130.6 L 29.3 118.4 L 49.4 113.7 L 52.1 111.5 L 59.5 80.2 L 52.6 71.7 L 51.6 64.3 L 61.6 61.1 L 60.6 56.9 L 53.7 56.9 L 54.2 51.0 L 71.2 51.0 L 78.1 49.4 L 80.8 59.0 L 97.7 59.0 L 119.5 43.1 L 116.3 39.4 L 111.5 38.8 L 107.3 26.6 L 122.2 28.2 Z',
  },
  NORDESTE: {
    codigo: 'NORDESTE',
    label: 'Nordeste',
    short: 'NE',
    color: 'var(--region-nordeste)',
    hoverColor: 'var(--region-nordeste-hover)',
    siglasUfs: ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'],
    centroid: { x: 337, y: 156 },
    path: 'M 296.3 80.2 L 299.4 80.2 L 310.6 88.2 L 310.1 99.9 L 322.8 93.5 L 326.5 93.5 L 344.0 99.9 L 358.4 98.3 L 382.8 119.5 L 401.3 124.3 L 402.4 125.9 L 405.1 135.4 L 405.1 151.9 L 402.9 162.5 L 382.2 181.1 L 370.0 200.2 L 367.9 200.2 L 365.3 197.5 L 359.9 207.6 L 359.9 235.2 L 357.8 243.7 L 356.2 251.7 L 353.0 254.9 L 350.4 254.9 L 347.2 252.2 L 344.6 243.7 L 353.0 232.6 L 352.0 231.5 L 338.7 227.8 L 321.7 216.1 L 315.9 218.2 L 310.1 212.4 L 296.8 218.8 L 292.5 218.8 L 292.5 195.9 L 289.4 180.5 L 295.7 172.0 L 284.6 158.8 L 285.1 155.6 L 290.9 147.1 L 284.0 146.6 L 278.7 139.7 L 281.9 122.7 L 274.0 117.9 L 274.0 115.3 L 283.5 107.3 Z',
  },
  CENTRO_OESTE: {
    codigo: 'CENTRO_OESTE',
    label: 'Centro-Oeste',
    short: 'CO',
    color: 'var(--region-centro-oeste)',
    hoverColor: 'var(--region-centro-oeste-hover)',
    siglasUfs: ['DF', 'GO', 'MT', 'MS'],
    centroid: { x: 212, y: 220 },
    path: 'M 172.0 142.9 L 174.2 142.9 L 177.4 152.4 L 188.5 160.9 L 251.1 164.1 L 247.4 176.3 L 249.0 195.4 L 253.8 193.8 L 255.4 197.5 L 263.9 195.4 L 270.2 201.2 L 292.5 197.0 L 292.5 218.2 L 285.6 217.7 L 285.1 226.7 L 279.3 231.0 L 279.3 248.0 L 278.2 249.5 L 274.5 253.3 L 252.7 255.4 L 244.2 263.9 L 243.2 271.3 L 229.9 285.1 L 214.5 302.6 L 213.5 309.0 L 201.2 305.8 L 195.9 290.9 L 177.9 288.8 L 175.8 265.5 L 180.0 246.4 L 172.0 240.5 L 171.5 229.4 L 153.5 229.4 L 152.4 209.2 L 148.2 204.4 L 148.2 202.3 L 155.6 190.6 L 154.0 185.8 L 154.5 178.4 L 139.1 177.9 L 138.6 155.1 L 167.8 155.1 Z',
  },
  SUDESTE: {
    codigo: 'SUDESTE',
    label: 'Sudeste',
    short: 'SE',
    color: 'var(--region-sudeste)',
    hoverColor: 'var(--region-sudeste-hover)',
    siglasUfs: ['SP', 'RJ', 'MG', 'ES'],
    centroid: { x: 296, y: 267 },
    path: 'M 308.5 212.4 L 310.6 212.4 L 317.0 218.2 L 323.3 216.6 L 339.2 227.8 L 352.5 231.5 L 352.0 234.7 L 344.0 244.8 L 347.2 251.7 L 351.5 255.4 L 349.3 269.2 L 337.1 284.6 L 335.5 293.1 L 327.6 296.8 L 324.9 300.5 L 302.1 299.4 L 299.4 303.7 L 282.5 311.1 L 270.8 319.6 L 267.6 320.1 L 257.5 314.8 L 252.2 297.8 L 225.7 293.6 L 224.6 290.9 L 243.2 270.8 L 244.8 262.3 L 252.2 255.4 L 274.0 253.3 L 277.1 250.1 L 279.3 247.4 L 279.3 230.4 L 285.1 226.2 L 285.1 217.7 L 296.3 218.8 Z',
  },
  SUL: {
    codigo: 'SUL',
    label: 'Sul',
    short: 'S',
    color: 'var(--region-sul)',
    hoverColor: 'var(--region-sul-hover)',
    siglasUfs: ['PR', 'SC', 'RS'],
    centroid: { x: 231, y: 344 },
    path: 'M 223.0 293.1 L 252.7 297.8 L 257.5 314.3 L 267.1 319.6 L 267.1 322.3 L 263.9 324.4 L 262.8 329.2 L 263.3 348.8 L 261.8 355.2 L 251.1 364.2 L 243.2 378.0 L 228.3 392.3 L 224.1 400.8 L 221.4 404.5 L 218.8 404.5 L 218.8 400.8 L 221.4 395.5 L 188.5 370.0 L 185.8 370.0 L 185.8 367.9 L 203.9 347.2 L 217.2 339.8 L 215.6 325.4 L 209.2 324.4 L 209.2 321.2 L 210.8 309.5 L 213.5 308.5 L 214.5 302.1 Z',
  },
};

export const REGION_ORDER = ['NORTE', 'NORDESTE', 'CENTRO_OESTE', 'SUDESTE', 'SUL'];

export const REGIAO_LABEL = {
  NORTE: 'Norte',
  NORDESTE: 'Nordeste',
  CENTRO_OESTE: 'Centro-Oeste',
  SUDESTE: 'Sudeste',
  SUL: 'Sul',
};

const APPROVED_PALETTE = new Set([
  'var(--region-norte)',
  'var(--region-nordeste)',
  'var(--region-centro-oeste)',
  'var(--region-sudeste)',
  'var(--region-sul)',
]);

export const sanitizeRegionColor = (color, fallbackColor) => {
  const normalized = String(color || '').trim();
  return APPROVED_PALETTE.has(normalized) ? normalized : fallbackColor;
};

export const normalizeRegiaoCode = (raw) => {
  const upper = String(raw || '').toUpperCase().trim();
  if (upper.includes('SUDESTE')) return 'SUDESTE';
  if (upper.includes('SUL') && !upper.includes('SUDESTE')) return 'SUL';
  if (upper.includes('NORDESTE')) return 'NORDESTE';
  if (upper.includes('CENTRO') || upper.includes('C-OESTE')) return 'CENTRO_OESTE';
  if (upper.includes('NORTE')) return 'NORTE';
  return upper;
};

const parseCount = (val) => {
  if (typeof val === 'number') return val;
  const match = String(val || '0').replace(/\./g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
};

export const buildBrazilRegions = (regioesMapa = [], donutRegioes = []) => {
  const byCode = {};

  if (Array.isArray(regioesMapa) && regioesMapa.length > 0) {
    regioesMapa.forEach((item) => {
      const code = normalizeRegiaoCode(item.codigo || item.label);
      if (REGION_META[code]) {
        byCode[code] = {
          ...REGION_META[code],
          veiculos: Number(item.veiculos || 0),
          percentage: Number(item.percentage || 0),
          atpsAtivas: Number(item.atpsAtivas || 0),
          siglasUfs: item.siglasUfs?.length
            ? item.siglasUfs
            : REGION_META[code].siglasUfs,
          color: sanitizeRegionColor(item.color, REGION_META[code].color),
        };
      }
    });
  } else if (Array.isArray(donutRegioes) && donutRegioes.length > 0) {
    donutRegioes.forEach((seg) => {
      const code = normalizeRegiaoCode(seg.label);
      if (REGION_META[code]) {
        byCode[code] = {
          ...REGION_META[code],
          veiculos: parseCount(seg.value),
          percentage: Number(seg.percentage || 0),
          atpsAtivas: 0,
        };
      }
    });
  }

  return REGION_ORDER.map(
    (code) =>
      byCode[code] || {
        ...REGION_META[code],
        veiculos: 0,
        percentage: 0,
        atpsAtivas: 0,
      }
  );
};

export const BrazilRegionsSvg = ({
  regions = [],
  highlightedCode = null,
  dimInactive = false,
  onHoverChange,
  onSelectRegion,
  className = 'w-full max-w-[265px] h-auto select-none overflow-visible',
}) => {
  return (
    <svg
      viewBox="0 0 420 420"
      className={className}
      role="img"
      aria-label="Mapa estilizado do Brasil dividido nas 5 macro-regiões"
    >
      {regions.map((reg) => {
        const isHighlighted = highlightedCode === reg.codigo;
        const isDimmed = dimInactive && highlightedCode && !isHighlighted;

        return (
          <g
            key={reg.codigo}
            tabIndex={0}
            role="button"
            aria-pressed={isHighlighted}
            aria-label={`${reg.label}: ${reg.veiculos} veículos (${reg.percentage.toFixed(1)}%), ${reg.atpsAtivas} ATPs`}
            onMouseEnter={() => onHoverChange?.(reg.codigo)}
            onMouseLeave={() => onHoverChange?.(null)}
            onFocus={() => onHoverChange?.(reg.codigo)}
            onBlur={() => onHoverChange?.(null)}
            onClick={() => onSelectRegion?.(reg.codigo)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRegion?.(reg.codigo);
              }
            }}
            className="cursor-pointer focus:outline-none group/reg"
          >
            <path
              d={reg.path}
              fill={isHighlighted ? (reg.hoverColor || reg.color) : reg.color}
              fillOpacity={isDimmed ? 0.78 : 1}
              stroke="currentColor"
              strokeWidth={isHighlighted ? '3.0' : '2.4'}
              strokeLinejoin="round"
              className="text-app-surface dark:text-app-darkSurface motion-safe:transition-all motion-safe:duration-200 group-focus-visible/reg:stroke-light-orange dark:group-focus-visible/reg:stroke-fleet-bronze"
              style={
                isHighlighted
                  ? {
                      filter: 'drop-shadow(0 4px 10px var(--map-highlight-glow))',
                    }
                  : undefined
              }
            />
          </g>
        );
      })}
    </svg>
  );
};

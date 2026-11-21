/**
 * Regras de normalização de modelos e propriedades de veículos para exibição concisa na UI.
 */

const CANONICAL_MODELS = [
  { pattern: /\bKWID\b/i, label: 'Renault Kwid' },
  { pattern: /\bHB20\b/i, label: 'Hyundai HB20' },
  { pattern: /\bMOBI\b/i, label: 'Fiat Mobi' },
  { pattern: /\bPOLO\b/i, label: 'VW Polo' },
  { pattern: /\bONIX\b/i, label: 'Chevrolet Onix' },
  { pattern: /\bVOYAGE\b/i, label: 'VW Voyage' },
  { pattern: /\bC3\b/i, label: 'Citroën C3' },
  { pattern: /\bCRONOS\b/i, label: 'Fiat Cronos' },
  { pattern: /\b208\b/i, label: 'Peugeot 208' },
  { pattern: /\bFIORINO\b/i, label: 'Fiat Fiorino' },
  { pattern: /\bSTRADA\b/i, label: 'Fiat Strada' },
];

const NOISE_TOKENS_REGEX = /\b(1\.[0-9]|2\.[0-9]|2P|4P|5P|MT|AT|MPI|RGD\/R7A|RGH|ZEN|LIKE|COMFORT|SENSE|PLUS|TREKKING|TRACK|LIVE|PACK|ENDURANCE|EVO|HATCHBACK|25\/26|202[0-9])\b/gi;

function toTitleCase(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Converte descrições verbosas (ex: "RENAULT KWID HATCHBACK 1.0 Zen 25/26 2026 5P")
 * no formato limpo "Renault Kwid 2026".
 */
export function formatVehicleShortName(modelo, ano) {
  const rawModel = String(modelo || '').trim();
  const anoStr = ano ? String(ano).trim() : '';

  if (!rawModel) {
    return anoStr ? `Veículo ${anoStr}` : 'Veículo não informado';
  }

  const matched = CANONICAL_MODELS.find((entry) => entry.pattern.test(rawModel));
  let baseName;

  if (matched) {
    baseName = matched.label;
  } else {
    const cleaned = rawModel.replace(NOISE_TOKENS_REGEX, ' ').replace(/\s+/g, ' ').trim();
    baseName = toTitleCase(cleaned || rawModel);
  }

  return anoStr && !baseName.endsWith(anoStr) ? `${baseName} ${anoStr}` : baseName;
}

/**
 * Formata o rótulo da propriedade do veículo ("Arval", "Próprio", etc.).
 */
export function formatPropriedadeLabel(propriedade) {
  const raw = String(propriedade || '').trim();
  if (!raw) return 'Próprio';
  const upper = raw.toUpperCase();
  if (upper.includes('ARVAL')) return 'Arval';
  if (upper.includes('PROPRIO') || upper.includes('PRÓPRIO')) return 'Próprio';
  return toTitleCase(raw);
}


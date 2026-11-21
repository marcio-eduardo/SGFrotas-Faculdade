import plugin from 'tailwindcss/plugin';

/**
 * Converte uma cor #RGB/#RRGGBB da paleta em rgba(r, g, b, alpha) automaticamente.
 * Assim, basta editar o hex uma única vez no topo deste arquivo.
 */
const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * ============================================================================
 *  FONTE ÚNICA DA VERDADE (SINGLE SOURCE OF TRUTH) — DESIGN SYSTEM SGFROTAS
 * ============================================================================
 *  REGRA DO PROJETO:
 *  Nenhuma cor (#hex, rgb, rgba, hsl) ou estilização CSS crua deve existir
 *  fora deste arquivo. O script `scripts/check-design-tokens.mjs` (executado
 *  automaticamente no `prebuild`) bloqueia o build caso encontre cores soltas
 *  em `src/`.
 *
 *  ONDE MEXER RÁPIDO:
 *  - Quer mudar o FUNDO (cor, textura, opacidade)? Edite o BLOCO [FUNDO] logo abaixo!
 *  - Quer mudar cores dos cards, bordas ou acentos? Edite a SEÇÃO 1 (FLEET_PALETTE).
 *  - Quer mudar cores do mapa, bombas ou alertas? Edite a SEÇÃO 2.
 *  - Quer alterar fontes, sombras ou utilitários Tailwind? Edite a SEÇÃO 3.
 *  - Quer ajustar variáveis CSS por tema (Light/Dark)? Edite a SEÇÃO 4.
 *  - Quer modificar superfícies de cards, menu ou faixas KPI? Edite a SEÇÃO 5.
 * ============================================================================
 */

/* -------------------------------------------------------------------------- *
 * [SEÇÃO 1A] PALETA INTERNATIONAL ORANGE (MODO CLARO)
 * Centraliza superfícies Pure White/Alabaster, bordas Platinum e acento #F15025.
 * -------------------------------------------------------------------------- */
const LIGHT_PALETTE = {
  orange: '#F15025',       // International Orange — acento primário, botões/pílulas, foco, marca
  orangeHover: '#D94017',  // Hover de botões/pílulas primárias
  orangeText: '#C83B14',   // Variante WCAG AA (>= 4.5:1) para texto pequeno sobre #FFFFFF/#E6E8E6
  white: '#FFFFFF',        // Pure White — superfície primária (cards, modais, Topbar, Sidebar, inputs)
  alabaster: '#E6E8E6',    // Alabaster — fundo base --bg e superfícies secundárias/muted
  platinum: '#CED0CE',     // Platinum — bordas, divisores, frestas, scrollbar e trilhos
  jet: '#191919',          // Jet Black — tipografia principal e alto contraste
  charcoalText: '#4A4A4A', // Texto secundário legível sobre Pure White / Alabaster
  mutedText: '#5C5E5C',    // Texto terciário / metadados sutis (contraste >= 5.1:1 em branco e #E6E8E6)
};

/* -------------------------------------------------------------------------- *
 * [FUNDO] CONFIGURAÇÃO DO FUNDO DA APLICAÇÃO (PLEXUS, GLOBO, TEXTURA & COR)
 * Edite aqui para alternar entre animações de fundo, textura ou cor sólida.
 * -------------------------------------------------------------------------- */
const FUNDO_DA_APLICACAO = {
  // Opções: 'plexus' (002.mp4) | 'globo' (001.mp4) | 'textura' | 'plexus+textura' | 'globo+textura' | 'solido'
  modoFundo: 'plexus',
  corEscura: '#0a0a0aff',  // Cor sólida de fundo no Modo Escuro (e por trás da textura/animação)
  corClara: LIGHT_PALETTE.alabaster, // Cor sólida de fundo no Modo Claro (#E6E8E6 Alabaster)
  plexusVelocidade: 0.90,       // Velocidade de deriva da constelação 3D (002.mp4)
  plexusOpacidadeEscura: 0.92,  // Opacidade do fundo Plexus no Modo Escuro (0 a 1)
  plexusOpacidadeClara: 0.72,   // Opacidade do fundo Plexus no Modo Claro (0 a 1)
  globoVelocidade: 0.0016,      // Velocidade de rotação do globo 3D (001.mp4)
  globoOpacidadeEscura: 0.80,   // Opacidade do globo animado no Modo Escuro (0 a 1)
  globoOpacidadeClara: 0.58,    // Opacidade do globo animado no Modo Claro (0 a 1)
  // Textura hexagonal 3D no Modo Escuro (usada quando modoFundo inclui 'textura'):
  texturaImagem: "url('../assets/textures/stone-hex-bg.jpg')",
  // Textura hexagonal 3D harmônica no Modo Claro (#CED0CE / #E6E8E6 / #FFFFFF):
  texturaImagemClara: "url('../assets/textures/stone-hex-light-bg.jpg')",
  texturaTamanho: '318px 273px', // Ex.: '318px 273px', 'cover', 'contain', 'auto'
  texturaRepeticao: 'repeat',    // 'repeat' | 'no-repeat'
  texturaPosicao: 'center top',  // Posição inicial da textura
  texturaOpacidade: '0.60',         // De '0' a '1'. Ex.: '0.35' mistura a corEscura na textura
  texturaOpacidadeClara: '0.92',    // De '0' a '1' no Modo Claro
  opacidadeDosCards: 0.80,       // Transparência dos cards sobre o fundo (0 a 1)
};

/* -------------------------------------------------------------------------- *
 * [SEÇÃO 1] PALETA AUTOMOTIVA PRINCIPAL (MODO ESCURO)
 * Controla o contraste entre fundo, cards, bordas metálicas e acento cobre.
 * -------------------------------------------------------------------------- */
const FLEET_PALETTE = {
  obsidian: FUNDO_DA_APLICACAO.corEscura, // Sincronizado automaticamente com [FUNDO]
  charcoal: '#090909',   // Superfície primária de cards, modais e painéis
  graphite: '#33353A',   // Superfície secundária, inputs e estados hover
  titanium: '#415057',   // Bordas metálicas sutis e divisores entre blocos
  bronze: '#A47F6F',     // Transição quente e labels/subtítulos secundários
  copper: '#D64218',     // Acento automotivo principal (botões, pílulas ativas)
  copperGlow: '#E07A1F', // Variante alto contraste WCAG AA sobre Charcoal
};

/* -------------------------------------------------------------------------- *
 * [SEÇÃO 2] PALETAS DE DOMÍNIO, ALERTAS & VISUALIZAÇÃO DE DADOS (SVG/GRÁFICOS)
 * Centraliza todas as cores usadas em mapas, medidores, placas e indicadores.
 * -------------------------------------------------------------------------- */

// Cores das 5 macro-regiões do mapa no Modo Escuro (base + hover de mapa02.excalidraw)
const REGION_PALETTE = {
  norte: '#3C381B',          // Olive (base) — Região Norte
  norteHover: '#69613C',     // Olive (hover)
  nordeste: '#B48A62',       // Beige (base) — Região Nordeste
  nordesteHover: '#CCAB8A',  // Beige (hover)
  centroOeste: '#81341A',    // Terracotta (base) — Região Centro-Oeste
  centroOesteHover: '#A54424', // Terracotta (hover)
  sudeste: '#0D1424',        // Navy (base) — Região Sudeste
  sudesteHover: '#20314F',   // Navy (hover)
  sul: '#353535',            // Charcoal (base) — Região Sul
  sulHover: '#555354',       // Charcoal (hover)
};

// Mesma família cromática (Olive/Beige/Terracotta/Navy/Charcoal) calibrada para o Modo Claro (#FFFFFF / #E6E8E6)
const REGION_PALETTE_LIGHT = {
  norte: '#6B653B',          // Olive diurno — harmônico sobre branco
  norteHover: '#55502B',     // Olive (hover — aprofunda com nitidez)
  nordeste: '#C9A47C',       // Beige quente — sem aspecto lavado
  nordesteHover: '#B3895C',  // Beige (hover)
  centroOeste: '#B8532F',    // Terracotta luminoso — conversa com #F15025
  centroOesteHover: '#9B3F1E', // Terracotta (hover)
  sudeste: '#2F4663',        // Slate Navy — legível e limpo no claro
  sudesteHover: '#1E324B',   // Slate Navy (hover)
  sul: '#5E6063',            // Warm Charcoal — harmônico com #191919 e #CED0CE
  sulHover: '#45474A',       // Warm Charcoal (hover)
};

// Paleta das Bombas Digitais (Card Combustível ValeCard — tons foscos sem neon)
const FUEL_PUMP_PALETTE = {
  etanolCanopyStart: '#213D51',
  etanolCanopyEnd: '#315A79',
  etanolLiquidTop: '#4A7394',
  etanolLiquidBottom: '#213D51',
  etanolLcdText: '#A8C5DB',
  gasolinaCanopyStart: '#04332D',
  gasolinaCanopyEnd: '#0F4D44',
  gasolinaLiquidTop: '#266B5E',
  gasolinaLiquidBottom: '#04332D',
  gasolinaLcdText: '#94C4B8',
};

// Paleta oficial de Alertas (Chaves de Revisão + Badges/Pílulas de Status)
const ALERT_PALETTE = {
  emDia: '#04332D',   // Em dia / Regular
  proxima: '#C5630C', // Atenção / Próxima
  vencida: '#4C1507', // Crítico / Vencido
};

// Padrão cromático oficial da Placa Mercosul Brasileira e Bandeira do Brasil
const MERCOSUL_PALETTE = {
  blue: '#003399',        // Faixa superior oficial "BRASIL"
  starArc: '#93C5FD',     // Arco abaixo das estrelas Mercosul
  flagGreen: '#009C3B',   // Verde bandeira nacional
  flagYellow: '#FFDF00',  // Losango amarelo ouro
  flagBlue: '#002776',    // Esfera azul nacional
};

// Acentos de status semânticos, reflexos SVG e elementos neutros
const STATUS_ACCENTS = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dangerRose: '#F43F5E',
  info: '#0ea5e9',
  infoDeep: '#0284C7',
  purple: '#8b5cf6',
  tiIndigo: '#6366f1',
  contrastDarkBg: '#0B1220', // Visor LCD escuro e marcadores numéricos do mapa
  white: '#FFFFFF',
  black: '#000000',
  slateDotsLight: '#e2e8f0',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      /* -------------------------------------------------------------------- *
       * [SEÇÃO 3] UTILITÁRIOS TAILWIND (FONTES, CORES, TEXTURAS E SOMBRAS)
       * -------------------------------------------------------------------- */
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        fleet: FLEET_PALETTE,
        light: LIGHT_PALETTE,
        alert: {
          'em-dia': ALERT_PALETTE.emDia,
          proxima: ALERT_PALETTE.proxima,
          vencida: ALERT_PALETTE.vencida,
        },
        region: {
          norte: REGION_PALETTE.norte,
          'norte-hover': REGION_PALETTE.norteHover,
          nordeste: REGION_PALETTE.nordeste,
          'nordeste-hover': REGION_PALETTE.nordesteHover,
          'centro-oeste': REGION_PALETTE.centroOeste,
          'centro-oeste-hover': REGION_PALETTE.centroOesteHover,
          sudeste: REGION_PALETTE.sudeste,
          'sudeste-hover': REGION_PALETTE.sudesteHover,
          sul: REGION_PALETTE.sul,
          'sul-hover': REGION_PALETTE.sulHover,
        },
        mercosul: {
          blue: MERCOSUL_PALETTE.blue,
          arc: MERCOSUL_PALETTE.starArc,
          'flag-green': MERCOSUL_PALETTE.flagGreen,
          'flag-yellow': MERCOSUL_PALETTE.flagYellow,
          'flag-blue': MERCOSUL_PALETTE.flagBlue,
        },
        brand: {
          50: '#FFF4F0',
          100: '#FFE4DB',
          200: '#FFC5B3',
          300: '#FF9E80',
          400: '#FA734D',
          500: LIGHT_PALETTE.orange,      // #F15025 (International Orange)
          600: LIGHT_PALETTE.orangeHover, // #D94017
          700: LIGHT_PALETTE.orangeText,  // #C83B14 (WCAG AA em texto pequeno sobre claro)
          800: '#9E2D0F',
          900: '#78220B',
        },
        sidebar: {
          bg: '#0f172a',
          darkBg: FLEET_PALETTE.obsidian,
          border: hexToRgba(FLEET_PALETTE.titanium, 0.35),
          text: '#cbd5e1',
          muted: FLEET_PALETTE.bronze,
          activeBg: hexToRgba(FLEET_PALETTE.copper, 0.16),
          activeText: FLEET_PALETTE.copperGlow,
        },
        app: {
          bg: FUNDO_DA_APLICACAO.corClara,
          surface: LIGHT_PALETTE.white,
          surface2: LIGHT_PALETTE.alabaster,
          surface3: LIGHT_PALETTE.platinum,
          darkBg: FUNDO_DA_APLICACAO.corEscura,
          darkSurface: FLEET_PALETTE.charcoal,
          darkSurface2: FLEET_PALETTE.graphite,
          darkSurface3: FLEET_PALETTE.titanium,
        },
      },
      backgroundImage: {
        // Textura configurada no bloco [FUNDO] no topo deste arquivo
        'fleet-stone-hex': FUNDO_DA_APLICACAO.texturaImagem,
        'fleet-stone-hex-light': FUNDO_DA_APLICACAO.texturaImagemClara,
        // Grade pontilhada sutil da tela de Login no Modo Claro
        'login-dots-light': `radial-gradient(${STATUS_ACCENTS.slateDotsLight} 1px, transparent 1px)`,
        // Brilho decorativo superior direito do cabeçalho do Painel TI
        'ti-panel-glow': `radial-gradient(ellipse at top right, ${STATUS_ACCENTS.tiIndigo} 0%, transparent 70%)`,
      },
      backgroundSize: {
        'stone-hex-tile': FUNDO_DA_APLICACAO.texturaTamanho,
        'dots-16': '16px 16px',
      },
      boxShadow: {
        'card': '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        'card-dark': '0 6px 24px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.04)',
        'glow': '0 4px 14px rgba(0,0,0,0.22)',
        'glow-copper': '0 4px 14px rgba(0,0,0,0.35)',
        'plate-flag': '0 0 1px rgba(0,0,0,0.5)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.25s ease-out forwards',
      },
    },
  },
  plugins: [
    plugin(({ addBase, addComponents, theme }) => {
      /* -------------------------------------------------------------------- *
       * [SEÇÃO 4] VARIÁVEIS CSS GLOBAIS (:root LIGHT / DARK) + SCROLLBARS
       * Utilizadas via var(--nome) em SVGs, inline styles e fallback charts.
       * -------------------------------------------------------------------- */
      const sharedDomainVars = {
        // Marcadores de mapa
        '--map-marker-bg': STATUS_ACCENTS.contrastDarkBg,
        '--map-marker-stroke': STATUS_ACCENTS.white,

        // Alertas e Séries Fallback dos Gráficos Donut
        '--alert-em-dia': ALERT_PALETTE.emDia,
        '--alert-proxima': ALERT_PALETTE.proxima,
        '--alert-vencida': ALERT_PALETTE.vencida,
        '--fuel-gasolina': FUEL_PUMP_PALETTE.gasolinaLiquidTop,
        '--fuel-etanol': FUEL_PUMP_PALETTE.etanolCanopyEnd,
        '--fuel-diesel': ALERT_PALETTE.proxima,

        // Bombas de Combustível ValeCard (SVG)
        '--pump-lcd-bg': STATUS_ACCENTS.contrastDarkBg,
        '--pump-etanol-canopy-start': FUEL_PUMP_PALETTE.etanolCanopyStart,
        '--pump-etanol-canopy-end': FUEL_PUMP_PALETTE.etanolCanopyEnd,
        '--pump-etanol-liquid-top': FUEL_PUMP_PALETTE.etanolLiquidTop,
        '--pump-etanol-liquid-bottom': FUEL_PUMP_PALETTE.etanolLiquidBottom,
        '--pump-etanol-lcd-text': FUEL_PUMP_PALETTE.etanolLcdText,
        '--pump-gasolina-canopy-start': FUEL_PUMP_PALETTE.gasolinaCanopyStart,
        '--pump-gasolina-canopy-end': FUEL_PUMP_PALETTE.gasolinaCanopyEnd,
        '--pump-gasolina-liquid-top': FUEL_PUMP_PALETTE.gasolinaLiquidTop,
        '--pump-gasolina-liquid-bottom': FUEL_PUMP_PALETTE.gasolinaLiquidBottom,
        '--pump-gasolina-lcd-text': FUEL_PUMP_PALETTE.gasolinaLcdText,

        // Chaves de Revisão Anual (SVG flat sem contorno/efeito metálico)
        '--wrench-emdia-fill': ALERT_PALETTE.emDia,
        '--wrench-proxima-fill': ALERT_PALETTE.proxima,
        '--wrench-vencida-fill': ALERT_PALETTE.vencida,

        // Reflexos especulares genéricos (SVG)
        '--sheen-white': STATUS_ACCENTS.white,
        '--sheen-black': STATUS_ACCENTS.black,

        // Placa Mercosul & Bandeira Nacional (SVG)
        '--mercosul-star': STATUS_ACCENTS.white,
        '--mercosul-arc': MERCOSUL_PALETTE.starArc,
        '--mercosul-flag-green': MERCOSUL_PALETTE.flagGreen,
        '--mercosul-flag-yellow': MERCOSUL_PALETTE.flagYellow,
        '--mercosul-flag-blue': MERCOSUL_PALETTE.flagBlue,
      };

      addBase({
        ':root[data-theme="light"], :root:not([data-theme="dark"])': {
          ...sharedDomainVars,
          '--region-norte': REGION_PALETTE_LIGHT.norte,
          '--region-norte-hover': REGION_PALETTE_LIGHT.norteHover,
          '--region-nordeste': REGION_PALETTE_LIGHT.nordeste,
          '--region-nordeste-hover': REGION_PALETTE_LIGHT.nordesteHover,
          '--region-centro-oeste': REGION_PALETTE_LIGHT.centroOeste,
          '--region-centro-oeste-hover': REGION_PALETTE_LIGHT.centroOesteHover,
          '--region-sudeste': REGION_PALETTE_LIGHT.sudeste,
          '--region-sudeste-hover': REGION_PALETTE_LIGHT.sudesteHover,
          '--region-sul': REGION_PALETTE_LIGHT.sul,
          '--region-sul-hover': REGION_PALETTE_LIGHT.sulHover,
          '--map-highlight-glow': hexToRgba(LIGHT_PALETTE.jet, 0.14),
          '--bg': theme('colors.app.bg'),
          '--surface': theme('colors.app.surface'),
          '--surface2': theme('colors.app.surface2'),
          '--surface3': theme('colors.app.surface3'),
          '--border': LIGHT_PALETTE.platinum,
          '--border2': hexToRgba(LIGHT_PALETTE.jet, 0.16),
          '--accent': LIGHT_PALETTE.orangeText,
          '--accent2': LIGHT_PALETTE.orange,
          '--accent-glow': hexToRgba(LIGHT_PALETTE.orange, 0.14),
          '--success': STATUS_ACCENTS.success,
          '--warning': STATUS_ACCENTS.warning,
          '--danger': STATUS_ACCENTS.danger,
          '--text': LIGHT_PALETTE.jet,
          '--text2': LIGHT_PALETTE.charcoalText,
          '--text3': LIGHT_PALETTE.mutedText,
          '--shadow': theme('boxShadow.card'),
          '--sidebar-bg': LIGHT_PALETTE.white,
          '--sidebar-text': LIGHT_PALETTE.jet,
          '--sidebar-text2': LIGHT_PALETTE.charcoalText,
          '--sidebar-active': hexToRgba(LIGHT_PALETTE.orange, 0.12),
          '--sidebar-active-text': LIGHT_PALETTE.orangeText,
          '--sidebar-border': LIGHT_PALETTE.platinum,
          '--scrollbar-thumb': LIGHT_PALETTE.platinum,
          '--scrollbar-thumb-hover': LIGHT_PALETTE.mutedText,
          '--globe-mode': FUNDO_DA_APLICACAO.modoFundo,
          '--backdrop-mode': FUNDO_DA_APLICACAO.modoFundo,
          '--globe-speed': String(FUNDO_DA_APLICACAO.globoVelocidade),
          '--globe-opacity': String(FUNDO_DA_APLICACAO.globoOpacidadeClara),
          '--globe-dot': hexToRgba(LIGHT_PALETTE.jet, 0.34),
          '--globe-dot-land': hexToRgba(LIGHT_PALETTE.jet, 0.72),
          '--globe-dot-accent': hexToRgba(LIGHT_PALETTE.orange, 0.82),
          '--globe-line': hexToRgba(LIGHT_PALETTE.charcoalText, 0.16),
          '--globe-rim': hexToRgba(LIGHT_PALETTE.platinum, 0.65),
          '--globe-bokeh': hexToRgba(LIGHT_PALETTE.orange, 0.25),
          '--plexus-speed': String(FUNDO_DA_APLICACAO.plexusVelocidade),
          '--plexus-opacity': String(FUNDO_DA_APLICACAO.plexusOpacidadeClara),
          '--plexus-node': hexToRgba(LIGHT_PALETTE.jet, 0.82),
          '--plexus-node-accent': hexToRgba(LIGHT_PALETTE.orange, 0.95),
          '--plexus-line': hexToRgba(LIGHT_PALETTE.charcoalText, 0.42),
          '--plexus-facet': hexToRgba(LIGHT_PALETTE.platinum, 0.48),
          '--plexus-nebula-a': hexToRgba(LIGHT_PALETTE.platinum, 0.55),
          '--plexus-nebula-b': hexToRgba(LIGHT_PALETTE.orange, 0.14),
          '--kwid-stroke-top': LIGHT_PALETTE.orange,
          '--kwid-stroke-bottom': LIGHT_PALETTE.jet,
          '--kwid-streak': LIGHT_PALETTE.orange,
        },
        ':root[data-theme="dark"], :root.dark': {
          ...sharedDomainVars,
          '--region-norte': REGION_PALETTE.norte,
          '--region-norte-hover': REGION_PALETTE.norteHover,
          '--region-nordeste': REGION_PALETTE.nordeste,
          '--region-nordeste-hover': REGION_PALETTE.nordesteHover,
          '--region-centro-oeste': REGION_PALETTE.centroOeste,
          '--region-centro-oeste-hover': REGION_PALETTE.centroOesteHover,
          '--region-sudeste': REGION_PALETTE.sudeste,
          '--region-sudeste-hover': REGION_PALETTE.sudesteHover,
          '--region-sul': REGION_PALETTE.sul,
          '--region-sul-hover': REGION_PALETTE.sulHover,
          '--map-highlight-glow': hexToRgba(REGION_PALETTE.centroOesteHover, 0.22),
          '--bg': theme('colors.fleet.obsidian'),
          '--surface': theme('colors.fleet.charcoal'),
          '--surface2': theme('colors.fleet.graphite'),
          '--surface3': theme('colors.fleet.titanium'),
          '--border': hexToRgba(FLEET_PALETTE.titanium, 0.42),
          '--border2': hexToRgba(FLEET_PALETTE.bronze, 0.28),
          '--accent': theme('colors.fleet.copper'),
          '--accent2': theme('colors.fleet.copperGlow'),
          '--accent-glow': hexToRgba(FLEET_PALETTE.copper, 0.22),
          '--success': STATUS_ACCENTS.success,
          '--warning': STATUS_ACCENTS.warning,
          '--danger': STATUS_ACCENTS.danger,
          '--text': '#f1f5f9',
          '--text2': '#cbd5e1',
          '--text3': theme('colors.fleet.bronze'),
          '--shadow': theme('boxShadow.card-dark'),
          '--sidebar-bg': theme('colors.fleet.obsidian'),
          '--sidebar-text': '#cbd5e1',
          '--sidebar-text2': theme('colors.fleet.bronze'),
          '--sidebar-active': hexToRgba(FLEET_PALETTE.copper, 0.16),
          '--sidebar-active-text': theme('colors.fleet.copperGlow'),
          '--sidebar-border': hexToRgba(FLEET_PALETTE.titanium, 0.35),
          '--scrollbar-thumb': 'rgba(148, 163, 184, 0.28)',
          '--scrollbar-thumb-hover': 'rgba(148, 163, 184, 0.5)',
          '--globe-mode': FUNDO_DA_APLICACAO.modoFundo,
          '--backdrop-mode': FUNDO_DA_APLICACAO.modoFundo,
          '--globe-speed': String(FUNDO_DA_APLICACAO.globoVelocidade),
          '--globe-opacity': String(FUNDO_DA_APLICACAO.globoOpacidadeEscura),
          '--globe-dot': hexToRgba(FLEET_PALETTE.titanium, 0.55),
          '--globe-dot-land': hexToRgba(FLEET_PALETTE.bronze, 0.88),
          '--globe-dot-accent': hexToRgba(FLEET_PALETTE.copperGlow, 0.85),
          '--globe-line': 'rgba(203, 213, 225, 0.15)',
          '--globe-rim': hexToRgba(FLEET_PALETTE.titanium, 0.38),
          '--globe-bokeh': hexToRgba(FLEET_PALETTE.copper, 0.30),
          '--plexus-speed': String(FUNDO_DA_APLICACAO.plexusVelocidade),
          '--plexus-opacity': String(FUNDO_DA_APLICACAO.plexusOpacidadeEscura),
          '--plexus-node': 'rgba(226, 232, 240, 0.92)',
          '--plexus-node-accent': hexToRgba(FLEET_PALETTE.copperGlow, 0.98),
          '--plexus-line': 'rgba(203, 213, 225, 0.44)',
          '--plexus-facet': hexToRgba(REGION_PALETTE.norteHover, 0.28),
          '--plexus-nebula-a': hexToRgba(REGION_PALETTE.norteHover, 0.36),
          '--plexus-nebula-b': hexToRgba(FLEET_PALETTE.copper, 0.22),
          '--kwid-stroke-top': FLEET_PALETTE.copperGlow,
          '--kwid-stroke-bottom': FLEET_PALETTE.bronze,
          '--kwid-streak': FLEET_PALETTE.copper,
        },

        // Estilização global padronizada de Scrollbars
        '::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: 'var(--scrollbar-thumb)',
          borderRadius: '3px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'var(--scrollbar-thumb-hover)',
        },
      });

      /* -------------------------------------------------------------------- *
       * [SEÇÃO 5] COMPONENTES SEMÂNTICOS REUTILIZÁVEIS (.fleet-* e .kpi-stripe-*)
       * Centraliza fundo, elevação, estados de navegação e filetes de cards.
       * -------------------------------------------------------------------- */
      const useHexTexture = String(FUNDO_DA_APLICACAO.modoFundo || '').includes('textura');

      addComponents({
        // Camada de fundo unificada (Light: Alabaster | Dark: Obsidian; textura condicional por modoFundo)
        '.fleet-backdrop-layer': {
          display: 'block',
          position: 'fixed',
          inset: '0',
          pointerEvents: 'none',
          zIndex: '0',
          backgroundColor: FUNDO_DA_APLICACAO.corClara,
        },
        '.fleet-backdrop-layer::before': {
          content: "''",
          position: 'absolute',
          inset: '0',
          backgroundImage: useHexTexture ? FUNDO_DA_APLICACAO.texturaImagemClara : 'none',
          backgroundRepeat: FUNDO_DA_APLICACAO.texturaRepeticao,
          backgroundPosition: FUNDO_DA_APLICACAO.texturaPosicao,
          backgroundSize: FUNDO_DA_APLICACAO.texturaTamanho,
          opacity: useHexTexture ? FUNDO_DA_APLICACAO.texturaOpacidadeClara : '0',
        },
        ':is(.dark, [data-theme="dark"]) .fleet-backdrop-layer': {
          display: 'block',
          backgroundColor: FUNDO_DA_APLICACAO.corEscura,
        },
        ':is(.dark, [data-theme="dark"]) .fleet-backdrop-layer::before': {
          backgroundImage: useHexTexture ? FUNDO_DA_APLICACAO.texturaImagem : 'none',
          opacity: useHexTexture ? FUNDO_DA_APLICACAO.texturaOpacidade : '0',
        },

        // Superfície padrão de Cards (Light: Pure White + Platinum | Dark: Charcoal + opacidadeDosCards)
        '.fleet-card-surface': {
          backgroundColor: hexToRgba(LIGHT_PALETTE.white, 0.95),
          borderWidth: '1px',
          borderColor: LIGHT_PALETTE.platinum,
          boxShadow: theme('boxShadow.card'),
        },
        ':is(.dark, [data-theme="dark"]) .fleet-card-surface': {
          backgroundColor: hexToRgba(FLEET_PALETTE.charcoal, FUNDO_DA_APLICACAO.opacidadeDosCards),
          borderColor: hexToRgba(FLEET_PALETTE.titanium, 0.48),
          boxShadow: theme('boxShadow.card-dark'),
          backdropFilter: 'blur(10px)',
        },

        // Superfície elevada para Modais, Popovers e Painéis sobrepostos
        '.fleet-surface-elevated': {
          backgroundColor: LIGHT_PALETTE.white,
          borderWidth: '1px',
          borderColor: LIGHT_PALETTE.platinum,
        },
        ':is(.dark, [data-theme="dark"]) .fleet-surface-elevated': {
          backgroundColor: FLEET_PALETTE.charcoal,
          borderColor: hexToRgba(FLEET_PALETTE.titanium, 0.58),
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
        },

        // Superfície interna discreta para sub-blocos, toolbars e tags
        '.fleet-surface-muted': {
          backgroundColor: hexToRgba(LIGHT_PALETTE.alabaster, 0.85),
          borderWidth: '1px',
          borderColor: LIGHT_PALETTE.platinum,
        },
        ':is(.dark, [data-theme="dark"]) .fleet-surface-muted': {
          backgroundColor: hexToRgba(FLEET_PALETTE.graphite, 0.72),
          borderColor: hexToRgba(FLEET_PALETTE.titanium, 0.45),
        },

        // Item ativo de menu na Sidebar
        '.fleet-nav-active': {
          backgroundColor: hexToRgba(LIGHT_PALETTE.orange, 0.10),
          color: LIGHT_PALETTE.orangeText,
          fontWeight: '700',
          borderWidth: '1px',
          borderColor: hexToRgba(LIGHT_PALETTE.orange, 0.35),
        },
        ':is(.dark, [data-theme="dark"]) .fleet-nav-active': {
          backgroundColor: hexToRgba(FLEET_PALETTE.copper, 0.16),
          color: theme('colors.fleet.copperGlow'),
          borderColor: hexToRgba(FLEET_PALETTE.copper, 0.38),
        },

        // Item inativo de menu na Sidebar (e hover)
        '.fleet-nav-idle': {
          color: LIGHT_PALETTE.charcoalText,
        },
        '.fleet-nav-idle:hover': {
          backgroundColor: LIGHT_PALETTE.alabaster,
          color: LIGHT_PALETTE.jet,
        },
        ':is(.dark, [data-theme="dark"]) .fleet-nav-idle': {
          color: '#cbd5e1',
        },
        ':is(.dark, [data-theme="dark"]) .fleet-nav-idle:hover': {
          backgroundColor: hexToRgba(FLEET_PALETTE.graphite, 0.72),
          color: STATUS_ACCENTS.white,
        },

        // Pílula de destaque em acento primário
        '.fleet-pill-accent': {
          backgroundColor: LIGHT_PALETTE.orange,
          color: LIGHT_PALETTE.white,
        },
        ':is(.dark, [data-theme="dark"]) .fleet-pill-accent': {
          backgroundColor: theme('colors.fleet.copper'),
          color: STATUS_ACCENTS.white,
        },

        // Pílulas / Badges oficiais de Alerta (Em dia, Atenção/Próxima, Crítico/Vencido)
        '.fleet-alert-em-dia': {
          backgroundColor: ALERT_PALETTE.emDia,
          color: STATUS_ACCENTS.white,
          borderColor: 'rgba(255, 255, 255, 0.14)',
        },
        '.fleet-alert-proxima': {
          backgroundColor: ALERT_PALETTE.proxima,
          color: STATUS_ACCENTS.white,
          borderColor: 'rgba(255, 255, 255, 0.16)',
        },
        '.fleet-alert-vencida': {
          backgroundColor: ALERT_PALETTE.vencida,
          color: STATUS_ACCENTS.white,
          borderColor: 'rgba(255, 255, 255, 0.14)',
        },

        // Filetes superiores sutis dos cards de KPI (sem efeito neon)
        '.kpi-stripe-blue::before, .kpi-stripe-green::before, .kpi-stripe-amber::before, .kpi-stripe-red::before, .kpi-stripe-purple::before': {
          content: "''",
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '2px',
          opacity: '0.65',
        },
        '.kpi-stripe-blue::before': {
          background: `linear-gradient(90deg, ${hexToRgba(REGION_PALETTE.norteHover, 0.85)}, transparent)`,
        },
        '.kpi-stripe-green::before': {
          background: `linear-gradient(90deg, ${ALERT_PALETTE.emDia}, transparent)`,
        },
        '.kpi-stripe-amber::before': {
          background: `linear-gradient(90deg, ${hexToRgba(ALERT_PALETTE.proxima, 0.65)}, transparent)`,
        },
        '.kpi-stripe-red::before': {
          background: `linear-gradient(90deg, ${ALERT_PALETTE.vencida}, transparent)`,
        },
        '.kpi-stripe-purple::before': {
          background: `linear-gradient(90deg, ${hexToRgba(FLEET_PALETTE.titanium, 0.8)}, transparent)`,
        },
      });
    }),
  ],
};

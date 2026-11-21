import React, { useEffect, useState } from 'react';
import { AnimatedGlobeBackdrop } from './AnimatedGlobeBackdrop';
import { AnimatedPlexusBackdrop } from './AnimatedPlexusBackdrop';

const readBackdropMode = () => {
  const mode = getComputedStyle(document.documentElement)
    .getPropertyValue('--backdrop-mode')
    .trim()
    .replace(/^["']|["']$/g, '');
  return mode || 'plexus';
};

/**
 * Seleciona dinamicamente a animação de fundo configurada em `tailwind.config.js`
 * (`FUNDO_DA_APLICACAO.modoFundo`: 'plexus' | 'globo' | 'textura' | 'solido' | ...).
 */
export const AnimatedBackdrop = ({ hasSidebar = true }) => {
  const [mode, setMode] = useState(() =>
    typeof window !== 'undefined' ? readBackdropMode() : 'plexus'
  );

  useEffect(() => {
    setMode(readBackdropMode());
    const observer = new MutationObserver(() => {
      setMode(readBackdropMode());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  if (mode.startsWith('plexus')) {
    return <AnimatedPlexusBackdrop hasSidebar={hasSidebar} />;
  }

  if (mode.startsWith('globo')) {
    return <AnimatedGlobeBackdrop hasSidebar={hasSidebar} />;
  }

  return null;
};

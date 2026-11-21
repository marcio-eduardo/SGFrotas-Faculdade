import React, { useEffect, useRef } from 'react';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TILT_X = 0.28; // Inclinação axial suave (~16°) para destacar Américas/Atlântico

/**
 * Máscara geográfica simplificada para realçar massas continentais em pontos,
 * preservando visual orgânico sem depender de arquivos GeoJSON externos.
 */
const isContinentCoord = (latDeg, lonDeg) => {
  const wave =
    Math.sin(latDeg * 0.23 + lonDeg * 0.17) * 3.8 +
    Math.cos(latDeg * 0.41 - lonDeg * 0.29) * 2.1;
  const lat = latDeg + wave * 0.55;
  const lon = lonDeg + wave * 0.7;

  // América do Sul (taper ao sul + costa brasileira destacada)
  if (lat >= -54 && lat <= 12 && lon >= -81 && lon <= -34) {
    const t = (12 - lat) / 66;
    const minLon = -80 + t * 14;
    const maxLon = lat > -22 ? -34 : -34 - (t - 0.52) * 58;
    if (lon >= minLon && lon <= maxLon) return true;
  }

  // América do Norte & Central
  if (lat >= 12 && lat <= 70 && lon >= -164 && lon <= -54) {
    if (lat < 24 && lon >= -105 && lon <= -82) return true;
    if (lat >= 24 && lat <= 56 && lon >= -130 && lon <= -62) return true;
    if (lat > 56 && lon >= -162 && lon <= -66) return true;
  }

  // África
  if (lat >= -35 && lat <= 36 && lon >= -18 && lon <= 50) {
    if (lat >= 4 && lon >= -17 && lon <= 48) return true;
    if (lat < 4 && lon >= 10 && lon <= 42) return true;
  }

  // Europa
  if (lat >= 36 && lat <= 69 && lon >= -10 && lon <= 44) {
    return true;
  }

  // Ásia
  if (lat >= 8 && lat <= 72 && lon >= 44 && lon <= 146) {
    if (lat >= 22 || (lon >= 68 && lon <= 122)) return true;
  }

  // Oceania
  if (lat >= -40 && lat <= -11 && lon >= 113 && lon <= 154) {
    return true;
  }

  return false;
};

/**
 * Gera a nuvem esférica (pontos continentais + malha plexus + bokeh) uma única vez.
 */
const buildGlobeGeometry = () => {
  const dots = [];
  const plexusHubs = [];
  const bokeh = [];

  const totalSamples = 1450;
  for (let i = 0; i < totalSamples; i += 1) {
    const y = 1 - (i / (totalSamples - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    const latDeg = Math.asin(y) * (180 / Math.PI);
    const lonDeg = Math.atan2(z, x) * (180 / Math.PI);
    const onLand = isContinentCoord(latDeg, lonDeg);

    if (onLand) {
      const isAccent = i % 9 === 0;
      dots.push({
        x,
        y,
        z,
        kind: isAccent ? 'accent' : 'land',
        size: isAccent ? 2.15 : 1.45,
      });
      if (i % 8 === 0 && plexusHubs.length < 135) {
        plexusHubs.push({ x, y, z });
      }
    } else if (i % 6 === 0) {
      dots.push({
        x,
        y,
        z,
        kind: 'grid',
        size: 0.95,
      });
      if (i % 18 === 0 && plexusHubs.length < 150) {
        plexusHubs.push({ x, y, z });
      }
    }
  }

  // Pré-calcula conexões próximas (arestas plexus) para custo O(1) por frame
  const edges = [];
  const maxDistSq = 0.43 * 0.43;
  for (let i = 0; i < plexusHubs.length; i += 1) {
    let links = 0;
    for (let j = i + 1; j < plexusHubs.length && links < 4; j += 1) {
      const dx = plexusHubs[i].x - plexusHubs[j].x;
      const dy = plexusHubs[i].y - plexusHubs[j].y;
      const dz = plexusHubs[i].z - plexusHubs[j].z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < maxDistSq) {
        edges.push([i, j]);
        links += 1;
      }
    }
  }

  // Partículas bokeh orbitais suaves nas bordas externas (profundidade do vídeo)
  for (let k = 0; k < 44; k += 1) {
    const angle = (k / 44) * Math.PI * 2 + (k % 3) * 0.19;
    const radialScale = 0.92 + (k % 5) * 0.045;
    const yTilt = Math.sin(k * 1.7) * 0.88;
    const ringR = Math.sqrt(Math.max(0.08, 1 - yTilt * yTilt)) * radialScale;
    bokeh.push({
      x: Math.cos(angle) * ringR,
      y: yTilt,
      z: Math.sin(angle) * ringR,
      size: 2.2 + (k % 4) * 1.15,
    });
  }

  return { dots, plexusHubs, edges, bokeh };
};

const readGlobeTokens = () => {
  const styles = getComputedStyle(document.documentElement);
  const readVar = (name) => styles.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
  return {
    mode: readVar('--globe-mode') || 'globo',
    speed: Number.parseFloat(readVar('--globe-speed')) || 0.0016,
    opacity: Number.parseFloat(readVar('--globe-opacity')) || 0.72,
    dot: readVar('--globe-dot'),
    dotLand: readVar('--globe-dot-land'),
    dotAccent: readVar('--globe-dot-accent'),
    line: readVar('--globe-line'),
    rim: readVar('--globe-rim'),
    bokeh: readVar('--globe-bokeh'),
  };
};

export const AnimatedGlobeBackdrop = ({ hasSidebar = true }) => {
  const canvasRef = useRef(null);
  const tokensRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    tokensRef.current = readGlobeTokens();
    const initialTokens = tokensRef.current;
    if (initialTokens.mode !== 'globo' && initialTokens.mode !== 'globo+textura') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return undefined;
    }

    const geometry = buildGlobeGeometry();
    const cosTilt = Math.cos(TILT_X);
    const sinTilt = Math.sin(TILT_X);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = null;
    let angle = -1.05; // Posiciona o Atlântico / Brasil em destaque inicial

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const projectPoint = (p, cosA, sinA, cx, cy, radius) => {
      const rx = p.x * cosA - p.z * sinA;
      const rz = p.x * sinA + p.z * cosA;
      const ry = p.y * cosTilt - rz * sinTilt;
      const fz = p.y * sinTilt + rz * cosTilt;
      const perspective = 2.6 / (2.6 - fz * 0.65);
      return {
        sx: cx + rx * radius * perspective,
        sy: cy + ry * radius * perspective,
        fz,
        scale: perspective,
      };
    };

    const drawFrame = () => {
      const t = tokensRef.current || readGlobeTokens();
      ctx.clearRect(0, 0, width, height);

      const sidebarOffset = hasSidebar && width >= 1024 ? 256 : 0;
      const availableW = width - sidebarOffset;
      const cx = sidebarOffset + availableW * (hasSidebar ? 0.56 : 0.5);
      const cy = height * 0.52;
      const radius = Math.min(availableW, height) * (width >= 1024 ? 0.44 : 0.48);

      ctx.save();
      ctx.globalAlpha = t.opacity;

      // 1. Aura sutil atmosférica na borda do globo
      if (t.rim) {
        const rimGrad = ctx.createRadialGradient(
          cx,
          cy,
          radius * 0.72,
          cx,
          cy,
          radius * 1.08
        );
        rimGrad.addColorStop(0, 'transparent');
        rimGrad.addColorStop(0.74, t.rim);
        rimGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
        ctx.fill();
      }

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // 2. Malha geométrica plexus conectando nós frontais
      if (t.line) {
        const projectedHubs = geometry.plexusHubs.map((h) =>
          projectPoint(h, cosA, sinA, cx, cy, radius)
        );
        ctx.strokeStyle = t.line;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        for (let e = 0; e < geometry.edges.length; e += 1) {
          const [aIdx, bIdx] = geometry.edges[e];
          const pa = projectedHubs[aIdx];
          const pb = projectedHubs[bIdx];
          if (pa.fz > -0.18 && pb.fz > -0.18) {
            ctx.moveTo(pa.sx, pa.sy);
            ctx.lineTo(pb.sx, pb.sy);
          }
        }
        ctx.stroke();
      }

      // 3. Nuvem de pontos esférica + continentes
      for (let i = 0; i < geometry.dots.length; i += 1) {
        const d = geometry.dots[i];
        const pt = projectPoint(d, cosA, sinA, cx, cy, radius);
        if (pt.fz < -0.35) continue;

        const depthFactor = Math.max(0.14, Math.min(1, (pt.fz + 0.35) / 1.35));
        ctx.fillStyle =
          d.kind === 'accent'
            ? t.dotAccent || t.dotLand
            : d.kind === 'land'
              ? t.dotLand || t.dot
              : t.dot;

        if (!ctx.fillStyle) continue;
        ctx.globalAlpha = t.opacity * depthFactor;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, d.size * pt.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Partículas bokeh periféricas (profundidade do vídeo)
      if (t.bokeh) {
        ctx.fillStyle = t.bokeh;
        for (let b = 0; b < geometry.bokeh.length; b += 1) {
          const bk = geometry.bokeh[b];
          const pt = projectPoint(bk, cosA * 0.92, sinA * 0.92, cx, cy, radius * 1.05);
          if (pt.fz < -0.25) continue;
          const rimEmphasis = 1 - Math.min(1, Math.abs(pt.fz) * 0.85);
          ctx.globalAlpha = t.opacity * (0.25 + rimEmphasis * 0.55);
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, bk.size * (0.9 + rimEmphasis * 0.55), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    const tick = () => {
      if (!document.hidden) {
        const speed = (tokensRef.current && tokensRef.current.speed) || 0.0016;
        angle += speed;
        drawFrame();
      }
      rafId = requestAnimationFrame(tick);
    };

    resize();
    drawFrame();

    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    const handleVisibility = () => {
      if (!document.hidden && reducedMotion) {
        drawFrame();
      }
    };

    // Atualiza tokens imediatamente quando data-theme / classe .dark muda no <html>
    const themeObserver = new MutationObserver(() => {
      tokensRef.current = readGlobeTokens();
      drawFrame();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hasSidebar]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

import React, { useEffect, useRef } from 'react';

const readPlexusTokens = () => {
  const styles = getComputedStyle(document.documentElement);
  const readVar = (name) => styles.getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
  return {
    speed: Number.parseFloat(readVar('--plexus-speed')) || 0.45,
    opacity: Number.parseFloat(readVar('--plexus-opacity')) || 0.9,
    node: readVar('--plexus-node'),
    nodeAccent: readVar('--plexus-node-accent'),
    line: readVar('--plexus-line'),
    facet: readVar('--plexus-facet'),
    nebulaA: readVar('--plexus-nebula-a'),
    nebulaB: readVar('--plexus-nebula-b'),
  };
};

/**
 * Gerador pseudo-aleatório determinístico (Mulberry32) para espalhar os vértices
 * uniformemente por toda a tela sem colapsar em diagonais.
 */
const createSeededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Cria a constelação 3D (vértices em toda a viewport, nós brilhantes e nuvens atmosféricas)
 * inspirada em `002.mp4`.
 */
const createPlexusScene = (count) => {
  const rand = createSeededRandom(20261119);
  const nodes = [];

  for (let i = 0; i < count; i += 1) {
    const z = 0.22 + rand() * 0.78;
    const moveAngle = rand() * Math.PI * 2;
    const speedFactor = (0.35 + rand() * 0.75) * (0.55 + z * 0.6);
    const isAccent = i % 5 === 0;
    nodes.push({
      nx: rand(),
      ny: rand(),
      z,
      zPhase: rand() * Math.PI * 2,
      vx: Math.cos(moveAngle) * 0.00055 * speedFactor,
      vy: Math.sin(moveAngle) * 0.00055 * speedFactor,
      phase: rand() * Math.PI * 2,
      isAccent,
      radius: (isAccent ? 2.4 : 1.4) * (0.65 + z * 0.55),
    });
  }

  const nebulae = [
    { nx: 0.16, ny: 0.30, rRatio: 0.30, phase: 0.3, kind: 'a' },
    { nx: 0.84, ny: 0.26, rRatio: 0.28, phase: 1.7, kind: 'a' },
    { nx: 0.22, ny: 0.72, rRatio: 0.30, phase: 3.1, kind: 'b' },
    { nx: 0.82, ny: 0.74, rRatio: 0.28, phase: 4.5, kind: 'b' },
    { nx: 0.52, ny: 0.50, rRatio: 0.34, phase: 5.4, kind: 'a' },
  ];

  return { nodes, nebulae };
};

/**
 * Fundo animado 3D (malha plexus + facetas triangulares + nebulosa suave) baseado em `002.mp4`.
 * Todas as cores são lidas das variáveis CSS definidas em `tailwind.config.js`.
 */
export const AnimatedPlexusBackdrop = ({ hasSidebar = true }) => {
  const canvasRef = useRef(null);
  const tokensRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    tokensRef.current = readPlexusTokens();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = createPlexusScene(130);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = null;
    let clock = 0;

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

    const drawFrame = () => {
      const t = tokensRef.current || readPlexusTokens();
      ctx.clearRect(0, 0, width, height);

      const sidebarOffset = hasSidebar && width >= 1024 ? 256 : 0;
      const areaW = Math.max(320, width - sidebarOffset);
      const linkDist = Math.min(210, Math.max(135, Math.min(areaW, height) * 0.22));
      const linkDistSq = linkDist * linkDist;
      const facetDistSq = (linkDist * 0.82) ** 2;

      ctx.save();

      // 1. Nuvens atmosféricas suaves em deriva (efeito de profundidade do vídeo 002.mp4)
      for (let m = 0; m < scene.nebulae.length; m += 1) {
        const nb = scene.nebulae[m];
        const color = nb.kind === 'b' ? t.nebulaB : t.nebulaA;
        if (!color) continue;
        const cx =
          sidebarOffset +
          (nb.nx + Math.sin(clock * 0.35 + nb.phase) * 0.04) * areaW;
        const cy = (nb.ny + Math.cos(clock * 0.28 + nb.phase) * 0.04) * height;
        const r = Math.max(areaW, height) * nb.rRatio;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = t.opacity;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Coordenadas projetadas cobrindo toda a área visível + margens laterais
      const pts = new Array(scene.nodes.length);
      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i];
        const zDepth = Math.max(0.2, Math.min(1, n.z + Math.sin(clock * 0.55 + n.zPhase) * 0.14));
        pts[i] = {
          x: sidebarOffset - 40 + n.nx * (areaW + 80),
          y: -40 + n.ny * (height + 80),
          z: zDepth,
          isAccent: n.isAccent,
          radius: n.radius * (0.75 + zDepth * 0.35),
          phase: n.phase,
        };
      }

      const neighbors = Array.from({ length: pts.length }, () => []);

      // 2. Arestas geométricas nítidas da malha plexus
      ctx.lineWidth = 0.85;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j += 1) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDistSq) {
            neighbors[i].push(j);
            if (t.line) {
              const distRatio = 1 - Math.sqrt(d2) / linkDist;
              const depth = (a.z + b.z) * 0.5;
              ctx.globalAlpha = t.opacity * Math.min(1, distRatio * 1.35) * (0.35 + depth * 0.65);
              ctx.strokeStyle = t.line;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      // 3. Facetas triangulares translúcidas entre agrupamentos próximos
      if (t.facet) {
        ctx.fillStyle = t.facet;
        let facetCount = 0;
        for (let i = 0; i < pts.length && facetCount < 90; i += 1) {
          const nb = neighbors[i];
          if (nb.length < 2) continue;
          for (let aIdx = 0; aIdx < nb.length && facetCount < 90; aIdx += 1) {
            const j = nb[aIdx];
            const pb = pts[j];
            const dAB = (pts[i].x - pb.x) ** 2 + (pts[i].y - pb.y) ** 2;
            if (dAB > facetDistSq) continue;
            for (let bIdx = aIdx + 1; bIdx < nb.length && facetCount < 90; bIdx += 1) {
              const k = nb[bIdx];
              const pc = pts[k];
              const dBC = (pb.x - pc.x) ** 2 + (pb.y - pc.y) ** 2;
              const dAC = (pts[i].x - pc.x) ** 2 + (pts[i].y - pc.y) ** 2;
              if (dBC < facetDistSq && dAC < facetDistSq) {
                const avgZ = (pts[i].z + pb.z + pc.z) / 3;
                ctx.globalAlpha = t.opacity * (0.20 + avgZ * 0.45);
                ctx.beginPath();
                ctx.moveTo(pts[i].x, pts[i].y);
                ctx.lineTo(pb.x, pb.y);
                ctx.lineTo(pc.x, pc.y);
                ctx.closePath();
                ctx.fill();
                facetCount += 1;
              }
            }
          }
        }
      }

      // 4. Vértices luminosos + halos suaves nos nós de destaque
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i];
        const pulse = 0.8 + Math.sin(clock * 1.5 + p.phase) * 0.2;
        const fill = p.isAccent ? t.nodeAccent || t.node : t.node;
        if (!fill) continue;

        if (p.isAccent) {
          const glowR = p.radius * 7.5;
          const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          halo.addColorStop(0, fill);
          halo.addColorStop(1, 'transparent');
          ctx.globalAlpha = t.opacity * 0.42 * pulse;
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = t.opacity * (0.45 + p.z * 0.55) * pulse;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const advance = () => {
      const speed = (tokensRef.current && tokensRef.current.speed) || 0.45;
      clock += 0.016 * speed;
      for (let i = 0; i < scene.nodes.length; i += 1) {
        const n = scene.nodes[i];
        n.nx += n.vx * speed;
        n.ny += n.vy * speed;
        if (n.nx < 0) n.nx += 1;
        else if (n.nx > 1) n.nx -= 1;
        if (n.ny < 0) n.ny += 1;
        else if (n.ny > 1) n.ny -= 1;
      }
    };

    const tick = () => {
      if (!document.hidden) {
        advance();
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

    const themeObserver = new MutationObserver(() => {
      tokensRef.current = readPlexusTokens();
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

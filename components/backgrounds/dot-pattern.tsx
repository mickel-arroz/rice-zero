"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { DOT_PATTERN, DOT_PATTERN_TOKENS } from "@/lib/constants";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Dot {
  x: number;
  y: number;
  baseOpacity: number;
}

const HEX_COLOR = /^#?([a-f\d])([a-f\d])([a-f\d])$|^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/** `null` cuando el valor no es un hex reconocible: preferimos no pintar a pintar en negro. */
function hexToRgb(hex: string): Rgb | null {
  const match = HEX_COLOR.exec(hex.trim());
  if (!match) return null;
  const [r, g, b] = match[1]
    ? [match[1] + match[1], match[2] + match[2], match[3] + match[3]]
    : [match[4], match[5], match[6]];
  return {
    r: Number.parseInt(r, 16),
    g: Number.parseInt(g, 16),
    b: Number.parseInt(b, 16),
  };
}

function readTokenAsRgb(token: string): Rgb | null {
  return hexToRgb(
    getComputedStyle(document.documentElement).getPropertyValue(token)
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Fondo de retícula de puntos en canvas: los puntos respiran con una onda y se
 * encienden con el rojo de marca cerca del cursor. Es decorativo y no
 * interactivo — se monta como hermano del contenido, nunca envolviéndolo, para
 * no romper el scroll de páginas largas.
 *
 * Los colores salen de los tokens de `globals.css`, así que sigue al tema.
 */
export function DotPattern() {
  const {
    dotSize,
    gap,
    proximity,
    waveSpeed,
    restOpacity,
    restOpacityJitter,
    glowOpacity,
    glowIntensity,
  } = DOT_PATTERN;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -Infinity, y: -Infinity });
  const frameRef = useRef<number | undefined>(undefined);
  const colorsRef = useRef<{ base: Rgb; glow: Rgb } | null>(null);

  const { resolvedTheme } = useTheme();
  // En SSR no hay media query: asumimos animación y la apagamos al hidratar.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );

  // Los tokens son CSS: solo se pueden leer ya montados, y cambian con el tema.
  // Van a un ref porque solo los consume el bucle de dibujo, nunca el render.
  useEffect(() => {
    const base = readTokenAsRgb(DOT_PATTERN_TOKENS.base);
    const glow = readTokenAsRgb(DOT_PATTERN_TOKENS.glow);
    colorsRef.current = base && glow ? { base, glow } : null;
  }, [resolvedTheme]);

  const buildGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    const cellSize = dotSize + gap;
    const cols = Math.ceil(rect.width / cellSize) + 1;
    const rows = Math.ceil(rect.height / cellSize) + 1;
    const offsetX = (rect.width - (cols - 1) * cellSize) / 2;
    const offsetY = (rect.height - (rows - 1) * cellSize) / 2;

    const dots: Dot[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots.push({
          x: offsetX + col * cellSize,
          y: offsetY + row * cellSize,
          baseOpacity: restOpacity + Math.random() * restOpacityJitter,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap, restOpacity, restOpacityJitter]);

  const draw = useCallback(
    (elapsedSeconds: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const colors = colorsRef.current;
      if (!canvas || !ctx || !colors) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const { base, glow: glowRgb } = colors;
      const { x: mx, y: my } = mouseRef.current;
      const proximitySquared = proximity * proximity;
      const time = elapsedSeconds * waveSpeed;

      for (const dot of dotsRef.current) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const distanceSquared = dx * dx + dy * dy;

        const wave = Math.sin(dot.x * 0.02 + dot.y * 0.02 + time) * 0.5 + 0.5;
        let opacity = dot.baseOpacity + wave * 0.15;
        let scale = 1 + wave * 0.2;
        let { r, g, b } = base;
        let glow = 0;

        if (distanceSquared < proximitySquared) {
          const t = 1 - Math.sqrt(distanceSquared) / proximity;
          const eased = t * t * (3 - 2 * t); // smoothstep

          r = Math.round(base.r + (glowRgb.r - base.r) * eased);
          g = Math.round(base.g + (glowRgb.g - base.g) * eased);
          b = Math.round(base.b + (glowRgb.b - base.b) * eased);

          opacity = Math.min(1, opacity + eased * glowOpacity);
          scale += eased * 0.8;
          glow = eased * glowIntensity;
        }

        const radius = (dotSize / 2) * scale;

        if (glow > 0) {
          const halo = ctx.createRadialGradient(
            dot.x,
            dot.y,
            0,
            dot.x,
            dot.y,
            radius * 4
          );
          const { r: gr, g: gg, b: gb } = glowRgb;
          halo.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${glow * 0.4})`);
          halo.addColorStop(0.5, `rgba(${gr}, ${gg}, ${gb}, ${glow * 0.1})`);
          halo.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, radius * 4, 0, Math.PI * 2);
          ctx.fillStyle = halo;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fill();
      }
    },
    [dotSize, glowIntensity, glowOpacity, proximity, waveSpeed]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    buildGrid();
    const observer = new ResizeObserver(buildGrid);
    observer.observe(container);
    return () => observer.disconnect();
  }, [buildGrid]);

  // Sin movimiento reducido animamos; con él pintamos un único fotograma quieto.
  // En una pestaña oculta no se dibuja nada.
  useEffect(() => {
    if (reducedMotion) {
      draw(0);
      return;
    }

    let start: number | undefined;
    const step = (timestamp: number) => {
      start ??= timestamp;
      if (!document.hidden) draw((timestamp - start) / 1000);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
    // resolvedTheme: con movimiento reducido el fotograma único hay que
    // repintarlo cuando cambian los colores del tema.
  }, [draw, reducedMotion, resolvedTheme]);

  // El contenido se monta por encima del fondo, así que el puntero nunca llega
  // al contenedor: la posición se sigue desde la ventana.
  useEffect(() => {
    if (reducedMotion) return;

    const track = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    const reset = () => {
      mouseRef.current = { x: -Infinity, y: -Infinity };
    };

    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerleave", reset);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden bg-background"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_0%,transparent_40%,var(--dot-vignette)_100%)]" />
    </div>
  );
}

"use client";
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { CORE_COLORS } from '../lib/coreColors';

// Animated Rings implementation: arcs grow from 0 -> final share when clustersRunId changes.

type RingsProps = {
  matrixAtRun: Array<[string, Record<string, number>]>;
  clustersRunId?: number | null;
};

const CORES = [
  'support','flexibility','cost','reliability','access','quality','time','trust',
  'choice','effort','information','risk','value'
] as const;
type CoreId = typeof CORES[number];

export default function RingsView({ matrixAtRun, clustersRunId }: RingsProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(360);
  const [armed, setArmed] = useState(false); // when true, animate to final lengths
  const prefersReducedMotion = usePrefersReducedMotion();

  // Arm animation on clustersRunId (new run) or data change.
  useEffect(() => {
    // Reset to 0-length first, then next frame enable final lengths so CSS transition fires.
    setArmed(false);
    if (prefersReducedMotion) { setArmed(true); return; }
    let r1:number; let r2:number;
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setArmed(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [clustersRunId, matrixAtRun, prefersReducedMotion]);

  // Measure container (responsive square) with clamp.
  useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const clamped = Math.max(280, Math.min(520, w));
      setSize(prev => prev === clamped ? prev : clamped);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Counts (presence across interviews in snapshot)
  const N = Array.isArray(matrixAtRun) ? matrixAtRun.length : 0;
  const counts = useMemo(() => {
    const base: Record<CoreId, number> = Object.fromEntries(CORES.map(c => [c, 0])) as any;
    if (N > 0) for (const [, weights] of matrixAtRun) for (const c of CORES) if ((weights?.[c] || 0) > 0) base[c]++;
    return base;
  }, [matrixAtRun, N]);

  const progress: Record<CoreId, number> = useMemo(() => (
    Object.fromEntries(CORES.map(c => [c, N ? counts[c] / N : 0])) as any
  ), [counts, N]);

  // Geometry
  const PAD = 18;
  const OUTER = size / 2 - PAD;
  const RINGS = CORES.length;
  let T = Math.max(8, Math.floor(size * 0.018)); // thickness
  let G = Math.max(4, Math.floor(T * 0.55));     // gap
  const required = RINGS * T + (RINGS - 1) * G;
  if (required > OUTER) {
    const scale = OUTER / required;
    T = Math.max(6, Math.floor(T * scale));
    G = Math.max(3, Math.floor(G * scale));
  }
  const vb = [-OUTER - PAD, -OUTER - PAD, 2 * (OUTER + PAD), 2 * (OUTER + PAD)];
  // Path starts exactly at 12 o'clock (0,-r) and traverses full circle twice (two arcs) so we can rely on length = circumference * 2? Actually one full circle via two 180° arcs gives total length = 2πr.
  const circlePath = (r: number) => `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;

  // Animation: when !armed strokeDasharray shows 0 portion, when armed transitions to final fraction.

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      <svg
        viewBox={vb.join(' ')}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Theme frequency rings"
      >
        <title>Theme frequency rings</title>
        <desc>Each ring shows the share of interviews containing that theme.</desc>

        {/* Tracks */}
        {CORES.map((core, i) => {
          const r = OUTER - (RINGS - 1 - i) * (T + G) - T / 2;
          return (
            <path
              key={`track-${core}`}
              d={circlePath(r)}
              stroke="rgba(0,0,0,.07)"
              strokeWidth={T}
              fill="none"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
            />
          );
        })}

  {/* Progress arcs: path starts at 12 o'clock (M 0 -r). We want growth CLOCKWISE. By default a path stroke draws along the path direction (which for our two-arc circle is clockwise for first half then continues). Using dashoffset decreasing currently gave a counter-direction visual. We flip by reversing the dashoffset baseline and applying a rotate(180) scale(-1,1) was overkill; instead we set strokeDasharray to full length and animate from full offset -> target offset while also reversing path direction via a path definition with reversed arc sweep flag when needed. Simpler: keep path but compute dashOffset baseline as -C so animation visually proceeds clockwise. */}
        {CORES.map((core, i) => {
          const r = OUTER - (RINGS - 1 - i) * (T + G) - T / 2;
          const frac = Math.max(0, Math.min(1, progress[core]));
          const color = (CORE_COLORS as any)[core] || '#64748b';
          // Normalize path length to 1 so strokeDasharray can be expressed as fractional values.
          const visible = armed ? frac : 0;
          const remainder = 1 - visible;
          return (
            <path
              key={`arc-${clustersRunId || 'static'}-${core}`}
              d={circlePath(r)}
              stroke={color}
              strokeWidth={T}
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              shapeRendering="geometricPrecision"
              pathLength={1}
              strokeDasharray={`${visible} ${remainder}`}
              strokeDashoffset={0}
              style={{
                transition: prefersReducedMotion ? undefined : 'stroke-dasharray 820ms cubic-bezier(.4,.0,.2,1)',
                transitionDelay: prefersReducedMotion ? undefined : `${i * 40}ms`
              }}
              aria-label={`${core}: ${Math.round(frac * 100)} percent`}
            />
          );
        })}
        {/* Optional debug guide (uncomment to show radial line at 12 o'clock) */}
        {/* <line x1="0" y1="0" x2="0" y2={-OUTER} stroke="rgba(0,0,0,.3)" strokeWidth={1} /> */}

        {N === 0 && (
          <text x="0" y="0" textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="14">
            No interviews in this run
          </text>
        )}
      </svg>
    </div>
  );
}

// Local reduced motion hook (duplicated intentionally to keep component standalone)
function usePrefersReducedMotion(){
  const [reduced, setReduced] = useState(false);
  useEffect(()=>{
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  },[]);
  return reduced;
}

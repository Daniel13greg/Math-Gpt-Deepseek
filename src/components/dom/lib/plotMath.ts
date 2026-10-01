import { compileExpr, type CompiledExpr } from '@/lib/mathExpr';
import type { GraphSpec } from '@/lib/types';

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const PLOT_COLORS = ['#3490DD', '#E5484D', '#2F9E5E', '#F59E0B', '#8B5CF6', '#0EA5E9'];

/** 1-2-5 tick spacing giving roughly `target` intervals. */
export function niceStep(span: number, target = 8): number {
  const raw = span / target;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / power;
  const nice = unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10;
  return nice * power;
}

export function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Tick label with a real minus sign (−2, not -2). */
export function formatTick(v: number, step: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(v.toFixed(Math.min(decimals, 6)))
    .toString()
    .replace('-', '−');
}

export function compileAll(spec: GraphSpec): (CompiledExpr | null)[] {
  return spec.functions.map((f) => {
    try {
      return compileExpr(f.expr);
    } catch {
      return null;
    }
  });
}

/** Chooses a y-range that shows the interesting part of every curve, ignoring asymptote spikes. */
export function initialViewport(spec: GraphSpec, fns: (CompiledExpr | null)[]): Viewport {
  const { xMin, xMax } = spec;
  if (spec.yMin !== undefined && spec.yMax !== undefined) return { xMin, xMax, yMin: spec.yMin, yMax: spec.yMax };

  const ys: number[] = [];
  for (const f of fns) {
    if (!f) continue;
    for (let i = 0; i <= 240; i++) {
      const y = f(xMin + ((xMax - xMin) * i) / 240);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  for (const p of spec.points) ys.push(p.y);
  if (ys.length === 0) return { xMin, xMax, yMin: -10, yMax: 10 };

  ys.sort((a, b) => a - b);
  const pick = (q: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(q * (ys.length - 1))))];
  let lo = pick(0.03);
  let hi = pick(0.97);
  for (const p of spec.points) {
    lo = Math.min(lo, p.y);
    hi = Math.max(hi, p.y);
  }
  // Keep the x-axis in view when it's close.
  if (lo > 0 && lo < (hi - lo) * 0.5) lo = 0;
  if (hi < 0 && -hi < (hi - lo) * 0.5) hi = 0;
  let span = hi - lo;
  if (span < 1e-6) span = Math.max(2, Math.abs(hi) * 0.5);
  const pad = span * 0.12;
  return { xMin, xMax, yMin: spec.yMin ?? lo - pad, yMax: spec.yMax ?? hi + pad };
}

/**
 * Samples f across the viewport and returns SVG path data in a W×H box.
 * Breaks the path at undefined points and at vertical asymptotes.
 */
export function curvePath(f: CompiledExpr, vp: Viewport, width: number, height: number, samples = 480): string {
  const sx = (x: number) => ((x - vp.xMin) / (vp.xMax - vp.xMin)) * width;
  const sy = (y: number) => height - ((y - vp.yMin) / (vp.yMax - vp.yMin)) * height;
  const span = vp.yMax - vp.yMin;
  const clampY = (y: number) => Math.max(vp.yMin - span * 2, Math.min(vp.yMax + span * 2, y));

  let d = '';
  let prev: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const x = vp.xMin + ((vp.xMax - vp.xMin) * i) / samples;
    const y = f(x);
    if (!Number.isFinite(y)) {
      prev = null;
      continue;
    }
    const jump =
      prev !== null && Math.abs(y - prev) > span * 1.5 && (y > vp.yMax || y < vp.yMin || prev > vp.yMax || prev < vp.yMin);
    const cmd = prev === null || jump ? 'M' : 'L';
    d += `${cmd}${sx(x).toFixed(1)},${sy(clampY(y)).toFixed(1)}`;
    prev = y;
  }
  return d;
}

export function zoomViewport(vp: Viewport, factor: number, cx = (vp.xMin + vp.xMax) / 2, cy = (vp.yMin + vp.yMax) / 2): Viewport {
  return {
    xMin: cx - (cx - vp.xMin) * factor,
    xMax: cx + (vp.xMax - cx) * factor,
    yMin: cy - (cy - vp.yMin) * factor,
    yMax: cy + (vp.yMax - cy) * factor,
  };
}

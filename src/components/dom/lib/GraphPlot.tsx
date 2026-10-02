import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';

import type { GraphSpec } from '@/lib/types';

import { useDomT } from './i18n';
import { Icon } from './Icon';
import { InlineMarkdown } from './Markdown';
import {
  compileAll,
  curvePath,
  formatTick,
  initialViewport,
  niceStep,
  PLOT_COLORS,
  ticks,
  zoomViewport,
  type Viewport,
} from './plotMath';

const W = 400;
const H = 300;

/** Plain calculator syntax ("y = 2*sin(x) + pi") → TeX for the legend. */
export function exprToTex(label: string): string {
  if (label.includes('\\(') || label.includes('$')) return label;
  const tex = label
    .replace(/\*\*/g, '^')
    .replace(/\*/g, ' \\cdot ')
    .replace(/\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|ln|log|exp)\b/g, '\\$1 ')
    .replace(/\bsqrt\b/g, '\\sqrt')
    .replace(/\bpi\b/g, '\\pi ');
  return `\\(${tex}\\)`;
}

/**
 * Interactive plot of y = f(x). Drag sideways to pan, pinch or use the buttons to zoom.
 * `touch-action: pan-y` keeps vertical swipes scrolling the chat.
 */
export function GraphPlot({ spec, fullscreen = false }: { spec: GraphSpec; fullscreen?: boolean }) {
  const { t } = useDomT();
  const fns = useMemo(() => compileAll(spec), [spec]);
  const initial = useMemo(() => initialViewport(spec, fns), [spec, fns]);
  const [vp, setVp] = useState<Viewport>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const clipId = `plot-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const sx = (x: number) => ((x - vp.xMin) / (vp.xMax - vp.xMin)) * W;
  const sy = (y: number) => H - ((y - vp.yMin) / (vp.yMax - vp.yMin)) * H;

  const xStep = niceStep(vp.xMax - vp.xMin, 8);
  const yStep = niceStep(vp.yMax - vp.yMin, 6);
  const xTicks = ticks(vp.xMin, vp.xMax, xStep);
  const yTicks = ticks(vp.yMin, vp.yMax, yStep);
  const axisX = vp.yMin <= 0 && vp.yMax >= 0 ? sy(0) : vp.yMin > 0 ? H : 0;
  const axisY = vp.xMin <= 0 && vp.xMax >= 0 ? sx(0) : vp.xMin > 0 ? 0 : W;

  const toUnits = (dxPx: number, dyPx: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const scaleX = rect ? W / rect.width : 1;
    const scaleY = rect ? H / rect.height : 1;
    return {
      dx: (dxPx * scaleX * (vp.xMax - vp.xMin)) / W,
      dy: (dyPx * scaleY * (vp.yMax - vp.yMin)) / H,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 1) {
      const { dx, dy } = toUnits(next.x - prev.x, next.y - prev.y);
      setVp((v) => ({ xMin: v.xMin - dx, xMax: v.xMax - dx, yMin: v.yMin + dy, yMax: v.yMax + dy }));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) {
        const factor = pinchDistance.current / dist;
        setVp((v) => zoomViewport(v, factor));
      }
      pinchDistance.current = dist;
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (!fullscreen && !e.ctrlKey) return; // Let normal wheel scrolling scroll the chat.
    e.preventDefault();
    setVp((v) => zoomViewport(v, e.deltaY > 0 ? 1.12 : 0.89));
  };

  return (
    <div>
      <svg
        ref={svgRef}
        className="plot"
        viewBox={`0 0 ${W} ${H}`}
        style={{ touchAction: fullscreen ? 'none' : 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onWheel={onWheel}
        role="img"
        aria-label={spec.title}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        <g stroke="var(--border)" strokeWidth={1}>
          {xTicks.map((t) => (
            <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={0} y2={H} />
          ))}
          {yTicks.map((t) => (
            <line key={`gy${t}`} x1={0} x2={W} y1={sy(t)} y2={sy(t)} />
          ))}
        </g>
        <g stroke="var(--text-2)" strokeWidth={1.3}>
          <line x1={0} x2={W} y1={axisX} y2={axisX} />
          <line x1={axisY} x2={axisY} y1={0} y2={H} />
        </g>
        <g fill="var(--text-2)" fontSize={12} fontFamily="inherit">
          {xTicks.map((t) =>
            t === 0 ? null : (
              <text key={`tx${t}`} x={sx(t)} y={Math.min(H - 5, Math.max(14, axisX + 15))} textAnchor="middle">
                {formatTick(t, xStep)}
              </text>
            ),
          )}
          {yTicks.map((t) =>
            t === 0 ? null : (
              <text
                key={`ty${t}`}
                x={Math.min(W - 5, Math.max(5, axisY - 6))}
                y={sy(t) + 4}
                textAnchor={axisY < 30 ? 'start' : 'end'}>
                {formatTick(t, yStep)}
              </text>
            ),
          )}
        </g>
        <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
          {fns.map((f, i) =>
            f ? <path key={i} d={curvePath(f, vp, W, H)} stroke={PLOT_COLORS[i % PLOT_COLORS.length]} /> : null,
          )}
        </g>
        <g clipPath={`url(#${clipId})`}>
          {spec.points.map((p, i) => (
            <g key={i}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="var(--bg)" stroke="var(--text)" strokeWidth={2} />
              {p.label ? (
                <text
                  x={sx(p.x) + (sx(p.x) > W - 90 ? -8 : 8)}
                  y={sy(p.y) + (sy(p.y) < 20 ? 16 : -8)}
                  textAnchor={sx(p.x) > W - 90 ? 'end' : 'start'}
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--text)"
                  stroke="var(--surface-2)"
                  strokeWidth={3.5}
                  paintOrder="stroke">
                  {p.label}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      </svg>
      <div className="plot-tools">
        <button className="icon-btn small" aria-label={t('graph.zoomIn')} onClick={() => setVp((v) => zoomViewport(v, 0.7))}>
          <Icon name="zoomIn" size={17} />
        </button>
        <button className="icon-btn small" aria-label={t('graph.zoomOut')} onClick={() => setVp((v) => zoomViewport(v, 1.4))}>
          <Icon name="zoomOut" size={17} />
        </button>
        <button className="icon-btn small" aria-label={t('graph.reset')} onClick={() => setVp(initial)}>
          <Icon name="rotateCcw" size={17} />
        </button>
      </div>
      <div className="legend">
        {spec.functions.map((f, i) => (
          <span key={i}>
            <i style={{ background: PLOT_COLORS[i % PLOT_COLORS.length] }} />
            <InlineMarkdown text={exprToTex(f.label)} />
          </span>
        ))}
      </div>
    </div>
  );
}

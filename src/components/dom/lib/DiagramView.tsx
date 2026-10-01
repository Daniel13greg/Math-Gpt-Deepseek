import { useId, useMemo } from 'react';

import type { DiagramSpec } from '@/lib/types';

import { edgePath, layoutFlowchart, layoutMindMap, wrapLabel, type DiagramLayout, type LaidOutNode } from './diagramLayout';
import { Markdown } from './Markdown';
import { PLOT_COLORS } from './plotMath';

const LINE_H = 18;

function NodeText({ node, color, weight = 500 }: { node: LaidOutNode; color: string; weight?: number }) {
  const top = node.y - ((node.lines.length - 1) * LINE_H) / 2;
  return (
    <text textAnchor="middle" fontSize={14} fontWeight={weight} fill={color} fontFamily="inherit">
      {node.lines.map((line, i) => (
        <tspan key={i} x={node.x} y={top + i * LINE_H + 5}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function FlowShape({ node }: { node: LaidOutNode }) {
  const { x, y, width: w, height: h } = node;
  const left = x - w / 2;
  const top = y - h / 2;
  switch (node.shape) {
    case 'start':
    case 'end':
      return (
        <rect
          x={left}
          y={top}
          width={w}
          height={h}
          rx={h / 2}
          fill="var(--primary-soft)"
          stroke="var(--primary)"
          strokeWidth={2}
        />
      );
    case 'decision':
      return (
        <polygon
          points={`${x},${top} ${left + w},${y} ${x},${top + h} ${left},${y}`}
          fill="#FFF4DB"
          stroke="#F59E0B"
          strokeWidth={2}
        />
      );
    case 'io': {
      const k = 14;
      return (
        <polygon
          points={`${left + k},${top} ${left + w},${top} ${left + w - k},${top + h} ${left},${top + h}`}
          fill="var(--success-soft)"
          stroke="var(--success)"
          strokeWidth={2}
        />
      );
    }
    default:
      return <rect x={left} y={top} width={w} height={h} rx={10} fill="var(--bg)" stroke="var(--text-2)" strokeWidth={1.6} />;
  }
}

/** Natural-size SVG that shrinks a little to fit, then scrolls sideways. */
function Canvas({ layout, label, children }: { layout: DiagramLayout; label: string; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        className="diagram-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ minWidth: layout.width * 0.62, maxWidth: Math.max(layout.width * 1.05, 280), margin: '0 auto' }}
        role="img"
        aria-label={label}>
        {children}
      </svg>
    </div>
  );
}

function Flowchart({ spec }: { spec: Extract<DiagramSpec, { type: 'flowchart' }> }) {
  const layout = useMemo(() => layoutFlowchart(spec.nodes, spec.edges), [spec]);
  const marker = `arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <Canvas layout={layout} label={spec.title}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-2)" />
        </marker>
      </defs>
      {layout.edges.map((e, i) => (
        <path key={i} d={edgePath(e.points)} fill="none" stroke="var(--text-2)" strokeWidth={1.6} markerEnd={`url(#${marker})`} />
      ))}
      {layout.edges.map((e, i) =>
        e.label && e.labelPos ? (
          <g key={`l${i}`}>
            <rect
              x={e.labelPos.x - e.label.length * 3.6 - 6}
              y={e.labelPos.y - 10}
              width={e.label.length * 7.2 + 12}
              height={20}
              rx={10}
              fill="var(--bg)"
              stroke="var(--border)"
            />
            <text
              x={e.labelPos.x}
              y={e.labelPos.y + 4.5}
              textAnchor="middle"
              fontSize={12.5}
              fontWeight={600}
              fill="var(--text-2)"
              fontFamily="inherit">
              {e.label}
            </text>
          </g>
        ) : null,
      )}
      {layout.nodes.map((n) => (
        <g key={n.id}>
          <FlowShape node={n} />
          <NodeText node={n} color="var(--text)" />
        </g>
      ))}
    </Canvas>
  );
}

function MindMap({ spec }: { spec: Extract<DiagramSpec, { type: 'mindmap' }> }) {
  const layout = useMemo(() => layoutMindMap(spec.root), [spec]);
  const byDepth = (n: LaidOutNode) => PLOT_COLORS[n.branch % PLOT_COLORS.length];
  const nodesById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  return (
    <Canvas layout={layout} label={spec.title}>
      {layout.edges.map((e, i) => {
        const target = nodesById.get(e.to);
        return (
          <path
            key={i}
            d={edgePath(e.points)}
            fill="none"
            stroke={target ? byDepth(target) : 'var(--text-3)'}
            strokeWidth={2}
            strokeOpacity={0.75}
          />
        );
      })}
      {layout.nodes.map((n) => {
        const color = byDepth(n);
        const root = n.depth === 0;
        return (
          <g key={n.id}>
            <rect
              x={n.x - n.width / 2}
              y={n.y - n.height / 2}
              width={n.width}
              height={n.height}
              rx={root ? n.height / 2 : 10}
              fill={root ? 'var(--primary)' : n.depth === 1 ? `${color}22` : 'var(--bg)'}
              stroke={root ? 'none' : color}
              strokeWidth={n.depth === 1 ? 2 : 1.4}
            />
            <NodeText node={n} color={root ? '#fff' : 'var(--text)'} weight={root ? 700 : n.depth === 1 ? 600 : 500} />
          </g>
        );
      })}
    </Canvas>
  );
}

const VENN_2 = {
  circles: [
    { cx: 155, cy: 165, r: 110 },
    { cx: 265, cy: 165, r: 110 },
  ],
  labels: [
    { x: 120, y: 38 },
    { x: 300, y: 38 },
  ],
  regions: { '0': { x: 112, y: 165 }, '1': { x: 308, y: 165 }, '0,1': { x: 210, y: 165 } } as Record<
    string,
    { x: number; y: number }
  >,
  width: 420,
  height: 300,
};

const VENN_3 = {
  circles: [
    { cx: 165, cy: 140, r: 100 },
    { cx: 255, cy: 140, r: 100 },
    { cx: 210, cy: 220, r: 100 },
  ],
  labels: [
    { x: 95, y: 30 },
    { x: 325, y: 30 },
    { x: 210, y: 345 },
  ],
  regions: {
    '0': { x: 118, y: 112 },
    '1': { x: 302, y: 112 },
    '2': { x: 210, y: 268 },
    '0,1': { x: 210, y: 92 },
    '0,2': { x: 158, y: 205 },
    '1,2': { x: 262, y: 205 },
    '0,1,2': { x: 210, y: 168 },
  } as Record<string, { x: number; y: number }>,
  width: 420,
  height: 360,
};

function Venn({ spec }: { spec: Extract<DiagramSpec, { type: 'venn' }> }) {
  const geo = spec.sets.length === 3 ? VENN_3 : VENN_2;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        className="diagram-svg"
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        style={{ maxWidth: 520, margin: '0 auto' }}
        role="img"
        aria-label={spec.title}>
        {geo.circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill={PLOT_COLORS[i]}
            fillOpacity={0.14}
            stroke={PLOT_COLORS[i]}
            strokeWidth={2}
          />
        ))}
        {spec.sets.map((label, i) => (
          <text
            key={i}
            x={geo.labels[i].x}
            y={geo.labels[i].y}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill={PLOT_COLORS[i]}
            fontFamily="inherit">
            {label.length > 26 ? `${label.slice(0, 25)}…` : label}
          </text>
        ))}
        {spec.regions.map((region, i) => {
          const pos = geo.regions[region.sets.join(',')];
          if (!pos) return null;
          // Overlaps are narrow: wrap tighter and show fewer lines.
          const overlap = region.sets.length > 1;
          const maxLines = overlap ? 4 : 6;
          const wrapped = region.items.flatMap((item) => wrapLabel(item, overlap ? 12 : 16));
          const lines = wrapped.length > maxLines ? [...wrapped.slice(0, maxLines - 1), '…'] : wrapped;
          const top = pos.y - ((lines.length - 1) * 15) / 2;
          return (
            <text key={i} textAnchor="middle" fontSize={overlap ? 11 : 12} fill="var(--text)" fontFamily="inherit">
              {lines.map((line, j) => (
                <tspan key={j} x={pos.x} y={top + j * 15 + 4}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/** Model-drawn SVG is shown through <img>, which never executes scripts. */
function SvgImage({ spec }: { spec: Extract<DiagramSpec, { type: 'svg' }> }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(spec.svg)}`, [spec.svg]);
  return <img className="diagram-img" src={src} alt={spec.title} />;
}

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  return (
    <div>
      {spec.type === 'flowchart' ? <Flowchart spec={spec} /> : null}
      {spec.type === 'mindmap' ? <MindMap spec={spec} /> : null}
      {spec.type === 'venn' ? <Venn spec={spec} /> : null}
      {spec.type === 'svg' ? <SvgImage spec={spec} /> : null}
      {spec.caption ? <Markdown className="caption muted" text={spec.caption} /> : null}
    </div>
  );
}

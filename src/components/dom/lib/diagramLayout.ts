import { Graph, layout } from '@dagrejs/dagre';

import type { FlowEdge, FlowNode, MindNode } from '@/lib/types';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LaidOutNode extends Box {
  id: string;
  lines: string[];
  shape: FlowNode['shape'] | 'mind';
  depth: number;
  branch: number;
}

export interface LaidOutEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
  label?: string;
  labelPos?: { x: number; y: number };
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

const CHAR_W = 7.4; // ~14px system font
const LINE_H = 18;

/** Greedy word wrap by character count. */
export function wrapLabel(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function sizeFor(lines: string[], shape: LaidOutNode['shape']) {
  const textW = Math.max(...lines.map((l) => l.length)) * CHAR_W;
  const textH = lines.length * LINE_H;
  if (shape === 'decision') return { width: Math.max(120, textW * 1.5 + 30), height: Math.max(70, textH * 1.6 + 30) };
  if (shape === 'io') return { width: textW + 56, height: textH + 22 };
  return { width: Math.max(shape === 'mind' ? 60 : 96, textW + 32), height: textH + 20 };
}

function finish(g: Graph, nodes: Map<string, Omit<LaidOutNode, keyof Box>>): DiagramLayout {
  layout(g);
  const out: LaidOutNode[] = [];
  for (const [id, meta] of nodes) {
    const n = g.node(id) as unknown as Box;
    out.push({ ...meta, x: n.x, y: n.y, width: n.width, height: n.height });
  }
  const edges: LaidOutEdge[] = g.edges().map((e) => {
    const data = g.edge(e) as unknown as { points: { x: number; y: number }[]; label?: string; x?: number; y?: number };
    return {
      from: e.v,
      to: e.w,
      points: data.points,
      label: data.label,
      labelPos: data.label && data.x !== undefined && data.y !== undefined ? { x: data.x, y: data.y } : undefined,
    };
  });
  const graph = g.graph() as unknown as { width: number; height: number };
  return { width: Math.ceil(graph.width), height: Math.ceil(graph.height), nodes: out, edges };
}

export function layoutFlowchart(nodes: FlowNode[], edges: FlowEdge[]): DiagramLayout {
  const g = new Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 44, edgesep: 14, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  const meta = new Map<string, Omit<LaidOutNode, keyof Box>>();
  for (const n of nodes) {
    const lines = wrapLabel(n.label, n.shape === 'decision' ? 16 : 22);
    g.setNode(n.id, sizeFor(lines, n.shape));
    meta.set(n.id, { id: n.id, lines, shape: n.shape, depth: 0, branch: 0 });
  }
  edges.forEach((e, i) => {
    const label = e.label?.slice(0, 24);
    g.setEdge(e.from, e.to, label ? { label, width: label.length * 6.8 + 10, height: 18, labelpos: 'c' } : {}, `e${i}`);
  });
  return finish(g, meta);
}

/** Left-to-right tree; each first-level branch gets its own color index. */
export function layoutMindMap(root: MindNode): DiagramLayout {
  const g = new Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 10, ranksep: 30, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));
  const meta = new Map<string, Omit<LaidOutNode, keyof Box>>();
  let counter = 0;
  const visit = (node: MindNode, depth: number, branch: number, parent?: string) => {
    const id = `m${counter++}`;
    const lines = wrapLabel(node.label, depth === 0 ? 14 : depth === 1 ? 18 : 16);
    g.setNode(id, sizeFor(lines, 'mind'));
    meta.set(id, { id, lines, shape: 'mind', depth, branch });
    if (parent) g.setEdge(parent, id);
    node.children.forEach((child, i) => visit(child, depth + 1, depth === 0 ? i : branch, id));
  };
  visit(root, 0, 0);
  return finish(g, meta);
}

/** Curved path through dagre's edge points. */
export function edgePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += `Q${points[i].x},${points[i].y} ${mid.x},${mid.y}`;
  }
  const last = points[points.length - 1];
  return `${d}L${last.x},${last.y}`;
}

import { compileExpr } from '@/lib/mathExpr';
import type { GraphSpec } from '@/lib/types';

import { layoutFlowchart, layoutMindMap, wrapLabel } from '../diagramLayout';
import { curvePath, initialViewport, niceStep, ticks } from '../plotMath';

describe('plotMath', () => {
  it('picks 1-2-5 steps', () => {
    expect(niceStep(20)).toBe(2);
    expect(niceStep(1)).toBe(0.1);
    expect(niceStep(370)).toBe(50);
    expect(ticks(-2.5, 2.5, 1)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('ignores asymptote spikes when choosing the y range', () => {
    const spec: GraphSpec = {
      title: 't',
      functions: [{ expr: '1/x', label: '' }],
      points: [],
      xMin: -5,
      xMax: 5,
      explanation: '',
    };
    const vp = initialViewport(spec, [compileExpr('1/x')]);
    expect(vp.yMax).toBeLessThan(20);
    expect(vp.yMin).toBeGreaterThan(-20);
  });

  it('respects explicit ranges and includes key points', () => {
    const base: GraphSpec = { title: 't', functions: [{ expr: 'x', label: '' }], points: [], xMin: -1, xMax: 1, explanation: '' };
    expect(initialViewport({ ...base, yMin: -3, yMax: 3 }, [compileExpr('x')])).toEqual({ xMin: -1, xMax: 1, yMin: -3, yMax: 3 });
    const withPoint = initialViewport({ ...base, points: [{ x: 0, y: 50 }] }, [compileExpr('x')]);
    expect(withPoint.yMax).toBeGreaterThan(50);
  });

  it('breaks curves at undefined points and asymptotes', () => {
    const vp = { xMin: -2, xMax: 2, yMin: -5, yMax: 5 };
    const tan = curvePath(compileExpr('1/x'), vp, 100, 100, 100);
    expect((tan.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
    const sqrt = curvePath(compileExpr('sqrt(x)'), vp, 100, 100, 100);
    expect(sqrt.startsWith('M50.0')).toBe(true);
  });
});

describe('diagramLayout', () => {
  it('wraps labels by words', () => {
    expect(wrapLabel('Discriminant ≥ 0?', 14)).toEqual(['Discriminant', '≥ 0?']);
    expect(wrapLabel('Compute the discriminant b squared minus 4ac', 16)).toEqual([
      'Compute the',
      'discriminant b',
      'squared minus',
      '4ac',
    ]);
  });

  it('lays out a flowchart top to bottom without overlaps', () => {
    const layout = layoutFlowchart(
      [
        { id: 'a', label: 'Start', shape: 'start' },
        { id: 'b', label: 'Is it raining?', shape: 'decision' },
        { id: 'c', label: 'Take umbrella', shape: 'process' },
        { id: 'd', label: 'End', shape: 'end' },
      ],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c', label: 'Yes' },
        { from: 'b', to: 'd', label: 'No' },
        { from: 'c', to: 'd' },
      ],
    );
    const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
    expect(byId.a.y).toBeLessThan(byId.b.y);
    expect(byId.b.y).toBeLessThan(byId.d.y);
    expect(layout.edges).toHaveLength(4);
    expect(layout.edges.find((e) => e.label === 'Yes')?.labelPos).toBeDefined();
    for (const n of layout.nodes)
      for (const m of layout.nodes) {
        if (n === m) continue;
        const overlapX = Math.abs(n.x - m.x) < (n.width + m.width) / 2;
        const overlapY = Math.abs(n.y - m.y) < (n.height + m.height) / 2;
        expect(overlapX && overlapY).toBe(false);
      }
  });

  it('lays out mind maps left to right with branch colors', () => {
    const layout = layoutMindMap({
      label: 'Cell',
      children: [
        { label: 'Nucleus', children: [{ label: 'DNA', children: [] }] },
        { label: 'Membrane', children: [] },
      ],
    });
    const root = layout.nodes.find((n) => n.depth === 0)!;
    const dna = layout.nodes.find((n) => n.lines[0] === 'DNA')!;
    expect(dna.x).toBeGreaterThan(root.x);
    expect(dna.branch).toBe(0);
    expect(layout.nodes.find((n) => n.lines[0] === 'Membrane')!.branch).toBe(1);
  });
});

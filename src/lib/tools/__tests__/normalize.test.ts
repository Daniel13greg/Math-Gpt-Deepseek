import {
  ArtifactError,
  normalizeDiagram,
  normalizeFlashcards,
  normalizeGraph,
  normalizePracticeQuestion,
  normalizePracticeTest,
  normalizeVideo,
  sanitizeSvg,
  speakable,
} from '../normalize';

describe('multiple choice normalization', () => {
  it('accepts letter answers, prefixed choices and object choices', () => {
    const q = normalizePracticeQuestion(
      {
        question: 'What is \\(2+2\\)?',
        choices: ['A) 3', 'B) 4', 'C) 5', 'D) 22'],
        answer: 'B',
        explanation: 'Add.',
        difficulty: 'easy',
      },
      'arithmetic',
    );
    expect(q.choices).toEqual(['3', '4', '5', '22']);
    expect(q.answerIndex).toBe(1);
    expect(q.difficulty).toBe('easy');

    const fromObject = normalizePracticeQuestion(
      { question: 'Pick', choices: { A: 'one', B: 'two' }, answer: 'two', explanation: '' },
      't',
    );
    expect(fromObject.answerIndex).toBe(1);
  });

  it('drops unusable test questions but keeps the rest', () => {
    const test = normalizePracticeTest(
      {
        title: 'Derivatives',
        questions: [
          { question: 'd/dx x^2?', choices: ['2x', 'x', '2', 'x^2'], answerIndex: 0, explanation: 'Power rule' },
          { question: 'broken', choices: ['only one'], answerIndex: 0 },
          { question: 'no answer', choices: ['a', 'b'] },
        ],
      },
      'derivatives',
    );
    expect(test.questions).toHaveLength(1);
    expect(test.title).toBe('Derivatives');
  });

  it('throws a readable error when nothing is usable', () => {
    expect(() => normalizePracticeTest({ questions: [] }, 't')).toThrow(ArtifactError);
  });
});

describe('normalizeFlashcards', () => {
  it('accepts term/definition aliases', () => {
    const deck = normalizeFlashcards({ cards: [{ term: 'Mitosis', definition: 'Cell division' }, { front: '' }] }, 'Bio');
    expect(deck).toEqual({ title: 'Bio', cards: [{ front: 'Mitosis', back: 'Cell division' }] });
  });
});

describe('normalizeGraph', () => {
  it('keeps only compilable functions and fixes inverted ranges', () => {
    const g = normalizeGraph(
      {
        functions: [{ expr: 'x^2 - 4', label: 'f' }, { expr: 'import os' }, 'sin(x)'],
        xMin: 5,
        xMax: -5,
        points: [
          { x: 2, y: 0, label: 'root' },
          { x: 'a', y: 1 },
        ],
      },
      'parabola',
    );
    expect(g.functions.map((f) => f.expr)).toEqual(['x^2 - 4', 'sin(x)']);
    expect([g.xMin, g.xMax]).toEqual([-10, 10]);
    expect(g.points).toEqual([{ x: 2, y: 0, label: 'root' }]);
  });

  it('rejects graphs without valid functions', () => {
    expect(() => normalizeGraph({ functions: [{ expr: '???' }] }, 't')).toThrow(ArtifactError);
  });
});

describe('normalizeDiagram', () => {
  it('validates flowchart edges against nodes', () => {
    const d = normalizeDiagram(
      {
        title: 'Quadratic',
        nodes: [
          { id: 'a', label: 'Start', shape: 'start' },
          { id: 'b', label: 'Compute discriminant', shape: 'weird' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'a', to: 'zzz' },
        ],
      },
      'flowchart',
      'q',
    );
    if (d.type !== 'flowchart') throw new Error('wrong type');
    expect(d.nodes[1].shape).toBe('process');
    expect(d.edges).toEqual([{ from: 'a', to: 'b', label: undefined }]);
  });

  it('maps venn region labels to set indexes', () => {
    const d = normalizeDiagram(
      { sets: ['Mitosis', 'Meiosis'], regions: [{ sets: ['Mitosis', 'meiosis'], items: ['DNA replication'] }] },
      'venn',
      'cells',
    );
    if (d.type !== 'venn') throw new Error('wrong type');
    expect(d.regions).toEqual([{ sets: [0, 1], items: ['DNA replication'] }]);
  });

  it('builds mind maps from string children', () => {
    const d = normalizeDiagram({ root: { label: 'Cell', children: ['Nucleus', { label: 'Membrane' }] } }, 'mindmap', 'c');
    if (d.type !== 'mindmap') throw new Error('wrong type');
    expect(d.root.children.map((c) => c.label)).toEqual(['Nucleus', 'Membrane']);
  });
});

describe('sanitizeSvg', () => {
  it('removes scripts, handlers and remote links and adds xmlns', () => {
    const svg = sanitizeSvg(
      'Here: <svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)"><circle r="2" onclick=\'x()\'/></a></svg> done',
    );
    expect(svg).not.toMatch(/script|onload|onclick|javascript/);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});

describe('video', () => {
  it('fills missing narration from the slide text', () => {
    const v = normalizeVideo({ title: 'Pythagoras', scenes: [{ heading: 'Theorem', body: '\\(a^2 + b^2 = c^2\\)' }] }, 'p');
    expect(v.scenes[0].narration).toBe('Theorem. a squared plus b squared equals c squared');
  });

  it('speakable strips markdown and LaTeX', () => {
    expect(speakable('**Area** is \\(\\frac{1}{2}bh\\)')).toBe('Area is 1 over 2 bh');
    expect(speakable('So 6/4 = 3/2 and x^2 - 4 >= 0.')).toBe(
      'So 6 over 4 equals 3 over 2 and x squared minus 4 is greater than or equal to 0.',
    );
    expect(speakable('\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]')).toBe(
      'x equals minus b plus or minus the square root of b squared minus 4ac over 2a',
    );
  });
});

describe('math in titles and labels', () => {
  it('turns plain-text math into Unicode for titles, labels and points', () => {
    const graph = normalizeGraph(
      { title: 'Parabola y = x^2 - 4', functions: [{ expr: 'x^2 - 4' }], points: [{ x: 0.5, y: -3.75, label: '(1/2, -15/4)' }] },
      'parabolas',
    );
    expect(graph.title).toBe('Parabola y = x² − 4');
    expect(graph.points[0].label).toBe('(½, −¹⁵⁄₄)');

    const flow = normalizeDiagram(
      {
        title: 'Quadratics',
        nodes: [
          { id: 'a', label: 'Compute b^2 - 4ac', shape: 'process' },
          { id: 'b', label: '\\(\\Delta \\ge 0\\)?', shape: 'decision' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      },
      'flowchart',
      'quadratics',
    );
    expect(flow.type === 'flowchart' && flow.nodes.map((n) => n.label)).toEqual(['Compute b² − 4ac', 'Δ ≥ 0?']);
  });

  it('cleans up math in model-drawn SVG text', () => {
    const svg = sanitizeSvg("<svg viewBox='0 0 10 10'><text x='1'>\\theta = 30^\\circ</text><text>x^2 &amp; y</text></svg>");
    expect(svg).toContain('>θ = 30°</text>');
    expect(svg).toContain('>x² &amp; y</text>');
  });
});

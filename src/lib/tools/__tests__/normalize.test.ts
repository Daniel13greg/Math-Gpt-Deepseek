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
    expect(v.scenes[0].narration).toBe('Theorem. a squared + b squared = c squared');
  });

  it('speakable strips markdown and LaTeX', () => {
    expect(speakable('**Area** is \\(\\frac{1}{2}bh\\)')).toBe('Area is 1 over 2bh');
  });
});

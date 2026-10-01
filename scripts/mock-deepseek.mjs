#!/usr/bin/env node
/**
 * A tiny stand-in for the DeepSeek API so the app can be demoed without an API key.
 *
 *   npm run mock            # listens on http://0.0.0.0:8787
 *
 * Then in the app: Settings → API base URL → http://<your-computer-ip>:8787 and any API key.
 * Streams OpenAI-style SSE (with `reasoning_content` when thinking is enabled) and returns
 * canned JSON for each tool, plus a fake /audio/transcriptions endpoint.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const DELAY = Number(process.env.MOCK_DELAY_MS ?? 18);

const ANSWER = String.raw`We need the roots of \(x^2 - 5x + 6 = 0\).

1. **Identify the coefficients.** Here \(a = 1\), \(b = -5\) and \(c = 6\).

2. **Factor the quadratic.** We look for two numbers whose product is \(6\) and whose sum is \(-5\): those are \(-2\) and \(-3\).
\[
x^2 - 5x + 6 = (x - 2)(x - 3)
\]

3. **Apply the zero-product property.**
\[
\begin{aligned}
x - 2 &= 0 \quad\Rightarrow\quad x = 2 \\
x - 3 &= 0 \quad\Rightarrow\quad x = 3
\end{aligned}
\]

4. **Check with the quadratic formula.**
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} = \frac{5 \pm \sqrt{25 - 24}}{2} = \frac{5 \pm 1}{2}$$

| Root | Check \(x^2 - 5x + 6\) |
|---|---|
| \(x = 2\) | \(4 - 10 + 6 = 0\) ✓ |
| \(x = 3\) | \(9 - 15 + 6 = 0\) ✓ |

**Tip:** for any quadratic ax^2 + bx + c = 0, the roots add up to -b/a = 5 and multiply to c/a = 6.

**Final answer:** \(\boxed{x = 2 \text{ or } x = 3}\)`;

const REASONING =
  'The user wants the roots of x^2 - 5x + 6. Product 6, sum -5 gives -2 and -3, so (x-2)(x-3). Roots 2 and 3. Let me double-check with the discriminant: 25 - 24 = 1, sqrt = 1, (5±1)/2 = 3 or 2. Good. I will present factoring, then verify with the formula and a table.';

const TOOL_REASONING =
  'The student wants study material on this topic. I will cover the main sub-skills, pick clean numbers, and make sure every answer key is correct before writing the JSON.';

const NOTES_REASONING =
  'The transcript covers derivatives. "The rivet of" is a mishearing of "the derivative of". I will reconstruct the power rule example and add review questions.';

const STUDY_GUIDE = String.raw`### Overview
Quadratic equations have the form \(ax^2 + bx + c = 0\) with \(a \neq 0\).

### Key Concepts
- **Roots** are the \(x\)-values where the parabola crosses the \(x\)-axis.
- The **discriminant** \(\Delta = b^2 - 4ac\) tells you how many real roots there are.

### Essential Formulas
\[ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} \]

### Worked Examples
1. Solve \(x^2 - 9 = 0\): \(x = \pm 3\).

### Common Mistakes
- Forgetting the \(\pm\).

### Quick Summary
- Factor when you can, otherwise use the formula.`;

const NOTES = String.raw`# Derivatives and the Power Rule

### Summary
The lecture introduced the derivative as the slope of the tangent line and derived the power rule.

### Key Concepts
- The derivative \(f'(x)\) measures the instantaneous rate of change.

### Formulas & Equations
\[ f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h} \qquad \frac{d}{dx} x^n = n x^{n-1} \]

### Worked Examples
1. \(\frac{d}{dx} x^3 = 3x^2\)

### Review Questions
1. What is \(\frac{d}{dx} x^5\)? — \(5x^4\)`;

const TOOLS = {
  'practice-question': {
    topic: 'Quadratic equations',
    difficulty: 'medium',
    question: 'Which values of \\(x\\) solve \\(x^2 - 7x + 10 = 0\\)?',
    choices: ['\\(x = 2\\) and \\(x = 5\\)', '\\(x = -2\\) and \\(x = -5\\)', '\\(x = 1\\) and \\(x = 10\\)', '\\(x = 7\\) only'],
    answerIndex: 0,
    hint: 'Find two numbers that multiply to 10 and add to 7.',
    explanation: 'Factor: \\(x^2 - 7x + 10 = (x-2)(x-5)\\), so \\(x = 2\\) or \\(x = 5\\). Choice B flips the signs.',
  },
  'practice-test': {
    title: 'Derivatives Practice Test',
    topic: 'Derivatives',
    questions: [
      {
        question: '\\(\\frac{d}{dx} x^4 = \\)?',
        choices: ['\\(4x^3\\)', '\\(x^3\\)', '\\(4x^4\\)', '\\(3x^4\\)'],
        answerIndex: 0,
        explanation: 'Power rule: \\(nx^{n-1}\\).',
      },
      {
        question: '\\(\\frac{d}{dx} \\sin x = \\)?',
        choices: ['\\(-\\cos x\\)', '\\(\\cos x\\)', '\\(\\sin x\\)', '\\(-\\sin x\\)'],
        answerIndex: 1,
        explanation: 'The derivative of sine is cosine.',
      },
      {
        question: '\\(\\frac{d}{dx} e^{2x} = \\)?',
        choices: ['\\(e^{2x}\\)', '\\(2e^{x}\\)', '\\(2e^{2x}\\)', '\\(e^{x}\\)'],
        answerIndex: 2,
        explanation: 'Chain rule gives \\(2e^{2x}\\).',
      },
      {
        question: '\\(\\frac{d}{dx} \\ln x = \\)?',
        choices: ['\\(x\\)', '\\(\\ln x\\)', '\\(e^x\\)', '1/x'],
        answerIndex: 3,
        explanation: 'Standard derivative.',
      },
    ],
  },
  flashcards: {
    title: 'Trigonometric Identities',
    cards: [
      { front: 'Pythagorean identity', back: '\\(\\sin^2\\theta + \\cos^2\\theta = 1\\)' },
      { front: 'Double angle for sine', back: '\\(\\sin 2\\theta = 2\\sin\\theta\\cos\\theta\\)' },
      { front: 'Tangent in terms of sine and cosine', back: '\\(\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}\\)' },
      { front: 'Double angle for cosine', back: '\\(\\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta\\)' },
      { front: 'Sum formula for sine', back: '\\(\\sin(a+b) = \\sin a\\cos b + \\cos a\\sin b\\)' },
      { front: 'Reciprocal identity', back: 'csc x = 1/sin x' },
    ],
  },
  graph: {
    title: 'Parabola y = x^2 - 4 and line y = x + 2',
    functions: [
      { expr: 'x^2 - 4', label: 'y = x^2 - 4' },
      { expr: 'x + 2', label: 'y = x + 2' },
    ],
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 10,
    points: [
      { x: -2, y: 0, label: '(-2, 0)' },
      { x: 3, y: 5, label: '(3, 5)' },
      { x: 0, y: -4, label: 'vertex (0, -4)' },
    ],
    explanation: 'The parabola opens upward with vertex \\((0,-4)\\). It meets the line at \\((-2, 0)\\) and \\((3, 5)\\).',
  },
  video: {
    title: 'The Pythagorean Theorem',
    scenes: [
      {
        heading: 'Right triangles',
        body: '- Two legs: \\(a\\) and \\(b\\)\n- Hypotenuse: \\(c\\), opposite the right angle',
        narration: 'Every right triangle has two legs and a longest side called the hypotenuse.',
      },
      {
        heading: 'The big idea',
        body: '\\[a^2 + b^2 = c^2\\]',
        narration: 'The squares of the legs add up to the square of the hypotenuse.',
      },
      {
        heading: 'Worked example',
        body: '\\[3^2 + 4^2 = 9 + 16 = 25 = 5^2\\]',
        narration: 'With legs three and four, the hypotenuse is five.',
      },
      {
        heading: 'Recap',
        body: '- Only for right triangles\n- \\(c\\) is always the longest side',
        narration: 'Remember, it only works for right triangles.',
      },
    ],
  },
  flowchart: {
    title: 'Solving a Quadratic Equation',
    nodes: [
      { id: 's', label: 'Start with ax² + bx + c = 0', shape: 'start' },
      { id: 'd', label: 'Compute the discriminant b^2 - 4ac', shape: 'process' },
      { id: 'q', label: 'Discriminant ≥ 0?', shape: 'decision' },
      { id: 'r', label: 'Use the quadratic formula', shape: 'process' },
      { id: 'n', label: 'No real roots', shape: 'io' },
      { id: 'e', label: 'Done', shape: 'end' },
    ],
    edges: [
      { from: 's', to: 'd' },
      { from: 'd', to: 'q' },
      { from: 'q', to: 'r', label: 'Yes' },
      { from: 'q', to: 'n', label: 'No' },
      { from: 'r', to: 'e' },
      { from: 'n', to: 'e' },
    ],
    caption: 'Check the discriminant first to know whether real roots exist.',
  },
  mindmap: {
    title: 'Cell Biology',
    root: {
      label: 'The Cell',
      children: [
        { label: 'Nucleus', children: [{ label: 'DNA storage' }, { label: 'Transcription' }] },
        { label: 'Mitochondria', children: [{ label: 'ATP production' }] },
        { label: 'Membrane', children: [{ label: 'Phospholipid bilayer' }, { label: 'Transport' }] },
      ],
    },
    caption: 'Main organelles and their roles.',
  },
  venn: {
    title: 'Mitosis vs Meiosis',
    sets: ['Mitosis', 'Meiosis'],
    regions: [
      { sets: [0], items: ['2 daughter cells', 'Identical cells'] },
      { sets: [1], items: ['4 daughter cells', 'Crossing over'] },
      { sets: [0, 1], items: ['DNA replicates first', 'PMAT stages'] },
    ],
    caption: 'Both divide cells, but meiosis halves the chromosome number.',
  },
  geometry: {
    title: 'Right Triangle',
    svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><polygon points='60,250 340,250 60,60' fill='#e8f2fc' stroke='#1f2937' stroke-width='2'/><rect x='60' y='230' width='20' height='20' fill='none' stroke='#1f2937' stroke-width='2'/><text x='200' y='280' font-family='Arial' font-size='16' text-anchor='middle'>a = 4</text><text x='35' y='160' font-family='Arial' font-size='16' text-anchor='middle'>b = 3</text><text x='215' y='145' font-family='Arial' font-size='16' text-anchor='middle'>c = 5</text><text x='300' y='238' font-family='Arial' font-size='15' text-anchor='end'>\\theta ≈ 37^\\circ</text></svg>",
    caption: 'A 3-4-5 right triangle.',
  },
};

function pickTool(system, user) {
  if (system.includes('ONE exam-style multiple-choice')) return 'practice-question';
  if (system.includes('practice test of')) return 'practice-test';
  if (system.includes('flashcards')) return 'flashcards';
  if (system.includes('graph of one to four functions')) return 'graph';
  if (system.includes('video lesson')) return 'video';
  const diagram = /Diagram type: ([a-z-]+)/.exec(user)?.[1];
  if (diagram) return TOOLS[diagram] ? diagram : 'geometry';
  return null;
}

function chunks(text, size = 6) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function stream(res, { reasoning = '', content, model }) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  res.write(': keep-alive\n\n');
  for (const piece of chunks(reasoning, 8)) {
    send({ model, choices: [{ index: 0, delta: { reasoning_content: piece } }] });
    await sleep(DELAY);
  }
  for (const piece of chunks(content)) {
    send({ model, choices: [{ index: 0, delta: { content: piece } }] });
    await sleep(DELAY);
  }
  send({ model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
  send({ model, choices: [], usage: { prompt_tokens: 120, completion_tokens: Math.round(content.length / 4) } });
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    });
    return res.end();
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;

  if (req.url?.endsWith('/audio/transcriptions')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(
      JSON.stringify({ text: 'Today we talk about derivatives. The derivative of x to the n is n x to the n minus one.' }),
    );
  }
  if (!req.url?.endsWith('/chat/completions') || req.method !== 'POST') {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: { message: 'Not found' } }));
  }

  const body = JSON.parse(raw || '{}');
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ') || auth === 'Bearer ') {
    res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: { message: 'Authentication Fails (no such user)' } }));
  }

  const system = body.messages?.find((m) => m.role === 'system')?.content ?? '';
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
  const userText =
    typeof lastUser?.content === 'string'
      ? lastUser.content
      : (lastUser?.content ?? []).map((p) => p.text ?? '[image]').join(' ');
  const thinking = body.thinking?.type === 'enabled';
  const model = body.model ?? 'deepseek-flash';
  console.log(
    `[mock] ${model} thinking=${thinking} json=${!!body.response_format} :: ${userText.slice(0, 70).replace(/\n/g, ' ')}`,
  );

  if (system.includes('short title')) return stream(res, { content: 'Solving x^2 - 5x + 6 = 0', model });
  const thought = (text) => (thinking ? text : '');
  if (system.includes('examiner')) {
    // Answer-key check: agree with the canned keys.
    const known = [TOOLS['practice-question'], ...TOOLS['practice-test'].questions];
    const answers = [...userText.matchAll(/Question (\d+): ([^\n]*)/g)].map(([, n, text]) => {
      const match = known.find((q) => q.question === text);
      return { q: Number(n), answer: match ? 'ABCD'[match.answerIndex] : 'A' };
    });
    return stream(res, { reasoning: thought('Solving each question independently.'), content: JSON.stringify({ answers }), model });
  }
  if (system.includes('note-taker')) return stream(res, { reasoning: thought(NOTES_REASONING), content: NOTES, model });
  if (system.includes('study guide')) return stream(res, { reasoning: thought(TOOL_REASONING), content: STUDY_GUIDE, model });
  if (body.response_format?.type === 'json_object' || system.includes('single valid JSON object')) {
    const tool = pickTool(system, userText) ?? 'practice-question';
    return stream(res, { reasoning: thought(TOOL_REASONING), content: JSON.stringify(TOOLS[tool], null, 1), model });
  }
  return stream(res, { reasoning: thinking ? REASONING : '', content: ANSWER, model });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mock DeepSeek API on http://localhost:${PORT}`));

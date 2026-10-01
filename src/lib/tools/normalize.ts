import type { DiagramKind } from '@/constants/tools';
import { prettifyMarkdown, splitMath, toUnicodeMath } from '@/lib/math';
import { tryCompileExpr } from '@/lib/mathExpr';
import type {
  DiagramSpec,
  FlashcardDeck,
  FlowEdge,
  FlowNode,
  GraphSpec,
  MindNode,
  MultipleChoiceQuestion,
  PracticeQuestion,
  PracticeTest,
  VennRegion,
  VideoLesson,
} from '@/lib/types';

/**
 * Model JSON is "mostly right". These normalizers accept the common variations
 * (letters vs indexes, objects vs strings, missing optional fields) and throw a
 * readable error only when the result would be unusable.
 */

export class ArtifactError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : fallback;
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Titles and labels are shown as plain text (native headers, SVG), so their math becomes Unicode: "x^2 - 4" → "x² − 4". */
const label = (v: unknown, fallback = ''): string => toUnicodeMath(str(v, fallback));

/** Finds the first array-valued field among `keys` (models sometimes rename fields). */
function pickArray(raw: Obj, keys: string[]): unknown[] {
  for (const key of keys) if (Array.isArray(raw[key])) return raw[key] as unknown[];
  return [];
}

const CHOICE_PREFIX = /^\s*(?:\(?[A-Ha-h][).:]|[A-Ha-h]\s*[-–]\s)\s*/;

function normalizeChoices(raw: unknown): string[] {
  if (isObj(raw)) {
    // {"A": "...", "B": "..."}
    return Object.keys(raw)
      .sort()
      .map((k) => str(raw[k]))
      .filter(Boolean);
  }
  return arr(raw)
    .map((c) => (isObj(c) ? str(c.text ?? c.choice ?? c.label ?? c.value) : str(c)))
    .map((c) => c.replace(CHOICE_PREFIX, ''))
    .filter(Boolean);
}

function resolveAnswerIndex(q: Obj, choices: string[]): number {
  const n = choices.length;
  const direct = num(q.answerIndex ?? q.answer_index ?? q.correctIndex ?? q.correct_index);
  if (direct !== undefined) {
    if (direct >= 0 && direct < n && Number.isInteger(direct)) return direct;
    if (direct === n) return n - 1; // 1-based slip on the last option
  }
  const answer = q.answer ?? q.correct ?? q.correctAnswer ?? q.correct_answer;
  if (typeof answer === 'number' && answer >= 0 && answer < n) return answer;
  if (typeof answer === 'string') {
    const letter = /^\(?([A-Ha-h])[).:]?$/.exec(answer.trim());
    if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
    const text = answer.replace(CHOICE_PREFIX, '').trim().toLowerCase();
    const match = choices.findIndex((c) => c.trim().toLowerCase() === text);
    if (match !== -1) return match;
  }
  return -1;
}

function normalizeMCQ(raw: unknown): MultipleChoiceQuestion | null {
  if (!isObj(raw)) return null;
  const question = str(raw.question ?? raw.prompt ?? raw.stem);
  const choices = normalizeChoices(raw.choices ?? raw.options ?? raw.answers);
  if (!question || choices.length < 2) return null;
  const answerIndex = resolveAnswerIndex(raw, choices);
  if (answerIndex < 0 || answerIndex >= choices.length) return null;
  return {
    question,
    choices: choices.slice(0, 6),
    answerIndex,
    explanation: str(raw.explanation ?? raw.solution ?? raw.rationale, 'No explanation provided.'),
    hint: str(raw.hint) || undefined,
  };
}

export function normalizePracticeQuestion(raw: unknown, topic: string): PracticeQuestion {
  const source = isObj(raw) && isObj(raw.question) ? raw.question : raw;
  const q = normalizeMCQ(source);
  if (!q) throw new ArtifactError('The practice question came back incomplete. Try again.');
  const difficulty = str(isObj(raw) ? raw.difficulty : '').toLowerCase();
  return {
    ...q,
    topic: label(isObj(raw) ? raw.topic : '', topic) || label(topic),
    difficulty: difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium',
  };
}

export function normalizePracticeTest(raw: unknown, topic: string): PracticeTest {
  if (!isObj(raw)) throw new ArtifactError('The practice test came back in an unexpected format.');
  const questions = pickArray(raw, ['questions', 'items', 'test'])
    .map(normalizeMCQ)
    .filter((q): q is MultipleChoiceQuestion => q !== null)
    .slice(0, 30);
  if (questions.length === 0) throw new ArtifactError('The practice test had no usable questions. Try again.');
  return { title: label(raw.title, `Practice Test: ${topic}`), topic: label(raw.topic, topic), questions };
}

export function normalizeFlashcards(raw: unknown, topic: string): FlashcardDeck {
  if (!isObj(raw)) throw new ArtifactError('The flashcards came back in an unexpected format.');
  const cards = pickArray(raw, ['cards', 'flashcards', 'items'])
    .map((c) => {
      if (!isObj(c)) return null;
      const front = str(c.front ?? c.term ?? c.question ?? c.q);
      const back = str(c.back ?? c.definition ?? c.answer ?? c.a);
      return front && back ? { front, back } : null;
    })
    .filter((c): c is { front: string; back: string } => c !== null)
    .slice(0, 60);
  if (cards.length === 0) throw new ArtifactError('No flashcards were generated. Try a more specific topic.');
  return { title: label(raw.title, topic), cards };
}

export function normalizeGraph(raw: unknown, topic: string): GraphSpec {
  if (!isObj(raw)) throw new ArtifactError('The graph came back in an unexpected format.');
  const functions = pickArray(raw, ['functions', 'curves', 'equations'])
    .map((f) => {
      const expr = isObj(f) ? str(f.expr ?? f.expression ?? f.equation ?? f.fn) : str(f);
      if (!expr || !tryCompileExpr(expr)) return null;
      const legend = isObj(f) ? str(f.label ?? f.name) : '';
      return { expr, label: legend || `y = ${expr}` };
    })
    .filter((f): f is { expr: string; label: string } => f !== null)
    .slice(0, 6);
  if (functions.length === 0)
    throw new ArtifactError("I couldn't turn that into a plottable function. Try writing it like y = x^2 - 4.");

  let xMin = num(raw.xMin ?? raw.x_min) ?? -10;
  let xMax = num(raw.xMax ?? raw.x_max) ?? 10;
  if (!(xMax > xMin)) [xMin, xMax] = [-10, 10];
  let yMin = num(raw.yMin ?? raw.y_min);
  let yMax = num(raw.yMax ?? raw.y_max);
  if (yMin !== undefined && yMax !== undefined && !(yMax > yMin)) yMin = yMax = undefined;

  const points = pickArray(raw, ['points', 'keyPoints', 'key_points'])
    .map((p) => {
      if (!isObj(p)) return null;
      const x = num(p.x);
      const y = num(p.y);
      return x === undefined || y === undefined ? null : { x, y, label: label(p.label) || undefined };
    })
    .filter((p): p is { x: number; y: number; label: string | undefined } => p !== null)
    .slice(0, 12);

  return {
    title: label(raw.title, topic),
    functions,
    points,
    xMin,
    xMax,
    yMin,
    yMax,
    explanation: str(raw.explanation ?? raw.description),
  };
}

/* ---------- Diagrams ---------- */

const SHAPES: FlowNode['shape'][] = ['start', 'end', 'process', 'decision', 'io'];

function normalizeFlowchart(raw: Obj, title: string, caption: string): DiagramSpec {
  const seen = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const n of pickArray(raw, ['nodes', 'steps'])) {
    if (!isObj(n)) continue;
    const id = str(n.id ?? n.key ?? n.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const shape = str(n.shape ?? n.type).toLowerCase() as FlowNode['shape'];
    nodes.push({ id, label: label(n.label ?? n.text ?? n.title, id), shape: SHAPES.includes(shape) ? shape : 'process' });
    if (nodes.length >= 30) break;
  }
  const edges = pickArray(raw, ['edges', 'links', 'connections'])
    .map((e): FlowEdge | null => {
      if (!isObj(e)) return null;
      const from = str(e.from ?? e.source);
      const to = str(e.to ?? e.target);
      if (!seen.has(from) || !seen.has(to) || from === to) return null;
      return { from, to, label: label(e.label) || undefined };
    })
    .filter((e): e is FlowEdge => e !== null);
  if (nodes.length < 2)
    throw new ArtifactError('The flowchart needs at least two steps. Try describing the process in more detail.');
  return { type: 'flowchart', title, nodes, edges, caption };
}

function normalizeMindNode(raw: unknown, depth: number): MindNode | null {
  if (typeof raw === 'string') return raw.trim() ? { label: label(raw), children: [] } : null;
  if (!isObj(raw)) return null;
  const text = label(raw.label ?? raw.text ?? raw.title ?? raw.name);
  if (!text) return null;
  const children =
    depth >= 3
      ? []
      : arr(raw.children ?? raw.branches ?? raw.subtopics)
          .map((c) => normalizeMindNode(c, depth + 1))
          .filter((c): c is MindNode => c !== null)
          .slice(0, 8);
  return { label: text, children };
}

function normalizeVenn(raw: Obj, title: string, caption: string): DiagramSpec {
  const sets = arr(raw.sets)
    .map((s) => (isObj(s) ? label(s.label ?? s.name) : label(s)))
    .filter(Boolean)
    .slice(0, 3);
  if (sets.length < 2) throw new ArtifactError('A Venn diagram needs two or three sets.');
  const indexOf = (v: unknown) => {
    if (typeof v === 'number') return v;
    const s = label(v).toLowerCase();
    const byLabel = sets.findIndex((name) => name.toLowerCase() === s);
    if (byLabel !== -1) return byLabel;
    return /^[a-c]$/.test(s) ? s.charCodeAt(0) - 97 : -1;
  };
  const regions: VennRegion[] = arr(raw.regions)
    .map((r) => {
      if (!isObj(r)) return null;
      const members = [...new Set(arr(r.sets ?? r.in).map(indexOf))].filter((i) => i >= 0 && i < sets.length).sort();
      const items = arr(r.items ?? r.elements)
        .map((i) => label(i))
        .filter(Boolean)
        .slice(0, 8);
      return members.length > 0 && items.length > 0 ? { sets: members, items } : null;
    })
    .filter((r): r is VennRegion => r !== null);
  return { type: 'venn', title, sets, regions, caption };
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encodeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Labels drawn by the model ("x^2", "\\theta", "$F_g$") read better as Unicode: x², θ, F_g. */
function prettifySvgText(svg: string): string {
  return svg.replace(/(<(?:text|tspan)\b[^>]*>)([^<]+)/g, (match, open: string, content: string) => {
    const text = decodeXml(content);
    const pretty = toUnicodeMath(text);
    return pretty === text ? match : open + encodeXml(pretty);
  });
}

/** Defense in depth: the SVG is shown as an <img>, which never runs scripts, but strip active content anyway. */
export function sanitizeSvg(svg: string): string {
  let out = svg.trim();
  const start = out.search(/<svg[\s>]/i);
  const end = out.toLowerCase().lastIndexOf('</svg>');
  if (start === -1 || end === -1) throw new ArtifactError('The diagram came back without a drawing. Try again.');
  out = out.slice(start, end + 6);
  out = out
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*(?:javascript|https?):[^"']*\2/gi, '');
  if (!/xmlns=/.test(out.slice(0, out.indexOf('>')))) out = out.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return prettifySvgText(out);
}

export function normalizeDiagram(raw: unknown, kind: DiagramKind, topic: string): DiagramSpec {
  if (!isObj(raw)) throw new ArtifactError('The diagram came back in an unexpected format.');
  const title = label(raw.title, topic);
  const caption = str(raw.caption ?? raw.explanation ?? raw.description);
  switch (kind) {
    case 'flowchart':
      return normalizeFlowchart(raw, title, caption);
    case 'mindmap': {
      const root = normalizeMindNode(raw.root ?? raw.map ?? { label: title, children: raw.children }, 0);
      if (!root || root.children.length === 0) throw new ArtifactError('The mind map came back empty. Try a broader topic.');
      return { type: 'mindmap', title, root, caption };
    }
    case 'venn':
      return normalizeVenn(raw, title, caption);
    default:
      return { type: 'svg', kind, title, svg: sanitizeSvg(str(raw.svg)), caption };
  }
}

/* ---------- Video ---------- */

const SPOKEN: Record<string, string> = {
  times: 'times',
  cdot: 'times',
  div: 'divided by',
  pm: 'plus or minus',
  mp: 'minus or plus',
  le: 'is less than or equal to',
  leq: 'is less than or equal to',
  ge: 'is greater than or equal to',
  geq: 'is greater than or equal to',
  ne: 'is not equal to',
  neq: 'is not equal to',
  approx: 'is approximately',
  equiv: 'is equivalent to',
  to: 'approaches',
  rightarrow: 'gives',
  Rightarrow: 'implies',
  implies: 'implies',
  infty: 'infinity',
  sum: 'the sum of',
  int: 'the integral of',
  lim: 'the limit',
  partial: 'partial',
  angle: 'angle',
  triangle: 'triangle',
  perp: 'is perpendicular to',
  parallel: 'is parallel to',
  sin: 'sine',
  cos: 'cosine',
  tan: 'tangent',
  ln: 'natural log',
  log: 'log',
  ldots: 'and so on',
  cdots: 'and so on',
};
const GREEK_NAMES =
  /^(?:alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|varphi|omega|Delta|Sigma|Omega|Theta|Phi)$/;

/** Reads one math span the way a teacher would say it: \\frac{6}{4} → "6 over 4", x^2 → "x squared". */
function speakTeX(tex: string): string {
  let s = tex.replace(/\\%/g, ' percent ');
  for (let pass = 0; pass < 4; pass++) {
    s = s
      .replace(/\\[dtc]?frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 over $2 ')
      .replace(/\\sqrt\{([^{}]*)\}/g, ' the square root of $1 ')
      .replace(/\\(?:text|mathrm|mathbf|operatorname|boxed|ce)\{([^{}]*)\}/g, ' $1 ');
  }
  return s
    .replace(/\^\{?\\circ\}?/g, ' degrees ')
    .replace(/\^\{?2\}?(?!\d)/g, ' squared ')
    .replace(/\^\{?3\}?(?!\d)/g, ' cubed ')
    .replace(/\^\{([^{}]*)\}|\^(\w)/g, (_, braced?: string, single?: string) => ` to the power ${braced ?? single} `)
    .replace(/_\{([^{}]*)\}|_(\w)/g, (_, braced?: string, single?: string) => ` sub ${braced ?? single} `)
    .replace(/\\([A-Za-z]+)/g, (_, name: string) =>
      Object.prototype.hasOwnProperty.call(SPOKEN, name)
        ? ` ${SPOKEN[name]} `
        : GREEK_NAMES.test(name)
          ? ` ${name.toLowerCase()} `
          : ' ',
    )
    .replace(/-/g, ' minus ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/</g, ' is less than ')
    .replace(/>/g, ' is greater than ')
    .replace(/\\./g, ' ')
    .replace(/[{}&]/g, ' ');
}

/** Plain spoken version of markdown + LaTeX, for "Read aloud" and narration fallbacks. */
export function speakable(markdown: string): string {
  return splitMath(prettifyMarkdown(markdown))
    .map((piece) => (piece.type === 'math' ? ` ${speakTeX(piece.tex)} ` : piece.text))
    .join('')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export function normalizeVideo(raw: unknown, topic: string): VideoLesson {
  if (!isObj(raw)) throw new ArtifactError('The video script came back in an unexpected format.');
  const scenes = pickArray(raw, ['scenes', 'slides', 'steps'])
    .map((s) => {
      if (!isObj(s)) return null;
      const heading = label(s.heading ?? s.title);
      const body = str(s.body ?? s.content ?? s.text);
      const narration = str(s.narration ?? s.voiceover ?? s.script) || speakable(`${heading}. ${body}`);
      return heading || body ? { heading, body, narration } : null;
    })
    .filter((s): s is { heading: string; body: string; narration: string } => s !== null)
    .slice(0, 14);
  if (scenes.length === 0) throw new ArtifactError('The video lesson came back empty. Try again.');
  return { title: label(raw.title, topic), scenes };
}

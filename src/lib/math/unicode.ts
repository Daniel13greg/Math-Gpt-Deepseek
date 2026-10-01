/**
 * TeX → readable Unicode for places that can't run KaTeX: native titles, SVG labels.
 * "\frac{6}{4}" → "⁶⁄₄", "\frac{1}{2}" → "½", "x^2 - 4" → "x² − 4", "\sqrt{x+1}" → "√(x + 1)", "\ce{H2O}" → "H₂O".
 */
import { splitMath } from './segment';
import { OPERATOR_NAMES, SUBSCRIPT, SUPERSCRIPT, TEX_FUNCTIONS, TEX_SYMBOLS, toScript, VULGAR_FRACTIONS } from './symbols';
import { texTokens, type TexToken } from './tex';

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

const ACCENTS: Record<string, string> = {
  bar: '̄',
  overline: '̅',
  hat: '̂',
  widehat: '̂',
  vec: '⃗',
  overrightarrow: '⃗',
  dot: '̇',
  ddot: '̈',
  tilde: '̃',
  widetilde: '̃',
};
/** Commands whose argument is shown as is. */
const CONTENT = new Set(
  'text textrm textbf textit textsf texttt textnormal emph mathrm mathbf mathit mathsf mathtt mathcal boldsymbol bm operatorname mbox hbox boxed underline cancel'.split(
    ' ',
  ),
);
const DROP_ARG = new Set('label tag hspace vspace phantom vphantom hphantom color begin end'.split(' '));
const SIZING = /^(?:left|right|middle|[bB]igg?[lrm]?)$/;
const DOUBLE_STRUCK: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };
const ESCAPES: Record<string, string> = { ',': ' ', ';': ' ', ':': ' ', ' ': ' ', '!': '', '\\': ' ', '|': '‖' };
const DELIMS: Record<string, string> = {
  '.': '',
  '\\{': '{',
  '\\}': '}',
  '\\|': '‖',
  '\\langle': '⟨',
  '\\rangle': '⟩',
  '\\lvert': '|',
  '\\rvert': '|',
};
const OPERATOR = /[\s+\-−=<>±∓×÷·/,]/;

function fraction(num: string, den: string): string {
  const n = num.trim();
  const d = den.trim();
  if (has(VULGAR_FRACTIONS, `${n}/${d}`)) return VULGAR_FRACTIONS[`${n}/${d}`];
  if (/^\d+$/.test(n) && /^\d+$/.test(d)) return `${toScript(n, SUPERSCRIPT)}⁄${toScript(d, SUBSCRIPT)}`;
  // dy/dx reads fine; 2a or x + 1 underneath needs parentheses.
  const wrapDen = OPERATOR.test(d) || (/[\dA-Za-zͰ-Ͽ].*[A-Za-zͰ-Ͽ]/.test(d) && !/^d[A-Za-z]$/.test(d));
  return `${OPERATOR.test(n) ? `(${n})` : n}/${wrapDen ? `(${d})` : d}`;
}

function root(arg: string, index: string): string {
  const sign = index === '' ? '√' : index === '3' ? '∛' : index === '4' ? '∜' : `${toScript(index, SUPERSCRIPT) ?? index}√`;
  return OPERATOR.test(arg) || (arg.length > 2 && !/^\d+$/.test(arg)) ? `${sign}(${arg.trim()})` : `${sign}${arg}`;
}

function script(base: string, arg: string, sup: boolean): string {
  const value = arg.trim();
  if (sup && (value === '∘' || value === '°')) return `${base}°`;
  if (sup && /^′+$/.test(value)) return base + value;
  const mapped = toScript(value, sup ? SUPERSCRIPT : SUBSCRIPT);
  if (mapped) return base + mapped;
  return `${base}${sup ? '^' : '_'}${value.length === 1 ? value : `(${value})`}`;
}

/** mhchem-style formulas: H2O → H₂O, SO4^{2-} → SO₄²⁻, -> → →. */
function chemistry(src: string): string {
  return src
    .replace(/<=>/g, '⇌')
    .replace(/<->/g, '↔')
    .replace(/->/g, '→')
    .replace(/<-/g, '←')
    .replace(/\^\{([^}]*)\}|\^(\d*[+-])/g, (_, braced?: string, bare?: string) => {
      const charge = braced ?? bare ?? '';
      return toScript(charge, SUPERSCRIPT) ?? `^${charge}`;
    })
    .replace(/([A-Za-z)\]])(\d+)/g, (_, el: string, n: string) => el + toScript(n, SUBSCRIPT));
}

/** Renders the argument starting at `j` (a group, command or single token). */
function arg(toks: TexToken[], j: number): [string, number] {
  while (toks[j]?.type === 'space') j++;
  const t = toks[j];
  if (!t) return ['', j];
  if (t.type === 'group') return [render(texTokens(t.value)), j + 1];
  return one(toks, j);
}

function rawArg(toks: TexToken[], j: number): [string, number] {
  while (toks[j]?.type === 'space') j++;
  const t = toks[j];
  if (!t) return ['', j];
  return [t.type === 'group' ? t.value : t.text, j + 1];
}

/** Renders one unit starting at `i`; returns the text and the index after it. */
function one(toks: TexToken[], i: number): [string, number] {
  const t = toks[i];
  if (t.type === 'space') return [' ', i + 1];
  if (t.type === 'group') return [render(texTokens(t.value)), i + 1];
  if (t.type !== 'cmd') {
    const c = t.text;
    return [c === '-' ? '−' : c === '*' ? '·' : c === "'" ? '′' : c === '~' ? ' ' : c === '&' ? ' ' : c, i + 1];
  }
  const name = t.value;
  if (SIZING.test(name)) {
    const delim = t.text.replace(/^\\[A-Za-z]+\s*/, '');
    return [has(DELIMS, delim) ? DELIMS[delim] : has(TEX_SYMBOLS, delim.slice(1)) ? TEX_SYMBOLS[delim.slice(1)] : delim, i + 1];
  }
  if (has(ESCAPES, name)) return [ESCAPES[name], i + 1];
  if (name.length === 1) return [name, i + 1]; // \{ \} \% \$ \& \# \_
  if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
    const [num, a] = arg(toks, i + 1);
    const [den, b] = arg(toks, a);
    return [fraction(num, den), b];
  }
  if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
    const [n, a] = arg(toks, i + 1);
    const [k, b] = arg(toks, a);
    return [`C(${n}, ${k})`, b];
  }
  if (name === 'sqrt') {
    let j = i + 1;
    let index = '';
    if (toks[j]?.text === '[') {
      let k = j + 1;
      while (k < toks.length && toks[k].text !== ']') index += toks[k++].text;
      j = k + 1;
    }
    const [value, end] = arg(toks, j);
    return [root(value, index), end];
  }
  if (has(ACCENTS, name)) {
    const [value, end] = arg(toks, i + 1);
    return [[...value].map((ch) => (ch.trim() ? ch + ACCENTS[name] : ch)).join(''), end];
  }
  if (name === 'mathbb') {
    const [value, end] = rawArg(toks, i + 1);
    return [[...value].map((ch) => (has(DOUBLE_STRUCK, ch) ? DOUBLE_STRUCK[ch] : ch)).join(''), end];
  }
  if (name === 'ce' || name === 'pu') {
    const [value, end] = rawArg(toks, i + 1);
    return [chemistry(value), end];
  }
  if (name === 'textcolor') return arg(toks, rawArg(toks, i + 1)[1]);
  if (CONTENT.has(name) || name === 'operatorname*') return arg(toks, i + 1);
  if (DROP_ARG.has(name)) {
    let end = rawArg(toks, i + 1)[1];
    if (name === 'begin' && toks[end]?.type === 'group' && /^[lcr|]+$/.test(toks[end].value)) end++; // array column spec
    return ['', end];
  }
  if (name === 'not') {
    const [value, end] = one(toks, i + 1);
    return [`${value}̸`, end];
  }
  if (has(TEX_SYMBOLS, name)) return [TEX_SYMBOLS[name], i + 1];
  if (TEX_FUNCTIONS.has(name) || OPERATOR_NAMES.has(name)) {
    // "\sin\theta" → "sin θ", "\sin(x)" → "sin(x)"
    const next = toks[i + 1];
    const spaced =
      next && (next.type === 'letter' || next.type === 'num' || (next.type === 'cmd' && has(TEX_SYMBOLS, next.value)));
    return [spaced ? `${name} ` : name, i + 1];
  }
  if (/^(?:displaystyle|textstyle|scriptstyle|limits|nolimits|nonumber|notag)$/.test(name)) return ['', i + 1];
  return [name, i + 1];
}

function render(toks: TexToken[]): string {
  let out = '';
  for (let i = 0; i < toks.length; ) {
    const t = toks[i];
    if (t.type === 'char' && (t.text === '^' || t.text === '_')) {
      const [value, end] = arg(toks, i + 1);
      out = script(out, value, t.text === '^');
      i = end;
      continue;
    }
    const [text, end] = one(toks, i);
    out += text;
    i = end;
  }
  return out;
}

/** Spaces binary operators the way they're printed: "x²−5x+6=0" → "x² − 5x + 6 = 0", keeping "−3" and "(−b". */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*([=<>≤≥≠≈≡→⇒⇔⇌×÷])\s*/g, ' $1 ')
    .replace(/\s*·\s*/g, '·')
    .replace(/(\S?)(\s*)([+−±∓])\s*/g, (_, before: string, gap: string, op: string) =>
      !before || /[(=<>≤≥≠≈≡→⇒⇔⇌±∓×÷,[{^_]/.test(before) ? `${before}${gap}${op}` : `${before} ${op} `,
    )
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

export function texToUnicode(tex: string): string {
  try {
    return tidy(render(texTokens(tex)));
  } catch {
    return tex;
  }
}

/** Plain text with any math in it (TeX or plain-text math) rewritten as Unicode. */
export function toUnicodeMath(text: string): string {
  if (!text) return text;
  return splitMath(text)
    .map((piece) => (piece.type === 'text' ? piece.text : texToUnicode(piece.tex)))
    .join('');
}

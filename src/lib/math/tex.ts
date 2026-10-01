/**
 * Cleans up TeX before KaTeX sees it, so math written loosely still renders properly:
 * "6/4" → \frac{6}{4}, "<=" → \le, "sqrt(x)" → \sqrt{x}, "e^(2x)" → e^{2x}, "x²" → x^{2}, "π" → \pi.
 */
import { FROM_SUBSCRIPT, FROM_SUPERSCRIPT, FROM_VULGAR, GREEK, OPERATOR_NAMES, TEX_FUNCTIONS, UNICODE_TO_TEX } from './symbols';

export interface TexToken {
  type: 'cmd' | 'group' | 'num' | 'letter' | 'space' | 'char';
  /** Source text of the token. */
  text: string;
  /** Command name without the backslash (cmd) or the content between the braces (group). */
  value: string;
}

const CMD_RE = /\\([A-Za-z]+\*?|[^A-Za-z])/y;
const DELIM_RE = /\s*(?:\\[A-Za-z]+|\\[^A-Za-z]|[^\s\\])/y;
const NUM_RE = /\d+(?:\.\d+)?/y;
const SPACE_RE = /\s+/y;
/** Commands whose delimiter belongs to them (\left( … \right)). */
const SIZED = /^(?:left|right|middle|[bB]igg?[lrm]?)$/;

/** Index of the "}" closing the "{" at `open`, or -1. */
export function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

export function texTokens(src: string): TexToken[] {
  const out: TexToken[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      CMD_RE.lastIndex = i;
      const m = CMD_RE.exec(src);
      if (m) {
        let text = m[0];
        i += text.length;
        if (SIZED.test(m[1])) {
          DELIM_RE.lastIndex = i;
          const d = DELIM_RE.exec(src);
          if (d) {
            text += d[0];
            i += d[0].length;
          }
        }
        out.push({ type: 'cmd', text, value: m[1] });
        continue;
      }
    } else if (c === '{') {
      const end = matchBrace(src, i);
      if (end !== -1) {
        out.push({ type: 'group', text: src.slice(i, end + 1), value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (c >= '0' && c <= '9') {
      NUM_RE.lastIndex = i;
      const text = NUM_RE.exec(src)![0];
      out.push({ type: 'num', text, value: text });
      i += text.length;
      continue;
    } else if (/\s/.test(c)) {
      SPACE_RE.lastIndex = i;
      const text = SPACE_RE.exec(src)![0];
      out.push({ type: 'space', text, value: text });
      i += text.length;
      continue;
    } else if (/[A-Za-z]/.test(c)) {
      out.push({ type: 'letter', text: c, value: c });
      i++;
      continue;
    }
    const ch = String.fromCodePoint(src.codePointAt(i)!);
    out.push({ type: 'char', text: ch, value: ch });
    i += ch.length;
  }
  return out;
}

const join = (toks: TexToken[], from: number, to: number) =>
  toks
    .slice(from, to)
    .map((t) => t.text)
    .join('');

/** Index of the ")" matching the "(" at `open`; -1 if missing or if it would cross a table cell or row. */
function matchParen(toks: TexToken[], open: number): number {
  let depth = 0;
  for (let i = open; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === 'char') {
      if (t.text === '(') depth++;
      else if (t.text === ')' && --depth === 0) return i;
      else if (t.text === '&') return -1;
    } else if (t.type === 'cmd' && t.value === '\\') return -1;
  }
  return -1;
}

/** Appends TeX pieces, keeping a command name from running into a following letter (\pi r, not \pir). */
class TexWriter {
  text = '';
  private afterCommand = false;
  push(piece: string) {
    if (!piece) return;
    if (this.afterCommand && /^[A-Za-z]/.test(piece)) this.text += ' ';
    this.text += piece;
    this.afterCommand = /\\[A-Za-z]+$/.test(piece);
  }
}

/* ---------- Pass 1: symbols, operators, function names, scripts ---------- */

/** Arguments that hold text, names or chemistry, never math to rewrite. */
const VERBATIM_ARGS = new Set(
  'text textrm textbf textit textsf texttt textnormal emph mathrm mathbf mathit mathsf mathtt boldsymbol bm operatorname operatorname* mbox hbox ce pu label tag begin end color textcolor href url hspace vspace unit si SI mathbb mathcal mathfrak mathscr'.split(
    ' ',
  ),
);
const GREEK_WORDS = new Set(
  'alpha beta gamma delta epsilon varepsilon zeta theta kappa lambda mu pi rho sigma tau phi varphi psi omega Gamma Delta Theta Lambda Pi Sigma Phi Psi Omega'.split(
    ' ',
  ),
);
const ROOT_WORDS: Record<string, string> = { sqrt: '\\sqrt', cbrt: '\\sqrt[3]', abs: '' };
const ROOT_CHARS: Record<string, string> = { '√': '\\sqrt', '∛': '\\sqrt[3]', '∜': '\\sqrt[4]' };
const FN_SPLIT = /^([A-Za-z]{0,3}?)(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|sec|csc|cot|log|ln|exp)([A-Za-z]*)$/;

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const ALIASES: Record<string, string> = { asin: 'arcsin', acos: 'arccos', atan: 'arctan' };

const fnTex = (name: string) => (OPERATOR_NAMES.has(name) ? `\\operatorname{${name}}` : `\\${name}`);

/** Handles a run of letters starting at `i`; returns the index after what it consumed. */
function rewriteWord(toks: TexToken[], i: number, w: TexWriter): number {
  let j = i;
  let word = '';
  while (toks[j]?.type === 'letter') word += toks[j++].text;

  if (has(ALIASES, word)) word = ALIASES[word];
  if (has(ROOT_WORDS, word)) {
    let k = j;
    while (toks[k]?.type === 'space') k++;
    const next = toks[k];
    if (next?.text === '(') {
      const close = matchParen(toks, k);
      if (close !== -1) {
        const inner = normalizeTex(join(toks, k + 1, close));
        w.push(word === 'abs' ? `\\left|${inner}\\right|` : `${ROOT_WORDS[word]}{${inner}}`);
        return close + 1;
      }
    } else if (word !== 'abs' && next && (next.type === 'group' || next.type === 'num' || next.type === 'letter')) {
      w.push(`${ROOT_WORDS[word]}{${next.type === 'group' ? normalizeTex(next.value) : next.text}}`);
      return k + 1;
    }
  }

  if (TEX_FUNCTIONS.has(word) || OPERATOR_NAMES.has(word)) w.push(fnTex(word));
  else if (word === 'mod') w.push('\\bmod');
  else if (GREEK_WORDS.has(word)) w.push(`\\${word}`);
  else if (word === 'infinity' || word === 'inf') w.push('\\infty');
  else {
    const split = FN_SPLIT.exec(word);
    const [, before, fn, after] = split ?? [];
    if (split && word !== 'cost' && (after === '' || /^[xyzuv]$/.test(after) || GREEK_WORDS.has(after))) {
      // "sinx" → \sin x, "mgsin" → mg\sin, "costheta" → \cos\theta
      w.push(before);
      w.push(fnTex(fn));
      if (after) w.push(GREEK_WORDS.has(after) ? `\\${after}` : ` ${after}`);
    } else if (word.length >= 4 && word !== word.toUpperCase()) {
      w.push(`\\text{${word}}`); // A word like "Area" or "otherwise", not a product of variables.
    } else {
      w.push(word);
    }
  }
  return j;
}

/** Superscript/subscript arguments that TeX would cut short: x^10, x^-1, e^(2x), e^-kt. */
function rewriteScript(toks: TexToken[], i: number, w: TexWriter): number {
  const op = toks[i].text;
  let k = i + 1;
  while (toks[k]?.type === 'space') k++;
  const first = toks[k];
  if (first?.text === '(') {
    const close = matchParen(toks, k);
    if (close !== -1) {
      w.push(`${op}{${normalizeTex(join(toks, k + 1, close))}}`);
      return close + 1;
    }
  }
  const eBase = op === '^' && toks[i - 1]?.text === 'e' && toks[i - 2]?.type !== 'letter';
  let j = k;
  let body = '';
  if (first && /^[-+−]$/.test(first.text) && (toks[k + 1]?.type === 'num' || toks[k + 1]?.type === 'letter')) {
    body = first.text === '+' ? '+' : '-';
    j++;
  }
  const atom = toks[j];
  if (!atom || (atom.type !== 'num' && atom.type !== 'letter')) {
    w.push(op);
    return i + 1;
  }
  // For e^…, "e^2x" and "e^-kt" mean the whole product is the exponent (at most two letters).
  let letters = 0;
  while (toks[j + 1 + letters]?.type === 'letter') letters++;
  const takeLetters = eBase && letters > 0 && letters + (atom.type === 'letter' ? 1 : 0) <= 2;
  if (!body && !takeLetters && atom.text.length === 1) {
    w.push(op);
    return i + 1;
  }
  body += atom.text;
  j++;
  if (takeLetters) for (; toks[j]?.type === 'letter'; j++) body += toks[j].text;
  w.push(`${op}{${body}}`);
  return j;
}

function rewriteRoot(toks: TexToken[], i: number, w: TexWriter, root: string): number {
  let k = i + 1;
  while (toks[k]?.type === 'space') k++;
  const a = toks[k];
  if (a?.text === '(') {
    const close = matchParen(toks, k);
    if (close !== -1) {
      w.push(`${root}{${normalizeTex(join(toks, k + 1, close))}}`);
      return close + 1;
    }
  }
  if (a?.type === 'group') {
    w.push(`${root}{${normalizeTex(a.value)}}`);
    return k + 1;
  }
  if (a && (a.type === 'num' || a.type === 'letter' || (a.type === 'cmd' && has(GREEK, a.value)))) {
    w.push(`${root}{${a.text}}`);
    return k + 1;
  }
  if (a?.type === 'char' && has(UNICODE_TO_TEX, a.text) && UNICODE_TO_TEX[a.text].startsWith('\\')) {
    w.push(`${root}{${UNICODE_TO_TEX[a.text]}}`);
    return k + 1;
  }
  w.push('\\surd');
  return i + 1;
}

/** Handles the character token at `i`; returns the index after what it consumed. */
function rewriteChar(toks: TexToken[], i: number, w: TexWriter): number {
  const c = toks[i].text;
  const n1 = toks[i + 1]?.text;
  const n2 = toks[i + 2]?.text;
  const emit = (tex: string, used: number) => {
    w.push(tex);
    return i + used;
  };

  if (c === '^' || c === '_') return rewriteScript(toks, i, w);
  if (has(ROOT_CHARS, c)) return rewriteRoot(toks, i, w, ROOT_CHARS[c]);
  if (has(FROM_VULGAR, c)) return emit(`\\frac{${FROM_VULGAR[c][0]}}{${FROM_VULGAR[c][1]}}`, 1);
  for (const [table, op] of [
    [FROM_SUPERSCRIPT, '^'],
    [FROM_SUBSCRIPT, '_'],
  ] as const) {
    if (has(table, c)) {
      let j = i;
      let body = '';
      while (toks[j]?.type === 'char' && has(table, toks[j].text)) body += table[toks[j++].text];
      w.push(`${op}{${body}}`);
      return j;
    }
  }
  if (has(UNICODE_TO_TEX, c)) return emit(UNICODE_TO_TEX[c], 1);

  switch (c) {
    case '<':
      if (n1 === '=' && n2 === '>') return emit('\\Leftrightarrow', 3);
      if (n1 === '-' && n2 === '>') return emit('\\leftrightarrow', 3);
      if (n1 === '=') return emit('\\le', 2);
      break;
    case '>':
      if (n1 === '=') return emit('\\ge', 2);
      break;
    case '!':
      // "5!=120" is a factorial; "x != 0" means not equal.
      if (n1 === '=' && toks[i - 1]?.type !== 'num') return emit('\\ne', 2);
      break;
    case '=':
      if (n1 === '/' && n2 === '=') return emit('\\ne', 3);
      if (n1 === '>') return emit('\\Rightarrow', 2);
      if (n1 === '=') return emit('=', 2);
      break;
    case '+':
      if (n1 === '-') return emit('\\pm', 2);
      if (n1 === '/' && n2 === '-') return emit('\\pm', 3);
      break;
    case '-':
      if (n1 === '>') return emit('\\to', 2);
      break;
    case '~':
      if (n1 === '=') return emit('\\approx', 2);
      break;
    case '%':
      return emit('\\%', 1); // A bare % would start a TeX comment and hide the rest.
    case '*': {
      if (n1 === '*') return emit('^', 2);
      const prev = toks[i - 1]?.text;
      if (prev === '^' || prev === '_') break; // z^* (conjugate)
      let p = i - 1;
      while (toks[p]?.type === 'space') p--;
      let n = i + 1;
      while (toks[n]?.type === 'space') n++;
      return emit(toks[p]?.type === 'num' && toks[n]?.type === 'num' ? '\\times' : '\\cdot', 1);
    }
  }
  return emit(c, 1);
}

function normalizeTex(src: string): string {
  const toks = texTokens(src);
  const w = new TexWriter();
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === 'cmd') {
      if (t.value === 'sqrt' && toks[i + 1]?.text === '(') {
        const close = matchParen(toks, i + 1);
        if (close !== -1) {
          w.push(`\\sqrt{${normalizeTex(join(toks, i + 2, close))}}`);
          i = close;
          continue;
        }
      }
      w.push(t.text);
      if (VERBATIM_ARGS.has(t.value)) while (toks[i + 1]?.type === 'group') w.push(toks[++i].text);
    } else if (t.type === 'group') {
      w.push(`{${normalizeTex(t.value)}}`);
    } else if (t.type === 'letter') {
      i = rewriteWord(toks, i, w) - 1;
    } else if (t.type === 'char') {
      i = rewriteChar(toks, i, w) - 1;
    } else {
      w.push(t.text);
    }
  }
  return w.text;
}

/* ---------- Pass 2: a/b → \frac{a}{b} ---------- */

interface Atom {
  kind: 'atom';
  tex: string;
  numeric?: boolean;
  /** Inner TeX when the atom is a parenthesized group without scripts. */
  paren?: string;
  /** A function applied to its argument (\sin x, \ln(2x)). */
  fn?: boolean;
  /** Text, units or number sets: never split into a fraction (\text{m/s}, \mathbb{Z}/n). */
  blocked?: boolean;
  letter?: string;
}
type Item = Atom | { kind: 'slash' } | { kind: 'break' | 'space'; tex: string };

const FRAC_CMDS = new Set('frac dfrac tfrac cfrac binom dbinom tbinom'.split(' '));
const RECURSE_CMDS = new Set(
  'boxed overline underline bar hat vec tilde dot ddot widehat widetilde overrightarrow mathbf boldsymbol bm mathit cancel'.split(
    ' ',
  ),
);
const BLOCK_CMDS = new Set('text textrm textbf textit mathrm mathbb mathcal mathfrak mathscr ce pu unit si mbox'.split(' '));
const ATOM_CMDS = new Set([...Object.keys(GREEK), 'infty', 'ell', 'hbar', 'partial', 'nabla', 'emptyset', 'varnothing', 'imath']);
const FN_CMDS = new Set('sin cos tan sec csc cot arcsin arccos arctan sinh cosh tanh coth log ln lg exp operatorname'.split(' '));
const UNIT_LEFT = new Set('m g s N J W V A K L C'.split(' '));
const UNIT_RIGHT = new Set('s h m L g K C'.split(' '));
const SPACING = /^\\(?:[,;:! ]|q?quad)$/;

const isAtom = (it: Item | undefined): it is Atom => it?.kind === 'atom';
const endsWithCommand = (it: Item | undefined) => isAtom(it) && /\\[A-Za-z]+$/.test(it.tex);
const itemTex = (it: Item) => (it.kind === 'slash' ? '/' : it.tex);

/** Index after one TeX argument starting at `j`, or -1. */
function argEnd(toks: TexToken[], j: number): number {
  while (toks[j]?.type === 'space') j++;
  const t = toks[j];
  if (!t || (t.type === 'char' && /^[}&^_]$/.test(t.text))) return -1;
  return j + 1;
}

function parseAtom(toks: TexToken[], i: number): { atom: Atom; next: number } | null {
  const t = toks[i];
  let atom: Atom;
  let next = i + 1;
  if (t.type === 'num') atom = { kind: 'atom', tex: t.text, numeric: true };
  else if (t.type === 'letter') atom = { kind: 'atom', tex: t.text, letter: t.text };
  else if (t.type === 'group') atom = { kind: 'atom', tex: `{${convertFractions(t.value)}}` };
  else if (t.type === 'char' && t.text === '(') {
    const close = matchParen(toks, i);
    if (close === -1) return null;
    const inner = convertFractions(join(toks, i + 1, close));
    atom = { kind: 'atom', tex: inner.includes('\\frac') ? `\\left(${inner}\\right)` : `(${inner})`, paren: inner };
    next = close + 1;
  } else if (t.type === 'cmd') {
    const name = t.value;
    if (name === 'left') {
      let depth = 0;
      let k = i;
      for (; k < toks.length; k++) {
        const v = toks[k].type === 'cmd' ? toks[k].value : '';
        if (v === 'left') depth++;
        else if (v === 'right' && --depth === 0) break;
      }
      if (k >= toks.length) return null;
      const inner = convertFractions(join(toks, i + 1, k));
      const round = /\($/.test(t.text) && /\)$/.test(toks[k].text);
      atom = { kind: 'atom', tex: `${t.text}${inner}${toks[k].text}`, paren: round ? inner : undefined };
      next = k + 1;
    } else if (FRAC_CMDS.has(name)) {
      const a = argEnd(toks, i + 1);
      const b = a === -1 ? -1 : argEnd(toks, a);
      if (b === -1) return null;
      atom = { kind: 'atom', tex: join(toks, i, b) };
      next = b;
    } else if (name === 'sqrt' || RECURSE_CMDS.has(name)) {
      let j = i + 1;
      let opt = '';
      if (name === 'sqrt' && toks[j]?.text === '[') {
        let k = j;
        while (k < toks.length && toks[k].text !== ']') k++;
        if (k >= toks.length) return null;
        opt = join(toks, j, k + 1);
        j = k + 1;
      }
      const end = argEnd(toks, j);
      if (end === -1) return null;
      const arg = toks[end - 1];
      atom = {
        kind: 'atom',
        tex: `${t.text}${opt}${arg.type === 'group' ? `{${convertFractions(arg.value)}}` : join(toks, j, end)}`,
      };
      next = end;
    } else if (BLOCK_CMDS.has(name)) {
      const end = argEnd(toks, i + 1);
      if (end === -1) return null;
      atom = { kind: 'atom', tex: join(toks, i, end), blocked: true };
      next = end;
    } else if (FN_CMDS.has(name)) {
      const end = name === 'operatorname' ? argEnd(toks, i + 1) : i + 1;
      if (end === -1) return null;
      atom = { kind: 'atom', tex: join(toks, i, end), fn: true };
      next = end;
    } else if (ATOM_CMDS.has(name)) {
      atom = { kind: 'atom', tex: t.text };
    } else return null;
  } else return null;

  // Scripts, primes and factorials stay with their base: x^2, f', n!
  let scripted = false;
  for (;;) {
    const s = toks[next];
    if (s?.type !== 'char') break;
    if (s.text === '^' || s.text === '_') {
      const end = argEnd(toks, next + 1);
      if (end === -1) break;
      atom.tex += join(toks, next, end);
      next = end;
      scripted = true;
    } else if (s.text === "'" || s.text === '!') {
      atom.tex += s.text;
      next++;
    } else break;
  }
  if (scripted) {
    atom.numeric = false;
    atom.paren = undefined;
  }

  // A function takes its argument along: \sin x, \ln(2x), \log_2 8.
  if (atom.fn) {
    let j = next;
    while (toks[j]?.type === 'space') j++;
    const nextTok = toks[j];
    const arg = nextTok && !(nextTok.type === 'cmd' && FN_CMDS.has(nextTok.value)) ? parseAtom(toks, j) : null;
    if (arg) {
      atom.tex += join(toks, next, j) + arg.atom.tex;
      next = arg.next;
    }
  }
  return { atom, next };
}

/** The atom before `index`, skipping spaces and spacing commands ("5\,m/s"). */
function atomBefore(out: Item[], index: number): Atom | undefined {
  let p = index - 1;
  while (p >= 0 && (out[p].kind === 'space' || (out[p].kind === 'break' && SPACING.test(itemTex(out[p]))))) p--;
  const it = out[p];
  return isAtom(it) ? it : undefined;
}

function operandTex(items: Item[]): string {
  const atoms = items.filter(isAtom);
  if (items.length === 1 && atoms.length === 1 && atoms[0].paren !== undefined) return atoms[0].paren;
  return items.map(itemTex).join('').trim();
}

/** Builds \frac for the slash at items[k], taking the left operand from the end of `out`. */
function makeFraction(out: Item[], items: Item[], k: number): { leftStart: number; rightEnd: number; atom: Atom } | null {
  let end = out.length;
  while (end > 0 && out[end - 1].kind === 'space') end--;
  let start = end;
  while (start > 0) {
    const prev = out[start - 1];
    if (isAtom(prev)) start--;
    else if (prev.kind === 'space' && endsWithCommand(out[start - 2])) start--;
    else break;
  }
  const leftItems = out.slice(start, end);
  const left = leftItems.filter(isAtom);
  if (!left.length) return null;

  let r = k + 1;
  while (items[r]?.kind === 'space') r++;
  const first = items[r];
  if (!isAtom(first)) return null;
  const rightItems: Item[] = [first];
  r++;
  const numericLeft = left.every((a) => a.numeric);
  const derivative = left[0].letter === 'd' && left.length <= 2 && left.every((a) => a.letter) && first.letter === 'd';
  if (derivative) {
    // dy/dx: the denominator is just "dx", whatever follows.
    const second = items[r];
    if (isAtom(second) && second.letter) rightItems.push(items[r++]);
  } else if (!numericLeft) {
    // x/2y means x over 2y; but 1/2 mv^2 keeps the coefficient ½ (numeric numerators take one atom).
    for (;;) {
      const nx = items[r];
      if (isAtom(nx) && !nx.fn) rightItems.push(items[r++]);
      else if (nx?.kind === 'space' && endsWithCommand(items[r - 1]) && isAtom(items[r + 1])) rightItems.push(items[r++]);
      else break;
    }
  }
  const right = rightItems.filter(isAtom);
  if ([...left, ...right].some((a) => a.blocked)) return null;

  // Units such as 5 m/s or 9.8 m/s^2 keep their slash.
  const unit = left[left.length - 1].letter;
  if (unit && UNIT_LEFT.has(unit) && right.length === 1 && right[0].letter && UNIT_RIGHT.has(right[0].letter)) {
    const before = left.length > 1 ? left[left.length - 2] : atomBefore(out, start);
    if (before?.numeric) return null;
  }

  const tex = `\\frac{${operandTex(leftItems)}}{${operandTex(rightItems)}}`;
  return { leftStart: start, rightEnd: r, atom: { kind: 'atom', tex } };
}

function isSingleFrac(tex: string): boolean {
  if (!tex.startsWith('\\frac{')) return false;
  const a = matchBrace(tex, 5);
  return a !== -1 && tex[a + 1] === '{' && matchBrace(tex, a + 1) === tex.length - 1;
}

function convertFractions(src: string): string {
  if (!src.includes('/')) return src;
  const toks = texTokens(src);
  const items: Item[] = [];
  for (let i = 0; i < toks.length; ) {
    const t = toks[i];
    if (t.type === 'space') {
      items.push({ kind: 'space', tex: t.text });
      i++;
    } else if (t.type === 'char' && t.text === '/') {
      const double = toks[i - 1]?.text === '/' || toks[i + 1]?.text === '/';
      items.push(double ? { kind: 'break', tex: '/' } : { kind: 'slash' });
      i++;
    } else {
      const parsed = parseAtom(toks, i);
      if (parsed) {
        items.push(parsed.atom);
        i = parsed.next;
      } else {
        items.push({ kind: 'break', tex: t.text });
        i++;
      }
    }
  }

  const out: Item[] = [];
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.kind !== 'slash') {
      out.push(it);
      continue;
    }
    const frac = makeFraction(out, items, k);
    if (!frac) {
      out.push({ kind: 'break', tex: '/' });
      continue;
    }
    out.length = frac.leftStart;
    out.push(frac.atom);
    k = frac.rightEnd - 1;
  }
  // "(1/2)x" reads better as "\frac{1}{2}x".
  return out
    .map((it, i) =>
      isAtom(it) && it.paren !== undefined && isSingleFrac(it.paren) && isAtom(out[i + 1]) ? it.paren : itemTex(it),
    )
    .join('');
}

/** Rows written with & but no environment ("a &= b \\ c &= d") need one, or KaTeX shows an error. */
function wrapAlignment(tex: string): string {
  if (tex.includes('\\begin{')) return tex;
  return texTokens(tex).some((t) => t.type === 'char' && t.text === '&') ? `\\begin{aligned}${tex}\\end{aligned}` : tex;
}

const cache = new Map<string, string>();

/** Normalizes the TeX inside one math span. Never throws; returns the input if anything goes wrong. */
export function fixTeX(tex: string): string {
  const hit = cache.get(tex);
  if (hit !== undefined) return hit;
  let out: string;
  try {
    out = wrapAlignment(convertFractions(normalizeTex(tex)));
  } catch {
    out = tex;
  }
  if (cache.size > 600) cache.clear();
  cache.set(tex, out);
  return out;
}

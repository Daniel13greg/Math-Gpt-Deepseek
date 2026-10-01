/**
 * Walks Markdown (or plain text), leaving code, links and URLs untouched, cleaning up existing math spans
 * and handing the remaining prose to the plain-text math detector.
 */
import { plainPieces, type MathPiece } from './plain';
import { fixTeX } from './tex';

export const MATH_ENV = /^\\begin\{(equation|align|gather|multline|alignat|eqnarray)(\*?)\}/;

/** Index of the $ closing a $…$ span that starts at `start` (pandoc rules, so "$5 and $10" is money), or -1. */
export function matchDollarInline(src: string, start = 0): number {
  const first = src[start + 1];
  if (src[start] !== '$' || first === '$' || first === undefined || /\s/.test(first)) return -1;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '\n' && src[i + 1] === '\n') return -1; // Never span paragraphs.
    if (c === '$') {
      if (/\s/.test(src[i - 1]) || /\d/.test(src[i + 1] ?? '')) return -1;
      return i;
    }
  }
  return -1;
}

interface Delimited {
  end: number;
  open: string;
  close: string;
  tex: string;
  display: boolean;
}

function matchDelimited(src: string, i: number): Delimited | null {
  if (src.startsWith('\\(', i) || src.startsWith('\\[', i)) {
    const display = src[i + 1] === '[';
    const close = display ? '\\]' : '\\)';
    const end = src.indexOf(close, i + 2);
    return end === -1 ? null : { end: end + 2, open: src.slice(i, i + 2), close, tex: src.slice(i + 2, end), display };
  }
  if (src.startsWith('$$', i)) {
    const end = src.indexOf('$$', i + 2);
    return end <= i + 2 ? null : { end: end + 2, open: '$$', close: '$$', tex: src.slice(i + 2, end), display: true };
  }
  if (src[i] === '$') {
    const end = matchDollarInline(src, i);
    return end === -1 ? null : { end: end + 1, open: '$', close: '$', tex: src.slice(i + 1, end), display: false };
  }
  if (src.startsWith('\\begin{', i)) {
    const env = MATH_ENV.exec(src.slice(i, i + 40));
    if (!env) return null;
    const endTag = `\\end{${env[1]}${env[2]}}`;
    const end = src.indexOf(endTag, i);
    return end === -1
      ? null
      : { end: end + endTag.length, open: '', close: '', tex: src.slice(i, end + endTag.length), display: true };
  }
  return null;
}

type Segment = { kind: 'raw' | 'plain'; text: string } | ({ kind: 'math' } & Delimited);

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
/** Horizontal rules, setext underlines and table delimiter rows. */
const RULE_LINE = /^[ \t]*(?:(?:[-*_][ \t]*){3,}|=+[ \t]*|\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*)$/;
/** Blockquote, list and heading markers ("- " is a bullet, not a minus sign). */
const LINE_PREFIX = /^[ \t]*(?:>[ \t]?)*[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)?(?:#{1,6}[ \t]+)?/;
const IMAGE_RE = /!\[[^\]\n]*\]\([^)\n]*\)/y;
const AUTOLINK_RE = /<(?:https?:|mailto:)[^>\s]*>/iy;
const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/y;
const MD_ESCAPE = /[!-/:-@[-`{-~]/;

function closingTicks(src: string, from: number, count: number): number {
  for (let j = src.indexOf('`', from); j !== -1; j = src.indexOf('`', j)) {
    let k = j;
    while (src[k] === '`') k++;
    if (k - j === count) return j;
    j = k;
  }
  return -1;
}

function closingParen(src: string, open: number): number {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '\n') return -1;
    if (c === '\\') j++;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return j;
  }
  return -1;
}

function sticky(re: RegExp, src: string, i: number): string | null {
  re.lastIndex = i;
  return re.exec(src)?.[0] ?? null;
}

function scan(src: string, markdown: boolean): Segment[] {
  const segs: Segment[] = [];
  let textStart = 0;
  const flush = (to: number) => {
    if (to > textStart) segs.push({ kind: 'plain', text: src.slice(textStart, to) });
  };
  const raw = (from: number, to: number) => {
    flush(from);
    if (to > from) segs.push({ kind: 'raw', text: src.slice(from, to) });
    textStart = to;
  };

  let fence: string | null = null;
  let tableRow = false;
  let lineStart = true;
  let i = 0;
  while (i < src.length) {
    if (lineStart && markdown) {
      lineStart = false;
      let lineEnd = src.indexOf('\n', i);
      if (lineEnd === -1) lineEnd = src.length;
      const line = src.slice(i, lineEnd);
      const open = FENCE.exec(line);
      if (fence !== null || open) {
        if (fence === null) fence = open![1];
        else if (line.trimStart().startsWith(fence)) fence = null;
        const next = Math.min(lineEnd + 1, src.length);
        raw(i, next);
        i = next;
        lineStart = true;
        continue;
      }
      if (RULE_LINE.test(line)) {
        raw(i, lineEnd);
        i = lineEnd;
        continue;
      }
      tableRow = line.trimStart().startsWith('|');
      const prefix = LINE_PREFIX.exec(line)![0];
      if (prefix) {
        raw(i, i + prefix.length);
        i += prefix.length;
        continue;
      }
    }

    const c = src[i];
    if (c === '\n') {
      lineStart = true;
      i++;
      continue;
    }
    if (c === '\\' || c === '$') {
      const math = matchDelimited(src, i);
      if (math) {
        flush(i);
        segs.push({ kind: 'math', ...math });
        textStart = i = math.end;
        continue;
      }
      if (markdown && c === '\\' && MD_ESCAPE.test(src[i + 1] ?? '')) {
        raw(i, i + 2);
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    let skip: string | null = null;
    if (markdown) {
      if (c === '`') {
        let n = 1;
        while (src[i + n] === '`') n++;
        const close = closingTicks(src, i + n, n);
        if (close === -1) {
          i += n;
          continue;
        }
        raw(i, close + n);
        i = close + n;
        continue;
      }
      if (c === ']' && src[i + 1] === '(') {
        const close = closingParen(src, i + 1);
        if (close !== -1) skip = src.slice(i, close + 1);
      } else if (c === '!') skip = sticky(IMAGE_RE, src, i);
      else if (c === '<') skip = sticky(AUTOLINK_RE, src, i);
      else if (c === '|' && tableRow) skip = '|';
    }
    if (!skip && (c === 'h' || c === 'w') && (i === 0 || /[\s(<[]/.test(src[i - 1]))) {
      skip = sticky(URL_RE, src, i)?.replace(/[.,;:!?)\]'"*_]+$/, '') ?? null;
    }
    if (skip) {
      raw(i, i + skip.length);
      i += skip.length;
      continue;
    }
    i++;
  }
  flush(src.length);
  return segs;
}

/** Markdown with every math span cleaned up and plain-text math wrapped in \( … \) for KaTeX. */
export function prettifyMarkdown(src: string): string {
  let out = '';
  for (const seg of scan(src, true)) {
    if (seg.kind === 'raw') out += seg.text;
    else if (seg.kind === 'math') out += seg.open + fixTeX(seg.tex) + seg.close;
    else for (const piece of plainPieces(seg.text)) out += piece.type === 'text' ? piece.text : `\\(${piece.tex}\\)`;
  }
  return out;
}

/** Splits plain text that isn't Markdown (a student's message, a title) into text and math. */
export function splitMath(text: string): MathPiece[] {
  const out: MathPiece[] = [];
  const pushText = (value: string) => {
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += value;
    else if (value) out.push({ type: 'text', text: value });
  };
  for (const seg of scan(text, false)) {
    if (seg.kind === 'math') out.push({ type: 'math', tex: fixTeX(seg.tex), display: seg.display });
    else if (seg.kind === 'raw') pushText(seg.text);
    else
      for (const piece of plainPieces(seg.text)) {
        if (piece.type === 'text') pushText(piece.text);
        else out.push(piece);
      }
  }
  return out;
}

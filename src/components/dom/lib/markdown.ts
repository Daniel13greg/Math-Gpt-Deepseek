/**
 * Markdown + LaTeX → HTML for DOM components (runs in the WebView, never in Hermes).
 *
 * Math delimiters: \( \), \[ \], $$ $$ and $ $ (pandoc rules, so "$5 and $10" stays money),
 * plus bare \begin{align}…\end{align} style environments. Before parsing, math the model wrote as
 * plain text ("6/4", "x^2", "sqrt(2)") is turned into TeX so it shows stacked fractions and real symbols.
 */
import katex from 'katex';
import 'katex/contrib/mhchem';
import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked';

import { MATH_ENV, matchDollarInline, prettifyMarkdown, splitMath } from '@/lib/math';
import { texTokens } from '@/lib/math/tex';

const MACROS = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
};

const mathCache = new Map<string, string>();

/** UI words inside rendered Markdown; DOM components set them for the app language. */
const labels = { copy: 'Copy' };

export function setMarkdownLabels(next: Partial<typeof labels>) {
  Object.assign(labels, next);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Inline fractions are drawn at full size: KaTeX's text-style ½ shrinks the digits to ~70%, which is hard
 * to read on a phone. Nested fractions and fractions in exponents stay small, as in print.
 */
function fullSizeFractions(tex: string): string {
  if (!tex.includes('\\frac')) return tex;
  let out = '';
  let boxed = false;
  for (const t of texTokens(tex)) {
    if (t.type === 'cmd' && t.value === 'frac') out += '\\dfrac';
    else if (t.type === 'group' && boxed) out += `{${fullSizeFractions(t.value)}}`;
    else out += t.text;
    boxed = t.type === 'cmd' && t.value === 'boxed';
  }
  return out;
}

export function renderMath(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  const cached = mathCache.get(key);
  if (cached !== undefined) return cached;
  let html: string;
  try {
    html = katex.renderToString(display ? tex : fullSizeFractions(tex), {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
      macros: { ...MACROS },
    });
  } catch {
    html = `<code class="math-error">${escapeHtml(tex)}</code>`;
  }
  if (display) html = `<div class="math-display">${html}</div>`;
  if (mathCache.size > 800) mathCache.clear();
  mathCache.set(key, html);
  return html;
}

interface MathToken extends Tokens.Generic {
  type: 'math' | 'blockMath';
  raw: string;
  text: string;
  display: boolean;
}

/** Punctuation right after inline math ("… = 6.") joins it, so it can't wrap onto a line of its own. */
const TRAILING_PUNCTUATION = /^[.,;:!?)]{1,3}(?![\w(])/;

function inlineToken(src: string, raw: string, tex: string): MathToken {
  const punctuation = TRAILING_PUNCTUATION.exec(src.slice(raw.length))?.[0] ?? '';
  return {
    type: 'math',
    raw: raw + punctuation,
    text: punctuation ? `${tex}\\text{${punctuation}}` : tex,
    display: false,
  };
}

const inlineMath: TokenizerAndRendererExtension = {
  name: 'math',
  level: 'inline',
  start(src) {
    const match = /\$|\\\(|\\\[|\\begin\{/.exec(src);
    return match ? match.index : undefined;
  },
  tokenizer(src): MathToken | undefined {
    let m = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (m) return { type: 'math', raw: m[0], text: m[1].trim(), display: true };
    m = /^\\\[([\s\S]+?)\\\]/.exec(src);
    if (m) return { type: 'math', raw: m[0], text: m[1].trim(), display: true };
    m = /^\\\(([\s\S]+?)\\\)/.exec(src);
    if (m) return inlineToken(src, m[0], m[1].trim());
    const env = MATH_ENV.exec(src);
    if (env) {
      const end = src.indexOf(`\\end{${env[1]}${env[2]}}`);
      if (end !== -1) {
        const raw = src.slice(0, end + `\\end{${env[1]}${env[2]}}`.length);
        return { type: 'math', raw, text: raw, display: true };
      }
    }
    const close = matchDollarInline(src);
    if (close > 0) return inlineToken(src, src.slice(0, close + 1), src.slice(1, close));
    return undefined;
  },
  renderer(token) {
    return renderMath((token as MathToken).text, (token as MathToken).display);
  },
};

/** Display math that starts a block may contain blank lines or list-like lines; grab it whole. */
const blockMath: TokenizerAndRendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src) {
    const match = /^ {0,3}(?:\$\$|\\\[|\\begin\{)/m.exec(src);
    return match ? match.index : undefined;
  },
  tokenizer(src): MathToken | undefined {
    const lead = /^ {0,3}/.exec(src)![0].length;
    const body = src.slice(lead);
    let open = '';
    let close = '';
    if (body.startsWith('$$')) [open, close] = ['$$', '$$'];
    else if (body.startsWith('\\[')) [open, close] = ['\\[', '\\]'];
    else {
      const env = MATH_ENV.exec(body);
      if (!env) return undefined;
      open = '';
      close = `\\end{${env[1]}${env[2]}}`;
    }
    const end = body.indexOf(close, open.length || 1);
    if (end === -1) return undefined;
    // Only treat it as a block if nothing but whitespace follows on the closing line.
    const after = body.slice(end + close.length);
    const lineEnd = after.search(/\n|$/);
    if (after.slice(0, lineEnd).trim() !== '') return undefined;
    const inner = open ? body.slice(open.length, end) : body.slice(0, end + close.length);
    return {
      type: 'blockMath',
      raw: src.slice(0, lead + end + close.length + lineEnd + (after[lineEnd] === '\n' ? 1 : 0)),
      text: inner.trim(),
      display: true,
    };
  },
  renderer(token) {
    return renderMath((token as MathToken).text, true);
  },
};

const marked = new Marked({ gfm: true, breaks: false, async: false });
marked.use({
  extensions: [blockMath, inlineMath],
  hooks: {
    // Wide tables scroll horizontally instead of overflowing the chat.
    postprocess: (html) => html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>'),
  },
  renderer: {
    // Never trust raw HTML from the model.
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:)/i.test(href)) return label;
      return `<a href="${escapeHtml(href)}" data-external-link="1" rel="noopener noreferrer">${label}</a>`;
    },
    image({ href, text }) {
      if (!/^https?:/i.test(href)) return escapeHtml(text);
      return `<a href="${escapeHtml(href)}" data-external-link="1">${escapeHtml(text || 'image')}</a>`;
    },
    code({ text, lang }) {
      const language = (lang ?? '').split(/\s/)[0];
      return `<div class="code-block"><div class="code-head"><span>${escapeHtml(language || 'code')}</span><button type="button" data-copy-code="1">${escapeHtml(labels.copy)}</button></div><pre><code>${escapeHtml(text)}</code></pre></div>`;
    },
  },
});

/**
 * While streaming, a display equation arrives token by token. Rendering the half-written
 * TeX as text and then snapping to math looks jumpy, so cut an unclosed trailing equation
 * and show a placeholder until its closing delimiter arrives.
 */
export function splitDanglingMath(raw: string): { text: string; pending: boolean } {
  // A chunk can end between "\\" and "(" — don't flash a lone backslash.
  const src = /(^|[^\\])\\$/.test(raw) ? raw.slice(0, -1) : raw;
  let cut = -1;
  const dollars = src.split('$$').length - 1;
  if (dollars % 2 === 1) cut = src.lastIndexOf('$$');
  for (const [open, close] of [
    ['\\[', '\\]'],
    ['\\(', '\\)'],
  ]) {
    const lastOpen = src.lastIndexOf(open);
    if (lastOpen > src.lastIndexOf(close)) cut = cut === -1 ? lastOpen : Math.min(cut, lastOpen);
  }
  if (cut === -1 || src.length - cut > 1500) return { text: src, pending: false };
  return { text: src.slice(0, cut), pending: true };
}

/**
 * `streaming`: hide a half-written trailing equation and show a placeholder for it.
 * `partial`: the reply was cut off (stopped); hide the dangling equation without a placeholder.
 */
export function renderMarkdown(src: string, opts: { streaming?: boolean; partial?: boolean } = {}): string {
  if (!opts.streaming && !opts.partial) return marked.parse(prettifyMarkdown(src)) as string;
  const { text, pending } = splitDanglingMath(src);
  const html = marked.parse(prettifyMarkdown(text)) as string;
  return pending && opts.streaming ? `${html}<div class="math-pending" aria-hidden="true"></div>` : html;
}

export function renderInline(src: string): string {
  return marked.parseInline(prettifyMarkdown(src)) as string;
}

/** Plain text that isn't Markdown (a student's message, a title) with its math typeset. */
export function renderMathText(text: string): string {
  const pieces = splitMath(text);
  let html = '';
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (piece.type === 'text') {
      html += escapeHtml(piece.text);
      continue;
    }
    const next = pieces[i + 1];
    let punctuation = '';
    if (!piece.display && next?.type === 'text') {
      punctuation = TRAILING_PUNCTUATION.exec(next.text)?.[0] ?? '';
      if (punctuation) pieces[i + 1] = { type: 'text', text: next.text.slice(punctuation.length) };
    }
    html += renderMath(punctuation ? `${piece.tex}\\text{${punctuation}}` : piece.tex, piece.display);
  }
  return html;
}

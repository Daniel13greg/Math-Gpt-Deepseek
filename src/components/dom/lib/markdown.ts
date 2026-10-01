/**
 * Markdown + LaTeX → HTML for DOM components (runs in the WebView, never in Hermes).
 *
 * Math delimiters: \( \), \[ \], $$ $$ and $ $ (pandoc rules, so "$5 and $10" stays money),
 * plus bare \begin{align}…\end{align} style environments.
 */
import katex from 'katex';
import 'katex/contrib/mhchem';
import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked';

const MACROS = {
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\dfrac': '\\displaystyle\\frac',
};

const mathCache = new Map<string, string>();

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderMath(tex: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}${tex}`;
  const cached = mathCache.get(key);
  if (cached !== undefined) return cached;
  let html: string;
  try {
    html = katex.renderToString(tex, {
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

/** Finds the end of a $…$ span following pandoc's rules; returns -1 if it isn't math. */
function matchDollarInline(src: string): number {
  if (src[0] !== '$' || src[1] === '$' || src[1] === undefined || /\s/.test(src[1])) return -1;
  for (let i = 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '\n' && src[i + 1] === '\n') return -1; // Never span paragraphs.
    if (c === '$') {
      if (/\s/.test(src[i - 1])) return -1;
      if (/\d/.test(src[i + 1] ?? '')) return -1;
      return i;
    }
  }
  return -1;
}

const ENV = /^\\begin\{(equation|align|gather|multline|alignat|eqnarray)(\*?)\}/;

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
    if (m) return { type: 'math', raw: m[0], text: m[1].trim(), display: false };
    const env = ENV.exec(src);
    if (env) {
      const end = src.indexOf(`\\end{${env[1]}${env[2]}}`);
      if (end !== -1) {
        const raw = src.slice(0, end + `\\end{${env[1]}${env[2]}}`.length);
        return { type: 'math', raw, text: raw, display: true };
      }
    }
    const close = matchDollarInline(src);
    if (close > 0) return { type: 'math', raw: src.slice(0, close + 1), text: src.slice(1, close), display: false };
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
      const env = ENV.exec(body);
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
      return `<div class="code-block"><div class="code-head"><span>${escapeHtml(language || 'code')}</span><button type="button" data-copy-code="1">Copy</button></div><pre><code>${escapeHtml(text)}</code></pre></div>`;
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
  if (!opts.streaming && !opts.partial) return marked.parse(src) as string;
  const { text, pending } = splitDanglingMath(src);
  const html = marked.parse(text) as string;
  return pending && opts.streaming ? `${html}<div class="math-pending" aria-hidden="true"></div>` : html;
}

export function renderInline(src: string): string {
  return marked.parseInline(src) as string;
}

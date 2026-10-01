/**
 * LaTeX commands that begin with a letter JSON treats as an escape (\n, \t).
 * `"\nabla"` is valid JSON (newline + "abla"), so we can only tell intent from the word.
 */
const LATEX_N_WORDS = new Set([
  'nabla',
  'ne',
  'neq',
  'neg',
  'nu',
  'ni',
  'not',
  'notin',
  'nexists',
  'newline',
  'nleq',
  'ngeq',
  'nless',
  'ngtr',
  'nmid',
  'nparallel',
  'nsubseteq',
  'nsupseteq',
  'nolimits',
  'normalsize',
  'natural',
]);
const LATEX_T_WORDS = new Set([
  'theta',
  'tau',
  'times',
  'to',
  'top',
  'tan',
  'tanh',
  'tilde',
  'therefore',
  'tfrac',
  'tbinom',
  'tiny',
  'triangle',
  'triangleleft',
  'triangleright',
  'textstyle',
  'texttt',
  'textrm',
  'textbf',
  'textit',
  'text',
  'textnormal',
  'textsf',
  'textup',
  'textsc',
  'textcolor',
  'tag',
  'tt',
  'thinspace',
  'textdegree',
]);

const JSON_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

/**
 * Doubles backslashes that the model clearly meant literally (LaTeX), so JSON.parse
 * neither throws on `\(` nor silently turns `\frac` into a form feed + "rac".
 * Correctly escaped JSON (`\\frac`) is left untouched.
 */
export function repairLatexEscapes(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '\\') {
      out += text[i++];
      continue;
    }
    let run = 0;
    while (text[i + run] === '\\') run++;
    out += text.slice(i, i + run);
    i += run;
    if (run % 2 === 0) continue; // Fully escaped backslashes.

    const next = text[i] ?? '';
    const word = /^[a-zA-Z]+/.exec(text.slice(i))?.[0] ?? '';
    let literal: boolean;
    if (!JSON_ESCAPES.has(next)) {
      literal = true; // \( \[ \, \{ \alpha ... are invalid JSON escapes.
    } else if (next === 'u') {
      literal = !/^u[0-9a-fA-F]{4}/.test(text.slice(i)); // \underline, \uparrow
    } else if (next === 'b' || next === 'f' || next === 'r') {
      literal = word.length > 1; // \beta \frac \rho; real \b \f \r are rare and never followed by letters.
    } else if (next === 'n') {
      literal = LATEX_N_WORDS.has(word);
    } else if (next === 't') {
      literal = LATEX_T_WORDS.has(word) || word.startsWith('text') || word.startsWith('triangle');
    } else {
      literal = false;
    }
    if (literal) out += '\\';
  }
  return out;
}

/** Extracts and parses the first JSON object/array in a model reply (handles code fences and prose). */
export function extractJson<T = unknown>(raw: string): T {
  let text = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = fence[1].trim();

  const start = text.search(/[{[]/);
  if (start === -1) throw new Error('No JSON object found in the reply.');
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  if (end <= start) throw new Error('The JSON in the reply is incomplete.');
  const candidate = repairLatexEscapes(text.slice(start, end + 1));

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Common model slip: trailing commas before } or ].
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')) as T;
  }
}

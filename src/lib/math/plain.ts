/**
 * Finds math written as plain text ("6/4", "x^2 - 5x + 6 = 0", "sqrt(16)", "a <= b", "2H2 + O2 -> 2H2O")
 * and turns it into TeX. Deliberately conservative: prose, dates, units, money and Markdown stay as written.
 */
import { FROM_SUBSCRIPT, FROM_SUPERSCRIPT, OPERATOR_NAMES, SUPERSCRIPT, TEX_FUNCTIONS, TEX_SYMBOLS } from './symbols';
import { fixTeX, matchBrace } from './tex';

export type MathPiece = { type: 'text'; text: string } | { type: 'math'; tex: string; display: boolean };

type Kind = 'num' | 'word' | 'tex' | 'greek' | 'sym' | 'sup' | 'sub' | 'op' | 'lp' | 'rp' | 'bar' | 'comma' | 'ws' | 'other';

interface Tok {
  kind: Kind;
  text: string;
  /** How the token reads when it stays text (units get real superscripts: m/s²). */
  shown?: string;
  /** A number right after a currency sign. */
  money?: boolean;
}

/* ---------- Tokenizer ---------- */

const NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d+(?:\.\d+)?/y;
const WORD_RE = /[A-Za-z]+/y;
const WS_RE = /[ \t ]+/y;
const TEX_RE = /\\([A-Za-z]+)/y;
const DELIM_RE = /\s*(?:\\[A-Za-z]+|\\[^A-Za-z]|[^\s\\])/y;
const SUP_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/y;
const SUB_RE = /[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₙ]+/y;
const GREEK_RE = /[Α-Ωα-ωϑϕϖϵ]/;
const SYMBOLS = '∞½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒∅ℝℕℤℚℂℓℏ';
const UNIT_NAMES = 'kg|mg|g|km|cm|mm|m|ms|s|min|hr|h|kN|N|kJ|J|kW|W|V|mA|A|K|mL|ml|L|mol|kPa|Pa|Hz|C|lb|ft|mi|gal';
const UNIT_POW = '(?:\\^-?\\d|[²³])';
/** Units after a number: "9.8 m/s^2", "50 m^2", "2 g/mol". */
const UNIT_RE = new RegExp(
  `(?:${UNIT_NAMES})${UNIT_POW}?(?:\\/(?:${UNIT_NAMES})${UNIT_POW}?)+(?![A-Za-z0-9])|(?:${UNIT_NAMES})${UNIT_POW}(?![A-Za-z0-9])`,
  'y',
);
/** Markdown markers that look like operators. */
const MARKS = ['**', '__', '~~', '//'];
const OPS = [
  ...['<=>', '<->', '=/=', '+/-'],
  ...['<=', '>=', '!=', '+-', '->', '=>', '~='],
  ..."+ - − * / ^ _ = < > ! % ' ° ± ∓ × ÷ · ⋅ ≤ ≥ ≠ ≈ ≡ ∼ ∝ → ⇒ ⇔ ⇌ ↔ ⟹ ⟺ ∈ ∉ ⊂ ⊆ ∪ ∩ √ ∛ ∜ ∫ ∑ ∏ ∂ ∇ ∠ △ ′ ″ ⊥ ∥".split(' '),
];
const TEX_KNOWN = new Set([
  ...Object.keys(TEX_SYMBOLS),
  ...TEX_FUNCTIONS,
  ...OPERATOR_NAMES,
  ...'frac dfrac tfrac sqrt boxed text mathrm mathbf operatorname overline underline bar hat vec dot ddot tilde left right ce pu binom'.split(
    ' ',
  ),
]);

function readTex(src: string, i: number): string | null {
  TEX_RE.lastIndex = i;
  const m = TEX_RE.exec(src);
  if (!m || !TEX_KNOWN.has(m[1])) return null;
  let end = i + m[0].length;
  if (m[1] === 'left' || m[1] === 'right') {
    DELIM_RE.lastIndex = end;
    const d = DELIM_RE.exec(src);
    return src.slice(i, d ? end + d[0].length : end);
  }
  if (m[1] === 'sqrt' && src[end] === '[') {
    const close = src.indexOf(']', end);
    if (close !== -1 && close - end < 8) end = close + 1;
  }
  while (src[end] === '{') {
    const close = matchBrace(src, end);
    if (close === -1) break;
    end = close + 1;
  }
  return src.slice(i, end);
}

const superscriptDigits = (unit: string) =>
  unit.replace(/\^(-?)(\d)/g, (_, minus: string, digit: string) => (minus ? '⁻' : '') + SUPERSCRIPT[digit]);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const sticky = (re: RegExp) => {
    re.lastIndex = i;
    return re.exec(src)?.[0] ?? null;
  };
  while (i < src.length) {
    const c = src[i];
    const prev = toks[toks.length - 1];
    let m: string | null;
    const afterNumber = prev?.kind === 'num' || (prev?.text === ' ' && toks[toks.length - 2]?.kind === 'num');
    if (afterNumber && /[A-Za-z]/.test(c) && (m = sticky(UNIT_RE))) {
      toks.push({ kind: 'other', text: m, shown: superscriptDigits(m) });
    } else if (c >= '0' && c <= '9') {
      m = sticky(NUM_RE)!;
      toks.push({ kind: 'num', text: m, money: !!prev && /^[$€£¥]$/.test(prev.text) });
    } else if (/[A-Za-z]/.test(c)) {
      m = sticky(WORD_RE)!;
      toks.push({ kind: 'word', text: m });
    } else if (c === '\\' && (m = readTex(src, i))) {
      toks.push({ kind: 'tex', text: m });
    } else if ((m = sticky(WS_RE))) {
      toks.push({ kind: 'ws', text: m });
    } else if ((m = sticky(SUP_RE))) {
      toks.push({ kind: 'sup', text: m });
    } else if ((m = sticky(SUB_RE))) {
      toks.push({ kind: 'sub', text: m });
    } else if (GREEK_RE.test(c)) {
      toks.push({ kind: 'greek', text: (m = c) });
    } else if (SYMBOLS.includes(c)) {
      toks.push({ kind: 'sym', text: (m = c) });
    } else if (c === '(' || c === ')' || c === '|' || c === ',') {
      toks.push({ kind: c === '(' ? 'lp' : c === ')' ? 'rp' : c === '|' ? 'bar' : 'comma', text: (m = c) });
    } else if ((m = MARKS.find((s) => src.startsWith(s, i)) ?? null)) {
      toks.push({ kind: 'other', text: m });
    } else if ((m = OPS.find((s) => src.startsWith(s, i)) ?? null)) {
      const minus =
        m === '-' &&
        /\d/.test(src[i + 1] ?? '') &&
        (!prev || prev.kind === 'ws' || prev.kind === 'lp' || /^[[{=:,;]$/.test(prev.text));
      toks.push({ kind: 'op', text: m, shown: minus ? '−' : undefined });
    } else {
      m = String.fromCodePoint(src.codePointAt(i)!);
      toks.push({ kind: 'other', text: m });
    }
    i += m.length;
  }
  return toks;
}

/* ---------- Expression parser ---------- */

// "==" is left out on purpose: in prose it's code ("a == b"), not math.
const REL = new Set('= < > <= >= != =/= ≤ ≥ ≠ ≈ ≡ ∼ ∝ → -> => ⇒ ⇔ ⇌ <=> <-> ↔ ⟹ ⟺ ∈ ∉ ⊂ ⊆ ~='.split(' '));
const ARITH = new Set('+ - − ± ∓ +- +/- ∪ ∩ * × ÷ · ⋅ /'.split(' '));
const ASCII_OPS = new Set('<=> <-> =/= +/- <= >= != +- -> => ~= *'.split(' '));
const SIGNS = new Set(['-', '+', '−', '±', '∓']);
const ROOT_OPS = new Set(['√', '∛', '∜']);
const PREFIX_OPS = new Set(['∫', '∑', '∏', '∂', '∇', '∠', '△']);
const POSTFIX = new Set(['!', '%', '°', "'", '′', '″']);
const FUNCTIONS = new Set(
  'sin cos tan sec csc cot arcsin arccos arctan asin acos atan sinh cosh tanh log ln exp sqrt cbrt abs lim max min gcd lcm det sgn'.split(
    ' ',
  ),
);
/** Functions that may take their argument after a space: "sin x", "log 2". */
const SPACE_ARG = new Set('sin cos tan sec csc cot ln log sqrt'.split(' '));
const CONSTANTS = new Set(
  'pi theta alpha beta gamma delta lambda mu sigma omega phi rho tau epsilon Delta Sigma Omega Theta Phi Lambda Gamma Pi infinity'.split(
    ' ',
  ),
);
/** Two-letter words that are English, ordinals or units rather than products of variables. */
const STOPWORDS = new Set(
  'am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we vs eg ie st nd rd th pm oz lb ft hr ms mm cm km kg mg ml'.split(
    ' ',
  ),
);
const ELEMENTS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(
    ' ',
  ),
);

const isInt = (t: Tok | undefined) => t?.kind === 'num' && /^\d+$/.test(t.text);

/** Number of element symbols a word is made of ("NaCl" → 2), or 0. */
function elementCount(word: string): number {
  const parts = word.match(/[A-Z][a-z]?/g);
  if (!parts || parts.join('') !== word || !parts.every((p) => ELEMENTS.has(p))) return 0;
  return parts.length;
}

type Mode = 'top' | 'paren' | 'bar';

class Parser {
  private flags: string[] = [];
  private edits: { from: number; to: number; tex: string }[] = [];
  /** Set when the expression stopped at a binary operator whose right side didn't parse. */
  dangling: number | null = null;

  constructor(private t: Tok[]) {}

  private has(flag: string) {
    return this.flags.includes(flag);
  }
  private flag(flag: string) {
    this.flags.push(flag);
  }
  private mark(): [number, number] {
    return [this.flags.length, this.edits.length];
  }
  private reset([flags, edits]: [number, number]) {
    this.flags.length = flags;
    this.edits.length = edits;
  }
  private op(i: number): string {
    const tok = this.t[i];
    return tok?.kind === 'op' ? tok.text : '';
  }
  private ws(i: number): number {
    return this.t[i]?.kind === 'ws' ? i + 1 : i;
  }

  atomStart(i: number): boolean {
    const tok = this.t[i];
    if (!tok) return false;
    if (tok.kind === 'op') return ROOT_OPS.has(tok.text) || PREFIX_OPS.has(tok.text);
    if (tok.kind === 'num') return !tok.money;
    return (
      tok.kind === 'word' ||
      tok.kind === 'greek' ||
      tok.kind === 'sym' ||
      tok.kind === 'tex' ||
      tok.kind === 'lp' ||
      tok.kind === 'bar'
    );
  }

  expr(i: number, mode: Mode): number {
    let termStart = i;
    let end = this.term(i);
    if (end < 0) return -1;
    for (;;) {
      const p = this.ws(end);
      const spacedBefore = p > end;
      const tok = this.t[p];
      if (!tok) break;
      // Mixed number: 1 1/2
      if (spacedBefore && termStart === end - 1 && isInt(this.t[end - 1]) && isInt(tok) && this.op(p + 1) === '/') {
        if (isInt(this.t[p + 2]) && !this.op(p + 3)) {
          this.edits.push({ from: end, to: p + 3, tex: `{${tok.text}/${this.t[p + 2].text}}` }); // 2½, no gap
          this.flag('frac');
          termStart = p;
          end = p + 3;
          continue;
        }
      }
      // 3 x 4 means 3 × 4
      if (spacedBefore && tok.text === 'x' && this.t[p + 1]?.kind === 'ws' && isInt(this.t[end - 1]) && isInt(this.t[p + 2])) {
        this.edits.push({ from: p, to: p + 1, tex: '\\times' });
        this.flag('times');
        termStart = p + 2;
        end = this.term(p + 2);
        continue;
      }
      if (mode === 'paren' && tok.kind === 'comma') {
        const q = this.ws(p + 1);
        const saved = this.mark();
        const r = this.term(q);
        if (r < 0) {
          this.reset(saved);
          break;
        }
        termStart = q;
        end = r;
        continue;
      }
      const op = this.op(p);
      const kind = REL.has(op) ? 'rel' : ARITH.has(op) ? 'arith' : '';
      if (!kind) break;
      const q = this.ws(p + 1);
      if (op === '*' && spacedBefore !== q > p + 1) break; // *emphasis*, not multiplication
      const saved = this.mark();
      const r = this.term(q);
      if (r < 0) {
        this.reset(saved);
        if (mode === 'top') this.dangling = p;
        break;
      }
      this.flag(kind);
      if (op === '/') this.flag('frac');
      if (ASCII_OPS.has(op)) this.flag('ascii');
      termStart = q;
      end = r;
    }
    return end;
  }

  term(i: number): number {
    let j = i;
    if (SIGNS.has(this.op(j)) && this.atomStart(j + 1)) j++;
    let end = this.factor(j);
    if (end < 0) return -1;
    for (;;) {
      const next = this.t[end];
      if (!next) break;
      // 3x4 means 3 × 4
      if (next.text === 'x' && isInt(this.t[end - 1]) && isInt(this.t[end + 1])) {
        this.edits.push({ from: end, to: end + 1, tex: '\\times' });
        this.flag('times');
        end += 2;
        continue;
      }
      // ∫ x^2 dx
      if (next.kind === 'ws' && this.has('calc') && /^d[a-z]$/.test(this.t[end + 1]?.text ?? '')) {
        end += 2;
        continue;
      }
      const juxtaposed =
        next.kind === 'num' ||
        next.kind === 'word' ||
        next.kind === 'greek' ||
        next.kind === 'sym' ||
        next.kind === 'tex' ||
        next.kind === 'lp' ||
        ROOT_OPS.has(this.op(end));
      if (!juxtaposed) break;
      const saved = this.mark();
      const r = this.factor(end);
      if (r < 0) {
        this.reset(saved);
        break;
      }
      if (next.kind === 'lp' && this.t[end - 1].kind === 'rp') this.flag('product'); // (x - 2)(x - 3)
      end = r;
    }
    return end;
  }

  factor(i: number): number {
    let end = this.atom(i);
    if (end < 0) return -1;
    for (;;) {
      const tok = this.t[end];
      if (!tok) break;
      if (tok.kind === 'sup' || tok.kind === 'sub') {
        this.flag(tok.kind === 'sup' ? 'usup' : 'usub');
        end++;
        continue;
      }
      if (tok.kind !== 'op') break;
      const baseKind = this.t[end - 1].kind;
      if (
        tok.text === '^' ||
        (tok.text === '_' && (baseKind === 'word' || baseKind === 'greek' || baseKind === 'tex' || baseKind === 'rp'))
      ) {
        const saved = this.mark();
        const r = this.script(end + 1, tok.text === '^');
        if (r < 0) {
          this.reset(saved);
          break;
        }
        this.flag(tok.text === '^' ? 'pow' : 'sub');
        end = r;
        continue;
      }
      if (POSTFIX.has(tok.text)) {
        const after = this.t[end + 1];
        if (after && (after.kind === 'word' || after.kind === 'num')) break; // "x's", "5'10"
        end++;
        continue;
      }
      break;
    }
    return end;
  }

  private script(i: number, sup: boolean): number {
    const j = SIGNS.has(this.op(i)) ? i + 1 : i;
    const tok = this.t[j];
    if (!tok) return -1;
    if (tok.kind === 'lp') return this.paren(j);
    if (tok.kind === 'num' || tok.kind === 'greek' || tok.kind === 'tex' || tok.kind === 'sym') return j + 1;
    if (tok.kind === 'word' && (tok.text.length <= (sup ? 2 : 3) || CONSTANTS.has(tok.text))) return j + 1;
    return -1;
  }

  private atom(i: number): number {
    const tok = this.t[i];
    if (!tok) return -1;
    switch (tok.kind) {
      case 'num':
        if (tok.money) return -1;
        this.flag('num');
        return i + 1;
      case 'greek':
        this.flag('var');
        return i + 1;
      case 'sym':
        this.flag('const');
        return i + 1;
      case 'tex':
        this.flag('tex');
        return i + 1;
      case 'word':
        return this.word(i);
      case 'lp':
        return this.paren(i);
      case 'bar': {
        const r = this.expr(this.ws(i + 1), 'bar');
        if (r < 0) return -1;
        const k = this.ws(r);
        return this.t[k]?.kind === 'bar' ? k + 1 : -1;
      }
      case 'op': {
        if (ROOT_OPS.has(tok.text)) {
          const r = this.factor(i + 1);
          if (r >= 0) this.flag('root');
          return r;
        }
        if (PREFIX_OPS.has(tok.text)) {
          const r = this.term(this.ws(i + 1));
          if (r >= 0) this.flag('calc');
          return r;
        }
        return -1;
      }
      default:
        return -1;
    }
  }

  private word(i: number): number {
    const w = this.t[i].text;
    if (FUNCTIONS.has(w)) return this.func(i);
    if (/^(?:sin|cos|tan|sec|csc|cot|ln|log)[xyz]$/.test(w)) {
      this.flag('fn'); // sinx, lnx
      return i + 1;
    }
    if (CONSTANTS.has(w)) {
      this.flag('const');
      return i + 1;
    }
    if (w.length === 1) {
      this.flag('var');
      return i + 1;
    }
    if (elementCount(w) >= 2) {
      this.flag('elem'); // NaCl, CO, HCl
      return i + 1;
    }
    // Short products of variables: mc, ma, PV, nRT, mgh, 4ac
    const product =
      w.length === 2
        ? !STOPWORDS.has(w.toLowerCase())
        : w.length === 3 && !/^(?:st|nd|rd|th)s$/.test(w) && (this.t[i - 1]?.kind === 'num' || !/[aeiou]/.test(w));
    if (!product) return -1;
    this.flag('var');
    return i + 1;
  }

  private func(i: number): number {
    const name = this.t[i].text;
    if (name === 'lim') return this.limit(i);
    let j = i + 1;
    const scriptOp = this.op(j);
    if (scriptOp === '^' || scriptOp === '_') {
      j = this.script(j + 1, scriptOp === '^'); // sin^2(x), log_2(8)
      if (j < 0) return -1;
    }
    const next = this.t[j];
    let r = -1;
    if (next?.kind === 'lp') r = this.paren(j);
    else if (next && (next.kind === 'num' || next.kind === 'greek' || next.kind === 'sym' || next.kind === 'tex'))
      r = this.factor(j);
    else if (next?.kind === 'ws' && SPACE_ARG.has(name)) r = this.factor(j + 1);
    if (r < 0) return -1;
    this.flag(name === 'sqrt' || name === 'cbrt' ? 'root' : 'fn');
    return r;
  }

  /** lim_(x->0) f(x) or lim x->0 f(x) */
  private limit(i: number): number {
    let j = i + 1;
    if (this.op(j) === '_') {
      j = this.script(j + 1, false);
      if (j < 0) return -1;
    } else {
      const v = this.ws(j);
      if (v === j || this.t[v]?.kind !== 'word' || this.t[v].text.length !== 1) return -1;
      const arrow = this.ws(v + 1);
      if (this.op(arrow) !== '->' && this.op(arrow) !== '→') return -1;
      const target = this.term(this.ws(arrow + 1));
      if (target < 0) return -1;
      this.edits.push({ from: i, to: target, tex: `\\lim_{${this.source(v, target)}}` });
      j = target;
    }
    const r = this.term(this.ws(j));
    if (r < 0) return -1;
    this.flag('fn');
    return r;
  }

  paren(i: number): number {
    const r = this.expr(this.ws(i + 1), 'paren');
    if (r < 0) return -1;
    const k = this.ws(r);
    return this.t[k]?.kind === 'rp' ? k + 1 : -1;
  }

  /** Whether the run is clearly math rather than prose that happens to contain a number. */
  triggered(): boolean {
    const f = (flag: string) => this.has(flag);
    if (['frac', 'pow', 'sub', 'root', 'fn', 'tex', 'ascii', 'times', 'calc'].some(f)) return true;
    if (f('product') && f('var') && f('arith')) return true;
    const ops = f('arith') || f('rel');
    if ((f('usup') || f('usub')) && ops && f('var')) return true; // x² − 1, but not H₂O
    if (f('const') && ops) return true;
    return f('rel') && (f('var') || f('arith'));
  }

  source(s: number, e: number): string {
    return this.t
      .slice(s, e)
      .map((t) => (t.kind === 'ws' ? ' ' : t.text))
      .join('');
  }

  tex(s: number, e: number): string {
    let out = '';
    for (let k = s; k < e; k++) {
      const edit = this.edits.find((x) => x.from === k);
      if (edit) {
        out += edit.tex;
        k = edit.to - 1;
        continue;
      }
      const t = this.t[k];
      out += t.kind === 'ws' ? ' ' : t.kind === 'num' ? t.text.replace(/,/g, '{,}') : t.text;
    }
    return out;
  }
}

/* ---------- Runs ---------- */

const GLUE = new Set<Kind>(['num', 'word', 'greek', 'sym', 'tex', 'sup', 'sub']);
const NO_START_AFTER = new Set(['/', '^', '_', "'", '\\', '$', '€', '£', '¥', '#', '@', '&', '.', '%']);
const LETTER = /[A-Za-zÀ-ɏ]/;
const DATE = /^\d{1,4}\/\d{1,2}\/\d{1,4}$/;
const EXCLUDED = new Set('w/o c/o n/a i/o a/c p/e p/l y/n t/f b/s s/n w/e 24/7 50/50 m/s n/m j/s g/l'.split(' '));
const CHEM_ARROWS: Record<string, string> = { '->': '->', '→': '->', '⇌': '<=>', '<=>': '<=>', '<->': '<->' };
const CHEM_EXCLUDED = new Set(['B2B', 'B2C', 'C2C', 'P2P', 'B2G', 'H1N1', 'H5N1']);
const HINT = /[\d^=<>/*_|\\√∛∜∞≤≥≠≈±∓×÷·−²³¹⁰⁴⁵⁶⁷⁸⁹₀-₉∫∑∏∂∇→⇒⇔⇌∈∠△Α-Ωα-ω]/;

/** "2H2 + O2 -> 2H2O" and "H2O" render best through mhchem. */
function chemistryTeX(toks: Tok[], s: number, e: number): string | null {
  let elements = 0;
  let counted = false;
  let out = '';
  for (let k = s; k < e; k++) {
    const t = toks[k];
    if (t.kind === 'word') {
      const n = elementCount(t.text);
      if (!n) return null;
      elements += n;
      if (toks[k + 1]?.kind === 'num') counted = true; // H₂O already reads fine; H2O doesn't
      out += t.text;
    } else if (t.kind === 'op' && Object.prototype.hasOwnProperty.call(CHEM_ARROWS, t.text)) {
      counted = true;
      out += CHEM_ARROWS[t.text];
    } else if (t.kind === 'op' && t.text === '+') out += '+';
    else if (t.kind === 'sub') out += [...t.text].map((c) => FROM_SUBSCRIPT[c] ?? '').join('');
    else if (t.kind === 'sup') out += `^{${[...t.text].map((c) => FROM_SUPERSCRIPT[c] ?? '').join('')}}`;
    else if (t.kind === 'num' || t.kind === 'lp' || t.kind === 'rp') out += t.text;
    else if (t.kind === 'ws') out += ' ';
    else return null;
  }
  return elements >= 2 && counted && !CHEM_EXCLUDED.has(out) ? `\\ce{${out}}` : null;
}

function canStart(toks: Tok[], i: number, parser: Parser): boolean {
  const prev = toks[i - 1];
  if (prev && (GLUE.has(prev.kind) || NO_START_AFTER.has(prev.text) || LETTER.test(prev.text))) return false;
  // A sign starts a run only right before its operand: "-6/4", not the list-like "- 6/4".
  if (toks[i].kind === 'op' && SIGNS.has(toks[i].text)) return parser.atomStart(i + 1);
  return parser.atomStart(i);
}

interface Run {
  end: number;
  tex: string | null;
  /** The run is one parenthesized group: keep the parentheses as text and look inside. */
  unwrap?: boolean;
}

function tryRun(toks: Tok[], i: number): Run {
  const parser = new Parser(toks);
  const end = parser.expr(i, 'top');
  const reject = { end: i + 1, tex: null };
  if (end <= i) return reject;

  // Never convert half an expression: "6/4ths", "x^", "v = u + at".
  const next = toks[end];
  if (next && (GLUE.has(next.kind) || /^[/^_]$/.test(next.text) || (next.kind === 'other' && LETTER.test(next.text))))
    return reject;
  if (parser.dangling !== null) {
    const at = parser.dangling;
    let k = at + 1;
    while (toks[k]?.kind === 'ws') k++;
    const lineEnds = !toks[k] || toks[k].text === '\n';
    const dash = (toks[at].text === '-' || toks[at].text === '−') && toks[at - 1]?.kind === 'ws' && toks[at + 1]?.kind === 'ws';
    if (!lineEnds && !(dash && toks[k].kind === 'word')) return reject;
  }

  const source = parser.source(i, end);
  if (DATE.test(source) || EXCLUDED.has(source.toLowerCase())) return reject;
  if (toks[i].kind === 'lp' && new Parser(toks).paren(i) === end) return { end: i + 1, tex: null, unwrap: true };
  const chemistry = chemistryTeX(toks, i, end);
  if (chemistry) return { end, tex: chemistry };
  return { end, tex: parser.triggered() ? fixTeX(parser.tex(i, end)) : null };
}

/** Splits plain text into text and inline math pieces. */
export function plainPieces(text: string): MathPiece[] {
  if (!HINT.test(text)) return [{ type: 'text', text }];
  const toks = tokenize(text);
  const probe = new Parser(toks);
  const pieces: MathPiece[] = [];
  let buffer = '';
  for (let i = 0; i < toks.length; ) {
    if (canStart(toks, i, probe)) {
      const run = tryRun(toks, i);
      if (run.tex !== null) {
        if (buffer) pieces.push({ type: 'text', text: buffer });
        buffer = '';
        pieces.push({ type: 'math', tex: run.tex, display: false });
        i = run.end;
        continue;
      }
      if (!run.unwrap && run.end > i + 1) {
        // Not math: keep the whole run as text so its parts aren't retried one by one.
        for (; i < run.end; i++) buffer += toks[i].shown ?? toks[i].text;
        continue;
      }
    }
    buffer += toks[i].shown ?? toks[i].text;
    i++;
  }
  if (buffer) pieces.push({ type: 'text', text: buffer });
  return pieces;
}

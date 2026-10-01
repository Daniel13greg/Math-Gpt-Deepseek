/**
 * A small, safe expression compiler for graphing y = f(x).
 *
 * Supports + - * / ^ (and **), unary minus, implicit multiplication (2x, 3(x+1), x sin x),
 * |abs| bars, √, factorial-free scientific functions, and the constants pi/π and e.
 * Never uses eval/Function, so model-generated expressions can't run code.
 */

export type CompiledExpr = (x: number) => number;

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' | '(' | ')' | ',' | '|' | '√' };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: (v) => 1 / Math.cos(v),
  csc: (v) => 1 / Math.sin(v),
  cot: (v) => 1 / Math.tan(v),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: 2 * Math.PI };

const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const isFunctionName = (name: string) => own(FUNCTIONS, name);
const isConstantName = (name: string) => own(CONSTANTS, name);

/** Names tried longest-first when splitting runs of letters like "sinx" or "pix". */
const KNOWN_NAMES = [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), 'x'].sort((a, b) => b.length - a.length);

export class ExprError extends Error {}

function normalize(source: string): string {
  let s = source
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\pi/g, 'pi')
    .replace(/\\left|\\right/g, '')
    .replace(/\\(sin|cos|tan|ln|log|exp|sqrt)/g, '$1')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))
    .trim();
  // Drop a leading "y =", "f(x) =", "g(x)=" etc.
  s = s.replace(/^\s*(?:y|[a-zA-Z]\s*\(\s*x\s*\))\s*=\s*/, '');
  return s;
}

function splitIdentifier(run: string): string[] {
  const parts: string[] = [];
  let rest = run;
  while (rest.length > 0) {
    const name = KNOWN_NAMES.find((n) => rest.startsWith(n));
    if (!name) throw new ExprError(`Unknown name "${rest}"`);
    parts.push(name);
    rest = rest.slice(name.length);
  }
  return parts;
}

function tokenize(source: string): Token[] {
  const s = normalize(source);
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new ExprError(`Bad number at "${s.slice(i)}"`);
      tokens.push({ type: 'num', value: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Zπ]/.test(c)) {
      const m = /^[a-zA-Zπ][a-zA-Zπ0-9]*/.exec(s.slice(i))!;
      let run = m[0];
      // Keep digits only for names like log10/log2; otherwise "x2" means x*2.
      if (!isFunctionName(run)) run = /^[a-zA-Zπ]+/.exec(run)![0];
      for (const part of isFunctionName(run) ? [run] : splitIdentifier(run)) tokens.push({ type: 'id', value: part });
      i += run.length;
    } else if ('+-*/^(),|√'.includes(c)) {
      tokens.push({ type: 'op', value: c as Token['value'] & string } as Token);
      i++;
    } else if (c === '[') {
      tokens.push({ type: 'op', value: '(' });
      i++;
    } else if (c === ']') {
      tokens.push({ type: 'op', value: ')' });
      i++;
    } else {
      throw new ExprError(`Unexpected "${c}"`);
    }
  }
  return tokens;
}

type Node = (x: number) => number;

class Parser {
  private pos = 0;
  private absDepth = 0;

  constructor(private tokens: Token[]) {}

  parse(): Node {
    if (this.tokens.length === 0) throw new ExprError('Empty expression');
    const node = this.expr();
    if (this.pos < this.tokens.length) throw new ExprError('Unexpected input after expression');
    return node;
  }

  private peek() {
    return this.tokens[this.pos];
  }

  private isOp(value: string) {
    const t = this.peek();
    return t?.type === 'op' && t.value === value;
  }

  private expect(value: string) {
    if (!this.isOp(value)) throw new ExprError(`Expected "${value}"`);
    this.pos++;
  }

  private expr(): Node {
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.tokens[this.pos++] as { value: string }).value;
      const l = left;
      const r = this.term();
      left = op === '+' ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }

  /** A token that can start an implicitly multiplied factor: 2x, x(x+1), 3 sin x. */
  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.type === 'num' || t.type === 'id') return true;
    if (t.type === 'op' && (t.value === '(' || t.value === '√')) return true;
    // An opening "|" only when we're not inside |...| (otherwise it closes).
    return t.type === 'op' && t.value === '|' && this.absDepth === 0;
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.tokens[this.pos++] as { value: string }).value;
        const l = left;
        const r = this.unary();
        left = op === '*' ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
      } else if (this.startsFactor()) {
        const l = left;
        const r = this.power();
        left = (x) => l(x) * r(x);
      } else {
        return left;
      }
    }
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.pos++;
      const inner = this.unary();
      return (x) => -inner(x);
    }
    if (this.isOp('+')) {
      this.pos++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.isOp('^')) {
      this.pos++;
      const exponent = this.unary(); // Right-associative; allows x^-2.
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw new ExprError('Unexpected end of expression');
    this.pos++;

    if (t.type === 'num') {
      const v = t.value;
      return () => v;
    }

    if (t.type === 'id') {
      if (t.value === 'x') return (x) => x;
      if (isConstantName(t.value)) {
        const v = CONSTANTS[t.value];
        return () => v;
      }
      const fn = FUNCTIONS[t.value];
      if (this.isOp('(')) {
        this.pos++;
        const args = [this.expr()];
        while (this.isOp(',')) {
          this.pos++;
          args.push(this.expr());
        }
        this.expect(')');
        if (args.length === 1) {
          const a = args[0];
          return (x) => fn(a(x));
        }
        return (x) => fn(...args.map((a) => a(x)));
      }
      // "sin x" / "ln x^2": take the next power as the argument.
      const arg = this.power();
      return (x) => fn(arg(x));
    }

    switch (t.value) {
      case '(': {
        const inner = this.expr();
        this.expect(')');
        return inner;
      }
      case '|': {
        this.absDepth++;
        const inner = this.expr();
        this.absDepth--;
        this.expect('|');
        return (x) => Math.abs(inner(x));
      }
      case '√': {
        const inner = this.power();
        return (x) => Math.sqrt(inner(x));
      }
      default:
        throw new ExprError(`Unexpected "${t.value}"`);
    }
  }
}

export function compileExpr(source: string): CompiledExpr {
  return new Parser(tokenize(source)).parse();
}

export function tryCompileExpr(source: string): CompiledExpr | null {
  try {
    const f = compileExpr(source);
    f(0.5); // Smoke-test evaluation.
    return f;
  } catch {
    return null;
  }
}

import { compileExpr, tryCompileExpr } from '../mathExpr';

const at = (expr: string, x: number) => compileExpr(expr)(x);

describe('compileExpr', () => {
  it.each([
    ['x^2 - 4', 3, 5],
    ['2x + 1', 2, 5],
    ['-x^2', 3, -9],
    ['x^-1', 4, 0.25],
    ['2^3^2', 0, 512],
    ['3(x+1)', 1, 6],
    ['(x+1)(x-1)', 3, 8],
    ['x(x+1)', 2, 6],
    ['sin(pi/2)', 0, 1],
    ['sinx', Math.PI / 2, 1],
    ['sin x', Math.PI / 2, 1],
    ['2 sin(x) cos(x)', 0.3, Math.sin(0.6)],
    ['|x - 3|', 1, 2],
    ['2|x|', -4, 8],
    ['√x', 9, 3],
    ['√(x+7)', 9, 4],
    ['ln(e)', 0, 1],
    ['log(100)', 0, 2],
    ['log2(8)', 0, 3],
    ['e^x', 1, Math.E],
    ['ex', 2, 2 * Math.E],
    ['pix', 2, 2 * Math.PI],
    ['y = x**2', 3, 9],
    ['f(x) = 1/x', 4, 0.25],
    ['3x²', 2, 12],
    ['x × 2 − 1', 5, 9],
    ['max(x, 2)', 1, 2],
    ['\\frac', 0, NaN],
  ])('%s at x=%d', (expr, x, expected) => {
    if (Number.isNaN(expected)) {
      expect(tryCompileExpr(expr)).toBeNull();
      return;
    }
    expect(at(expr, x)).toBeCloseTo(expected, 10);
  });

  it('rejects code and unknown names instead of evaluating them', () => {
    expect(tryCompileExpr('alert(1)')).toBeNull();
    expect(tryCompileExpr('constructor')).toBeNull();
    expect(tryCompileExpr('x;process.exit()')).toBeNull();
    expect(tryCompileExpr('')).toBeNull();
    expect(tryCompileExpr('(x+1')).toBeNull();
  });

  it('returns NaN / Infinity for points outside the domain', () => {
    expect(at('sqrt(x)', -1)).toBeNaN();
    expect(at('1/x', 0)).toBe(Infinity);
  });
});

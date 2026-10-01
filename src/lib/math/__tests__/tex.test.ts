import { fixTeX } from '../tex';

describe('fixTeX fractions', () => {
  it.each([
    ['6/4', '\\frac{6}{4}'],
    ['-6/4 = -3/2', '-\\frac{6}{4} = -\\frac{3}{2}'],
    ['6 / 4', '\\frac{6}{4}'],
    ['(x+1)/(x-1)', '\\frac{x+1}{x-1}'],
    ['x^2/4', '\\frac{x^2}{4}'],
    ['3x^2/2', '\\frac{3x^2}{2}'],
    ['1/2mv^2', '\\frac{1}{2}mv^2'],
    ['-b/2a', '-\\frac{b}{2a}'],
    ['dy/dx = 2x', '\\frac{dy}{dx} = 2x'],
    ['d/dx(x^2)', '\\frac{d}{dx}(x^2)'],
    ['\\sqrt{2}/2', '\\frac{\\sqrt{2}}{2}'],
    ['\\pi/4', '\\frac{\\pi}{4}'],
    ['2\\pi r/3', '\\frac{2\\pi r}{3}'],
    ['\\sin(x)/x', '\\frac{\\sin(x)}{x}'],
    ['a/b/c', '\\frac{\\frac{a}{b}}{c}'],
    ['\\boxed{3/2}', '\\boxed{\\frac{3}{2}}'],
    ['(1/2)x', '\\frac{1}{2}x'],
    ['(1/2)^2', '\\left(\\frac{1}{2}\\right)^2'],
    ['\\Delta y/\\Delta x', '\\frac{\\Delta y}{\\Delta x}'],
    ['\\lim_{h \\to 0} (f(x+h)-f(x))/h', '\\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}'],
  ])('%s', (input, expected) => {
    expect(fixTeX(input)).toBe(expected);
  });

  it.each([
    ['x^{1/2}'],
    ['e^{-x/2}'],
    ['\\frac{a}{b}'],
    ['\\text{m/s}'],
    ['\\mathbb{Z}/n\\mathbb{Z}'],
    ['9.8 \\, m/s^2'],
    ['a // b'],
  ])('leaves %s alone', (input) => {
    expect(fixTeX(input)).toBe(input);
  });
});

describe('fixTeX symbols and syntax', () => {
  it.each([
    ['a <= b', 'a \\le b'],
    ['x >= 0', 'x \\ge 0'],
    ['x != 0', 'x \\ne 0'],
    ['5!=120', '5!=120'],
    ['x +- 2', 'x \\pm 2'],
    ['x -> 0', 'x \\to 0'],
    ['2*3', '2\\times3'],
    ['a*b', 'a\\cdot b'],
    ['z^*', 'z^*'],
    ['sqrt(16) = 4', '\\sqrt{16} = 4'],
    ['\\sqrt(x+1)', '\\sqrt{x+1}'],
    ['√(x+1) + √2', '\\sqrt{x+1} + \\sqrt{2}'],
    ['abs(x-3) < 5', '\\left|x-3\\right| < 5'],
    ['e^(2x)', 'e^{2x}'],
    ['x^10', 'x^{10}'],
    ['x^-1', 'x^{-1}'],
    ['e^-kt', 'e^{-kt}'],
    ['e^2x', 'e^{2x}'],
    ['x_10', 'x_{10}'],
    ['x² − 5x + 6', 'x^{2} - 5x + 6'],
    ['30° + 60°', '30^{\\circ} + 60^{\\circ}'],
    ['2πr', '2\\pi r'],
    ['1½', '1\\frac{1}{2}'],
    ['x ≤ 3', 'x \\le 3'],
    ['sin^2(x) + cos^2(x) = 1', '\\sin^2(x) + \\cos^2(x) = 1'],
    ['sinx', '\\sin x'],
    ['mgsin\\theta', 'mg\\sin\\theta'],
    ['2pi', '2\\pi'],
    ['Area = lw', '\\text{Area} = lw'],
    ['x_{max}', 'x_{\\max}'],
    ['50%', '50\\%'],
    ['a &= b \\\\ c &= d', '\\begin{aligned}a &= b \\\\ c &= d\\end{aligned}'],
  ])('%s', (input, expected) => {
    expect(fixTeX(input)).toBe(expected);
  });

  it.each([
    ['\\text{if } x > 0'],
    ['\\ce{2H2 + O2 -> 2H2O}'],
    ['\\begin{cases} x & x > 0 \\\\ -x & \\text{otherwise} \\end{cases}'],
    ['\\operatorname{lcm}(4, 6)'],
    ['\\triangle ABC \\cong \\triangle DEF'],
    ["f'(x) = 3x^2"],
  ])('leaves %s alone', (input) => {
    expect(fixTeX(input)).toBe(input);
  });

  it('never throws on malformed input', () => {
    for (const input of ['{', '}', '\\', '((', 'x^', '\\frac{', '\\left(', '/', '//', '^(', '\\sqrt[']) {
      expect(() => fixTeX(input)).not.toThrow();
    }
  });
});

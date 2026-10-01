import { prettifyMarkdown, splitMath } from '../segment';

const md = prettifyMarkdown;

describe('prettifyMarkdown: plain-text math becomes TeX', () => {
  it.each([
    ['Simplify 6/4.', 'Simplify \\(\\frac{6}{4}\\).'],
    ['So 6/4 = 3/2', 'So \\(\\frac{6}{4} = \\frac{3}{2}\\)'],
    ['Solve x^2 - 5x + 6 = 0 now', 'Solve \\(x^2 - 5x + 6 = 0\\) now'],
    ['sqrt(16) = 4', '\\(\\sqrt{16} = 4\\)'],
    ['Then (x + 1)/(x - 1) is undefined', 'Then \\(\\frac{x + 1}{x - 1}\\) is undefined'],
    ['if a <= b', 'if \\(a \\le b\\)'],
    ['where x != 0.', 'where \\(x \\ne 0\\).'],
    ['2*3 = 6', '\\(2\\times3 = 6\\)'],
    ['3 x 4 = 12', '\\(3 \\times 4 = 12\\)'],
    ['x^10 and e^(2x)', '\\(x^{10}\\) and \\(e^{2x}\\)'],
    ['dy/dx = 2x', '\\(\\frac{dy}{dx} = 2x\\)'],
    ['Add 1 1/2 cups', 'Add \\(1{\\frac{1}{2}}\\) cups'],
    ['x = -6/4', '\\(x = -\\frac{6}{4}\\)'],
    ['x² − 5x + 6 = 0', '\\(x^{2} - 5x + 6 = 0\\)'],
    ['E = mc^2', '\\(E = mc^2\\)'],
    ['KE = 1/2mv^2', '\\(KE = \\frac{1}{2}mv^2\\)'],
    ['x = (-b ± sqrt(b^2 - 4ac))/(2a)', '\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)'],
    ['If x = 3, then 2x + 1 = 7.', 'If \\(x = 3\\), then \\(2x + 1 = 7\\).'],
    ['p < 0.05', '\\(p < 0.05\\)'],
    ['The answer is \\frac{3}{2}.', 'The answer is \\(\\frac{3}{2}\\).'],
    ['lim x->0 sin(x)/x = 1', '\\(\\lim_{x\\to0} \\frac{\\sin(x)}{x} = 1\\)'],
    ['x = 5', '\\(x = 5\\)'],
    ['Water: 2H2 + O2 -> 2H2O', 'Water: \\(\\ce{2H2 + O2 -> 2H2O}\\)'],
    ['Drink H2O daily', 'Drink \\(\\ce{H2O}\\) daily'],
    ['a = 9.8 m/s^2', '\\(a = 9.8\\) m/s²'],
    ['1,250 + 750 = 2,000', '\\(1{,}250 + 750 = 2{,}000\\)'],
    ['(6/4)', '(\\(\\frac{6}{4}\\))'],
    ['so (x-2)(x-3) works', 'so \\((x-2)(x-3)\\) works'],
    ['sum -5 gives -2 and (-3)', 'sum −5 gives −2 and (−3)'],
  ])('%s', (input, expected) => {
    expect(md(input)).toBe(expected);
  });
});

describe('prettifyMarkdown: prose stays prose', () => {
  it.each([
    ['Due 10/1/2026 at 5pm'],
    ['N/A and I/O, w/o help'],
    ['speed in km/h or m/s'],
    ['the x-axis and COVID-19'],
    ['It is 50% done'],
    ['Costs $5 and $10, or $5/hour'],
    ['Call 555-1234'],
    ['Pages 4-6, ages 5-10'],
    ['if a == b then i++ and x += 1'],
    ['Section 5(a)(2)'],
    ['Open 24/7'],
    ['and/or he/she'],
    ['e.g. version 2.0'],
    ['Page 3 of 10'],
    ['v = u + at'],
    ['the 6/4ths rule'],
    ['A4 paper, MP3 files, B2B sales'],
    ['x²'],
    ['H₂O'],
    ['mg/L'],
  ])('%s', (input) => {
    expect(md(input)).toBe(input);
  });
});

describe('prettifyMarkdown: markdown structure', () => {
  it('keeps list, heading and quote markers out of math', () => {
    expect(md('- 6/4 is a fraction')).toBe('- \\(\\frac{6}{4}\\) is a fraction');
    expect(md('1. x^2 + 1')).toBe('1. \\(x^2 + 1\\)');
    expect(md('### Step 2: 6/4')).toBe('### Step 2: \\(\\frac{6}{4}\\)');
    expect(md('> 6/4')).toBe('> \\(\\frac{6}{4}\\)');
  });

  it('works inside emphasis and tables', () => {
    expect(md('**6/4**')).toBe('**\\(\\frac{6}{4}\\)**');
    expect(md('*x^2*')).toBe('*\\(x^2\\)*');
    expect(md('| a | b |\n|---|---|\n| 6/4 | x^2 |')).toBe('| a | b |\n|---|---|\n| \\(\\frac{6}{4}\\) | \\(x^2\\) |');
  });

  it('does not treat emphasis markers as multiplication', () => {
    expect(md('*x* and *y*')).toBe('*x* and *y*');
    expect(md('**Final answer:** x = 3/2')).toBe('**Final answer:** \\(x = \\frac{3}{2}\\)');
  });

  it('leaves code, links and URLs alone', () => {
    expect(md('`x = 6/4` and\n```\ny = 6/4\n```')).toBe('`x = 6/4` and\n```\ny = 6/4\n```');
    expect(md('[1/2](https://a.com/1/2) see https://b.com/x^2')).toBe(
      '[\\(\\frac{1}{2}\\)](https://a.com/1/2) see https://b.com/x^2',
    );
  });

  it('normalizes math the model already delimited', () => {
    expect(md('\\(6/4\\) and $x <= 3$ and \\[ (x+1)/2 \\]')).toBe('\\(\\frac{6}{4}\\) and $x \\le 3$ and \\[ \\frac{x+1}{2} \\]');
    expect(md('\\begin{align} x &= 6/4 \\end{align}')).toBe('\\begin{align} x &= \\frac{6}{4} \\end{align}');
  });

  it('keeps an unfinished expression intact while streaming', () => {
    expect(md('So 6/4 =')).toBe('So \\(\\frac{6}{4}\\) =');
    expect(md('So 6/')).toBe('So 6/');
  });

  it('handles a long mixed answer', () => {
    const answer = '### Solution\n\nFactor: x^2 - 5x + 6 = (x - 2)(x - 3), so x = 2 or x = 3.\n\n**Check:** 2^2 - 5(2) + 6 = 0 ✓';
    expect(md(answer)).toBe(
      '### Solution\n\nFactor: \\(x^2 - 5x + 6 = (x - 2)(x - 3)\\), so \\(x = 2\\) or \\(x = 3\\).\n\n**Check:** \\(2^2 - 5(2) + 6 = 0\\) ✓',
    );
  });
});

describe('splitMath', () => {
  it('splits a student message into text and math', () => {
    expect(splitMath('what is 6/4 simplified?')).toEqual([
      { type: 'text', text: 'what is ' },
      { type: 'math', tex: '\\frac{6}{4}', display: false },
      { type: 'text', text: ' simplified?' },
    ]);
  });

  it('understands TeX delimiters and keeps money as text', () => {
    expect(splitMath('Is $x^2$ more than $5 and $10?')).toEqual([
      { type: 'text', text: 'Is ' },
      { type: 'math', tex: 'x^2', display: false },
      { type: 'text', text: ' more than $5 and $10?' },
    ]);
    expect(splitMath('\\[\\frac{1}{2}\\]')).toEqual([{ type: 'math', tex: '\\frac{1}{2}', display: true }]);
  });

  it('returns plain text untouched', () => {
    expect(splitMath('Explain photosynthesis')).toEqual([{ type: 'text', text: 'Explain photosynthesis' }]);
  });
});

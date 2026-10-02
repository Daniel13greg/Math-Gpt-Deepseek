import { insertMath } from '../mathInput';

describe('insertMath', () => {
  it('appends inline LaTeX after the draft', () => {
    expect(insertMath('Solve', '\\frac{1}{2}x=3')).toBe('Solve \\(\\frac{1}{2}x=3\\) ');
    expect(insertMath('', 'x^2')).toBe('\\(x^2\\) ');
    expect(insertMath('Solve   ', 'x')).toBe('Solve \\(x\\) ');
  });

  it('leaves the draft alone when nothing was typed', () => {
    expect(insertMath('Solve', '  ')).toBe('Solve');
  });
});

import { texToUnicode, toUnicodeMath } from '../unicode';

describe('toUnicodeMath', () => {
  it.each([
    ['\\(\\frac{6}{4}\\)', '⁶⁄₄'],
    ['\\(\\frac{1}{2}\\)', '½'],
    ['Simplifying 6/4', 'Simplifying ⁶⁄₄'],
    ['Solve x^2 - 5x + 6 = 0', 'Solve x² − 5x + 6 = 0'],
    ['Parabola y = x^2 - 4', 'Parabola y = x² − 4'],
    ['Compute b^2 - 4ac', 'Compute b² − 4ac'],
    ['sqrt(16) = 4', '√16 = 4'],
    ['\\(\\sqrt{x+1}\\)', '√(x + 1)'],
    ['a <= b', 'a ≤ b'],
    ['x_1 + x_2 = 5', 'x₁ + x₂ = 5'],
    ['\\(\\theta = 30^\\circ\\)', 'θ = 30°'],
    ['(x+1)/(x-1) = 2', '(x + 1)/(x − 1) = 2'],
    ['\\(\\frac{a+b}{2}\\)', '(a + b)/2'],
    ['\\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\)', 'x = (−b ± √(b² − 4ac))/(2a)'],
    ['Water is \\(\\ce{H2O}\\)', 'Water is H₂O'],
    ['Burning 2H2 + O2 -> 2H2O', 'Burning 2H₂ + O₂ → 2H₂O'],
    ['\\(\\frac{dy}{dx}\\)', 'dy/dx'],
    ['\\(e^{i\\pi} + 1 = 0\\)', 'e^(iπ) + 1 = 0'],
    ['\\(x \\in \\mathbb{R}\\)', 'x ∈ ℝ'],
    ['\\(\\overline{AB}\\)', 'A̅B̅'],
    ['\\(\\left(\\frac{1}{2}\\right)^2\\)', '(½)²'],
    ['\\(\\int_0^1 x\\,dx\\)', '∫₀¹ x dx'],
    ['Discriminant ≥ 0?', 'Discriminant ≥ 0?'],
    ['x = ±2 and 2 1/2 cups', 'x = ±2 and 2½ cups'],
    ['A = pi*r^2', 'A = π·r²'],
    ['Photosynthesis', 'Photosynthesis'],
  ])('%s', (input, expected) => {
    expect(toUnicodeMath(input)).toBe(expected);
  });
});

describe('texToUnicode', () => {
  it('falls back to readable text for scripts without Unicode forms', () => {
    expect(texToUnicode('F_{g}')).toBe('F_g');
    expect(texToUnicode('x^{1/2}')).toBe('x^(1/2)');
  });

  it('never throws', () => {
    for (const input of ['\\frac{', '^', '_', '\\sqrt[', '\\left(', '{{{', '\\']) {
      expect(() => texToUnicode(input)).not.toThrow();
    }
  });
});

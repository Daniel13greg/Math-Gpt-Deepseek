import { extractJson, repairLatexEscapes } from '../json';

describe('repairLatexEscapes', () => {
  it('keeps LaTeX intact inside JSON strings', () => {
    const raw = String.raw`{"q":"Find \frac{1}{2} + \theta \times \beta and \nabla f, \rho, \text{m}, \underline{x}, \(x\)"}`;
    expect(JSON.parse(repairLatexEscapes(raw)).q).toBe(
      String.raw`Find \frac{1}{2} + \theta \times \beta and \nabla f, \rho, \text{m}, \underline{x}, \(x\)`,
    );
  });

  it('preserves real JSON escapes and already-escaped backslashes', () => {
    const raw = String.raw`{"a":"line1\nThe end\tTab \"q\" é \\frac"}`;
    expect(JSON.parse(repairLatexEscapes(raw)).a).toBe('line1\nThe end\tTab "q" é \\frac');
  });

  it('treats \\n followed by non-LaTeX words as newlines', () => {
    expect(JSON.parse(repairLatexEscapes(String.raw`{"a":"x\nx\n\nStep 2"}`)).a).toBe('x\nx\n\nStep 2');
  });
});

describe('extractJson', () => {
  it('pulls JSON out of fences and surrounding prose', () => {
    expect(extractJson('Here you go:\n```json\n{"a": [1, 2]}\n```\nEnjoy')).toEqual({ a: [1, 2] });
    expect(extractJson('Sure! {"ok": true} hope that helps')).toEqual({ ok: true });
  });

  it('tolerates trailing commas', () => {
    expect(extractJson('{"a": [1, 2,], "b": 3,}')).toEqual({ a: [1, 2], b: 3 });
  });

  it('throws when there is no JSON', () => {
    expect(() => extractJson('no json here')).toThrow();
  });
});

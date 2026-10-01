import {
  addToModel,
  costByModel,
  costOf,
  describeUsage,
  formatCost,
  formatTokens,
  fromApiUsage,
  mergeByModel,
  monthKey,
} from '../usage';

const usage = (prompt: number, cached: number, out: number) => ({
  requests: 1,
  promptTokens: prompt,
  cacheHitTokens: cached,
  completionTokens: out,
  reasoningTokens: 0,
});

describe('usage', () => {
  it('converts API usage and sums per model', () => {
    const u = fromApiUsage({ promptTokens: 100, completionTokens: 50, cacheHitTokens: 40, reasoningTokens: 20 });
    expect(u).toEqual({ requests: 1, promptTokens: 100, cacheHitTokens: 40, completionTokens: 50, reasoningTokens: 20 });
    const byModel = addToModel(addToModel(undefined, 'flash', u), 'flash', u);
    expect(byModel.flash.requests).toBe(2);
    expect(byModel.flash.promptTokens).toBe(200);
    expect(mergeByModel(byModel, { pro: u }).pro.completionTokens).toBe(50);
  });

  it('prices cache hits, misses and output separately', () => {
    const price = { input: 0.5, cachedInput: 0.05, output: 2 };
    // 600 uncached × 0.5 + 400 cached × 0.05 + 1000 out × 2, per million
    expect(costOf(usage(1000, 400, 1000), price)).toBeCloseTo((300 + 20 + 2000) / 1e6);
  });

  it('only reports a cost when every model used has a price', () => {
    const byModel = { a: usage(1e6, 0, 0), b: usage(1e6, 0, 0) };
    expect(costByModel(byModel, { a: { input: 1, cachedInput: 0, output: 0 } })).toBeNull();
    expect(
      costByModel(byModel, { a: { input: 1, cachedInput: 0, output: 0 }, b: { input: 2, cachedInput: 0, output: 0 } }),
    ).toBe(3);
  });

  it('formats tokens and costs compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(1234)).toBe('1.2K');
    expect(formatTokens(56_700)).toBe('57K');
    expect(formatTokens(2_340_000)).toBe('2.34M');
    expect(formatCost(0.00421)).toBe('$0.0042');
    expect(formatCost(1.234)).toBe('$1.23');
    expect(formatCost(0.00001)).toBe('<$0.0001');
    expect(describeUsage({ a: usage(1000, 0, 234) }, {})).toBe('1.2K tokens');
  });

  it('keys months in local time', () => {
    expect(monthKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01');
  });
});

import type { Usage } from '@/lib/deepseek/client';
import type { TokenUsage, UsageByModel } from '@/lib/types';
import { t } from '@/i18n';

/** USD per million tokens, as listed on DeepSeek's pricing page. */
export interface ModelPrice {
  /** Input tokens that miss the context cache. */
  input: number;
  /** Input tokens served from the context cache. */
  cachedInput: number;
  /** Output tokens, reasoning included. */
  output: number;
}

export const EMPTY_USAGE: TokenUsage = {
  requests: 0,
  promptTokens: 0,
  cacheHitTokens: 0,
  completionTokens: 0,
  reasoningTokens: 0,
};

export function fromApiUsage(u: Usage): TokenUsage {
  return {
    requests: 1,
    promptTokens: u.promptTokens,
    cacheHitTokens: u.cacheHitTokens ?? 0,
    completionTokens: u.completionTokens,
    reasoningTokens: u.reasoningTokens ?? 0,
  };
}

export function addUsage(a: TokenUsage | undefined, b: TokenUsage): TokenUsage {
  const base = a ?? EMPTY_USAGE;
  return {
    requests: base.requests + b.requests,
    promptTokens: base.promptTokens + b.promptTokens,
    cacheHitTokens: base.cacheHitTokens + b.cacheHitTokens,
    completionTokens: base.completionTokens + b.completionTokens,
    reasoningTokens: base.reasoningTokens + b.reasoningTokens,
  };
}

export function addToModel(byModel: UsageByModel | undefined, model: string, usage: TokenUsage): UsageByModel {
  return { ...byModel, [model]: addUsage(byModel?.[model], usage) };
}

export function mergeByModel(...items: (UsageByModel | undefined)[]): UsageByModel {
  let out: UsageByModel = {};
  for (const item of items) {
    for (const [model, usage] of Object.entries(item ?? {})) out = addToModel(out, model, usage);
  }
  return out;
}

export function totalUsage(byModel: UsageByModel | undefined): TokenUsage {
  return Object.values(byModel ?? {}).reduce<TokenUsage>((sum, u) => addUsage(sum, u), EMPTY_USAGE);
}

export function costOf(usage: TokenUsage, price: ModelPrice): number {
  const uncached = Math.max(0, usage.promptTokens - usage.cacheHitTokens);
  return (uncached * price.input + usage.cacheHitTokens * price.cachedInput + usage.completionTokens * price.output) / 1e6;
}

/** Total cost, or null when any model with usage has no price set. */
export function costByModel(byModel: UsageByModel | undefined, prices: Record<string, ModelPrice | undefined>): number | null {
  let total = 0;
  for (const [model, usage] of Object.entries(byModel ?? {})) {
    const price = prices[model];
    if (!price) return null;
    total += costOf(usage, price);
  }
  return total;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`;
}

export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  return `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;
}

/** Calendar month in local time, e.g. "2026-10". */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** "12.3K tokens · $0.0042" (cost only when every model used has a price). */
export function describeUsage(byModel: UsageByModel | undefined, prices: Record<string, ModelPrice | undefined>): string {
  const total = totalUsage(byModel);
  const tokens = t('usage.totalTokens', { tokens: formatTokens(total.promptTokens + total.completionTokens) });
  const cost = costByModel(byModel, prices);
  return cost === null ? tokens : `${tokens} · ${formatCost(cost)}`;
}

import { create } from 'zustand';

import { kv } from '@/lib/storage/kv';
import type { TokenUsage, UsageByModel } from '@/lib/types';
import { addToModel, monthKey, type ModelPrice } from '@/lib/usage';

interface PersistedUsage {
  /** Usage per calendar month ("2026-10") and model. */
  months: Record<string, UsageByModel>;
  /** USD per million tokens, entered by the user from DeepSeek's pricing page. */
  prices: Record<string, ModelPrice>;
}

interface UsageState extends PersistedUsage {
  record: (model: string, usage: TokenUsage) => void;
  setPrice: (model: string, price: ModelPrice | null) => void;
  resetStats: () => void;
}

const KEY = 'usage:v1';

function load(): PersistedUsage {
  try {
    const raw = kv.getItemSync(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { months: parsed.months ?? {}, prices: parsed.prices ?? {} };
  } catch {
    return { months: {}, prices: {} };
  }
}

export const useUsage = create<UsageState>()((set, get) => {
  const save = () => {
    const { months, prices } = get();
    kv.setItem(KEY, JSON.stringify({ months, prices }));
  };
  return {
    ...load(),
    record: (model, usage) => {
      const month = monthKey();
      const months = get().months;
      set({ months: { ...months, [month]: addToModel(months[month], model, usage) } });
      save();
    },
    setPrice: (model, price) => {
      const { [model]: _old, ...rest } = get().prices;
      set({ prices: price ? { ...rest, [model]: price } : rest });
      save();
    },
    resetStats: () => {
      set({ months: {} });
      save();
    },
  };
});

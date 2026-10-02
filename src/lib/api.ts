import type { ClientConfig } from '@/lib/ai/client';
import type { TokenUsage } from '@/lib/types';
import { fromApiUsage } from '@/lib/usage';
import { getApiKey, useSettings } from '@/store/settings';
import { useUsage } from '@/store/usage';

/**
 * Connection settings for a DeepSeek request. Every request's usage is added to the monthly
 * totals; `onUsage` also receives it, e.g. to attribute it to the message that caused it.
 */
export function apiConfig(onUsage?: (usage: TokenUsage, model: string) => void): ClientConfig {
  return {
    apiKey: getApiKey(),
    baseUrl: useSettings.getState().baseUrl,
    onUsage: (raw, model) => {
      const usage = fromApiUsage(raw);
      useUsage.getState().record(model, usage);
      onUsage?.(usage, model);
    },
  };
}

export const DEFAULT_BASE_URL = 'https://api.deepseek.com';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  vision: boolean;
}

/**
 * DeepSeek's catalog as of V4.1 (Sept 2026). Both models support thinking and
 * non-thinking modes through the `thinking` request parameter.
 */
export const MODELS: ModelOption[] = [
  {
    id: 'deepseek-flash',
    label: 'DeepSeek Flash',
    description: 'V4.1 Flash · fast, reads photos of problems',
    vision: true,
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'Strongest reasoning · text only',
    vision: false,
  },
];

export const DEFAULT_MODEL = 'deepseek-flash';
/** Used whenever a request contains images. */
export const DEFAULT_VISION_MODEL = 'deepseek-flash';

export type ReasoningEffort = 'low' | 'high' | 'max';

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/**
 * Model for small housekeeping calls such as chat titles: Flash when the user picked one of
 * DeepSeek's models, otherwise their custom model (it may be the only one their endpoint serves).
 */
export function utilityModel(selected: string): string {
  return MODELS.some((m) => m.id === selected) ? DEFAULT_MODEL : selected;
}

export function isKnownVisionModel(id: string): boolean {
  return MODELS.some((m) => m.id === id && m.vision);
}

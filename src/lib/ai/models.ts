import { APP_NAME } from '@/constants/app';

/**
 * The server the app talks to, and below its model IDs: the only provider details in the app.
 * People only ever see the labels. Settings can point the app at another server (e.g. your proxy).
 */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';

export interface ModelOption {
  /** Model ID sent to the server. Never shown. */
  id: string;
  /** Short name for the header button, e.g. "Flash". */
  name: string;
  /** Full name, e.g. "MathGPT Flash". */
  label: string;
  description: string;
  vision: boolean;
  recommended?: boolean;
}

/** The app's two math models. Both support Deep Think through the `thinking` request parameter. */
export const MODELS: ModelOption[] = [
  {
    id: 'deepseek-flash',
    name: 'Flash',
    label: `${APP_NAME} Flash`,
    description: 'Fast answers. Reads photos of problems.',
    vision: true,
    recommended: true,
  },
  {
    id: 'deepseek-v4-pro',
    name: 'Pro',
    label: `${APP_NAME} Pro`,
    description: 'Strongest reasoning, for proofs and hard problems. Text only.',
    vision: false,
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
/** Used whenever a request contains images. */
export const DEFAULT_VISION_MODEL = MODELS[0].id;

export type ReasoningEffort = 'low' | 'high' | 'max';

/** "MathGPT Flash"; a custom model ID from Settings is shown as typed. */
export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/** "Flash" for the header button; "Custom" for a model ID typed in Settings. */
export function modelName(id: string): string {
  return MODELS.find((m) => m.id === id)?.name ?? 'Custom';
}

export function isKnownVisionModel(id: string): boolean {
  return MODELS.some((m) => m.id === id && m.vision);
}

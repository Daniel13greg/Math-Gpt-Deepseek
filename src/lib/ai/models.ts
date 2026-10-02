import { APP_NAME } from '@/constants/app';

/**
 * The server the app talks to, and below its model IDs: the only provider details in the app.
 * People only ever see the labels. A build can bake in another server with EXPO_PUBLIC_API_BASE_URL
 * (e.g. the key-holding proxy in server/), and Settings can point the app at one too.
 */
const PROVIDER_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || PROVIDER_BASE_URL;

/** True for the built-in server's address (older versions saved it in settings). */
export function isBuiltInServer(url: string): boolean {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized === DEFAULT_BASE_URL.replace(/\/+$/, '') || normalized === PROVIDER_BASE_URL;
}

export interface ModelOption {
  /** Model ID sent to the server. Never shown. */
  id: string;
  /** Stable name for translations: `model.<key>.description`. */
  key: 'flash' | 'pro';
  /** Short name for the header button, e.g. "Flash". */
  name: string;
  /** Full name, e.g. "MathGPT Flash". */
  label: string;
  vision: boolean;
  recommended?: boolean;
}

/** The app's two math models. Both support Deep Think through the `thinking` request parameter. */
export const MODELS: ModelOption[] = [
  {
    id: 'deepseek-flash',
    key: 'flash',
    name: 'Flash',
    label: `${APP_NAME} Flash`,
    vision: true,
    recommended: true,
  },
  {
    id: 'deepseek-v4-pro',
    key: 'pro',
    name: 'Pro',
    label: `${APP_NAME} Pro`,
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

/** "Flash" for the header button; `custom` (translated by the caller) for a model ID typed in Settings. */
export function modelName(id: string, custom = 'Custom'): string {
  return MODELS.find((m) => m.id === id)?.name ?? custom;
}

/**
 * Model for small housekeeping calls such as chat titles: Flash when one of the app's models is
 * selected, otherwise the custom model (it may be the only one the server offers).
 */
export function utilityModel(selected: string): string {
  return MODELS.some((m) => m.id === selected) ? DEFAULT_MODEL : selected;
}

export function isKnownVisionModel(id: string): boolean {
  return MODELS.some((m) => m.id === id && m.vision);
}

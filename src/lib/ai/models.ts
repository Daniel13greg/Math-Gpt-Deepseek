import { APP_NAME } from '@/constants/app';

/**
 * The server the app talks to, and below its model ID: the only provider details in the app.
 * People only ever see the label. A build can bake in another server with EXPO_PUBLIC_API_BASE_URL
 * (e.g. the key-holding proxy in server/), and Settings can point the app at one too.
 */
const PROVIDER_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || PROVIDER_BASE_URL;

/** True for the built-in server's address (older versions saved it in settings). */
export function isBuiltInServer(url: string): boolean {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized === DEFAULT_BASE_URL.replace(/\/+$/, '') || normalized === PROVIDER_BASE_URL;
}

/** The app's math model. It reads photos and always thinks before answering in chat. */
export const MODEL = {
  /** Model ID sent to the server. Never shown. */
  id: 'deepseek-flash',
  label: `${APP_NAME} Flash`,
};

/** Models older versions offered; their usage history is still listed under these names. */
const LEGACY_LABELS: Record<string, string> = { 'deepseek-v4-pro': `${APP_NAME} Pro` };

/** "MathGPT Flash"; an ID the app doesn't know is shown as is. */
export function modelLabel(id: string): string {
  return id === MODEL.id ? MODEL.label : (LEGACY_LABELS[id] ?? id);
}

export type ReasoningEffort = 'low' | 'high' | 'max';

/** Reasoning effort for chat answers (thinking mode). */
export const REASONING_EFFORT: ReasoningEffort = 'high';

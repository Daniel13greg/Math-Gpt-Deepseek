import { create } from 'zustand';

import { DEFAULT_BASE_URL, DEFAULT_MODEL, type ReasoningEffort } from '@/lib/ai/models';
import { kv } from '@/lib/storage/kv';
import { secure } from '@/lib/storage/secure';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SttProvider = 'device' | 'cloud';

export interface PersistedSettings {
  model: string;
  /** "Deep Think": thinking mode for chat answers. */
  thinking: boolean;
  reasoningEffort: ReasoningEffort;
  baseUrl: string;
  theme: ThemePreference;
  /** BCP-47 language for speech recognition, e.g. en-US. */
  speechLang: string;
  sttProvider: SttProvider;
  /** OpenAI-compatible transcription endpoint base, used when sttProvider is "cloud". */
  sttBaseUrl: string;
  sttModel: string;
  ttsRate: number;
}

interface SettingsState extends PersistedSettings {
  apiKey: string;
  sttApiKey: string;
  update: (patch: Partial<PersistedSettings>) => void;
  setApiKey: (key: string) => Promise<void>;
  setSttApiKey: (key: string) => Promise<void>;
}

const SETTINGS_KEY = 'settings:v1';
const API_KEY = 'api_key';
const STT_API_KEY = 'stt_api_key';

export const DEFAULT_SETTINGS: PersistedSettings = {
  model: DEFAULT_MODEL,
  thinking: false,
  reasoningEffort: 'high',
  baseUrl: DEFAULT_BASE_URL,
  theme: 'system',
  speechLang: 'en-US',
  sttProvider: 'device',
  sttBaseUrl: 'https://api.openai.com/v1',
  sttModel: 'whisper-1',
  ttsRate: 1,
};

function loadSettings(): PersistedSettings {
  try {
    const raw = kv.getItemSync(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** A key baked in at build time via EXPO_PUBLIC_API_KEY (handy for development only). */
const ENV_API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export const useSettings = create<SettingsState>()((set, get) => ({
  ...loadSettings(),
  apiKey: secure.getSync(API_KEY) ?? '',
  sttApiKey: secure.getSync(STT_API_KEY) ?? '',
  update: (patch) => {
    set(patch);
    const { apiKey: _a, sttApiKey: _b, update: _u, setApiKey: _s, setSttApiKey: _t, ...persisted } = get();
    kv.setItem(SETTINGS_KEY, JSON.stringify(persisted));
  },
  setApiKey: async (key) => {
    const trimmed = key.trim();
    await secure.set(API_KEY, trimmed);
    set({ apiKey: trimmed });
  },
  setSttApiKey: async (key) => {
    const trimmed = key.trim();
    await secure.set(STT_API_KEY, trimmed);
    set({ sttApiKey: trimmed });
  },
}));

/** The key to use for requests: the one saved in Settings, else the build-time env key. */
export function getApiKey(): string {
  return useSettings.getState().apiKey || ENV_API_KEY;
}

export function useHasApiKey(): boolean {
  return useSettings((s) => Boolean(s.apiKey || ENV_API_KEY));
}

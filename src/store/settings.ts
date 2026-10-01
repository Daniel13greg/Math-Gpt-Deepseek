import { create } from 'zustand';

import { DEFAULT_ANSWER_STYLE, type AnswerStyle } from '@/constants/answerStyles';
import { applyLanguagePreference, type LanguagePreference } from '@/i18n';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, type ReasoningEffort } from '@/lib/deepseek/models';
import { kv } from '@/lib/storage/kv';
import { secure } from '@/lib/storage/secure';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SttProvider = 'device' | 'cloud';

export interface PersistedSettings {
  /** Bumped when a stored setting needs migrating (see loadSettings). */
  version: number;
  model: string;
  /** "Deep Think": DeepSeek thinking mode for answers, study tools and notes, on every model. */
  thinking: boolean;
  reasoningEffort: ReasoningEffort;
  /** How chat answers are written: full steps, Socratic tutor, just the answer, simple, exam-style. */
  answerStyle: AnswerStyle;
  baseUrl: string;
  theme: ThemePreference;
  /** UI language; "system" follows the device. */
  language: LanguagePreference;
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
const API_KEY = 'deepseek_api_key';
const STT_API_KEY = 'stt_api_key';

const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: PersistedSettings = {
  version: SETTINGS_VERSION,
  model: DEFAULT_MODEL,
  thinking: true,
  reasoningEffort: 'high',
  answerStyle: DEFAULT_ANSWER_STYLE,
  baseUrl: DEFAULT_BASE_URL,
  theme: 'system',
  language: 'system',
  speechLang: 'en-US',
  sttProvider: 'device',
  sttBaseUrl: 'https://api.openai.com/v1',
  sttModel: 'whisper-1',
  ttsRate: 1,
};

/** Upgrades settings saved by older versions of the app. */
export function migrateSettings(stored: Partial<PersistedSettings>): PersistedSettings {
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  // v2: Deep Think is on by default for every model, so turn it on once for existing installs.
  if ((stored.version ?? 1) < 2) settings.thinking = true;
  settings.version = SETTINGS_VERSION;
  return settings;
}

function loadSettings(): PersistedSettings {
  try {
    const raw = kv.getItemSync(SETTINGS_KEY);
    return raw ? migrateSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** A key baked in at build time via EXPO_PUBLIC_DEEPSEEK_API_KEY (handy for development only). */
const ENV_API_KEY = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ?? '';

const initialSettings = loadSettings();
applyLanguagePreference(initialSettings.language);

export const useSettings = create<SettingsState>()((set, get) => ({
  ...initialSettings,
  apiKey: secure.getSync(API_KEY) ?? '',
  sttApiKey: secure.getSync(STT_API_KEY) ?? '',
  update: (patch) => {
    set(patch);
    if (patch.language) applyLanguagePreference(patch.language);
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

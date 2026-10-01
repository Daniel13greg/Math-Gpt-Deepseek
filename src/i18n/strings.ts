/**
 * UI strings. Pure (no native imports), so DOM components can use it inside their WebView too.
 * English is the source of truth: every other locale must define the same keys (see the test).
 * Prompts sent to DeepSeek stay in English; the model already replies in the student's language.
 */
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { pt } from './locales/pt';
import { zh } from './locales/zh';

export type StringKey = keyof typeof en;
export type Dictionary = Record<StringKey, string>;
type PluralBase<K> = K extends `${infer B}_other` ? B : never;
export type PluralKey = PluralBase<StringKey>;
export type Params = Record<string, string | number>;

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português (Brasil)' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '简体中文' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, es, pt, fr, de, zh };

/** BCP-47 tag (e.g. "pt-BR", "zh-Hans-CN") → a supported language, or null. */
export function matchLanguage(tag: string | null | undefined): LanguageCode | null {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((l) => l.code === base) ? (base as LanguageCode) : null;
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function isStringKey(key: string): key is StringKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

export function translate(lang: LanguageCode, key: StringKey, params?: Params): string {
  return interpolate(DICTIONARIES[lang]?.[key] ?? en[key] ?? key, params);
}

/** Picks `<key>_one` or `<key>_other` with the language's plural rules; `{count}` is filled in. */
export function translatePlural(lang: LanguageCode, key: PluralKey, count: number, params?: Params): string {
  let rule = 'other';
  try {
    rule = new Intl.PluralRules(lang).select(count);
  } catch {
    rule = count === 1 ? 'one' : 'other';
  }
  const form = (rule === 'one' ? `${key}_one` : `${key}_other`) as StringKey;
  const dict = DICTIONARIES[lang] ?? en;
  const text = dict[form] ?? dict[`${key}_other` as StringKey] ?? en[`${key}_other` as StringKey];
  return interpolate(text, { count, ...params });
}

/** Translator bound to one language, for DOM components (which get `lang` as a prop). */
export function translator(lang: LanguageCode) {
  return {
    lang,
    t: (key: StringKey, params?: Params) => translate(lang, key, params),
    tp: (key: PluralKey, count: number, params?: Params) => translatePlural(lang, key, count, params),
  };
}

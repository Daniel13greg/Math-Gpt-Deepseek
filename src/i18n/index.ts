import { getLocales } from 'expo-localization';
import { useMemo } from 'react';
import { create } from 'zustand';

import {
  matchLanguage,
  translate,
  translatePlural,
  translator,
  type LanguageCode,
  type Params,
  type PluralKey,
  type StringKey,
} from './strings';

export * from './strings';

/** "system" follows the device language (falling back to English). */
export type LanguagePreference = 'system' | LanguageCode;

export function deviceLanguage(): LanguageCode {
  try {
    for (const locale of getLocales()) {
      const match = matchLanguage(locale.languageTag) ?? matchLanguage(locale.languageCode);
      if (match) return match;
    }
  } catch {
    // No locale information: use English.
  }
  return 'en';
}

const useLanguageStore = create<{ lang: LanguageCode }>(() => ({ lang: 'en' }));

/** Called by the settings store whenever the language preference loads or changes. */
export function applyLanguagePreference(preference: LanguagePreference) {
  const lang = preference === 'system' ? deviceLanguage() : preference;
  if (lang !== useLanguageStore.getState().lang) useLanguageStore.setState({ lang });
}

export function currentLanguage(): LanguageCode {
  return useLanguageStore.getState().lang;
}

/** For code outside React (errors, toasts, progress labels). */
export function t(key: StringKey, params?: Params): string {
  return translate(currentLanguage(), key, params);
}

export function tp(key: PluralKey, count: number, params?: Params): string {
  return translatePlural(currentLanguage(), key, count, params);
}

export function useLanguage(): LanguageCode {
  return useLanguageStore((s) => s.lang);
}

/** `const { t, tp, lang } = useT();` re-renders when the language changes. */
export function useT() {
  const lang = useLanguage();
  return useMemo(() => translator(lang), [lang]);
}

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { translator, type LanguageCode } from '@/i18n/strings';

const DomI18n = createContext(translator('en'));

/** DOM components receive the app language as a prop and provide it to everything they render. */
export function DomI18nProvider({ lang, children }: { lang: LanguageCode; children: ReactNode }) {
  const value = useMemo(() => translator(lang), [lang]);
  return <DomI18n.Provider value={value}>{children}</DomI18n.Provider>;
}

export function useDomT() {
  return useContext(DomI18n);
}

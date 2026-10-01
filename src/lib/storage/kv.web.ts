/** Web fallback for kv.ts (expo-sqlite on web needs COOP/COEP headers we don't want to require). */
export const kv = {
  getItemSync(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch (e) {
      console.warn(`kv: failed to save ${key}`, e);
    }
  },
  removeItem(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};

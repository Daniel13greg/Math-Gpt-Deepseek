import Storage from 'expo-sqlite/kv-store';

/**
 * Key-value storage backed by SQLite (no 6 MB AsyncStorage cap on Android).
 * Reads are synchronous so stores can hydrate before the first render;
 * writes are async so they never block the JS thread.
 */
export const kv = {
  getItemSync(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    Storage.setItemAsync(key, value).catch((e) => console.warn(`kv: failed to save ${key}`, e));
  },
  removeItem(key: string): void {
    Storage.removeItemAsync(key).catch((e) => console.warn(`kv: failed to remove ${key}`, e));
  },
};

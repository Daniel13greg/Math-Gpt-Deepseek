import * as SecureStore from 'expo-secure-store';

/** API keys live in the Keychain / Android Keystore, never in plain storage. */
export const secure = {
  getSync(key: string): string | null {
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  },
};

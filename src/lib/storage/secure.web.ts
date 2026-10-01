/**
 * Web has no keychain; keys are kept in localStorage for this origin only.
 * The web build is meant for development and previews.
 */
export const secure = {
  getSync(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(`secure:${key}`) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (value) globalThis.localStorage?.setItem(`secure:${key}`, value);
    else globalThis.localStorage?.removeItem(`secure:${key}`);
  },
};

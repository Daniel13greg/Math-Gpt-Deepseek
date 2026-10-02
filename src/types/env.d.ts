/// <reference types="expo/types" />

// Committed counterpart of the generated expo-env.d.ts so `tsc` works on a fresh clone.

declare namespace NodeJS {
  interface ProcessEnv {
    /** Optional development key baked into the bundle. Prefer entering it in Settings. */
    EXPO_PUBLIC_API_KEY?: string;
    /** Optional default API base URL, e.g. a key-holding proxy (server/proxy.mjs) for public builds. */
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}

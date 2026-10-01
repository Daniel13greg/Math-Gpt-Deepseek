import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type SpeechRecognitionLib = typeof import('expo-speech-recognition');

let cached: SpeechRecognitionLib | null | undefined;

/**
 * expo-speech-recognition is a native module that isn't part of Expo Go, and importing
 * it there throws. Load it lazily and only when the native side is present.
 */
export function getSpeechLib(): SpeechRecognitionLib | null {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
      cached = null;
    } else {
      // A static import would throw at startup in Expo Go, so load it only when present.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-speech-recognition') as SpeechRecognitionLib;
    }
  } catch {
    cached = null;
  }
  return cached;
}

export function isDeviceRecognitionAvailable(): boolean {
  const lib = getSpeechLib();
  if (!lib) return false;
  try {
    return lib.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function supportsOnDeviceRecognition(): boolean {
  try {
    return getSpeechLib()?.ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() ?? false;
  } catch {
    return false;
  }
}

export async function requestSpeechPermissions(): Promise<boolean> {
  const lib = getSpeechLib();
  if (!lib) return false;
  const result = await lib.ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone or speech permission was denied. Enable it in system settings.',
  'service-not-allowed': "Speech recognition isn't available on this device. Try cloud transcription in Settings.",
  'language-not-supported': "Speech recognition doesn't support the selected language on this device.",
  network: 'Speech recognition needs a network connection.',
  'audio-capture': "The audio couldn't be captured or read.",
  busy: 'Speech recognition is busy. Try again in a moment.',
};

export function speechErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? `Speech recognition failed (${code}).`;
}

/** Why voice features can't work in this build, for user-facing messages. */
export const NEEDS_DEV_BUILD_MESSAGE =
  'On-device speech recognition needs a development or production build (it is not in Expo Go). You can also add a Whisper-compatible API key under Settings → Speech to text.';

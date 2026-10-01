import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { t, type StringKey } from '@/i18n';

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

const ERROR_KEYS: Record<string, StringKey> = {
  'not-allowed': 'speech.error.notAllowed',
  'service-not-allowed': 'speech.error.serviceNotAllowed',
  'language-not-supported': 'speech.error.language',
  network: 'speech.error.network',
  'audio-capture': 'speech.error.audioCapture',
  busy: 'speech.error.busy',
};

export function speechErrorMessage(code: string, fallback?: string): string {
  const key = ERROR_KEYS[code];
  return key ? t(key) : (fallback ?? t('speech.error.failed', { code }));
}

/** Why voice features can't work in this build, for user-facing messages. */
export function needsDevBuildMessage(): string {
  return t('speech.needsDevBuild');
}

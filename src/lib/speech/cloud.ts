import { File } from 'expo-file-system';
import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

import { useSettings } from '@/store/settings';

/** Mono 16 kHz AAC at 32 kbps: ~14 MB per hour, under Whisper's 25 MB upload cap for long lectures. */
export const SPEECH_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

export function isCloudTranscriptionConfigured(): boolean {
  const s = useSettings.getState();
  return s.sttProvider === 'cloud' && Boolean(s.sttApiKey && s.sttBaseUrl);
}

/**
 * Transcribes an audio file with an OpenAI-compatible `/audio/transcriptions` endpoint
 * (OpenAI Whisper, Groq, a self-hosted whisper server, ...).
 */
export async function transcribeWithCloud(uri: string, fileName = 'audio.m4a', signal?: AbortSignal): Promise<string> {
  const { sttBaseUrl, sttApiKey, sttModel, speechLang } = useSettings.getState();
  if (!sttApiKey) throw new Error('Add a transcription API key in Settings → Speech to text.');

  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, fileName);
  } else {
    // expo-file-system's File is a Blob, which expo/fetch streams from disk.
    form.append('file', new File(uri) as unknown as Blob, fileName);
  }
  form.append('model', sttModel || 'whisper-1');
  form.append('response_format', 'json');
  const language = speechLang.split('-')[0];
  if (language) form.append('language', language);

  const base = sttBaseUrl.replace(/\/+$/, '');
  const response = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sttApiKey}` },
    body: form,
    signal,
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 200);
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {
      // keep raw text
    }
    throw new Error(`Transcription failed (${response.status}): ${message}`);
  }
  try {
    return String(JSON.parse(text).text ?? '').trim();
  } catch {
    return text.trim();
  }
}

import { Platform } from 'react-native';

import { useSettings } from '@/store/settings';

import { isCloudTranscriptionConfigured, transcribeWithCloud } from './cloud';
import { getSpeechLib, needsDevBuildMessage, requestSpeechPermissions, speechErrorMessage } from './recognition';
import { t } from '@/i18n';

/**
 * Transcribes an uploaded audio file. Cloud transcription handles any common format;
 * on-device transcription works on iOS and Android 13+ but is picky about formats
 * (16 kHz mono WAV/MP3/OGG transcribe best).
 */
export async function transcribeAudioFile(uri: string, fileName: string, onPartial?: (text: string) => void): Promise<string> {
  if (isCloudTranscriptionConfigured()) return transcribeWithCloud(uri, fileName);

  const lib = getSpeechLib();
  if (!lib || Platform.OS === 'web') throw new Error(needsDevBuildMessage());
  if (!(await requestSpeechPermissions())) throw new Error(speechErrorMessage('not-allowed'));

  const M = lib.ExpoSpeechRecognitionModule;
  return new Promise<string>((resolve, reject) => {
    let committed = '';
    let current = '';
    let failure: string | null = null;
    const join = () => `${committed} ${current}`.replace(/\s+/g, ' ').trim();
    const subs = [
      M.addListener('result', (e) => {
        current = e.results[0]?.transcript ?? '';
        if (e.isFinal) {
          committed = `${committed} ${current}`;
          current = '';
        }
        onPartial?.(join());
      }),
      M.addListener('error', (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') failure = speechErrorMessage(e.error, e.message);
      }),
      M.addListener('end', () => {
        subs.forEach((s) => s.remove());
        const text = join();
        if (text) resolve(text);
        else
          reject(
            new Error(
              failure ?? t('speech.file.noSpeech'),
            ),
          );
      }),
    ];
    M.start({
      lang: useSettings.getState().speechLang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition: Platform.OS === 'ios',
      audioSource: { uri },
    });
  });
}

import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { isCloudTranscriptionConfigured, SPEECH_RECORDING, transcribeWithCloud } from '@/lib/speech/cloud';
import {
  getSpeechLib,
  isDeviceRecognitionAvailable,
  NEEDS_DEV_BUILD_MESSAGE,
  requestSpeechPermissions,
  speechErrorMessage,
} from '@/lib/speech/recognition';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

export type DictationState = 'idle' | 'listening' | 'transcribing';

interface Options {
  /** Interim transcript of the current utterance. */
  onPartial: (text: string) => void;
  /** Final transcript of the utterance. */
  onFinal: (text: string) => void;
}

/** Voice input for the composer: on-device recognition, or record + cloud transcription. */
export function useDictation({ onPartial, onFinal }: Options) {
  const [state, setState] = useState<DictationState>('idle');
  const subscriptions = useRef<{ remove: () => void }[]>([]);
  const mode = useRef<'device' | 'cloud' | null>(null);
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const handlers = useRef({ onPartial, onFinal });
  useEffect(() => {
    handlers.current = { onPartial, onFinal };
  });

  const cleanup = () => {
    subscriptions.current.forEach((s) => s.remove());
    subscriptions.current = [];
  };

  useEffect(
    () => () => {
      cleanup();
      if (mode.current === 'device') getSpeechLib()?.ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  const start = async () => {
    if (state !== 'idle') return;
    const settings = useSettings.getState();
    const lib = getSpeechLib();

    if (settings.sttProvider === 'device' && lib && isDeviceRecognitionAvailable()) {
      if (!(await requestSpeechPermissions())) {
        toast.error(speechErrorMessage('not-allowed'));
        return;
      }
      const M = lib.ExpoSpeechRecognitionModule;
      cleanup();
      subscriptions.current = [
        M.addListener('result', (e) => {
          const text = e.results[0]?.transcript ?? '';
          if (e.isFinal) handlers.current.onFinal(text);
          else handlers.current.onPartial(text);
        }),
        M.addListener('error', (e) => {
          if (e.error !== 'aborted' && e.error !== 'no-speech' && e.error !== 'speech-timeout') {
            toast.error(speechErrorMessage(e.error, e.message));
          }
        }),
        M.addListener('end', () => {
          cleanup();
          mode.current = null;
          setState('idle');
        }),
      ];
      mode.current = 'device';
      setState('listening');
      M.start({
        lang: settings.speechLang,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
      });
      return;
    }

    if (isCloudTranscriptionConfigured()) {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        toast.error(speechErrorMessage('not-allowed'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      mode.current = 'cloud';
      setState('listening');
      return;
    }

    toast.info(lib ? speechErrorMessage('service-not-allowed') : NEEDS_DEV_BUILD_MESSAGE);
  };

  const stop = async () => {
    if (state !== 'listening') return;
    if (mode.current === 'device') {
      getSpeechLib()?.ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (mode.current === 'cloud') {
      setState('transcribing');
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (recorder.uri) handlers.current.onFinal(await transcribeWithCloud(recorder.uri, 'question.m4a'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Transcription failed.');
      } finally {
        mode.current = null;
        setState('idle');
      }
    }
  };

  return { state, start, stop, toggle: () => (state === 'idle' ? start() : stop()) };
}

import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isCloudTranscriptionConfigured, SPEECH_RECORDING, transcribeWithCloud } from '@/lib/speech/cloud';
import {
  getSpeechLib,
  isDeviceRecognitionAvailable,
  needsDevBuildMessage,
  requestSpeechPermissions,
  speechErrorMessage,
  supportsOnDeviceRecognition,
} from '@/lib/speech/recognition';
import { useSettings } from '@/store/settings';
import { t } from '@/i18n';

export type LecturePhase = 'idle' | 'recording' | 'finishing';
export type LectureEngine = 'device' | 'cloud';

const KEEP_AWAKE_TAG = 'lecture-recording';
let keepingAwake = false;

function holdScreenAwake() {
  keepingAwake = true;
  activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
    keepingAwake = false;
  });
}

/** deactivateKeepAwake throws if the lock was never taken, so only release what we hold. */
function releaseScreen() {
  if (!keepingAwake) return;
  keepingAwake = false;
  try {
    Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => {});
  } catch {
    // Already released.
  }
}

/** Errors that just mean "a pause in speech": restart the session instead of failing. */
const BENIGN = new Set(['no-speech', 'speech-timeout', 'aborted', 'nomatch']);

/**
 * Records a lecture.
 * - device: live on-device transcription; sessions auto-restart so long lectures keep going.
 * - cloud: records compressed audio, transcribed with a Whisper-compatible API when stopped.
 */
export function useLectureRecorder() {
  const [phase, setPhase] = useState<LecturePhase>('idle');
  const [engine, setEngine] = useState<LectureEngine | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const recorderState = useAudioRecorderState(recorder, 200);

  const active = useRef(false);
  const committed = useRef('');
  const current = useRef('');
  const subscriptions = useRef<{ remove: () => void }[]>([]);
  const onEnded = useRef<(() => void) | null>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = () => `${committed.current} ${current.current}`.replace(/\s+/g, ' ').trim();

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, [phase, startedAt]);

  useEffect(
    () => () => {
      active.current = false;
      subscriptions.current.forEach((s) => s.remove());
      if (restartTimer.current) clearTimeout(restartTimer.current);
      getSpeechLib()?.ExpoSpeechRecognitionModule.abort();
      releaseScreen();
    },
    [],
  );

  const startSession = () => {
    const M = getSpeechLib()?.ExpoSpeechRecognitionModule;
    if (!M) return;
    M.start({
      lang: useSettings.getState().speechLang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      // iOS server recognition stops after ~1 minute; on-device has no such limit.
      requiresOnDeviceRecognition: Platform.OS === 'ios' && supportsOnDeviceRecognition(),
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 200 },
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 20000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 20000,
      },
    });
  };

  const commitCurrent = () => {
    if (current.current) {
      committed.current = `${committed.current} ${current.current}`.trim();
      current.current = '';
    }
  };

  const startDevice = async (): Promise<boolean> => {
    if (!(await requestSpeechPermissions())) {
      setError(speechErrorMessage('not-allowed'));
      return false;
    }
    const M = getSpeechLib()!.ExpoSpeechRecognitionModule;
    subscriptions.current.forEach((s) => s.remove());
    subscriptions.current = [
      M.addListener('result', (e) => {
        const t = e.results[0]?.transcript ?? '';
        if (e.isFinal) {
          current.current = t;
          commitCurrent();
        } else {
          current.current = t;
        }
        setTranscript(text());
      }),
      M.addListener('volumechange', (e) => setLevel(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
      M.addListener('error', (e) => {
        if (BENIGN.has(e.error)) return;
        setError(speechErrorMessage(e.error, e.message));
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported')
          active.current = false;
      }),
      M.addListener('end', () => {
        commitCurrent();
        setTranscript(text());
        if (active.current) {
          restartTimer.current = setTimeout(startSession, 250);
        } else {
          onEnded.current?.();
          onEnded.current = null;
        }
      }),
    ];
    startSession();
    return true;
  };

  const startCloud = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(speechErrorMessage('not-allowed'));
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  };

  /** Returns false (and sets `error`) when recording can't start. */
  const start = async (): Promise<boolean> => {
    if (phase !== 'idle') return false;
    setError(null);
    committed.current = '';
    current.current = '';
    setTranscript('');
    setElapsed(0);

    const useDevice = useSettings.getState().sttProvider === 'device' && isDeviceRecognitionAvailable();
    const useCloud = !useDevice && isCloudTranscriptionConfigured();
    if (!useDevice && !useCloud) {
      setError(getSpeechLib() ? speechErrorMessage('service-not-allowed') : needsDevBuildMessage());
      return false;
    }

    active.current = true;
    const ok = useDevice ? await startDevice() : await startCloud();
    if (!ok) {
      active.current = false;
      return false;
    }
    setEngine(useDevice ? 'device' : 'cloud');
    setStartedAt(Date.now());
    setPhase('recording');
    holdScreenAwake();
    return true;
  };

  /** Stops recording and resolves with the full transcript (cloud mode transcribes here). */
  const stop = async (): Promise<{ transcript: string; durationSec: number }> => {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    active.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    setPhase('finishing');
    releaseScreen();

    try {
      if (engine === 'device') {
        const M = getSpeechLib()!.ExpoSpeechRecognitionModule;
        await new Promise<void>((resolve) => {
          onEnded.current = resolve;
          M.stop();
          setTimeout(resolve, 4000); // Don't hang if the recognizer never reports "end".
        });
        subscriptions.current.forEach((s) => s.remove());
        subscriptions.current = [];
        return { transcript: text(), durationSec };
      }
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error(t('record.saveFailed'));
      return { transcript: await transcribeWithCloud(recorder.uri, 'lecture.m4a'), durationSec };
    } finally {
      setPhase('idle');
      setEngine(null);
      setLevel(0);
    }
  };

  /** Discards the recording. */
  const cancel = async () => {
    active.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    releaseScreen();
    if (engine === 'device') getSpeechLib()?.ExpoSpeechRecognitionModule.abort();
    if (engine === 'cloud') await recorder.stop().catch(() => {});
    subscriptions.current.forEach((s) => s.remove());
    subscriptions.current = [];
    setPhase('idle');
    setEngine(null);
    setTranscript('');
    setLevel(0);
  };

  // Cloud mode meters the recorder itself (dBFS: about -60 silent .. 0 loud).
  const cloudLevel =
    typeof recorderState.metering === 'number' ? Math.max(0, Math.min(1, (recorderState.metering + 55) / 50)) : 0;

  return {
    phase,
    engine,
    startedAt,
    elapsed,
    transcript,
    level: engine === 'cloud' ? cloudLevel : level,
    error,
    setError,
    start,
    stop,
    cancel,
  };
}

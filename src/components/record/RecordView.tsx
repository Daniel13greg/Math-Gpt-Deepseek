import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { FileIcon, NotebookPenIcon, SettingsIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useLectureRecorder } from '@/hooks/useLectureRecorder';
import { generateLectureNotes } from '@/lib/notes/generate';
import { transcribeAudioFile } from '@/lib/speech/file';
import { useHasApiKey } from '@/store/settings';
import { sortNotes, useNotes } from '@/store/notes';

const AUDIO_TYPES = [
  'audio/*',
  'audio/mpeg',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
];

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** The red recording dot with its dark ring, from the MathGPT "Start recording" button. */
function RecordDot({ pulsing }: { pulsing: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.set(
      pulsing
        ? withRepeat(withSequence(withTiming(0.65, { duration: 600 }), withTiming(1, { duration: 600 })), -1)
        : withTiming(1),
    );
  }, [pulsing, scale]);
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <View style={[styles.dotRing, { backgroundColor: colors.recordRing }]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.recordDot }, inner]} />
    </View>
  );
}

function LevelBars({ level }: { level: number }) {
  const { colors } = useTheme();
  const bars = 24;
  return (
    <Svg width={bars * 7} height={34}>
      {Array.from({ length: bars }, (_, i) => {
        const shape = 0.35 + 0.65 * Math.abs(Math.sin((i + 1) * 1.7));
        const h = Math.max(4, 34 * level * shape);
        return <Rect key={i} x={i * 7} y={(34 - h) / 2} width={4} height={h} rx={2} fill={colors.recordDot} opacity={0.85} />;
      })}
    </Svg>
  );
}

/** "Create lecture notes": record live or upload audio, then DeepSeek writes the notes. */
export function RecordView() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const hasKey = useHasApiKey();
  const lecture = useLectureRecorder();
  const createNote = useNotes((s) => s.createNote);
  const notesById = useNotes((s) => s.notes);
  const recentNotes = useMemo(() => sortNotes(notesById).slice(0, 3), [notesById]);
  const [upload, setUpload] = useState<{ name: string; partial: string } | null>(null);

  const finishWithTranscript = (
    transcript: string,
    source: 'recording' | 'upload',
    extra: { durationSec?: number; fileName?: string },
  ) => {
    if (!transcript.trim()) {
      lecture.setError('No speech was captured. Check the microphone and try again.');
      return;
    }
    const id = createNote({ source, transcript, status: 'generating', ...extra });
    if (hasKey) void generateLectureNotes(id);
    else
      useNotes.getState().updateNote(id, { status: 'error', error: 'Add your DeepSeek API key in Settings to generate notes.' });
    router.push({ pathname: '/notes/[id]', params: { id } });
  };

  const onStart = () => {
    void lecture.start();
  };

  const onStop = async () => {
    try {
      const { transcript, durationSec } = await lecture.stop();
      finishWithTranscript(transcript, 'recording', { durationSec });
    } catch (e) {
      lecture.setError(e instanceof Error ? e.message : 'Recording failed.');
    }
  };

  const onUpload = async () => {
    lecture.setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: AUDIO_TYPES, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUpload({ name: asset.name, partial: '' });
    try {
      const transcript = await transcribeAudioFile(asset.uri, asset.name, (partial) => setUpload({ name: asset.name, partial }));
      finishWithTranscript(transcript, 'upload', { fileName: asset.name });
    } catch (e) {
      lecture.setError(e instanceof Error ? e.message : 'Transcription failed.');
    } finally {
      setUpload(null);
    }
  };

  const recording = lecture.phase === 'recording';
  const busy = lecture.phase === 'finishing' || upload !== null;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled">
      <AppText weight="bold" size={28} align="center" color={colors.textStrong} style={styles.title}>
        Create lecture notes
      </AppText>
      <AppText size={15.5} align="center" color={colors.textSecondary} style={styles.subtitle}>
        Record or upload any STEM lecture and MathGPT will write comprehensive notes.
      </AppText>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, !dark && styles.cardShadow]}>
        {recording ? (
          <View style={styles.recording}>
            <View style={styles.recRow}>
              <RecordDot pulsing />
              <AppText weight="semibold" size={30} color={colors.textStrong} style={styles.timer}>
                {formatTime(lecture.elapsed)}
              </AppText>
            </View>
            <LevelBars level={lecture.level} />
            <View style={[styles.liveBox, { backgroundColor: colors.dropzoneBg, borderColor: colors.divider }]}>
              <AppText
                size={15}
                color={lecture.transcript ? colors.text : colors.textMuted}
                numberOfLines={7}
                style={styles.liveText}>
                {lecture.engine === 'cloud'
                  ? 'Recording audio… the transcript will be created when you stop.'
                  : lecture.transcript
                    ? `…${lecture.transcript.slice(-420)}`
                    : 'Listening… start speaking and the transcript will appear here.'}
              </AppText>
            </View>
            <Pressable
              onPress={onStop}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.recordButton,
                { backgroundColor: colors.recordButton, opacity: pressed ? 0.85 : 1 },
              ]}>
              <View style={[styles.stopSquare, { backgroundColor: colors.recordDot }]} />
              <AppText weight="medium" size={17} color={colors.onRecordButton}>
                Stop & create notes
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={lecture.cancel} hitSlop={8} style={styles.cancel}>
              <AppText size={15} color={colors.textSecondary}>
                Discard recording
              </AppText>
            </Pressable>
          </View>
        ) : busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.primary} />
            <AppText weight="medium" size={16} align="center">
              {upload ? `Transcribing ${upload.name}…` : 'Finishing transcript…'}
            </AppText>
            {upload?.partial ? (
              <AppText size={14} secondary numberOfLines={4} align="center">
                …{upload.partial.slice(-240)}
              </AppText>
            ) : null}
          </View>
        ) : (
          <>
            <Pressable
              onPress={onStart}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.recordButton,
                { backgroundColor: colors.recordButton, opacity: pressed ? 0.85 : 1 },
              ]}>
              <RecordDot pulsing={false} />
              <AppText weight="medium" size={17} color={colors.onRecordButton}>
                Start recording
              </AppText>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: colors.divider }]} />
              <AppText size={16} color={colors.dividerText} style={styles.or}>
                or
              </AppText>
              <View style={[styles.line, { backgroundColor: colors.divider }]} />
            </View>

            <Pressable
              onPress={onUpload}
              accessibilityRole="button"
              accessibilityLabel="Upload an audio file"
              style={({ pressed }) => [
                styles.dropzone,
                { backgroundColor: pressed ? colors.surface : colors.dropzoneBg, borderColor: colors.dropzoneBorder },
              ]}>
              <View style={[styles.fileCircle, { backgroundColor: colors.fileCircle }]}>
                <FileIcon size={21} color={colors.fileIcon} strokeWidth={1.6} />
              </View>
              <AppText size={16} color={colors.uploadText} style={styles.uploadTitle}>
                Tap to upload an audio file
              </AppText>
              <AppText size={15} color={colors.formatsText}>
                MP3, AAC, WAV, OGG, or FLAC
              </AppText>
            </Pressable>
          </>
        )}
      </View>

      {lecture.error ? (
        <View style={[styles.error, { backgroundColor: colors.dangerSoft }]}>
          <AppText size={14} color={colors.text}>
            {lecture.error}
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} hitSlop={6} style={styles.errorAction}>
            <SettingsIcon size={15} color={colors.primary} />
            <AppText size={14} weight="semibold" color={colors.primary}>
              Speech settings
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {recentNotes.length > 0 && !recording ? (
        <View style={styles.recent}>
          <AppText weight="semibold" size={15} secondary style={styles.recentTitle}>
            Recent notes
          </AppText>
          {recentNotes.map((note) => (
            <Pressable
              accessibilityRole="button"
              key={note.id}
              onPress={() => router.push({ pathname: '/notes/[id]', params: { id: note.id } })}
              style={({ pressed }) => [
                styles.noteRow,
                { borderColor: colors.cardBorder, backgroundColor: pressed ? colors.surface : colors.card },
              ]}>
              <NotebookPenIcon size={20} color={colors.primary} />
              <View style={styles.noteText}>
                <AppText weight="medium" size={15} numberOfLines={1}>
                  {note.title}
                </AppText>
                <AppText size={13} secondary>
                  {new Date(note.createdAt).toLocaleDateString()} ·{' '}
                  {note.status === 'done' ? 'Ready' : note.status === 'error' ? 'Needs attention' : 'Generating…'}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 24, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { lineHeight: 36 },
  subtitle: { marginTop: 10, lineHeight: 23 },
  card: { marginTop: 34, borderWidth: 1.5, borderRadius: 18, paddingTop: 20, paddingHorizontal: 10, paddingBottom: 11 },
  cardShadow: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  recordButton: {
    alignSelf: 'center',
    height: 46,
    paddingHorizontal: 28,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    minWidth: 178,
  },
  dotRing: { width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  stopSquare: { width: 13, height: 13, borderRadius: 3 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 22 },
  line: { flex: 1, height: 1 },
  or: { marginHorizontal: 30 },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    height: 154,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  uploadTitle: { marginBottom: 4 },
  recording: { alignItems: 'center', gap: 16, paddingBottom: 6 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timer: { lineHeight: 36, fontVariant: ['tabular-nums'] },
  liveBox: { alignSelf: 'stretch', borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 92 },
  liveText: { lineHeight: 21 },
  cancel: { paddingVertical: 4 },
  busy: { alignItems: 'center', gap: 12, paddingVertical: 34, paddingHorizontal: 16 },
  error: { marginTop: 16, borderRadius: 12, padding: 12, gap: 8 },
  errorAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recent: { marginTop: 28, gap: 8 },
  recentTitle: { marginLeft: 4, marginBottom: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  noteText: { flex: 1 },
});

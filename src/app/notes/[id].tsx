import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RichDocument from '@/components/dom/RichDocument';
import { CopyIcon, RefreshIcon, ShareIcon, SquareIcon, Trash2Icon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { generateLectureNotes, stopNotes } from '@/lib/notes/generate';
import { useNotes } from '@/store/notes';
import { describeUsage } from '@/lib/usage';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { useUsage } from '@/store/usage';

type Tab = 'notes' | 'transcript';

function formatDuration(sec?: number) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  return m >= 1 ? `${m} min` : `${sec} s`;
}

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNotes((s) => s.notes[id]);
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('notes');
  const thinking = useSettings((s) => s.thinking);
  const prices = useUsage((s) => s.prices);

  if (!note) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <AppText secondary>These notes no longer exist.</AppText>
      </View>
    );
  }

  const generating = note.status === 'generating';
  const text = tab === 'notes' ? note.notes : note.transcript;

  const remove = () => {
    const doDelete = () => {
      stopNotes(note.id);
      useNotes.getState().deleteNote(note.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete these notes?')) doDelete();
      return;
    }
    Alert.alert('Delete notes?', 'The notes and transcript will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const meta = [
    new Date(note.createdAt).toLocaleString(),
    formatDuration(note.durationSec),
    note.fileName,
    note.usage ? describeUsage(note.usage, prices) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: note.title }} />

      <View style={styles.top}>
        <AppText size={13} secondary numberOfLines={1}>
          {meta}
        </AppText>
        <View style={[styles.tabs, { backgroundColor: colors.segmentBg }]}>
          {(['notes', 'transcript'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { backgroundColor: colors.segmentSelected }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}>
              <AppText weight={tab === t ? 'semibold' : 'regular'} size={14} color={colors.segmentText}>
                {t === 'notes' ? 'Notes' : 'Transcript'}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        {tab === 'notes' ? (
          note.status === 'error' && !note.notes ? (
            <View style={styles.errorWrap}>
              <View style={[styles.error, { backgroundColor: colors.dangerSoft }]}>
                <AppText size={15}>{note.error ?? 'Something went wrong.'}</AppText>
              </View>
            </View>
          ) : (
            <RichDocument
              markdown={note.notes}
              scheme={scheme}
              streaming={generating}
              placeholder={thinking ? 'Thinking through the lecture, then writing your notes…' : 'Writing your notes…'}
              onLink={async (url) => {
                if (/^https?:/.test(url)) await WebBrowser.openBrowserAsync(url);
              }}
              onCopyCode={async (code) => {
                await Clipboard.setStringAsync(code);
                toast.success('Copied');
              }}
              dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
            />
          )
        ) : (
          <ScrollView contentContainerStyle={styles.transcript}>
            <AppText size={16} selectable style={styles.transcriptText}>
              {note.transcript || 'No transcript.'}
            </AppText>
          </ScrollView>
        )}
      </View>

      {note.status === 'error' && note.notes ? (
        <View style={[styles.inlineError, { backgroundColor: colors.dangerSoft }]}>
          <AppText size={13}>{note.error}</AppText>
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: colors.hairline, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {generating ? (
          <Pressable style={styles.action} onPress={() => stopNotes(note.id)}>
            <SquareIcon size={20} color={colors.icon} />
            <AppText size={12} secondary>
              Stop
            </AppText>
          </Pressable>
        ) : (
          <Pressable style={styles.action} onPress={() => void generateLectureNotes(note.id)}>
            <RefreshIcon size={20} color={colors.icon} />
            <AppText size={12} secondary>
              Regenerate
            </AppText>
          </Pressable>
        )}
        <Pressable
          style={styles.action}
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            toast.success('Copied');
          }}>
          <CopyIcon size={20} color={colors.icon} />
          <AppText size={12} secondary>
            Copy
          </AppText>
        </Pressable>
        <Pressable style={styles.action} onPress={() => text && Share.share({ message: text, title: note.title })}>
          <ShareIcon size={20} color={colors.icon} />
          <AppText size={12} secondary>
            Share
          </AppText>
        </Pressable>
        <Pressable style={styles.action} onPress={remove}>
          <Trash2Icon size={20} color={colors.danger} />
          <AppText size={12} color={colors.danger}>
            Delete
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tabs: { flexDirection: 'row', borderRadius: 10, padding: 2, alignSelf: 'flex-start' },
  tab: { paddingHorizontal: 16, height: 32, borderRadius: 8, justifyContent: 'center' },
  body: { flex: 1 },
  errorWrap: { padding: 20 },
  error: { borderRadius: 12, padding: 14 },
  inlineError: { marginHorizontal: 16, marginBottom: 6, borderRadius: 10, padding: 10 },
  transcript: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  transcriptText: { lineHeight: 25 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, paddingTop: 8 },
  action: { alignItems: 'center', gap: 3, minWidth: 64, paddingVertical: 2 },
});

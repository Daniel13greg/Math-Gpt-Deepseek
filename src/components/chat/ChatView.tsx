import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Transcript from '@/components/dom/Transcript';
import type { TranscriptAction, TranscriptHandle } from '@/components/dom/transcriptTypes';
import { headerHeight } from '@/components/header/MainHeader';
import { NotebookPenIcon } from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { APP_NAME } from '@/constants/app';
import type { SubjectId } from '@/constants/subjects';
import { MaxContentWidth } from '@/constants/theme';
import { useDictation } from '@/hooks/useDictation';
import { usePdfExport } from '@/hooks/usePdfExport';
import { useTheme } from '@/hooks/useTheme';
import { t as translate, useT } from '@/i18n';
import {
  anotherQuestion,
  editFrom,
  isGenerating,
  practiceMistakes,
  recordAnswer,
  regenerate,
  sendMessage,
  stopGeneration,
} from '@/lib/chat/controller';
import { prepareImage } from '@/lib/images';
import { speakable } from '@/lib/tools/normalize';
import type { Message } from '@/lib/types';
import { getChat, useChats } from '@/store/chats';
import { useNotes } from '@/store/notes';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { useUI } from '@/store/ui';

import { AttachSheet } from './AttachSheet';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { ProblemPicker } from './ProblemPicker';
import { SubjectTabs } from './SubjectTabs';
import { ToolsSheet } from './ToolsSheet';

const EMPTY: Message[] = [];

/** Same messages except for streamed text, which reaches the WebView via patchMessage instead. */
function sameStructure(a: Message[], b: Message[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x.id !== y.id || x.role !== 'assistant' || y.role !== 'assistant') return false;
    if (x.status !== 'streaming' || y.status !== 'streaming' || x.progress !== y.progress || x.artifact !== y.artifact)
      return false;
  }
  return true;
}

/**
 * The open chat's messages, re-rendering only on structural changes (new message, status,
 * artifact) — not on every streamed token, which would re-send the whole chat to the WebView.
 */
function useStructuralMessages(chatId: string | null): Message[] {
  const cache = useRef<Message[]>(EMPTY);
  const getSnapshot = () => {
    const next = (chatId && useChats.getState().chats[chatId]?.messages) || EMPTY;
    if (!sameStructure(cache.current, next)) cache.current = next;
    return cache.current;
  };
  return useSyncExternalStore(useChats.subscribe, getSnapshot, getSnapshot);
}

function messageText(m: Message | undefined): string {
  if (!m) return '';
  return m.role === 'user' ? m.text : m.content;
}

export async function pickImageFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
  if (result.canceled || !result.assets[0]) return;
  const asset = result.assets[0];
  try {
    useUI.getState().addPendingImage(await prepareImage(asset.uri, { width: asset.width, height: asset.height }));
  } catch {
    toast.error(translate('chat.imageUnreadable'));
  }
}

interface ComposerAreaProps {
  chatId: string | null;
  busy: boolean;
  onPlus: () => void;
  onTools: () => void;
}

/**
 * Subject tabs, composer and disclaimer. The draft is read here, not in ChatView, so typing only
 * re-renders this part: a ChatView render re-sends every message to the transcript WebView.
 */
function ComposerArea({ chatId, busy, onPlus, onTools }: ComposerAreaProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const subject = useUI((s) => s.subject);
  const draft = useUI((s) => s.draft);
  const pendingImages = useUI((s) => s.pendingImages);
  const tool = useUI((s) => s.tool);
  const setDraft = useUI((s) => s.setDraft);
  const removePendingImage = useUI((s) => s.removePendingImage);
  const setTool = useUI((s) => s.setTool);
  const thinking = useSettings((s) => s.thinking);
  const answerStyle = useSettings((s) => s.answerStyle);
  const updateSettings = useSettings((s) => s.update);
  const dictationBase = useRef('');

  const dictation = useDictation({
    onPartial: (text) => setDraft(`${dictationBase.current}${dictationBase.current && text ? ' ' : ''}${text}`),
    onFinal: (text) => {
      const next = `${dictationBase.current}${dictationBase.current && text ? ' ' : ''}${text}`;
      dictationBase.current = next;
      setDraft(next);
    },
  });

  const onMic = () => {
    if (dictation.state === 'idle') {
      // Dictation and lecture recording share one speech recognizer.
      if (useUI.getState().lecture) return toast.info(t('composer.lectureBusy'));
      dictationBase.current = useUI.getState().draft.trim();
    }
    void dictation.toggle();
  };

  const send = () => {
    const { draft, pendingImages, tool, subject } = useUI.getState();
    if (dictation.state !== 'idle') void dictation.stop();
    useUI.getState().clearComposer();
    void sendMessage({ text: draft, images: pendingImages, tool, subject });
  };

  const onSubjectChange = (next: SubjectId) => {
    useUI.getState().setSubject(next);
    if (chatId) useChats.getState().setChatSubject(chatId, next);
  };

  return (
    <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <SubjectTabs value={subject} onChange={onSubjectChange} />
      <View style={styles.composerSpacing} />
      <Composer
        subject={subject}
        draft={draft}
        onDraftChange={setDraft}
        images={pendingImages}
        onRemoveImage={removePendingImage}
        tool={tool}
        onClearTool={() => setTool(null)}
        thinking={thinking}
        onToggleThinking={() => updateSettings({ thinking: !thinking })}
        answerStyle={answerStyle}
        busy={busy || isGenerating(chatId)}
        listening={dictation.state !== 'idle'}
        onSend={send}
        onStop={() => stopGeneration(chatId)}
        onPlus={onPlus}
        onTools={onTools}
        onMic={onMic}
        onMathKeyboard={() => {
          if (dictation.state !== 'idle') void dictation.stop();
          router.push('/math-input');
        }}
      />
      <AppText size={12.5} align="center" color={colors.textFaint} style={styles.disclaimer} numberOfLines={2}>
        {t('chat.disclaimer', { app: APP_NAME })}
      </AppText>
    </View>
  );
}

export function ChatView() {
  const { scheme, colors } = useTheme();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const transcriptRef = useRef<TranscriptHandle>(null);
  const chatId = useChats((s) => s.activeChatId);
  const messages = useStructuralMessages(chatId);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const pdf = usePdfExport();

  // Streamed text is patched straight into the WebView instead of re-sending every message.
  useEffect(
    () =>
      useChats.subscribe((state) => {
        const next = (chatId && state.chats[chatId]?.messages) || EMPTY;
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.status === 'streaming') {
          transcriptRef.current?.patchMessage?.(last.id, last.content, last.reasoning ?? '');
        }
      }),
    [chatId],
  );

  const lectureTitle = useChats((s) => {
    const noteId = chatId ? s.chats[chatId]?.noteId : undefined;
    return noteId ? (useNotes.getState().notes[noteId]?.title ?? null) : null;
  });

  // Keep the subject tabs in sync with the open chat.
  const chatSubject = useChats((s) => (chatId ? s.chats[chatId]?.subject : undefined));
  useEffect(() => {
    if (chatSubject) useUI.getState().setSubject(chatSubject);
  }, [chatSubject]);

  useEffect(() => () => void Speech.stop(), []);

  const busy =
    messages[messages.length - 1]?.role === 'assistant' &&
    (messages[messages.length - 1] as { status: string }).status === 'streaming';

  const findMessage = (id: string) => getChat(chatId)?.messages.find((m) => m.id === id);

  const onAction = async (action: TranscriptAction) => {
    switch (action.type) {
      case 'copy':
        await Clipboard.setStringAsync(messageText(findMessage(action.messageId)));
        toast.success(t('common.copied'));
        break;
      case 'copy-text':
        await Clipboard.setStringAsync(action.text);
        toast.success(t('common.copied'));
        break;
      case 'share': {
        const text = messageText(findMessage(action.messageId));
        if (text) await Share.share({ message: text });
        break;
      }
      case 'export-pdf': {
        const m = findMessage(action.messageId);
        if (m?.role !== 'assistant' || !m.content.trim()) break;
        const chat = getChat(chatId);
        const asked = chat?.messages[chat.messages.indexOf(m) - 1];
        const title =
          asked?.role === 'user' && asked.tool?.kind === 'study-guide' && asked.tool.topic
            ? t('pdf.studyGuideTitle', { topic: asked.tool.topic })
            : (chat?.title ?? t('pdf.answerTitle'));
        pdf.exportPdf({
          title,
          sections: [m.content],
          meta: `${new Date(m.createdAt).toLocaleDateString(lang)} · ${chat ? t(`subject.${chat.subject}`) : ''}`,
        });
        break;
      }
      case 'speak': {
        const wasSpeaking = speakingId === action.messageId;
        await Speech.stop();
        setSpeakingId(null);
        if (wasSpeaking) break;
        const text = speakable(messageText(findMessage(action.messageId)));
        setSpeakingId(action.messageId);
        Speech.speak(text, {
          rate: useSettings.getState().ttsRate,
          language: useSettings.getState().speechLang,
          onDone: () => setSpeakingId(null),
          onStopped: () => setSpeakingId(null),
        });
        break;
      }
      case 'regenerate':
        if (chatId) await regenerate(chatId, action.messageId);
        break;
      case 'edit': {
        if (!chatId) break;
        const message = editFrom(chatId, action.messageId);
        if (message) {
          const { setDraft, setTool, addPendingImage } = useUI.getState();
          setDraft(message.tool ? message.tool.topic : message.text);
          setTool(message.tool ? { kind: message.tool.kind, diagram: message.tool.diagram } : null);
          message.images?.forEach(addPendingImage);
        }
        break;
      }
      case 'open-artifact': {
        const m = findMessage(action.messageId);
        if (!chatId || m?.role !== 'assistant' || !m.artifact) break;
        const params = { chatId, messageId: m.id };
        if (m.artifact.kind === 'practice-test') router.push({ pathname: '/practice-test', params });
        else if (m.artifact.kind === 'flashcards') router.push({ pathname: '/flashcards', params });
        else if (m.artifact.kind === 'video') router.push({ pathname: '/video', params });
        break;
      }
      case 'open-link':
        if (/^https?:/i.test(action.url)) await WebBrowser.openBrowserAsync(action.url);
        break;
      case 'open-image': {
        const m = findMessage(action.messageId);
        const image = m?.role === 'user' ? m.images?.[action.index] : undefined;
        if (image) router.push({ pathname: '/image', params: { uri: image.uri } });
        break;
      }
      case 'open-settings':
        router.push('/settings');
        break;
      case 'another-question':
        if (chatId) await anotherQuestion(chatId, action.messageId);
        break;
      case 'practice-mistakes':
        if (chatId) await practiceMistakes(chatId, action.messageId);
        break;
      case 'answered':
        if (chatId) recordAnswer(chatId, action.messageId, action.choice, action.correct);
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(
            action.correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
          );
        }
        break;
    }
  };

  return (
    // KeyboardAvoidingView measures itself relative to its parent, which sits below the header.
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight(insets.top)}>
      {lectureTitle ? (
        <View style={[styles.lecture, { backgroundColor: colors.primarySoft }]}>
          <NotebookPenIcon size={15} color={colors.primary} />
          <AppText size={13.5} color={colors.primary} numberOfLines={1} style={styles.flexShrink}>
            {t('chat.lectureBanner', { title: lectureTitle })}
          </AppText>
        </View>
      ) : null}
      <View style={styles.flex}>
        <Transcript
          ref={transcriptRef}
          messages={messages}
          chatId={chatId}
          scheme={scheme}
          lang={lang}
          busy={busy}
          onAction={onAction}
          dom={{ style: { flex: 1 }, containerStyle: { flex: 1 }, scrollEnabled: false, bounces: false }}
        />
        {/* Drawn over the (empty) transcript so its WebView is already loaded by the first message.
            A chat about a lecture skips it: the banner above says what to ask about. */}
        {messages.length === 0 && !lectureTitle ? <EmptyState onTools={() => setToolsOpen(true)} /> : null}
      </View>

      <ComposerArea chatId={chatId} busy={busy} onPlus={() => setAttachOpen(true)} onTools={() => setToolsOpen(true)} />

      <ProblemPicker />
      {pdf.exporter}
      <ToolsSheet
        visible={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onSelect={(tool) => useUI.getState().setTool(tool)}
      />
      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onCamera={() => useUI.getState().setMode('camera')}
        onLibrary={() => void pickImageFromLibrary()}
        onModel={() => router.push('/models')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  lecture: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '92%',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  bottom: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: 6 },
  composerSpacing: { height: 10 },
  disclaimer: { marginTop: 12, paddingHorizontal: 16 },
});

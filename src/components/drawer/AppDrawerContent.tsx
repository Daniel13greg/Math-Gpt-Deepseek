import { router } from 'expo-router';
import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FlashcardsIcon,
  NotebookPenIcon,
  PencilIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SquarePenIcon,
  Trash2Icon,
} from '@/components/icons';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PromptModal } from '@/components/ui/PromptModal';
import { APP_NAME } from '@/constants/app';
import { getSubject } from '@/constants/subjects';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { deleteChatWithFiles } from '@/lib/chat/controller';
import { groupByDate } from '@/lib/dates';
import { isDue } from '@/lib/srs';
import type { Chat } from '@/lib/types';
import { describeUsage } from '@/lib/usage';
import { sortChats, useChats } from '@/store/chats';
import { sortNotes, useNotes } from '@/store/notes';
import { useReviews } from '@/store/reviews';
import { useUI } from '@/store/ui';
import { useUsage } from '@/store/usage';

export function AppLogo({ size = 30 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: colors.primary }]}>
      <AppText weight="bold" size={size * 0.62} color="#fff" style={{ lineHeight: size * 0.8 }}>
        ∑
      </AppText>
    </View>
  );
}

function confirmDelete(title: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`Delete "${title}"?`)) onConfirm();
    return;
  }
  Alert.alert('Delete chat?', `"${title}" will be permanently deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export function AppDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const chats = useChats((s) => s.chats);
  const activeChatId = useChats((s) => s.activeChatId);
  const notes = useNotes((s) => s.notes);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<Chat | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sortChats(chats).filter(
      (c) =>
        c.messages.length > 0 &&
        (!q ||
          c.title.toLowerCase().includes(q) ||
          c.messages.some((m) => (m.role === 'user' ? m.text : m.content).toLowerCase().includes(q))),
    );
    return groupByDate(list, (c) => c.updatedAt);
  }, [chats, query]);

  const recentNotes = useMemo(() => sortNotes(notes).slice(0, 4), [notes]);

  // Flashcard decks with cards due today (decks whose message was deleted are skipped).
  const reviewDecks = useReviews((s) => s.decks);
  const dueDecks = useMemo(() => {
    const out: { chatId: string; messageId: string; title: string; due: number }[] = [];
    for (const [key, cards] of Object.entries(reviewDecks)) {
      const [chatId, messageId] = key.split(':');
      const message = chats[chatId]?.messages.find((m) => m.id === messageId);
      if (message?.role !== 'assistant' || message.artifact?.kind !== 'flashcards') continue;
      const deckSize = message.artifact.data.cards.length;
      const due = Object.entries(cards).filter(([i, card]) => Number(i) < deckSize && isDue(card)).length;
      if (due > 0) out.push({ chatId, messageId, title: message.artifact.data.title, due });
    }
    return out.sort((a, b) => b.due - a.due).slice(0, 5);
  }, [reviewDecks, chats]);

  const close = () => navigation.closeDrawer();

  const newChat = () => {
    useChats.getState().setActiveChat(null);
    useUI.getState().clearComposer();
    useUI.getState().setMode('chat');
    close();
  };

  const openChat = (chat: Chat) => {
    useChats.getState().setActiveChat(chat.id);
    useUI.getState().setMode('chat');
    close();
  };

  const [menuFor, setMenuFor] = useState<Chat | null>(null);
  const prices = useUsage((s) => s.prices);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppLogo />
        <AppText weight="bold" size={20} style={styles.brand}>
          {APP_NAME}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={newChat}
          hitSlop={10}
          accessibilityLabel="New chat"
          style={styles.headerButton}>
          <SquarePenIcon size={22} color={colors.icon} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface }]}>
        <SearchIcon size={17} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          onPress={newChat}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
          <SquarePenIcon size={19} color={colors.primary} />
          <AppText weight="medium" size={15} color={colors.primary}>
            New chat
          </AppText>
        </Pressable>

        {dueDecks.length > 0 && !query ? (
          <>
            <AppText weight="semibold" size={12.5} color={colors.textMuted} style={styles.section} accessibilityRole="header">
              REVIEW TODAY
            </AppText>
            {dueDecks.map((deck) => (
              <Pressable
                key={`${deck.chatId}:${deck.messageId}`}
                accessibilityRole="button"
                accessibilityLabel={`Review ${deck.title}, ${deck.due} card${deck.due === 1 ? '' : 's'} due`}
                onPress={() => {
                  close();
                  router.push({
                    pathname: '/flashcards',
                    params: { chatId: deck.chatId, messageId: deck.messageId, review: '1' },
                  });
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
                <FlashcardsIcon size={18} color={colors.primary} />
                <AppText size={15} numberOfLines={1} style={styles.flex}>
                  {deck.title}
                </AppText>
                <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                  <AppText size={12} weight="semibold" color={colors.primary}>
                    {deck.due}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {recentNotes.length > 0 && !query ? (
          <>
            <AppText weight="semibold" size={12.5} color={colors.textMuted} style={styles.section} accessibilityRole="header">
              LECTURE NOTES
            </AppText>
            {recentNotes.map((note) => (
              <Pressable
                accessibilityRole="button"
                key={note.id}
                onPress={() => {
                  close();
                  router.push({ pathname: '/notes/[id]', params: { id: note.id } });
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
                <NotebookPenIcon size={18} color={colors.textSecondary} />
                <AppText size={15} numberOfLines={1} style={styles.flex}>
                  {note.title}
                </AppText>
              </Pressable>
            ))}
          </>
        ) : null}

        {groups.map((group) => (
          <View key={group.label}>
            <AppText weight="semibold" size={12.5} color={colors.textMuted} style={styles.section} accessibilityRole="header">
              {group.label.toUpperCase()}
            </AppText>
            {group.items.map((chat) => {
              const active = chat.id === activeChatId;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={chat.id}
                  onPress={() => openChat(chat)}
                  onLongPress={() => setMenuFor(chat)}
                  delayLongPress={350}
                  accessibilityState={{ selected: active }}
                  accessibilityHint="Long press for rename and delete"
                  accessibilityActions={[
                    { name: 'rename', label: 'Rename' },
                    { name: 'delete', label: 'Delete' },
                  ]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'rename') setRenaming(chat);
                    if (e.nativeEvent.actionName === 'delete') confirmDelete(chat.title, () => deleteChatWithFiles(chat.id));
                  }}
                  style={({ pressed }) => [styles.chatRow, (active || pressed) && { backgroundColor: colors.surface }]}>
                  <AppText size={15} numberOfLines={1} weight={active ? 'medium' : 'regular'}>
                    {chat.title}
                  </AppText>
                  <AppText size={12} color={colors.textMuted}>
                    {getSubject(chat.subject).label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}

        {groups.length === 0 ? (
          <AppText size={14} color={colors.textMuted} style={styles.empty}>
            {query ? 'No chats match your search.' : 'Your chats will appear here.'}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.hairline, paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            close();
            router.push('/upgrade');
          }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
          <SparklesIcon size={19} color={colors.primary} />
          <AppText weight="medium" size={15}>
            Upgrade · Models
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            close();
            router.push('/settings');
          }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
          <SettingsIcon size={19} color={colors.icon} />
          <AppText weight="medium" size={15}>
            Settings
          </AppText>
        </Pressable>
      </View>

      <BottomSheet visible={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        <View style={styles.menu}>
          {menuFor?.usage ? (
            <AppText size={13} color={colors.textMuted} style={styles.menuMeta}>
              {describeUsage(menuFor.usage, prices)}
            </AppText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surface }]}
            onPress={() => {
              const chat = menuFor;
              setMenuFor(null);
              setRenaming(chat);
            }}>
            <PencilIcon size={20} color={colors.icon} />
            <AppText size={17}>Rename</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surface }]}
            onPress={() => {
              const chat = menuFor;
              setMenuFor(null);
              if (chat) confirmDelete(chat.title, () => deleteChatWithFiles(chat.id));
            }}>
            <Trash2Icon size={20} color={colors.danger} />
            <AppText size={17} color={colors.danger}>
              Delete
            </AppText>
          </Pressable>
        </View>
      </BottomSheet>

      <PromptModal
        visible={renaming !== null}
        title="Rename chat"
        initialValue={renaming?.title ?? ''}
        onCancel={() => setRenaming(null)}
        onConfirm={(value) => {
          if (renaming) useChats.getState().renameChat(renaming.id, value);
          setRenaming(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 48, gap: 10 },
  logo: { alignItems: 'center', justifyContent: 'center' },
  brand: { flex: 1 },
  headerButton: { padding: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, minWidth: 0, fontFamily: FontFamily.regular, fontSize: 15, paddingVertical: 0 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 16 },
  section: { marginTop: 18, marginBottom: 4, marginLeft: 12, letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 44, borderRadius: 10 },
  chatRow: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  empty: { textAlign: 'center', marginTop: 28, paddingHorizontal: 20 },
  footer: { borderTopWidth: 1, paddingTop: 6, paddingHorizontal: 8 },
  badge: { minWidth: 24, height: 20, borderRadius: 10, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  menuMeta: { paddingHorizontal: 24, paddingBottom: 6 },
  menu: { paddingTop: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, height: 52 },
});

import { create } from 'zustand';

import { DEFAULT_SUBJECT, type SubjectId } from '@/constants/subjects';
import { makeId } from '@/lib/id';
import { toUnicodeMath } from '@/lib/math';
import { createCollectionSaver, loadCollection } from '@/lib/storage/collection';
import type { AssistantMessage, Chat, Message, TokenUsage, UserMessage } from '@/lib/types';
import { addToModel } from '@/lib/usage';
import { t } from '@/i18n';

interface ChatsState {
  chats: Record<string, Chat>;
  activeChatId: string | null;
  createChat: (subject: SubjectId, title?: string, extra?: Pick<Chat, 'noteId'>) => string;
  setActiveChat: (id: string | null) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateAssistant: (
    chatId: string,
    messageId: string,
    patch: Partial<AssistantMessage> | ((m: AssistantMessage) => Partial<AssistantMessage>),
  ) => void;
  updateUser: (chatId: string, messageId: string, patch: Partial<Omit<UserMessage, 'id' | 'role'>>) => void;
  /** Removes `messageId` and everything after it (used by regenerate / edit). */
  truncateFrom: (chatId: string, messageId: string) => void;
  /** `lock` (default true) marks the title as final so it won't be auto-replaced. */
  renameChat: (chatId: string, title: string, lock?: boolean) => void;
  setChatSubject: (chatId: string, subject: SubjectId) => void;
  addChatUsage: (chatId: string, model: string, usage: TokenUsage) => void;
  deleteChat: (chatId: string) => void;
  deleteAllChats: () => void;
  /** Replaces all chats (backup restore merges before calling this). */
  importChats: (chats: Record<string, Chat>) => void;
}

const PREFIX = 'chat';
const initialChats = loadCollection<Chat>(PREFIX);
const saver = createCollectionSaver(PREFIX, initialChats);

/** Streaming messages left over from a crash or force-quit become "stopped". */
function recoverInterrupted(chats: Record<string, Chat>): Record<string, Chat> {
  const out: Record<string, Chat> = {};
  for (const [id, chat] of Object.entries(chats)) {
    const stuck = chat.messages.some((m) => m.role === 'assistant' && m.status === 'streaming');
    out[id] = stuck
      ? {
          ...chat,
          messages: chat.messages.map((m) =>
            m.role === 'assistant' && m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m,
          ),
        }
      : chat;
  }
  return out;
}

export const useChats = create<ChatsState>()((set, get) => {
  const updateChat = (chatId: string, fn: (chat: Chat) => Chat) => {
    const chat = get().chats[chatId];
    if (!chat) return;
    set({ chats: { ...get().chats, [chatId]: fn(chat) } });
  };

  return {
    chats: recoverInterrupted(initialChats),
    activeChatId: null,

    createChat: (subject, title = t('drawer.newChat'), extra) => {
      const id = makeId('c');
      const now = Date.now();
      set({
        chats: {
          ...get().chats,
          [id]: { id, title, subject: subject ?? DEFAULT_SUBJECT, createdAt: now, updatedAt: now, messages: [], ...extra },
        },
        activeChatId: id,
      });
      return id;
    },

    setActiveChat: (id) => set({ activeChatId: id }),

    addMessage: (chatId, message) =>
      updateChat(chatId, (chat) => ({ ...chat, updatedAt: Date.now(), messages: [...chat.messages, message] })),

    updateAssistant: (chatId, messageId, patch) =>
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((m) => {
          if (m.id !== messageId || m.role !== 'assistant') return m;
          return { ...m, ...(typeof patch === 'function' ? patch(m) : patch) };
        }),
      })),

    updateUser: (chatId, messageId, patch) =>
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((m) => (m.id === messageId && m.role === 'user' ? { ...m, ...patch } : m)),
      })),

    truncateFrom: (chatId, messageId) =>
      updateChat(chatId, (chat) => {
        const index = chat.messages.findIndex((m) => m.id === messageId);
        return index === -1 ? chat : { ...chat, messages: chat.messages.slice(0, index) };
      }),

    // Titles are shown as native text, so math in them becomes Unicode ("x^2" → "x²", "6/4" → "⁶⁄₄").
    renameChat: (chatId, title, lock = true) =>
      updateChat(chatId, (chat) => ({
        ...chat,
        title: toUnicodeMath(title.trim()) || chat.title,
        titleLocked: chat.titleLocked || lock,
      })),

    setChatSubject: (chatId, subject) => updateChat(chatId, (chat) => ({ ...chat, subject })),

    addChatUsage: (chatId, model, usage) =>
      updateChat(chatId, (chat) => ({ ...chat, usage: addToModel(chat.usage, model, usage) })),

    deleteChat: (chatId) => {
      const { [chatId]: _removed, ...rest } = get().chats;
      set({ chats: rest, activeChatId: get().activeChatId === chatId ? null : get().activeChatId });
    },

    deleteAllChats: () => set({ chats: {}, activeChatId: null }),

    importChats: (chats) => set({ chats: recoverInterrupted(chats) }),
  };
});

useChats.subscribe((state, prev) => {
  if (state.chats !== prev.chats) saver.schedule(state.chats);
});

export function getChat(chatId: string | null | undefined): Chat | undefined {
  return chatId ? useChats.getState().chats[chatId] : undefined;
}

export function useActiveChat(): Chat | undefined {
  return useChats((s) => (s.activeChatId ? s.chats[s.activeChatId] : undefined));
}

/** Chats sorted by most recent activity. */
export function sortChats(chats: Record<string, Chat>): Chat[] {
  return Object.values(chats).sort((a, b) => b.updatedAt - a.updatedAt);
}

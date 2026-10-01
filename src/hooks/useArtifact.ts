import { useLocalSearchParams } from 'expo-router';

import type { Artifact } from '@/lib/types';
import { useChats } from '@/store/chats';

/** Resolves `?chatId=&messageId=` route params to a tool artifact of the given kind. */
export function useArtifact<K extends Artifact['kind']>(kind: K) {
  const { chatId, messageId } = useLocalSearchParams<{ chatId: string; messageId: string }>();
  const message = useChats((s) => s.chats[chatId]?.messages.find((m) => m.id === messageId));
  const artifact =
    message?.role === 'assistant' && message.artifact?.kind === kind
      ? (message.artifact as Extract<Artifact, { kind: K }>)
      : undefined;
  return { chatId, messageId, artifact };
}

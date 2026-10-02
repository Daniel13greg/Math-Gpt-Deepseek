import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  describeRestore,
  mergeById,
  mergeReviews,
  mergeUsageMonths,
  parseBackup,
  type Backup,
} from '@/lib/backup';
import { pickTextFile, saveTextFile } from '@/lib/files';
import { imageBase64, saveImageBase64 } from '@/lib/images';
import type { Chat, Message } from '@/lib/types';
import { useChats } from '@/store/chats';
import { useNotes } from '@/store/notes';
import { useReviews } from '@/store/reviews';
import { migrateSettings, useSettings, type PersistedSettings } from '@/store/settings';
import { useUsage } from '@/store/usage';

/** Builds a backup of everything on this device (API keys excluded) and offers it to save or share. */
export async function exportBackup(): Promise<{ chats: number; notes: number }> {
  const chats = Object.values(useChats.getState().chats);
  const notes = Object.values(useNotes.getState().notes);
  const images: Record<string, string> = {};
  for (const chat of chats) {
    for (const m of chat.messages) {
      if (m.role !== 'user') continue;
      for (const image of m.images ?? []) {
        const data = await imageBase64(image);
        if (data) images[image.id] = data;
      }
    }
  }
  const { apiKey: _a, sttApiKey: _b, update: _u, setApiKey: _s, setSttApiKey: _t, ...settings } = useSettings.getState();
  const { months, prices } = useUsage.getState();
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    chats,
    notes,
    reviews: useReviews.getState().decks,
    usage: { months, prices },
    settings,
    images,
  };
  await saveTextFile(backupFileName(), JSON.stringify(backup));
  return { chats: chats.length, notes: notes.length };
}

/** Restored photos get stored again; ones missing from the backup fall back to their thumbnail. */
function restoreImages(chat: Chat, images: Record<string, string>): Chat {
  return {
    ...chat,
    messages: chat.messages.map((m): Message => {
      if (m.role !== 'user' || !m.images?.length) return m;
      return {
        ...m,
        images: m.images.map((image) => ({
          ...image,
          uri: images[image.id] ? saveImageBase64(image.id, images[image.id]) : image.thumb,
        })),
      };
    }),
  };
}

/**
 * Lets the user pick a backup file and merges it in: new chats and notes are added, newer copies
 * replace older ones, nothing here is deleted. Returns a summary, or null if cancelled.
 */
export async function importBackup(): Promise<string | null> {
  const text = await pickTextFile();
  if (text === null) return null;
  const backup = parseBackup(text);

  const local = useChats.getState().chats;
  const incoming = backup.chats.filter((c) => !local[c.id] || c.updatedAt > local[c.id].updatedAt);
  const chats = mergeById(
    local,
    incoming.map((c) => restoreImages(c, backup.images)),
    (c) => c.updatedAt,
  );
  const notes = mergeById(useNotes.getState().notes, backup.notes, (n) => n.updatedAt ?? n.createdAt);

  useChats.getState().importChats(chats.merged);
  useNotes.getState().importNotes(notes.merged);
  useReviews.getState().replaceAll(mergeReviews(useReviews.getState().decks, backup.reviews));
  const usage = useUsage.getState();
  usage.importUsage(mergeUsageMonths(usage.months, backup.usage.months), { ...backup.usage.prices, ...usage.prices });

  const { version: _v, ...settings } = migrateSettings(backup.settings as Partial<PersistedSettings>);
  useSettings.getState().update(settings);

  return describeRestore(chats, notes);
}

import type { CardSchedule } from '@/lib/srs';
import type { Chat, LectureNote, UsageByModel } from '@/lib/types';
import type { ModelPrice } from '@/lib/usage';
import { t, tp } from '@/i18n';

export const BACKUP_FORMAT = 'math-gpt-deepseek-backup';
export const BACKUP_VERSION = 1;

type Decks = Record<string, Record<number, CardSchedule>>;

/** Everything the app stores, except API keys, as one JSON file. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  chats: Chat[];
  notes: LectureNote[];
  reviews: Decks;
  usage: { months: Record<string, UsageByModel>; prices: Record<string, ModelPrice> };
  /** Non-secret settings (never API keys). */
  settings: Record<string, unknown>;
  /** Full-size photos by attachment id (base64 JPEG). Thumbnails live inside the chats. */
  images: Record<string, string>;
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates a backup file's contents. Throws a BackupError with a readable message. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(t('backup.error.json'));
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError(t('backup.error.format'));
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError(t('backup.error.version'));
  }
  const chats = Array.isArray(raw.chats)
    ? (raw.chats as unknown[]).filter((c): c is Chat => isObj(c) && typeof c.id === 'string' && Array.isArray(c.messages))
    : [];
  const notes = Array.isArray(raw.notes)
    ? (raw.notes as unknown[]).filter((n): n is LectureNote => isObj(n) && typeof n.id === 'string' && typeof n.notes === 'string')
    : [];
  const usage = isObj(raw.usage) ? raw.usage : {};
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'number' ? raw.exportedAt : 0,
    chats,
    notes,
    reviews: isObj(raw.reviews) ? (raw.reviews as Decks) : {},
    usage: {
      months: isObj(usage.months) ? (usage.months as Backup['usage']['months']) : {},
      prices: isObj(usage.prices) ? (usage.prices as Backup['usage']['prices']) : {},
    },
    settings: isObj(raw.settings) ? raw.settings : {},
    images: isObj(raw.images) ? (raw.images as Record<string, string>) : {},
  };
}

export interface MergeResult<T> {
  merged: Record<string, T>;
  added: number;
  updated: number;
}

/** Adds items that are new here and replaces ones the backup has a newer copy of; never deletes. */
export function mergeById<T extends { id: string }>(
  local: Record<string, T>,
  incoming: T[],
  stamp: (item: T) => number,
): MergeResult<T> {
  const merged = { ...local };
  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const existing = merged[item.id];
    if (!existing) {
      merged[item.id] = item;
      added++;
    } else if (stamp(item) > stamp(existing)) {
      merged[item.id] = item;
      updated++;
    }
  }
  return { merged, added, updated };
}

/** Review schedules: keep the most recently reviewed state of each card. */
export function mergeReviews(local: Decks, incoming: Decks): Decks {
  const out: Decks = { ...local };
  for (const [deck, cards] of Object.entries(incoming)) {
    const mine = { ...out[deck] };
    for (const [index, card] of Object.entries(cards)) {
      const current = mine[Number(index)];
      if (!current || card.lastReviewed > current.lastReviewed) mine[Number(index)] = card;
    }
    out[deck] = mine;
  }
  return out;
}

/** Months this device has no record of are added; months it has are kept, so restoring twice never double-counts. */
export function mergeUsageMonths(
  local: Record<string, UsageByModel>,
  incoming: Record<string, UsageByModel>,
): Record<string, UsageByModel> {
  const out = { ...local };
  for (const [month, usage] of Object.entries(incoming)) if (!out[month]) out[month] = usage;
  return out;
}

/** Image attachment ids referenced by the chats. */
export function imageIds(chats: Chat[]): string[] {
  return chats.flatMap((c) => c.messages.flatMap((m) => (m.role === 'user' ? (m.images ?? []).map((i) => i.id) : [])));
}

export function describeRestore(chats: MergeResult<Chat>, notes: MergeResult<LectureNote>): string {
  const chatCount = chats.added + chats.updated;
  const noteCount = notes.added + notes.updated;
  if (!chatCount && !noteCount) return t('backup.restore.none');
  if (!noteCount) return t('backup.restore.one', { items: tp('backup.chats', chatCount) });
  if (!chatCount) return t('backup.restore.one', { items: tp('backup.notes', noteCount) });
  return t('backup.restore.both', { chats: tp('backup.chats', chatCount), notes: tp('backup.notes', noteCount) });
}

export function backupFileName(date = new Date()): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `MathGPT backup ${d}.json`;
}

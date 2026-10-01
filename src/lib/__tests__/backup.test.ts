import type { Chat, LectureNote } from '@/lib/types';

import {
  BACKUP_FORMAT,
  BackupError,
  backupFileName,
  describeRestore,
  imageIds,
  mergeById,
  mergeReviews,
  mergeUsageMonths,
  parseBackup,
} from '../backup';

const chat = (id: string, updatedAt: number, extra: Partial<Chat> = {}): Chat => ({
  id,
  title: id,
  subject: 'math',
  createdAt: 0,
  updatedAt,
  messages: [],
  ...extra,
});

describe('parseBackup', () => {
  it('rejects files that are not backups, or from a newer app', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"other"}')).toThrow("isn't a backup from this app");
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }))).toThrow('newer version');
  });

  it('keeps well-formed items and defaults the rest', () => {
    const backup = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, chats: [chat('c1', 1), { id: 3 }], notes: 'bad' }),
    );
    expect(backup.chats.map((c) => c.id)).toEqual(['c1']);
    expect(backup.notes).toEqual([]);
    expect(backup.images).toEqual({});
    expect(backup.usage).toEqual({ months: {}, prices: {} });
  });
});

describe('merging', () => {
  it('adds new items, takes newer copies and never deletes', () => {
    const local = { a: chat('a', 5), b: chat('b', 5) };
    const result = mergeById(local, [chat('a', 9), chat('b', 1), chat('c', 1)], (c) => c.updatedAt);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.merged.a.updatedAt).toBe(9);
    expect(result.merged.b.updatedAt).toBe(5);
    expect(Object.keys(result.merged).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps the most recently reviewed card state', () => {
    const card = (lastReviewed: number) => ({ ease: 2.5, intervalDays: 1, reps: 1, lapses: 0, due: 0, lastReviewed });
    const merged = mergeReviews({ d: { 0: card(5), 1: card(5) } }, { d: { 0: card(9), 1: card(1), 2: card(1) }, e: { 0: card(1) } });
    expect(merged.d[0].lastReviewed).toBe(9);
    expect(merged.d[1].lastReviewed).toBe(5);
    expect(merged.d[2]).toBeDefined();
    expect(merged.e[0]).toBeDefined();
  });

  it('adds only months missing here, so restoring twice never double-counts', () => {
    const u = { requests: 1, promptTokens: 1, cacheHitTokens: 0, completionTokens: 1, reasoningTokens: 0 };
    const merged = mergeUsageMonths({ '2026-10': { a: u } }, { '2026-10': { a: { ...u, requests: 9 } }, '2026-09': { a: u } });
    expect(merged['2026-10'].a.requests).toBe(1);
    expect(merged['2026-09']).toBeDefined();
  });

  it('lists the photos chats refer to and summarizes a restore', () => {
    const withPhoto = chat('p', 1, {
      messages: [{ id: 'm', role: 'user', text: '', createdAt: 0, images: [{ id: 'img1', uri: 'x', thumb: 't', width: 1, height: 1 }] }],
    });
    expect(imageIds([withPhoto, chat('q', 1)])).toEqual(['img1']);
    const none = { merged: {}, added: 0, updated: 0 };
    expect(describeRestore({ merged: {}, added: 2, updated: 1 }, { merged: {}, added: 1, updated: 0 } as never)).toBe(
      'Restored 3 chats and 1 lecture note.',
    );
    expect(describeRestore(none, none as never as { merged: Record<string, LectureNote>; added: number; updated: number })).toBe(
      'Everything in the backup is already on this device.',
    );
    expect(backupFileName(new Date(2026, 9, 1))).toBe('MathGPT backup 2026-10-01.json');
  });
});

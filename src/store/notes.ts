import { create } from 'zustand';

import { makeId } from '@/lib/id';
import { createCollectionSaver, loadCollection } from '@/lib/storage/collection';
import type { LectureNote } from '@/lib/types';
import { t } from '@/i18n';

interface NotesState {
  notes: Record<string, LectureNote>;
  createNote: (init: Pick<LectureNote, 'source' | 'transcript' | 'status'> & Partial<LectureNote>) => string;
  updateNote: (id: string, patch: Partial<LectureNote> | ((n: LectureNote) => Partial<LectureNote>)) => void;
  deleteNote: (id: string) => void;
  /** Replaces all notes (backup restore merges before calling this). */
  importNotes: (notes: Record<string, LectureNote>) => void;
}

const PREFIX = 'note';
const initialNotes = loadCollection<LectureNote>(PREFIX);
const saver = createCollectionSaver(PREFIX, initialNotes);

function recoverInterrupted(notes: Record<string, LectureNote>): Record<string, LectureNote> {
  const out: Record<string, LectureNote> = {};
  for (const [id, note] of Object.entries(notes)) {
    out[id] =
      note.status === 'generating' || note.status === 'transcribing'
        ? { ...note, status: 'error', error: t('notes.interrupted') }
        : note;
  }
  return out;
}

export const useNotes = create<NotesState>()((set, get) => ({
  notes: recoverInterrupted(initialNotes),

  createNote: (init) => {
    const id = makeId('n');
    const note: LectureNote = { title: t('notes.defaultTitle'), notes: '', createdAt: Date.now(), ...init, id };
    set({ notes: { ...get().notes, [id]: note } });
    return id;
  },

  updateNote: (id, patch) => {
    const note = get().notes[id];
    if (!note) return;
    const changes = typeof patch === 'function' ? patch(note) : patch;
    set({ notes: { ...get().notes, [id]: { ...note, ...changes, updatedAt: Date.now() } } });
  },

  importNotes: (notes) => set({ notes: recoverInterrupted(notes) }),

  deleteNote: (id) => {
    const { [id]: _removed, ...rest } = get().notes;
    set({ notes: rest });
  },
}));

useNotes.subscribe((state, prev) => {
  if (state.notes !== prev.notes) saver.schedule(state.notes);
});

export function sortNotes(notes: Record<string, LectureNote>): LectureNote[] {
  return Object.values(notes).sort((a, b) => b.createdAt - a.createdAt);
}

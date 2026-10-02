import { apiConfig } from '@/lib/api';
import { streamChat } from '@/lib/ai/client';
import { toApiError } from '@/lib/ai/errors';
import { toUnicodeMath } from '@/lib/math';
import { lectureNotesPrompt } from '@/lib/prompts';
import { useNotes } from '@/store/notes';
import { addToModel } from '@/lib/usage';
import { useSettings } from '@/store/settings';
import { t } from '@/i18n';

const inflight = new Map<string, AbortController>();

export function isGeneratingNotes(noteId: string) {
  return inflight.has(noteId);
}

export function stopNotes(noteId: string) {
  inflight.get(noteId)?.abort();
}

function titleFrom(markdown: string): string | undefined {
  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  return heading ? toUnicodeMath(heading.replace(/\*\*|__|`/g, '')).slice(0, 80) : undefined;
}

/** Streams comprehensive lecture notes for a transcript into the note. */
export async function generateLectureNotes(noteId: string): Promise<void> {
  const note = useNotes.getState().notes[noteId];
  if (!note || inflight.has(noteId)) return;
  const update = useNotes.getState().updateNote;

  if (!note.transcript.trim()) {
    update(noteId, { status: 'error', error: t('notes.noSpeech') });
    return;
  }

  const controller = new AbortController();
  inflight.set(noteId, controller);
  // On a regenerate, the old notes stay until new text arrives, and come back if this run fails or is stopped.
  const previous = note.notes;
  update(noteId, { status: 'generating', error: undefined });

  let notes = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    update(noteId, { notes });
  };

  const settings = useSettings.getState();
  try {
    const minutes = note.durationSec ? ` (${Math.max(1, Math.round(note.durationSec / 60))} minutes)` : '';
    const result = await streamChat(
      apiConfig((usage, model) => update(noteId, (n) => ({ usage: addToModel(n.usage, model, usage) }))),
      {
        model: settings.model,
        // Deep Think helps untangle misheard terms and reconstruct skipped steps.
        thinking: settings.thinking,
        reasoningEffort: settings.reasoningEffort,
        maxTokens: settings.thinking ? 32768 : 16384,
        temperature: 0.3,
        messages: [
          { role: 'system', content: lectureNotesPrompt() },
          { role: 'user', content: `Lecture transcript${minutes}:\n\n${note.transcript}` },
        ],
      },
      {
        onContent: (delta) => {
          notes += delta;
          if (!timer) timer = setTimeout(flush, 120);
        },
      },
      controller.signal,
    );
    if (timer) clearTimeout(timer);
    update(noteId, { notes: result.content, status: 'done', title: titleFrom(result.content) ?? note.title });
  } catch (e) {
    if (timer) clearTimeout(timer);
    const error = toApiError(e);
    const aborted = error.kind === 'aborted';
    if (previous) {
      update(noteId, {
        notes: previous,
        status: aborted ? 'done' : 'error',
        error: aborted ? undefined : t('notes.keptPrevious', { message: error.message }),
      });
    } else {
      update(noteId, {
        notes,
        status: aborted && notes ? 'done' : 'error',
        error: aborted ? t('notes.stopped') : error.message,
      });
    }
  } finally {
    inflight.delete(noteId);
  }
}

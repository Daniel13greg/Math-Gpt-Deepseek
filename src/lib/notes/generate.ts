import { apiConfig } from '@/lib/api';
import { streamChat } from '@/lib/deepseek/client';
import { toDeepSeekError } from '@/lib/deepseek/errors';
import { toUnicodeMath } from '@/lib/math';
import { lectureNotesPrompt } from '@/lib/prompts';
import { useNotes } from '@/store/notes';
import { addToModel } from '@/lib/usage';
import { useSettings } from '@/store/settings';

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
    update(noteId, { status: 'error', error: 'No speech was captured, so there is nothing to summarize.' });
    return;
  }

  const controller = new AbortController();
  inflight.set(noteId, controller);
  update(noteId, { status: 'generating', notes: '', error: undefined });

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
    const error = toDeepSeekError(e);
    update(noteId, {
      notes,
      status: error.kind === 'aborted' && notes ? 'done' : 'error',
      error: error.kind === 'aborted' ? 'Stopped before finishing.' : error.message,
    });
  } finally {
    inflight.delete(noteId);
  }
}

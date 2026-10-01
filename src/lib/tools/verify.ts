import { getSubject, type SubjectId } from '@/constants/subjects';
import { streamChat, type ClientConfig } from '@/lib/deepseek/client';
import { isAbortError } from '@/lib/deepseek/errors';
import type { ReasoningEffort } from '@/lib/deepseek/models';
import { extractJson } from '@/lib/json';
import type { MultipleChoiceQuestion } from '@/lib/types';

const LETTERS = 'ABCDEFGH';

export interface CheckOptions {
  config: ClientConfig;
  model: string;
  subject: SubjectId;
  thinking: boolean;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
}

/** Agreement of an independent solve with each answer key: true/false, or null when it couldn't be checked. */
export type KeyCheck = boolean | null;

export function checkPrompt(subject: SubjectId): string {
  return [
    `You are a meticulous ${getSubject(subject).label} examiner checking an exam before it is printed.`,
    'Solve every multiple-choice question yourself, independently and carefully. Do not assume any choice is correct.',
    'For each question give the letter of the single correct choice. If no choice is correct, or more than one is, answer "none".',
    'Reply with a single valid JSON object and nothing else, in exactly this format: {"answers":[{"q":1,"answer":"B"},{"q":2,"answer":"none"}]}',
  ].join('\n');
}

export function checkUserPrompt(questions: MultipleChoiceQuestion[]): string {
  return questions
    .map((q, i) => [`Question ${i + 1}: ${q.question}`, ...q.choices.map((c, j) => `${LETTERS[j]}) ${c}`)].join('\n'))
    .join('\n\n');
}

/** Maps the checker's reply onto the questions; anything missing or unreadable is null. */
export function compareKeys(questions: MultipleChoiceQuestion[], raw: unknown): KeyCheck[] {
  const out: KeyCheck[] = questions.map(() => null);
  const answers =
    raw && typeof raw === 'object' && Array.isArray((raw as { answers?: unknown }).answers)
      ? ((raw as { answers: unknown[] }).answers as unknown[])
      : [];
  answers.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const e = entry as { q?: unknown; answer?: unknown };
    const index = typeof e.q === 'number' && Number.isInteger(e.q) ? e.q - 1 : i;
    const q = questions[index];
    if (!q || typeof e.answer !== 'string') return;
    const answer = e.answer.trim();
    if (/^none$/i.test(answer)) {
      out[index] = false;
      return;
    }
    const letter = /^\(?([A-Ha-h])\)?[.)]?$/.exec(answer)?.[1];
    if (!letter) return;
    const picked = letter.toUpperCase().charCodeAt(0) - 65;
    if (picked < q.choices.length) out[index] = picked === q.answerIndex;
  });
  return out;
}

/**
 * Has the model solve the questions again without seeing the key. A wrong key teaches a student
 * the wrong thing, so callers drop or flag questions where the two solves disagree.
 * Failures other than a user abort resolve to "unknown" rather than blocking the tool.
 */
export async function checkAnswerKeys(questions: MultipleChoiceQuestion[], opts: CheckOptions): Promise<KeyCheck[]> {
  try {
    const result = await streamChat(
      opts.config,
      {
        model: opts.model,
        thinking: opts.thinking,
        reasoningEffort: opts.reasoningEffort,
        json: true,
        maxTokens: opts.thinking ? 32768 : 4096,
        temperature: 0,
        messages: [
          { role: 'system', content: checkPrompt(opts.subject) },
          { role: 'user', content: checkUserPrompt(questions) },
        ],
      },
      {},
      opts.signal,
    );
    return compareKeys(questions, extractJson(result.content));
  } catch (error) {
    if (isAbortError(error) || opts.signal?.aborted) throw error;
    return questions.map(() => null);
  }
}

/**
 * Keeps the questions whose key was confirmed (or couldn't be checked). Disagreements are
 * dropped while at least `minKeep` questions remain; otherwise they stay, flagged as unverified.
 */
export function applyKeyChecks<T extends MultipleChoiceQuestion>(questions: T[], checks: KeyCheck[], minKeep: number): T[] {
  const kept = questions.filter((_, i) => checks[i] !== false);
  if (kept.length >= minKeep && kept.length > 0) return kept;
  return questions.map((q, i) => (checks[i] === false ? { ...q, unverified: true } : q));
}

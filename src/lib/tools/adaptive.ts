import type { MultipleChoiceQuestion, PracticeQuestion, PracticeTest } from '@/lib/types';

const LETTERS = 'ABCDEFGH';
const LEVELS: PracticeQuestion['difficulty'][] = ['easy', 'medium', 'hard'];

export interface AnswerRecord {
  choice: number;
  correct: boolean;
  at: number;
}

/** Harder after a right answer, easier after a wrong one, the same when unanswered. */
export function nextDifficulty(
  current: PracticeQuestion['difficulty'],
  last: AnswerRecord | undefined,
): PracticeQuestion['difficulty'] {
  const i = LEVELS.indexOf(current);
  if (!last) return current;
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i + (last.correct ? 1 : -1)))];
}

const describe = (q: MultipleChoiceQuestion, choice: number | null | undefined) =>
  [
    `Question: ${q.question}`,
    `Correct answer: ${LETTERS[q.answerIndex]}) ${q.choices[q.answerIndex] ?? ''}`,
    choice === null || choice === undefined
      ? 'The student skipped it.'
      : `The student chose: ${LETTERS[choice]}) ${q.choices[choice] ?? ''}`,
  ].join('\n');

/** Instructions for the next "Another question", adapted to how the student did on this one. */
export function followUpContext(q: PracticeQuestion, last: AnswerRecord | undefined): string {
  const level = nextDifficulty(q.difficulty, last);
  const lines = [`Make the new question "${level}" difficulty and set "difficulty" to "${level}".`];
  if (last?.correct) {
    lines.push('The student answered the previous question correctly, so test a different or deeper sub-skill of the topic.');
  } else if (last) {
    lines.push(
      'The student got the previous question wrong. Target the same idea with a fresh question so they can practise it, and make the hint address the mistake they made.',
    );
  }
  lines.push('Do not repeat the previous question:', describe(q, last?.choice));
  return lines.join('\n');
}

/** Source material for "Practice my mistakes": the missed questions and the answers the student chose. */
export function mistakesContext(test: PracticeTest, answers: (number | null)[]): string | null {
  const missed = test.questions
    .map((q, i) => ({ q, choice: answers[i] }))
    .filter(({ q, choice }) => choice !== q.answerIndex);
  if (missed.length === 0) return null;
  return [
    `The student just took a practice test on ${test.topic} and missed the ${missed.length} question${missed.length > 1 ? 's' : ''} below.`,
    'Write a new practice test that targets the same skills and the misconceptions their wrong answers reveal: fresh questions (never copies), starting slightly easier and building up to the original level. Use the student\'s wrong answers as distractors where they fit.',
    '',
    ...missed.map(({ q, choice }, n) => `Missed question ${n + 1}\n${describe(q, choice)}`),
  ].join('\n');
}

export function missedCount(test: PracticeTest, answers: (number | null)[] | undefined): number {
  if (!answers) return 0;
  return test.questions.filter((q, i) => answers[i] !== q.answerIndex).length;
}

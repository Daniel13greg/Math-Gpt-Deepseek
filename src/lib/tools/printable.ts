import type { FlashcardDeck, PracticeTest } from '@/lib/types';

const LETTERS = 'ABCDEFGH';

/** A practice test as a printable worksheet: the questions, then (on a new page) the answer key with solutions. */
export function practiceTestSections(test: PracticeTest): string[] {
  const questions = test.questions.map((q, i) =>
    [`**${i + 1}.** ${q.question}`, '', ...q.choices.map((c, j) => `${LETTERS[j]}) ${c}  `)].join('\n'),
  );
  const key = test.questions.map(
    (q, i) => `**${i + 1}. ${LETTERS[q.answerIndex]})** ${q.choices[q.answerIndex] ?? ''}\n\n${q.explanation}`,
  );
  return [
    [`*${test.questions.length} questions on ${test.topic}. Circle one answer for each question.*`, ...questions].join('\n\n'),
    ['### Answer key', ...key].join('\n\n'),
  ];
}

/** Flashcards as a two-column table for printing and cutting out. */
export function flashcardsMarkdown(deck: FlashcardDeck): string {
  const cell = (s: string) => s.replace(/\n+/g, ' ').replace(/\|/g, '\\|');
  return ['| Front | Back |', '|---|---|', ...deck.cards.map((c) => `| ${cell(c.front)} | ${cell(c.back)} |`)].join('\n');
}

/** A file name that works on every platform: "Derivatives & the Power Rule" → "Derivatives the Power Rule.pdf". */
export function pdfFileName(title: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${clean || 'Document'}.pdf`;
}

import type { PracticeQuestion, PracticeTest } from '@/lib/types';

import { followUpContext, missedCount, mistakesContext, nextDifficulty } from '../adaptive';

const question: PracticeQuestion = {
  topic: 'Quadratics',
  difficulty: 'medium',
  question: 'Solve x^2 - 7x + 10 = 0',
  choices: ['2 and 5', '-2 and -5', '1 and 10', '7'],
  answerIndex: 0,
  explanation: '(x-2)(x-5)',
};

describe('nextDifficulty', () => {
  it('steps up after a right answer and down after a wrong one, within bounds', () => {
    expect(nextDifficulty('medium', { choice: 0, correct: true, at: 0 })).toBe('hard');
    expect(nextDifficulty('hard', { choice: 0, correct: true, at: 0 })).toBe('hard');
    expect(nextDifficulty('medium', { choice: 1, correct: false, at: 0 })).toBe('easy');
    expect(nextDifficulty('easy', { choice: 1, correct: false, at: 0 })).toBe('easy');
    expect(nextDifficulty('medium', undefined)).toBe('medium');
  });
});

describe('followUpContext', () => {
  it('asks for a harder, different question after a right answer', () => {
    const context = followUpContext(question, { choice: 0, correct: true, at: 0 });
    expect(context).toContain('"hard"');
    expect(context).toContain('different or deeper sub-skill');
    expect(context).toContain('Do not repeat');
  });

  it('targets the same idea and names the wrong choice after a miss', () => {
    const context = followUpContext(question, { choice: 1, correct: false, at: 0 });
    expect(context).toContain('"easy"');
    expect(context).toContain('The student chose: B) -2 and -5');
    expect(context).toContain('Correct answer: A) 2 and 5');
  });
});

describe('mistakesContext', () => {
  const test: PracticeTest = { title: 'T', topic: 'Quadratics', questions: [question, { ...question, question: 'Q2' }] };

  it('lists only the missed and skipped questions with the chosen answers', () => {
    const context = mistakesContext(test, [0, null])!;
    expect(context).toContain('missed the 1 question below');
    expect(context).toContain('Question: Q2');
    expect(context).toContain('The student skipped it.');
    expect(context).not.toContain('Question: Solve');
    expect(missedCount(test, [0, null])).toBe(1);
  });

  it('returns nothing to practise after a perfect score', () => {
    expect(mistakesContext(test, [0, 0])).toBeNull();
    expect(missedCount(test, undefined)).toBe(0);
  });
});

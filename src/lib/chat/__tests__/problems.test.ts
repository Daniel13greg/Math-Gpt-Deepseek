import { useProblemPicker } from '@/store/problemPicker';

import { parseProblems, problemRequest } from '../problems';

describe('parseProblems', () => {
  it('keeps labelled problems, numbers unlabelled ones and prettifies math', () => {
    expect(
      parseProblems({
        problems: [{ label: '4b', text: 'Solve x^2 = 9' }, { text: 'Simplify 6/4' }, { label: 'x', text: '' }, 'junk'],
      }),
    ).toEqual([
      { label: '4b', text: 'Solve x² = 9' },
      { label: '2', text: 'Simplify ⁶⁄₄' },
    ]);
  });

  it('treats anything else as no problems found', () => {
    expect(parseProblems({})).toEqual([]);
    expect(parseProblems(null)).toEqual([]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ label: String(i), text: `Problem ${i}` }));
    expect(parseProblems({ problems: many })).toHaveLength(12);
  });
});

describe('problemRequest', () => {
  it('names the chosen problem or asks for all', () => {
    expect(problemRequest({ label: '3', text: 'Factor 2x² + 7x + 3' })).toBe('Solve problem 3: Factor 2x² + 7x + 3');
    expect(problemRequest('all')).toBe('Solve all the problems in this photo.');
  });
});

describe('problem picker', () => {
  const problems = [
    { label: '1', text: 'a' },
    { label: '2', text: 'b' },
  ];

  it('resolves with the chosen problem and closes', async () => {
    const pending = useProblemPicker.getState().ask(problems);
    expect(useProblemPicker.getState().problems).toBe(problems);
    useProblemPicker.getState().answer(problems[1]);
    await expect(pending).resolves.toBe(problems[1]);
    expect(useProblemPicker.getState().problems).toBeNull();
  });

  it('falls back to solving everything when the reply is stopped', async () => {
    const controller = new AbortController();
    const pending = useProblemPicker.getState().ask(problems, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBe('all');
    expect(useProblemPicker.getState().problems).toBeNull();
  });
});

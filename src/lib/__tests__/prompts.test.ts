import { ANSWER_STYLES } from '@/constants/answerStyles';
import { toolRequestText } from '@/lib/chat/controller';
import { checkWorkSystemPrompt, toolSystemPrompt, toolUserPrompt, tutorSystemPrompt } from '@/lib/prompts';

jest.mock('@/lib/storage/kv', () => ({ kv: { getItemSync: () => null, setItem: () => {}, removeItem: () => {} } }));
jest.mock('@/lib/storage/secure', () => ({ secure: { getSync: () => null, set: async () => {} } }));

describe('answer styles', () => {
  it('gives every style its own instructions', () => {
    const prompts = ANSWER_STYLES.map((s) => tutorSystemPrompt('math', s.id));
    expect(new Set(prompts).size).toBe(ANSWER_STYLES.length);
    expect(tutorSystemPrompt('math')).toBe(tutorSystemPrompt('math', 'steps'));
  });

  it('keeps tutor mode from solving the whole problem up front', () => {
    const tutor = tutorSystemPrompt('physics', 'tutor');
    expect(tutor).toContain('Socratic tutor');
    expect(tutor).toContain('only the first hint');
    expect(tutor).not.toContain('Then solve it.');
  });

  it('keeps the shared math formatting rules in every style', () => {
    for (const style of ANSWER_STYLES) expect(tutorSystemPrompt('math', style.id)).toContain('\\frac{a}{b}');
  });
});

describe('check my work', () => {
  it('asks for the first mistake and a corrected solution', () => {
    const prompt = checkWorkSystemPrompt('math');
    expect(prompt).toContain('First mistake in step N');
    expect(prompt).toContain('Corrected solution');
    expect(toolSystemPrompt('check-work', 'math')).toBe(prompt);
  });

  it('builds the visible request from typed working', () => {
    expect(toolRequestText({ kind: 'check-work' }, '2x + 3 = 11\n2x = 14')).toBe('Check my work:\n\n2x + 3 = 11\n2x = 14');
    expect(toolRequestText({ kind: 'check-work' }, '  ')).toBe('Check my work');
  });
});

describe('toolUserPrompt', () => {
  it('appends source material after the topic', () => {
    expect(toolUserPrompt('flashcards', 'Derivatives', undefined, 'Notes:\n- power rule')).toBe(
      'Topic: Derivatives\n\nNotes:\n- power rule',
    );
    expect(toolUserPrompt('diagram', '', 'venn')).toBe('Diagram type: venn. Topic: a core topic of this subject');
  });
});

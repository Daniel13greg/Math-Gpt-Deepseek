export type AnswerStyle = 'steps' | 'tutor' | 'answer' | 'simple' | 'exam';

export interface AnswerStyleInfo {
  id: AnswerStyle;
  label: string;
  description: string;
  /** Composer placeholder while this style is active (the default style keeps the subject placeholder). */
  placeholder?: string;
}

export const ANSWER_STYLES: AnswerStyleInfo[] = [
  { id: 'steps', label: 'Step by step', description: 'Full worked solution with every step explained' },
  {
    id: 'tutor',
    label: 'Tutor mode',
    description: 'Hints first: you solve it, one step at a time',
    placeholder: 'Tutor mode: what are you working on?',
  },
  {
    id: 'answer',
    label: 'Just the answer',
    description: 'The result with a one- or two-line justification',
    placeholder: 'Just the answer: ask a question',
  },
  {
    id: 'simple',
    label: 'Explain simply',
    description: 'Plain words and small steps, no jargon',
    placeholder: 'Explain simply: ask a question',
  },
  {
    id: 'exam',
    label: 'Exam-style working',
    description: 'Concise, formal working that earns full marks',
    placeholder: 'Exam-style: ask a question',
  },
];

export const DEFAULT_ANSWER_STYLE: AnswerStyle = 'steps';

export function getAnswerStyle(id: AnswerStyle | undefined): AnswerStyleInfo {
  return ANSWER_STYLES.find((s) => s.id === id) ?? ANSWER_STYLES[0];
}

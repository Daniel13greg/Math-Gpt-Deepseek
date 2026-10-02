export type AnswerStyle = 'steps' | 'tutor' | 'answer' | 'simple' | 'exam';

/** Labels, descriptions and composer placeholders live in the translations ("answerStyle.<id>"). */
export const ANSWER_STYLES: AnswerStyle[] = ['steps', 'tutor', 'answer', 'simple', 'exam'];

export const DEFAULT_ANSWER_STYLE: AnswerStyle = 'steps';

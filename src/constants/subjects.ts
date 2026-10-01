export type SubjectId =
  | 'math'
  | 'physics'
  | 'accounting'
  | 'chemistry'
  | 'statistics'
  | 'biology'
  | 'economics'
  | 'finance'
  | 'computer-science'
  | 'engineering';

export interface Subject {
  id: SubjectId;
  label: string;
  /** Lowercase noun used in "Type your ___ question here". */
  noun: string;
  /** Extra guidance appended to the tutor system prompt. */
  guidance: string;
  /** Subjects where "$" usually means money, so math must use \( \) delimiters. */
  currency?: boolean;
}

export const SUBJECTS: Subject[] = [
  {
    id: 'math',
    label: 'Math',
    noun: 'math',
    guidance:
      'Cover arithmetic through university mathematics (algebra, geometry, trigonometry, calculus, linear algebra, differential equations, discrete math, proofs). Show every algebraic step and state theorems you use.',
  },
  {
    id: 'physics',
    label: 'Physics',
    noun: 'physics',
    guidance:
      'List the known quantities with units, choose the governing laws, solve symbolically first, then substitute numbers. Track units and significant figures, and sanity-check the magnitude of the answer.',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    noun: 'accounting',
    currency: true,
    guidance:
      'Follow GAAP/IFRS conventions. Use journal entries (debit/credit tables), T-accounts and financial statement formats where helpful. Label every amount clearly.',
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    noun: 'chemistry',
    guidance:
      'Balance equations, track moles and units through dimensional analysis, and use significant figures. Write chemical formulas and reactions with mhchem, e.g. \\(\\ce{2H2 + O2 -> 2H2O}\\).',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    noun: 'statistics',
    guidance:
      'State hypotheses, assumptions and the test or distribution used. Show formulas before plugging in numbers, report test statistics, p-values or intervals, and interpret the result in context.',
  },
  {
    id: 'biology',
    label: 'Biology',
    noun: 'biology',
    guidance:
      'Explain mechanisms step by step, define key terms, and use Punnett squares, pathways or tables when they make the answer clearer.',
  },
  {
    id: 'economics',
    label: 'Economics',
    noun: 'economics',
    currency: true,
    guidance:
      'Use supply/demand reasoning, marginal analysis and elasticities. Show equations for equilibrium, surplus and multipliers, and explain the intuition behind each result.',
  },
  {
    id: 'finance',
    label: 'Finance',
    noun: 'finance',
    currency: true,
    guidance:
      'Use time value of money, NPV/IRR, annuity, bond and portfolio formulas. Show the formula, the substituted values and the final figure rounded sensibly.',
  },
  {
    id: 'computer-science',
    label: 'Computer Science',
    noun: 'computer science',
    guidance:
      'Explain algorithms and data structures with complexity analysis. Use fenced code blocks with a language tag for code and trace through small examples.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    noun: 'engineering',
    guidance:
      'Draw on statics, dynamics, circuits, thermodynamics and materials. Define the system, state assumptions, keep units consistent and check the result against engineering intuition.',
  },
];

export const DEFAULT_SUBJECT: SubjectId = 'math';

export function getSubject(id: SubjectId | undefined | null): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0];
}

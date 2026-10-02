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
  /** Starter questions on the empty chat screen. Math is plain text ("x^2"); it's typeset when sent. */
  examples: string[];
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
    examples: ['Solve x^2 - 5x + 6 = 0', 'Find the derivative of x^3 + 2x^2 - 7', "Why can't we divide by zero?"],
    guidance:
      'Cover arithmetic through university mathematics (algebra, geometry, trigonometry, calculus, linear algebra, differential equations, discrete math, proofs). Show every algebraic step and state theorems you use.',
  },
  {
    id: 'physics',
    label: 'Physics',
    noun: 'physics',
    examples: [
      'A ball is thrown up at 20 m/s. How high does it go?',
      "Explain Newton's third law with an example",
      'What current flows through a 10 Ω resistor at 5 V?',
    ],
    guidance:
      'List the known quantities with units, choose the governing laws, solve symbolically first, then substitute numbers. Track units and significant figures, and sanity-check the magnitude of the answer.',
  },
  {
    id: 'accounting',
    label: 'Accounting',
    noun: 'accounting',
    examples: [
      'Journal entry for buying $5,000 of equipment on credit',
      "Accrual vs cash accounting: what's the difference?",
      'How does straight-line depreciation work?',
    ],
    currency: true,
    guidance:
      'Follow GAAP/IFRS conventions. Use journal entries (debit/credit tables), T-accounts and financial statement formats where helpful. Label every amount clearly.',
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    noun: 'chemistry',
    examples: ['Balance Fe + O2 -> Fe2O3', 'How many moles are in 36 g of water?', 'Why does ice float on water?'],
    guidance:
      'Balance equations, track moles and units through dimensional analysis, and use significant figures. Write chemical formulas and reactions with mhchem, e.g. \\(\\ce{2H2 + O2 -> 2H2O}\\).',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    noun: 'statistics',
    examples: [
      'Mean and standard deviation of 4, 8, 15, 16, 23, 42',
      'When should I use a t-test instead of a z-test?',
      'What does a p-value of 0.03 mean?',
    ],
    guidance:
      'State hypotheses, assumptions and the test or distribution used. Show formulas before plugging in numbers, report test statistics, p-values or intervals, and interpret the result in context.',
  },
  {
    id: 'biology',
    label: 'Biology',
    noun: 'biology',
    examples: ['How does photosynthesis work?', 'Punnett square for Aa × Aa', "Mitosis vs meiosis: what's the difference?"],
    guidance:
      'Explain mechanisms step by step, define key terms, and use Punnett squares, pathways or tables when they make the answer clearer.',
  },
  {
    id: 'economics',
    label: 'Economics',
    noun: 'economics',
    examples: [
      'What happens to price when demand rises?',
      'Explain price elasticity of demand',
      'What is the multiplier if the MPC is 0.8?',
    ],
    currency: true,
    guidance:
      'Use supply/demand reasoning, marginal analysis and elasticities. Show equations for equilibrium, surplus and multipliers, and explain the intuition behind each result.',
  },
  {
    id: 'finance',
    label: 'Finance',
    noun: 'finance',
    examples: [
      'NPV of $1,000 a year for 5 years at 8%',
      'How does compound interest work?',
      "Stocks vs bonds: what's the difference?",
    ],
    currency: true,
    guidance:
      'Use time value of money, NPV/IRR, annuity, bond and portfolio formulas. Show the formula, the substituted values and the final figure rounded sensibly.',
  },
  {
    id: 'computer-science',
    label: 'Computer Science',
    noun: 'computer science',
    examples: ['Big-O of binary search, and why?', 'Reverse a linked list in Python', "Stack vs queue: what's the difference?"],
    guidance:
      'Explain algorithms and data structures with complexity analysis. Use fenced code blocks with a language tag for code and trace through small examples.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    noun: 'engineering',
    examples: [
      '4 Ω and 6 Ω resistors in parallel: equivalent resistance?',
      'Explain the first law of thermodynamics',
      'Reactions of a 6 m beam with a 10 kN center load',
    ],
    guidance:
      'Draw on statics, dynamics, circuits, thermodynamics and materials. Define the system, state assumptions, keep units consistent and check the result against engineering intuition.',
  },
];

export const DEFAULT_SUBJECT: SubjectId = 'math';

export function getSubject(id: SubjectId | undefined | null): Subject {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0];
}

import { create } from 'zustand';

import type { DetectedProblem } from '@/lib/chat/problems';

export type ProblemChoice = DetectedProblem | 'all';

interface PickerState {
  problems: DetectedProblem[] | null;
  resolve: ((choice: ProblemChoice) => void) | null;
  /** Shows the picker and resolves with the student's choice ("all" if dismissed or aborted). */
  ask: (problems: DetectedProblem[], signal?: AbortSignal) => Promise<ProblemChoice>;
  answer: (choice: ProblemChoice) => void;
}

export const useProblemPicker = create<PickerState>()((set, get) => ({
  problems: null,
  resolve: null,
  ask: (problems, signal) =>
    new Promise<ProblemChoice>((resolve) => {
      get().resolve?.('all');
      const done = (choice: ProblemChoice) => {
        signal?.removeEventListener('abort', onAbort);
        set({ problems: null, resolve: null });
        resolve(choice);
      };
      const onAbort = () => done('all');
      signal?.addEventListener('abort', onAbort, { once: true });
      set({ problems, resolve: done });
    }),
  answer: (choice) => get().resolve?.(choice),
}));

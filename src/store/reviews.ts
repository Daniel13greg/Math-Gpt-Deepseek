import { create } from 'zustand';

import { schedule, type CardSchedule, type Grade } from '@/lib/srs';
import { kv } from '@/lib/storage/kv';

/** A flashcard deck lives in a chat message: "<chatId>:<messageId>". */
export type DeckKey = string;

export const deckKey = (chatId: string, messageId: string): DeckKey => `${chatId}:${messageId}`;

interface ReviewsState {
  /** Schedules per deck, indexed by card position. Cards never studied have no schedule. */
  decks: Record<DeckKey, Record<number, CardSchedule>>;
  grade: (deck: DeckKey, card: number, grade: Grade) => void;
  forgetChat: (chatId: string) => void;
  forgetAll: () => void;
  /** Replaces everything (backup restore). */
  replaceAll: (decks: Record<DeckKey, Record<number, CardSchedule>>) => void;
}

const KEY = 'reviews:v1';

function load(): ReviewsState['decks'] {
  try {
    return JSON.parse(kv.getItemSync(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export const useReviews = create<ReviewsState>()((set, get) => {
  const save = () => kv.setItem(KEY, JSON.stringify(get().decks));
  return {
    decks: load(),
    grade: (deck, card, grade) => {
      const cards = get().decks[deck] ?? {};
      set({ decks: { ...get().decks, [deck]: { ...cards, [card]: schedule(cards[card], grade) } } });
      save();
    },
    forgetChat: (chatId) => {
      const decks = Object.fromEntries(Object.entries(get().decks).filter(([key]) => !key.startsWith(`${chatId}:`)));
      set({ decks });
      save();
    },
    forgetAll: () => {
      set({ decks: {} });
      save();
    },
    replaceAll: (decks) => {
      set({ decks });
      save();
    },
  };
});

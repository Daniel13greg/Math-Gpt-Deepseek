import { describeDue, endOfDay, isDue, schedule, START_EASE } from '../srs';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 1, 9, 0).getTime();

describe('schedule', () => {
  it('grows the interval 1 → 3 → ×ease days while the card is known', () => {
    const first = schedule(undefined, 'good', now);
    expect(first).toMatchObject({ reps: 1, intervalDays: 1, due: now + DAY, ease: START_EASE });
    const second = schedule(first, 'good', first.due);
    expect(second.intervalDays).toBe(3);
    const third = schedule(second, 'good', second.due);
    expect(third.intervalDays).toBe(Math.round(3 * START_EASE));
  });

  it('brings a forgotten card back in ten minutes and lowers its ease', () => {
    const known = schedule(schedule(undefined, 'good', now), 'good', now);
    const lapsed = schedule(known, 'again', now);
    expect(lapsed).toMatchObject({ reps: 0, intervalDays: 0, lapses: 1, due: now + 10 * 60 * 1000 });
    expect(lapsed.ease).toBeCloseTo(START_EASE - 0.2);
    expect(schedule(lapsed, 'good', now).intervalDays).toBe(1);
  });

  it('never lets ease fall below 1.3 and does not count a first miss as a lapse', () => {
    let card = schedule(undefined, 'again', now);
    expect(card.lapses).toBe(0);
    for (let i = 0; i < 20; i++) card = schedule(card, 'again', now);
    expect(card.ease).toBeCloseTo(1.3);
  });
});

describe('due dates', () => {
  it('counts anything due before midnight as due today', () => {
    const card = schedule(undefined, 'again', now);
    expect(isDue(card, now)).toBe(true);
    expect(isDue({ ...card, due: endOfDay(now) + 1 }, now)).toBe(false);
    expect(isDue(undefined, now)).toBe(false);
  });

  it('describes when a card comes back', () => {
    expect(describeDue(now + 60_000, now)).toBe('today');
    expect(describeDue(now + DAY, now)).toBe('tomorrow');
    expect(describeDue(now + 6 * DAY, now)).toBe('in 6 days');
    expect(describeDue(now + 21 * DAY, now)).toBe('in 3 weeks');
    expect(describeDue(now + 90 * DAY, now)).toBe('in 3 months');
  });
});

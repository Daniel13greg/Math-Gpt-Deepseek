import { translate, type LanguageCode } from '@/i18n/strings';

export interface DateGroup<T> {
  label: string;
  items: T[];
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Groups items (already sorted newest first) into Today / Yesterday / Previous 7 days / Previous 30 days / Month Year. */
export function groupByDate<T>(
  items: T[],
  getTime: (item: T) => number,
  lang: LanguageCode = 'en',
  now = Date.now(),
): DateGroup<T>[] {
  const today = startOfDay(now);
  const groups: DateGroup<T>[] = [];
  const push = (label: string, item: T) => {
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  };
  for (const item of items) {
    const t = getTime(item);
    let label: string;
    if (t >= today) label = translate(lang, 'dates.today');
    else if (t >= today - DAY) label = translate(lang, 'dates.yesterday');
    else if (t >= today - 7 * DAY) label = translate(lang, 'dates.previous7');
    else if (t >= today - 30 * DAY) label = translate(lang, 'dates.previous30');
    else label = new Date(t).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    push(label, item);
  }
  return groups;
}

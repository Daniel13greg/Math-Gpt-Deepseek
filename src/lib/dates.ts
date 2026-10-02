export interface DateGroup<T> {
  label: string;
  items: T[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Elapsed seconds as a clock: "0:07", "12:34", "1:02:09". */
export function formatClock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Groups items (already sorted newest first) into Today / Yesterday / Previous 7 days / Previous 30 days / Month Year. */
export function groupByDate<T>(items: T[], getTime: (item: T) => number, now = Date.now()): DateGroup<T>[] {
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
    if (t >= today) label = 'Today';
    else if (t >= today - DAY) label = 'Yesterday';
    else if (t >= today - 7 * DAY) label = 'Previous 7 days';
    else if (t >= today - 30 * DAY) label = 'Previous 30 days';
    else label = new Date(t).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    push(label, item);
  }
  return groups;
}

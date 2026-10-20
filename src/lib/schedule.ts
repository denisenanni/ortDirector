// Pure date and scheduling logic. No React Native imports here, so it runs
// under `node --test` (see schedule.test.ts).
import { locale, tr } from './i18n.ts';
import type { DayString, Sun, Task, TaskWithPlant } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDay(date: Date): DayString {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses a DayString as local midnight. */
export function fromDay(day: DayString): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): DayString {
  return toDay(now);
}

export function addDays(day: DayString, n: number): DayString {
  const date = fromDay(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
}

/** Whole days from `a` to `b` (positive when b is later). DST-safe. */
export function daysBetween(a: DayString, b: DayString): number {
  return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / MS_PER_DAY);
}

export function relativeLabel(day: DayString, ref: DayString): string {
  const diff = daysBetween(ref, day);
  if (diff === 0) return tr('Oggi', 'Today');
  if (diff === 1) return tr('Domani', 'Tomorrow');
  if (diff === -1) return tr('Ieri', 'Yesterday');
  if (diff < 0) return tr(`In ritardo di ${-diff} giorni`, `${-diff} days late`);
  if (diff < 7) return tr(`Tra ${diff} giorni`, `In ${diff} days`);
  return fromDay(day).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function month(day: DayString): number {
  return Number(day.slice(5, 7));
}

function firstOfMonth(day: DayString, plusMonths = 0): DayString {
  const d = fromDay(day);
  return toDay(new Date(d.getFullYear(), d.getMonth() + plusMonths, 1));
}

/** Same day `n` months on (clamped by Date, so Feb 29 + 12 months is Mar 1). */
function addMonths(day: DayString, n: number): DayString {
  const d = fromDay(day);
  return toDay(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()));
}

export function inSeason(day: DayString, months: number[] | null | undefined): boolean {
  return !months || months.length === 0 || months.includes(month(day));
}

/** `day` itself when it is in season, else the first day of the next month that is. */
export function nextInSeason(day: DayString, months: number[] | null | undefined): DayString {
  if (inSeason(day, months)) return day;
  for (let i = 1; i <= 12; i++) {
    const first = firstOfMonth(day, i);
    if (inSeason(first, months)) return first;
  }
  return day;
}

/** May to September: when watering follows the summer interval. */
export const WARM_MONTHS = [5, 6, 7, 8, 9];

/** The repeat interval in force on `day`: the cold one outside the warm months, if set. */
export function intervalOn(
  task: { repeatDays: number | null; coldRepeatDays?: number | null },
  day: DayString,
): number | null {
  return task.coldRepeatDays && !inSeason(day, WARM_MONTHS) ? task.coldRepeatDays : task.repeatDays;
}

/**
 * Watering after rain: counts as watered on `day`, so the task moves to one
 * interval later. Never moves a task earlier.
 */
export function afterRain(
  task: { dueOn: DayString; repeatDays: number | null; coldRepeatDays?: number | null },
  day: DayString,
): DayString {
  const every = intervalOn(task, day);
  if (!every) return task.dueOn;
  const next = addDays(day, every);
  return next > task.dueOn ? next : task.dueOn;
}

/** Why a spot doesn't suit a plant's sun needs, or null when it does. */
export function sunMismatch(need: Sun, spot: Sun): string | null {
  if (need === 'full' && spot !== 'full') return tr('Qui prende meno sole di quanto le serve.', 'Gets less sun here than it needs.');
  if (need === 'shade' && spot === 'full') return tr('Qui prende troppo sole: rischia di bruciarsi.', 'Too much sun here: it may scorch.');
  if (need === 'partial' && spot === 'shade') return tr('Qui prende meno sole di quanto le serve.', 'Gets less sun here than it needs.');
  return null;
}

/** When something happened, for history: "Oggi", "Ieri", "3 giorni fa", or the date. */
export function pastLabel(day: DayString, ref: DayString): string {
  const ago = daysBetween(day, ref);
  if (ago <= 0) return tr('Oggi', 'Today');
  if (ago === 1) return tr('Ieri', 'Yesterday');
  if (ago < 7) return tr(`${ago} giorni fa`, `${ago} days ago`);
  return fromDay(day).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/**
 * What happens to a task when it is marked done on `doneOn`.
 * Repeating tasks roll forward from the completion day (water every 3 days
 * means 3 days after you actually watered, not after the original due date).
 * Outside its months a task skips to the first day of the next month it
 * allows ("fertilize every 3 weeks, April to September"). A yearly task comes
 * back at the start of its window next year (prune in February), or on the
 * same date when it has no months. A task with `endsOn` closes once its next
 * date would fall after it.
 */
export function completeTask(
  task: Pick<Task, 'repeatDays'> & {
    coldRepeatDays?: number | null;
    endsOn?: DayString | null;
    yearly?: boolean;
    months?: number[] | null;
  },
  doneOn: DayString,
): { dueOn: DayString; doneOn: DayString | null } | { dueOn: null; doneOn: DayString } {
  let next: DayString | null = null;
  if (task.yearly) {
    next = task.months?.length
      ? // Ten months on, then forward to the window: lands on next year's
        // window for any window shorter than ten months.
        nextInSeason(firstOfMonth(doneOn, 10), task.months)
      : addMonths(doneOn, 12);
  } else {
    const every = intervalOn(task, doneOn);
    if (every && every > 0) next = nextInSeason(addDays(doneOn, every), task.months);
  }
  if (next && (!task.endsOn || next <= task.endsOn)) return { dueOn: next, doneOn: null };
  return { dueOn: null, doneOn };
}

export interface Reminder {
  day: DayString;
  at: Date;
  title: string;
  body: string;
}

/**
 * One reminder per day that has open tasks, covering `horizonDays` days from
 * `now`. Overdue tasks are folded into today's reminder. Days whose reminder
 * time has already passed are skipped (the app shows them anyway).
 *
 * One digest per day instead of one notification per task keeps us well under
 * iOS's limit of 64 pending local notifications.
 */
export function buildReminders(
  tasks: TaskWithPlant[],
  now: Date,
  hour: number,
  horizonDays = 30,
): Reminder[] {
  const start = today(now);
  const byDay = new Map<DayString, TaskWithPlant[]>();
  for (const t of tasks) {
    if (t.doneOn) continue;
    const day = t.dueOn < start ? start : t.dueOn;
    if (daysBetween(start, day) >= horizonDays) continue;
    const list = byDay.get(day) ?? [];
    list.push(t);
    byDay.set(day, list);
  }

  const reminders: Reminder[] = [];
  for (const [day, list] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const at = fromDay(day);
    at.setHours(hour, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const names = list.map(taskLabel);
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? tr(` e altre ${names.length - 3}`, ` and ${names.length - 3} more`) : '';
    reminders.push({
      day,
      at,
      title:
        list.length === 1
          ? tr('Oggi nell’orto: 1 attività', 'In the garden today: 1 task')
          : tr(`Oggi nell’orto: ${list.length} attività`, `In the garden today: ${list.length} tasks`),
      body: shown + more,
    });
  }
  return reminders;
}

export function taskLabel(t: Pick<TaskWithPlant, 'title' | 'plantName'>): string {
  return t.plantName ? `${t.title} (${t.plantName})` : t.title;
}

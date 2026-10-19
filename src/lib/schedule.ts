// Pure date and scheduling logic. No React Native imports here, so it runs
// under `node --test` (see schedule.test.ts).
import type { DayString, Task, TaskWithPlant } from './types';

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
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff === -1) return 'Ieri';
  if (diff < 0) return `In ritardo di ${-diff} giorni`;
  if (diff < 7) return `Tra ${diff} giorni`;
  return fromDay(day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * What happens to a task when it is marked done on `doneOn`.
 * Repeating tasks roll forward from the completion day (water every 3 days
 * means 3 days after you actually watered, not after the original due date).
 * A repeating task with `endsOn` closes once its next date would fall after it.
 */
export function completeTask(
  task: Pick<Task, 'repeatDays'> & { endsOn?: DayString | null },
  doneOn: DayString,
): { dueOn: DayString; doneOn: DayString | null } | { dueOn: null; doneOn: DayString } {
  if (task.repeatDays && task.repeatDays > 0) {
    const next = addDays(doneOn, task.repeatDays);
    if (!task.endsOn || next <= task.endsOn) return { dueOn: next, doneOn: null };
  }
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
    const more = names.length > 3 ? ` e altre ${names.length - 3}` : '';
    reminders.push({
      day,
      at,
      title: list.length === 1 ? 'Oggi nell’orto: 1 attività' : `Oggi nell’orto: ${list.length} attività`,
      body: shown + more,
    });
  }
  return reminders;
}

export function taskLabel(t: Pick<TaskWithPlant, 'title' | 'plantName'>): string {
  return t.plantName ? `${t.title} (${t.plantName})` : t.title;
}

/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  afterRain,
  pastLabel,
  sunMismatch,
  nextInSeason,
  buildReminders,
  completeTask,
  daysBetween,
  relativeLabel,
} from './schedule.ts';
import { monthsLabel } from './presets.ts';
import type { TaskWithPlant } from './types';

function task(over: Partial<TaskWithPlant>): TaskWithPlant {
  return {
    id: 1,
    plantId: null,
    type: 'other',
    title: 'Task',
    dueOn: '2026-10-18',
    repeatDays: null,
    endsOn: null,
    yearly: false,
    months: null,
    coldRepeatDays: null,
    doneOn: null,
    notes: null,
    plantName: null,
    zoneName: null,
    ...over,
  };
}

test('addDays crosses month, year and DST boundaries', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-10-24', 2), '2026-10-26'); // EU DST ends Oct 25
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('daysBetween is signed and DST safe', () => {
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-10-26', '2026-10-24'), -2);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // DST starts Mar 29
});

test('relativeLabel', () => {
  const ref = '2026-10-18';
  assert.equal(relativeLabel('2026-10-18', ref), 'Oggi');
  assert.equal(relativeLabel('2026-10-19', ref), 'Domani');
  assert.equal(relativeLabel('2026-10-17', ref), 'Ieri');
  assert.equal(relativeLabel('2026-10-15', ref), 'In ritardo di 3 giorni');
  assert.equal(relativeLabel('2026-10-21', ref), 'Tra 3 giorni');
});

test('pastLabel reads history as the past, never as overdue', () => {
  const ref = '2026-10-20';
  assert.equal(pastLabel('2026-10-20', ref), 'Oggi');
  assert.equal(pastLabel('2026-10-19', ref), 'Ieri');
  assert.equal(pastLabel('2026-10-18', ref), '2 giorni fa');
});

test('completeTask rolls repeating tasks forward from the completion day', () => {
  assert.deepEqual(completeTask({ repeatDays: 3 }, '2026-10-20'), {
    dueOn: '2026-10-23',
    doneOn: null,
  });
  assert.deepEqual(completeTask({ repeatDays: null }, '2026-10-20'), {
    dueOn: null,
    doneOn: '2026-10-20',
  });
});

test('completeTask closes a repeating task past its end day', () => {
  assert.deepEqual(completeTask({ repeatDays: 7, endsOn: '2026-10-30' }, '2026-10-20'), {
    dueOn: '2026-10-27',
    doneOn: null,
  });
  assert.deepEqual(completeTask({ repeatDays: 7, endsOn: '2026-10-30' }, '2026-10-27'), {
    dueOn: null,
    doneOn: '2026-10-27',
  });
});

test('nextInSeason jumps to the first day of the next allowed month', () => {
  assert.equal(nextInSeason('2026-05-10', [4, 5, 6, 7, 8, 9]), '2026-05-10');
  assert.equal(nextInSeason('2026-10-02', [4, 5, 6, 7, 8, 9]), '2027-04-01');
  assert.equal(nextInSeason('2026-10-02', [11, 12, 1]), '2026-11-01');
  assert.equal(nextInSeason('2026-10-02', null), '2026-10-02');
});

test('completeTask keeps a repeating task inside its months', () => {
  const fertilize = { repeatDays: 21, months: [4, 5, 6, 7, 8, 9] };
  assert.equal(completeTask(fertilize, '2026-08-20').dueOn, '2026-09-10');
  assert.equal(completeTask(fertilize, '2026-09-20').dueOn, '2027-04-01');
});

test('completeTask brings a yearly task back in next year\'s window', () => {
  const prune = { repeatDays: null, yearly: true, months: [2] };
  assert.equal(completeTask(prune, '2027-02-10').dueOn, '2028-02-01');
  assert.equal(completeTask(prune, '2027-03-15').dueOn, '2028-02-01'); // done late
  const lavender = { repeatDays: null, yearly: true, months: [8, 9] };
  assert.equal(completeTask(lavender, '2026-09-25').dueOn, '2027-08-01');
  assert.equal(completeTask({ repeatDays: null, yearly: true }, '2026-10-20').dueOn, '2027-10-20');
  assert.equal(completeTask({ repeatDays: null, yearly: true, endsOn: '2027-01-01' }, '2026-10-20').dueOn, null);
});

test('monthsLabel groups runs, across New Year too', () => {
  assert.equal(monthsLabel([4, 5, 6, 7, 8, 9]), 'apr–set');
  assert.equal(monthsLabel([2]), 'feb');
  assert.equal(monthsLabel([11, 12, 1, 3]), 'mar, nov–gen');
  assert.equal(monthsLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'tutto l’anno');
});

test('watering follows the cold interval outside May to September', () => {
  const water = { repeatDays: 2, coldRepeatDays: 7 };
  assert.equal(completeTask(water, '2026-07-10').dueOn, '2026-07-12');
  assert.equal(completeTask(water, '2026-10-20').dueOn, '2026-10-27');
  assert.equal(completeTask({ repeatDays: 2, coldRepeatDays: null }, '2026-10-20').dueOn, '2026-10-22');
});

test('afterRain counts as watered today and never moves a task earlier', () => {
  assert.equal(afterRain({ dueOn: '2026-07-10', repeatDays: 2 }, '2026-07-10'), '2026-07-12');
  assert.equal(afterRain({ dueOn: '2026-07-08', repeatDays: 2 }, '2026-07-10'), '2026-07-12'); // overdue
  assert.equal(afterRain({ dueOn: '2026-07-20', repeatDays: 2 }, '2026-07-10'), '2026-07-20');
  assert.equal(afterRain({ dueOn: '2026-10-20', repeatDays: 2, coldRepeatDays: 7 }, '2026-10-20'), '2026-10-27');
});

test('sunMismatch flags sun lovers in the shade and shade plants in full sun', () => {
  assert.ok(sunMismatch('full', 'partial'));
  assert.ok(sunMismatch('full', 'shade'));
  assert.ok(sunMismatch('shade', 'full'));
  assert.ok(sunMismatch('partial', 'shade'));
  assert.equal(sunMismatch('partial', 'full'), null);
  assert.equal(sunMismatch('shade', 'partial'), null);
  assert.equal(sunMismatch('full', 'full'), null);
});

test('buildReminders groups by day, folds overdue into today, skips done and past', () => {
  const now = new Date(2026, 9, 18, 7, 0); // 07:00, before the 8:00 reminder
  const reminders = buildReminders(
    [
      task({ id: 1, title: 'Annaffiare', plantName: 'Basilico', dueOn: '2026-10-15' }),
      task({ id: 2, title: 'Controllo', dueOn: '2026-10-18' }),
      task({ id: 3, title: 'Potatura', dueOn: '2026-10-20' }),
      task({ id: 4, title: 'Fatto', dueOn: '2026-10-18', doneOn: '2026-10-17' }),
      task({ id: 5, title: 'Lontano', dueOn: '2027-01-01' }),
    ],
    now,
    8,
  );
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].day, '2026-10-18');
  assert.equal(reminders[0].body, 'Annaffiare (Basilico), Controllo');
  assert.equal(reminders[0].at.getHours(), 8);
  assert.equal(reminders[1].day, '2026-10-20');
});

test('buildReminders skips today once the reminder hour has passed', () => {
  const now = new Date(2026, 9, 18, 9, 0);
  const reminders = buildReminders([task({ dueOn: '2026-10-18' })], now, 8);
  assert.equal(reminders.length, 0);
});

test('buildReminders truncates long lists', () => {
  const now = new Date(2026, 9, 18, 7, 0);
  const tasks = [1, 2, 3, 4, 5].map((id) => task({ id, title: `T${id}` }));
  const [r] = buildReminders(tasks, now, 8);
  assert.equal(r.title, 'Oggi nell’orto: 5 attività');
  assert.equal(r.body, 'T1, T2, T3 e altre 2');
});

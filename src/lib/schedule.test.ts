/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildReminders,
  completeTask,
  daysBetween,
  relativeLabel,
} from './schedule.ts';
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
    doneOn: null,
    notes: null,
    plantName: null,
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

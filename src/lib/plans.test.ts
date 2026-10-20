/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, expandPlan, regularWateringFrom, transplantReminder } from './plans.ts';
import { PLANT_PRESETS } from './presets.ts';

test('every catalog plant has a plan, and every plan a catalog plant', () => {
  assert.deepEqual(
    PLANT_PRESETS.map((p) => p.name).sort(),
    Object.keys(PLANS).sort(),
  );
});

test('plan steps are well formed', () => {
  for (const [name, plan] of Object.entries(PLANS)) {
    for (const s of plan.steps) {
      assert.ok(s.day >= 0, `${name}: ${s.title}`);
      if (s.until !== undefined) assert.ok(s.every && s.until >= s.day, `${name}: ${s.title}`);
    }
  }
});

test('tomato plan counted from the transplant day', () => {
  const tasks = expandPlan(PLANS.Pomodoro.steps, '2026-05-01', '2026-05-01');
  const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t]));
  assert.deepEqual(byTitle['Annaffiare (attecchimento)'], {
    type: 'water',
    title: 'Annaffiare (attecchimento)',
    dueOn: '2026-05-01',
    repeatDays: 1,
    endsOn: '2026-05-14',
  });
  assert.equal(byTitle['Mettere il tutore'].dueOn, '2026-05-08');
  assert.equal(byTitle['Mettere il tutore'].repeatDays, null);
  assert.equal(byTitle['Concimazione'].dueOn, '2026-05-16');
  assert.equal(byTitle['Togliere le femminelle'].repeatDays, 7);
  assert.equal(byTitle['Raccolta'].dueOn, '2026-07-10');
});

test('a back-dated transplant drops past one-offs and moves repeats forward', () => {
  // Transplanted 20 days ago.
  const tasks = expandPlan(PLANS.Pomodoro.steps, '2026-05-01', '2026-05-21');
  const titles = tasks.map((t) => t.title);
  assert.ok(!titles.includes('Mettere il tutore')); // was due May 8
  assert.ok(!titles.includes('Annaffiare (attecchimento)')); // ended May 14
  const sfem = tasks.find((t) => t.title === 'Togliere le femminelle')!;
  assert.equal(sfem.dueOn, '2026-05-22'); // May 15, 22: first one not in the past
  assert.ok(tasks.every((t) => t.dueOn >= '2026-05-21'));
});

test('regular watering takes over after establishment', () => {
  assert.equal(regularWateringFrom(PLANS.Pomodoro.steps, '2026-05-01'), '2026-05-15');
  assert.equal(regularWateringFrom(PLANS.Carota.steps, '2026-05-01'), null);
});

test('transplant reminder after the minimum weeks from sowing', () => {
  assert.deepEqual(transplantReminder(PLANS.Pomodoro, '2026-03-01'), {
    dueOn: '2026-04-12',
    notes: 'Di solito 6-8 settimane dalla semina.',
  });
  assert.equal(transplantReminder(PLANS.Carota, '2026-03-01'), null);
  assert.equal(transplantReminder(undefined, '2026-03-01'), null);
});

/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, expandPlan, regularWateringFrom, seasonalTasks, transplantReminder } from './plans.ts';
import { PLANT_KINDS, kindWatering } from './kinds.ts';
import { PLANT_PRESETS, isAnnual, presetFor } from './presets.ts';

test('every catalog plant has a plan, and every plan a catalog plant', () => {
  assert.deepEqual(
    [...PLANT_PRESETS, ...PLANT_KINDS].map((p) => p.name).sort(),
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
    yearly: false,
    months: null,
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

test('a late transplant leaves out what only fits the summer', () => {
  const tasks = expandPlan(PLANS.Pomodoro.steps, '2026-10-01', '2026-10-01');
  const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t]));
  assert.equal(byTitle['Raccolta'], undefined); // +70 is December, next season is past +150
  assert.equal(byTitle['Concimazione'].dueOn, '2026-10-16');
  assert.ok(tasks.every((t) => t.dueOn < '2026-11-01'));
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

test('seasonal care starts at its next season and stays in it', () => {
  const tasks = seasonalTasks(PLANS.Rosa, '2026-10-20');
  const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t]));
  assert.deepEqual(byTitle['Potatura'], {
    type: 'prune',
    title: 'Potatura',
    dueOn: '2027-02-01',
    repeatDays: null,
    endsOn: null,
    yearly: true,
    months: [2],
  });
  assert.equal(byTitle['Concimazione'].dueOn, '2027-03-01');
  assert.equal(byTitle['Concimazione'].repeatDays, 30);
  assert.deepEqual(seasonalTasks(PLANS.Pomodoro, '2026-10-20'), []);
});

test('a savoy cabbage transplanted in August is picked from October', () => {
  const tasks = expandPlan(PLANS.Verza.steps, '2026-08-01', '2026-08-01');
  const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t]));
  assert.equal(byTitle['Controllo cavolaia (sotto le foglie)'].dueOn, '2026-08-15');
  assert.equal(byTitle['Raccolta'].dueOn, '2026-11-29');
  assert.deepEqual(byTitle['Raccolta'].months, [10, 11, 12, 1, 2, 3]);
});

test('vegetables are annual, shrubs and herbs that last are not', () => {
  assert.equal(isAnnual('Pomodoro'), true);
  assert.equal(isAnnual('Finocchio'), true);
  assert.equal(isAnnual('Menta'), false);
  assert.equal(isAnnual('Rosa'), false);
  assert.equal(isAnnual(undefined), false);
});

test('a kind gives care by pot, frost and age', () => {
  const plan = PLANS['Albero da frutto tropicale'];
  const titles = (care: Parameters<typeof seasonalTasks>[2]) =>
    seasonalTasks(plan, '2026-10-20', care).map((t) => t.title);
  const potted = titles({ potted: true, tender: true, young: true });
  assert.ok(potted.includes('Mettere al riparo dal gelo'));
  assert.ok(potted.includes('Controllare se serve un vaso più grande'));
  assert.ok(potted.includes('Potatura di formazione'));
  assert.ok(!potted.includes('Pacciamare e coprire con tessuto non tessuto'));
  const ground = titles({ potted: false, tender: true, young: false });
  assert.ok(ground.includes('Pacciamare e coprire con tessuto non tessuto'));
  assert.ok(ground.includes('Potatura leggera'));
  assert.ok(!ground.includes('Mettere al riparo dal gelo'));
  assert.ok(!ground.includes('Controllare se serve un vaso più grande'));
  const hardy = titles({ potted: false, tender: false });
  assert.ok(!hardy.some((t) => /gelo|protezione|tessuto/.test(t)));
});

test('frost protection falls in November', () => {
  const t = seasonalTasks(PLANS.Avocado, '2026-10-20', { potted: true }).find((x) => x.title === 'Mettere al riparo dal gelo');
  assert.equal(t?.dueOn, '2026-11-01');
  assert.equal(t?.yearly, true);
});

test('watering follows pot and size', () => {
  const tree = PLANT_KINDS.find((k) => k.name === 'Albero da frutto')!;
  assert.equal(kindWatering(tree, false, 'medium'), 7);
  assert.equal(kindWatering(tree, false, 'large'), 11);
  assert.equal(kindWatering(tree, true, 'small'), 2);
  assert.ok(kindWatering(PLANT_KINDS[0], true, 'small') >= 1);
});

test('kinds are perennial unless annual, and found only as a preset', () => {
  assert.equal(isAnnual('Albero da frutto'), false);
  assert.equal(isAnnual('Annuale da fiore'), true);
  assert.equal(isAnnual('Avocado'), false);
  assert.equal(presetFor({ preset: 'Siepe', name: 'Lauroceraso' })?.name, 'Siepe');
  assert.equal(presetFor({ preset: null, name: 'Siepe' }), undefined);
});

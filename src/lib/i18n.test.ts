/// <reference types="node" />
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { CATALOG_EN } from './catalog-en.ts';
import { cat, local, setLanguage, tr } from './i18n.ts';
import { planFor } from './plans.ts';
import { PLANT_PRESETS, SUN_LABEL, TASK_LABEL, monthsLabel, presetFor, repeatLabel, searchPresets } from './presets.ts';
import { relativeLabel } from './schedule.ts';

afterEach(() => setLanguage('it'));

test('every catalog text has an English version', () => {
  const missing: string[] = [];
  for (const p of PLANT_PRESETS) {
    const plan = planFor(p.name);
    const texts = [p.name, p.tip, ...(plan?.steps ?? []).map((s) => s.title), ...(plan?.seasonal ?? []).map((s) => s.title)];
    for (const text of texts) if (!(text in CATALOG_EN)) missing.push(text);
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('Italian is the default and catalog text stays as written', () => {
  assert.equal(tr('Oggi', 'Today'), 'Oggi');
  assert.equal(cat('Pomodoro'), 'Pomodoro');
  assert.equal(SUN_LABEL.full, 'Pieno sole');
});

test('English switches labels, catalog and dates', () => {
  setLanguage('en');
  assert.equal(cat('Pomodoro'), 'Tomato');
  assert.equal(cat('Not in the catalog'), 'Not in the catalog');
  assert.equal(SUN_LABEL.partial, 'Part shade');
  assert.equal(TASK_LABEL.water, 'Water');
  assert.equal(relativeLabel('2026-10-18', '2026-10-20'), '2 days late');
  assert.equal(repeatLabel({ repeatDays: 2, yearly: false, months: null, coldRepeatDays: 6 }), 'every 2 days (Oct–Apr every 6 days)');
  assert.equal(monthsLabel([4, 5, 6, 7, 8, 9]), 'Apr–Sep');
});

test('a plant named in English still finds its catalog entry', () => {
  setLanguage('en');
  assert.equal(presetFor({ preset: null, name: 'Tomato' })?.name, 'Pomodoro');
});

test('saved catalog text follows the app language, typed text stays', () => {
  assert.equal(local('Peperoncino'), 'Peperoncino');
  assert.equal(local('Chilli pepper'), 'Peperoncino');
  assert.equal(local('Water'), 'Annaffiare');
  assert.equal(local('Il mio limone'), 'Il mio limone');
  setLanguage('en');
  assert.equal(local('Peperoncino'), 'Chilli pepper');
  assert.equal(local('Annaffiare (attecchimento)'), 'Water (settling in)');
  assert.equal(local('Messa a dimora'), 'Planted out');
});

test('catalog search by name, plural and group', () => {
  const names = (q: string) => searchPresets(q).map((p) => p.name);
  assert.deepEqual(names('pomodori'), ['Pomodoro']);
  assert.ok(names('insalata').includes('Lattuga') && names('insalata').includes('Scarola'));
  assert.ok(names('cavolo').includes('Verza') && names('cavolo').includes('Broccolo'));
  assert.equal(names('cavolo')[0], 'Cavolfiore');
  assert.ok(names('aromatiche').includes('Basilico'));
  assert.deepEqual(names('Peperóncino'), ['Peperoncino']);
  assert.ok(names('tomato').includes('Pomodoro'));
  assert.deepEqual(names(''), []);
});

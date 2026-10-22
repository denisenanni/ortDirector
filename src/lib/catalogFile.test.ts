/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { parseCatalogFile } from './catalogFile.ts';
import { setCustomCatalog } from './custom.ts';
import { cat, local, setLanguage } from './i18n.ts';
import { planFor, seasonalTasks } from './plans.ts';
import { isAnnual, presetFor, searchPresets } from './presets.ts';

afterEach(() => {
  setCustomCatalog([]);
  setLanguage('it');
});

const mimosa = readFileSync(new URL('../../docs/catalogo/mimosa-tardiva.json', import.meta.url), 'utf8');
const file = (...catalog: unknown[]) => JSON.stringify({ app: 'ortdirector', catalog });
const plant = { name: 'Feijoa', sun: 'full', waterEveryDays: 5 };

test('the sample mimosa file reads', () => {
  const [{ entry }] = parseCatalogFile(mimosa);
  assert.equal(entry.name, 'Mimosa tardiva');
  assert.equal(entry.en['Mimosa tardiva'], 'Late-flowering mimosa');
  assert.equal(entry.waterColdDays, 21);
  assert.equal(entry.plan.steps.length, 1);
  assert.equal(entry.plan.seasonal!.length, 7);
});

test('added plants join the catalog: search, plan, annual, English', () => {
  setCustomCatalog(parseCatalogFile(mimosa).map((i) => i.entry));
  assert.deepEqual(searchPresets('mimosa').map((p) => p.name), ['Mimosa tardiva']);
  assert.deepEqual(searchPresets('dealbata').map((p) => p.name), ['Mimosa tardiva']);
  assert.equal(presetFor({ preset: 'Mimosa tardiva', name: 'Mimosa' })?.name, 'Mimosa tardiva');
  assert.equal(isAnnual('Mimosa tardiva'), false);
  const potted = seasonalTasks(planFor('Mimosa tardiva'), '2026-10-22', { potted: true }).map((t) => t.title);
  assert.ok(potted.includes('Proteggere il vaso dal gelo forte (sotto i -5 °C)'));
  assert.ok(!potted.includes('Pacciamare la base contro il gelo'));
  setLanguage('en');
  assert.equal(cat('Mimosa tardiva'), 'Late-flowering mimosa');
  assert.equal(local('Late-flowering mimosa'), 'Late-flowering mimosa');
  assert.equal(presetFor({ preset: null, name: 'Late-flowering mimosa' })?.name, 'Mimosa tardiva');
  setLanguage('it');
  assert.equal(local('Late-flowering mimosa'), 'Mimosa tardiva');
});

test('built-in plants are untouched when nothing is added', () => {
  assert.equal(planFor('Mimosa tardiva'), undefined);
  assert.equal(planFor('Pomodoro')?.sowToTransplantWeeks?.[0], 6);
  assert.equal(planFor('toString'), undefined);
});

test('parseCatalogFile says what is wrong and where', () => {
  assert.throws(() => parseCatalogFile('nope'), /non è JSON/);
  assert.throws(() => parseCatalogFile('{"app":"ortdirector","version":6,"tables":{}}'), /Importa backup/);
  assert.throws(() => parseCatalogFile('{"catalog":[]}'), /"catalog"/);
  assert.throws(() => parseCatalogFile(file({ ...plant, sun: 'sole' })), /Feijoa › sun/);
  assert.throws(() => parseCatalogFile(file({ ...plant, waterEveryDays: 0 })), /Feijoa › waterEveryDays: serve un numero intero da 1 a 60/);
  assert.throws(
    () => parseCatalogFile(file({ ...plant, seasonal: [{ type: 'prune', title: 'Potatura', months: [13] }] })),
    /seasonal\[0\]\.months\[0\]/,
  );
  assert.throws(() => parseCatalogFile(file({ ...plant, steps: [{ type: 'dance', title: 'x', day: 0 }] })), /steps\[0\]\.type/);
  assert.throws(() => parseCatalogFile(file({ ...plant, seasonal: [{ type: 'other', title: 'x', months: [1], only: { big: true } }] })), /only/);
  assert.throws(() => parseCatalogFile(file({ sun: 'full' })), /catalog\[0\] › name/);
  assert.throws(() => parseCatalogFile(file(plant, plant)), /due volte/);
});

test('a file cannot redefine a built-in plant, in either language', () => {
  assert.throws(() => parseCatalogFile(file({ ...plant, name: 'pomodoro' })), /già nel catalogo/);
  assert.throws(() => parseCatalogFile(file({ ...plant, name: 'Tomato' })), /già nel catalogo/);
  assert.throws(() => parseCatalogFile(file({ ...plant, name: 'Agrume' })), /già nel catalogo/);
});

test('optional fields default sensibly', () => {
  const [{ entry, raw }] = parseCatalogFile(file(plant));
  assert.deepEqual(entry, {
    name: 'Feijoa',
    sun: 'full',
    waterEveryDays: 5,
    tip: '',
    annual: false,
    tender: false,
    aliases: [],
    plan: { steps: [], seasonal: [] },
    en: {},
  });
  assert.deepEqual(raw, plant);
});

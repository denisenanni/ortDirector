/// <reference types="node" />
// db.ts against a real SQLite in memory (memoryDb.ts): what each action
// writes, not only what the pure functions compute.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { parseBackup } from './backup.ts';
import { parseCatalogFile } from './catalogFile.ts';
import { customFor, setCustomCatalog } from './custom.ts';
import * as db from './db.ts';
import { openMemoryDb } from './memoryDb.ts';
import { expandPlan, planFor } from './plans.ts';
import { addDays, today } from './schedule.ts';
import type { Plant } from './types';
import { plantWatering } from './watering.ts';

afterEach(() => setCustomCatalog([]));

const T = today();

async function fresh() {
  const d = openMemoryDb();
  await db.migrate(d);
  return d;
}

// No cold interval, so the tests don't depend on the month they run in.
function plant(over: Partial<db.PlantInput>): db.PlantInput {
  return {
    name: 'Pianta',
    variety: null,
    location: null,
    zoneId: null,
    potted: false,
    size: null,
    potSize: null,
    covered: false,
    sun: 'full',
    waterEveryDays: 3,
    waterColdDays: null,
    stage: 'ground',
    sownOn: null,
    plantedOn: null,
    preset: null,
    annual: false,
    archivedOn: null,
    photo: null,
    notes: null,
    ...over,
  };
}

const tasksOf = async (d: Awaited<ReturnType<typeof fresh>>, id: number) => db.listPlantTasks(d, id);
const waterOf = async (d: Awaited<ReturnType<typeof fresh>>, id: number) =>
  (await tasksOf(d, id)).filter((t) => t.type === 'water');

test('a new install migrates to the current version, and migrating again changes nothing', async () => {
  const d = await fresh();
  assert.equal((await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version, db.DATABASE_VERSION);
  await db.createPlant(d, plant({}));
  await db.migrate(d);
  assert.equal((await db.listPlants(d)).length, 1);
  assert.equal((await db.listOpenTasks(d)).length, 1);
});

test('a new plant gets its watering due today', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({ waterEveryDays: 4, waterColdDays: 12 }));
  const [w] = await waterOf(d, id);
  assert.deepEqual([w.dueOn, w.repeatDays, w.coldRepeatDays], [T, 4, 12]);
});

test('a plant without an interval gets no watering', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({ waterEveryDays: null }));
  assert.equal((await waterOf(d, id)).length, 0);
});

test('a perennial from the catalog gets its seasonal care', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({ name: 'Rosa', preset: 'Rosa' }));
  const prune = (await tasksOf(d, id)).find((t) => t.type === 'prune')!;
  assert.equal(prune.yearly, true);
  assert.deepEqual(prune.months, [2]);
  assert.equal(prune.dueOn.slice(5, 7), '02');
});

test('changing the interval updates the watering instead of adding one', async () => {
  const d = await fresh();
  const p = plant({});
  const id = await db.createPlant(d, p);
  const [before] = await waterOf(d, id);
  await db.updatePlant(d, id, { ...p, waterEveryDays: 5 });
  const after = await waterOf(d, id);
  assert.equal(after.length, 1);
  assert.deepEqual([after[0].id, after[0].repeatDays], [before.id, 5]);
  await db.updatePlant(d, id, { ...p, waterEveryDays: null });
  assert.equal((await waterOf(d, id)).length, 0);
  await db.updatePlant(d, id, { ...p, waterEveryDays: 2 });
  assert.equal((await waterOf(d, id)).length, 1);
});

test('a sown tomato gets "ready to transplant" after six weeks, and follows the sowing day', async () => {
  const d = await fresh();
  const p = plant({ name: 'Pomodoro', preset: 'Pomodoro', stage: 'seedbed', sownOn: '2026-03-01' });
  const id = await db.createPlant(d, p);
  const ready = () => tasksOf(d, id).then((ts) => ts.filter((t) => t.type === 'transplant'));
  assert.deepEqual((await ready()).map((t) => t.dueOn), ['2026-04-12']);
  await db.updatePlant(d, id, { ...p, sownOn: '2026-03-10' });
  assert.deepEqual((await ready()).map((t) => t.dueOn), ['2026-04-21']);
  await db.updatePlant(d, id, { ...p, sownOn: null });
  assert.equal((await ready()).length, 0);
});

test('a done task moves on from the day it was done, and unticking puts it back', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({ waterEveryDays: 4 }));
  const [w] = await waterOf(d, id);
  await db.markDone(d, w, '2026-10-20');
  assert.equal((await waterOf(d, id))[0].dueOn, '2026-10-24');
  const [entry] = await db.listDoneOn(d, '2026-10-20');
  assert.deepEqual([entry.title, entry.plantName, entry.prevDueOn], ['Annaffiare', 'Pianta', T]);
  await db.undoDone(d, entry);
  assert.equal((await waterOf(d, id))[0].dueOn, T);
  assert.equal((await db.listDoneOn(d, '2026-10-20')).length, 0);
});

test('a one-off task closes when done and reopens when unticked', async () => {
  const d = await fresh();
  const taskId = await db.createTask(d, {
    plantId: null, type: 'check', title: 'Controllo', dueOn: '2026-10-20', repeatDays: null,
    endsOn: null, yearly: false, months: null, coldRepeatDays: null, notes: null,
  });
  await db.markDone(d, (await db.getTask(d, taskId))!, '2026-10-20');
  assert.equal((await db.getTask(d, taskId))!.doneOn, '2026-10-20');
  assert.equal((await db.listOpenTasks(d)).length, 0);
  await db.undoDone(d, (await db.listDoneOn(d, '2026-10-20'))[0]);
  assert.equal((await db.listOpenTasks(d)).length, 1);
});

test('postpone moves only the date', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({}));
  const [w] = await waterOf(d, id);
  await db.postpone(d, w, addDays(T, 1));
  const [after] = await waterOf(d, id);
  assert.deepEqual([after.dueOn, after.repeatDays], [addDays(T, 1), 3]);
  assert.equal((await db.listDoneOn(d, T)).length, 0);
});

test('rain waters plants outdoors, pots included, but not under cover', async () => {
  const d = await fresh();
  const greenhouse = await db.saveZone(d, { name: 'Serra', sun: 'full', covered: true });
  const balcony = await db.saveZone(d, { name: 'Balcone', sun: 'partial', covered: false });
  const bed = await db.createPlant(d, plant({ name: 'Aiuola' }));
  const pot = await db.createPlant(d, plant({ name: 'Vaso', zoneId: balcony, potted: true }));
  const inGreenhouse = await db.createPlant(d, plant({ name: 'In serra', zoneId: greenhouse }));
  const underRoof = await db.createPlant(d, plant({ name: 'Sotto la tettoia', zoneId: balcony, covered: true }));
  assert.equal(await db.rained(d, T), 2);
  assert.equal((await waterOf(d, bed))[0].dueOn, addDays(T, 3));
  assert.equal((await waterOf(d, pot))[0].dueOn, addDays(T, 3));
  assert.equal((await waterOf(d, inGreenhouse))[0].dueOn, T);
  assert.equal((await waterOf(d, underRoof))[0].dueOn, T);
  assert.equal((await db.getLastRain(d))!.day, T);
});

test('rain never brings a watering forward', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({}));
  await db.postpone(d, (await waterOf(d, id))[0], addDays(T, 10));
  assert.equal(await db.rained(d, T), 0);
  assert.equal((await waterOf(d, id))[0].dueOn, addDays(T, 10));
});

test('undoing rain puts back what it moved, unless it was done since', async () => {
  const d = await fresh();
  const a = await db.createPlant(d, plant({ name: 'A' }));
  const b = await db.createPlant(d, plant({ name: 'B' }));
  await db.rained(d, '2026-10-01');
  await db.rained(d, T);
  await db.markDone(d, (await waterOf(d, b))[0], addDays(T, 1));
  await db.undoRain(d);
  assert.equal((await waterOf(d, a))[0].dueOn, T);
  assert.equal((await waterOf(d, b))[0].dueOn, addDays(T, 4));
  // The rain before shows again as the last one.
  assert.equal((await db.getLastRain(d))!.day, '2026-10-01');
  await db.undoRain(d);
  assert.equal(await db.getLastRain(d), null);
});

test('transplanting closes the reminder, logs it, adds the plan and holds back regular watering', async () => {
  const d = await fresh();
  const p = plant({ name: 'Pomodoro', preset: 'Pomodoro', stage: 'seedbed', sownOn: addDays(T, -50), waterEveryDays: 2 });
  const id = await db.createPlant(d, p);
  const steps = planFor('Pomodoro')!.steps;
  const planned = expandPlan(steps, T, T);
  const place = { potted: false, size: 'large' as const, potSize: null };
  const watering = plantWatering({ ...p, stage: 'ground', ...place });
  await db.transplant(d, id, T, planned, { ...place, watering });

  const after = (await db.getPlant(d, id)) as Plant;
  assert.deepEqual([after.stage, after.plantedOn, after.size, after.waterEveryDays], ['ground', T, 'large', 3]);
  const open = await tasksOf(d, id);
  assert.equal(open.filter((t) => t.type === 'transplant').length, 0);
  assert.equal(open.length, planned.length + 1);
  const regular = open.find((t) => t.type === 'water' && !t.endsOn)!;
  assert.deepEqual([regular.dueOn, regular.repeatDays], [addDays(T, 14), 3]);
  const establishing = open.find((t) => t.type === 'water' && t.endsOn)!;
  assert.deepEqual([establishing.dueOn, establishing.repeatDays, establishing.endsOn], [T, 1, addDays(T, 13)]);
  const log = await db.listPlantLog(d, id);
  assert.deepEqual(log.map((e) => [e.type, e.doneOn]), [['transplant', T]]);
});

test('archiving keeps the history and drops open tasks; restoring brings the care back', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({ name: 'Rosa', preset: 'Rosa' }));
  const careCount = (await tasksOf(d, id)).length;
  await db.markDone(d, (await waterOf(d, id))[0], '2026-10-20');
  await db.archivePlant(d, id, '2026-10-21');
  assert.equal((await db.getPlant(d, id))!.archivedOn, '2026-10-21');
  assert.equal((await tasksOf(d, id)).length, 0);
  assert.equal((await db.listPlantLog(d, id)).length, 1);
  await db.restorePlant(d, id);
  assert.equal((await db.getPlant(d, id))!.archivedOn, null);
  assert.equal((await tasksOf(d, id)).length, careCount);
});

test('deleting a plant deletes its tasks and history', async () => {
  const d = await fresh();
  const id = await db.createPlant(d, plant({}));
  await db.markDone(d, (await waterOf(d, id))[0], '2026-10-20');
  await db.deletePlant(d, id);
  assert.equal((await db.listOpenTasks(d)).length, 0);
  assert.equal((await db.listDoneOn(d, '2026-10-20')).length, 0);
});

test('a zone with plants, archived ones too, cannot be deleted', async () => {
  const d = await fresh();
  const zone = await db.saveZone(d, { name: 'Orto', sun: 'full', covered: false });
  const id = await db.createPlant(d, plant({ zoneId: zone }));
  await db.archivePlant(d, id);
  assert.deepEqual(await db.countZonePlants(d, zone), { total: 1, archived: 1 });
  await assert.rejects(db.deleteZone(d, zone));
  await db.deletePlant(d, id);
  await db.deleteZone(d, zone);
  assert.equal((await db.listZones(d)).length, 0);
});

const mimosa = readFileSync(new URL('../../docs/catalogo/mimosa-tardiva.json', import.meta.url), 'utf8');

test('plants added to the catalog are saved, replaced by name and removed', async () => {
  const d = await fresh();
  assert.deepEqual(await db.addToCatalog(d, parseCatalogFile(mimosa)), { added: ['Mimosa tardiva'], replaced: [] });
  assert.deepEqual(await db.addToCatalog(d, parseCatalogFile(mimosa)), { added: [], replaced: ['Mimosa tardiva'] });
  setCustomCatalog([]);
  await db.loadCatalog(d);
  assert.ok(customFor('Mimosa tardiva'));
  await db.removeFromCatalog(d, 'Mimosa tardiva');
  assert.equal(customFor('Mimosa tardiva'), undefined);
});

test('a backup restores the same garden on another phone', async () => {
  const d = await fresh();
  const zone = await db.saveZone(d, { name: 'Serra', sun: 'partial', covered: true });
  await db.addToCatalog(d, parseCatalogFile(mimosa));
  const id = await db.createPlant(d, plant({ name: 'Rosa', preset: 'Rosa', zoneId: zone }));
  await db.markDone(d, (await waterOf(d, id))[0], '2026-10-20');
  await db.setReminderHour(d, 7);
  const file = JSON.stringify(await db.exportBackup(d));

  setCustomCatalog([]);
  const other = await fresh();
  await db.importBackup(other, parseBackup(file, db.DATABASE_VERSION));
  assert.deepEqual(await db.listPlants(other), await db.listPlants(d));
  assert.deepEqual(await db.listZones(other), await db.listZones(d));
  assert.deepEqual(await db.listOpenTasks(other), await db.listOpenTasks(d));
  assert.deepEqual(await db.listPlantLog(other, id), await db.listPlantLog(d, id));
  assert.equal(await db.getReminderHour(other), 7);
  assert.ok(customFor('Mimosa tardiva'));
});

test('a backup from before zones and annuals still imports', async () => {
  const d = await fresh();
  const old = {
    app: 'ortdirector',
    version: 3,
    exportedAt: '2026-10-19T10:00:00.000Z',
    tables: {
      plants: [{ id: 1, name: 'Pomodoro', sun: 'full', water_every_days: 2, stage: 'ground', preset: 'Pomodoro', created_at: '2026-10-19 10:00:00' }],
      tasks: [{ id: 1, plant_id: 1, type: 'water', title: 'Annaffiare', due_on: '2026-10-19', repeat_days: 2, yearly: 0 }],
      task_log: [],
      settings: [],
    },
  };
  await db.importBackup(d, parseBackup(JSON.stringify(old), db.DATABASE_VERSION));
  const [p] = await db.listPlants(d);
  assert.deepEqual([p.name, p.annual, p.zoneId, p.covered], ['Pomodoro', true, null, false]);
  assert.equal((await db.listOpenTasks(d)).length, 1);
});

test('a backup that fails halfway leaves the garden as it was', async () => {
  const d = await fresh();
  await db.createPlant(d, plant({ name: 'Resto' }));
  const broken = await db.exportBackup(d);
  broken.tables.plants = [{ id: 9, sun: 'full' }]; // no name: NOT NULL fails
  await assert.rejects(db.importBackup(d, broken));
  assert.deepEqual((await db.listPlants(d)).map((p) => p.name), ['Resto']);
  assert.equal((await db.listOpenTasks(d)).length, 1);
});

test('the reminder hour falls back to 8 when unset or broken', async () => {
  const d = await fresh();
  assert.equal(await db.getReminderHour(d), db.DEFAULT_REMINDER_HOUR);
  await d.runAsync(`INSERT INTO settings (key, value) VALUES ('reminder_hour', 'x')`);
  assert.equal(await db.getReminderHour(d), db.DEFAULT_REMINDER_HOUR);
});

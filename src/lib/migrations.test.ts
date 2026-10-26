/// <reference types="node" />
// A phone can sit on any older database version and update straight to the
// latest. Each test builds the schema of an old version as it really was,
// with a realistic garden in it, and runs the migration.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as db from './db.ts';
import { openMemoryDb, type MemoryDb } from './memoryDb.ts';

// The schema each version added. History: never change a version once
// released, only add the next one.
const SCHEMA: Record<number, string> = {
  1: `
    CREATE TABLE plants (
      id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, variety TEXT, location TEXT, sun TEXT NOT NULL,
      water_every_days INTEGER, planted_on TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY NOT NULL, plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE, type TEXT NOT NULL,
      title TEXT NOT NULL, due_on TEXT NOT NULL, repeat_days INTEGER, done_on TEXT, notes TEXT
    );
    CREATE INDEX tasks_due ON tasks(done_on, due_on);
    CREATE TABLE task_log (
      id INTEGER PRIMARY KEY NOT NULL, task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
      plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, done_on TEXT NOT NULL
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  2: `
    ALTER TABLE plants ADD COLUMN stage TEXT NOT NULL DEFAULT 'ground';
    ALTER TABLE plants ADD COLUMN sown_on TEXT;
    ALTER TABLE plants ADD COLUMN preset TEXT;
    ALTER TABLE tasks ADD COLUMN ends_on TEXT;`,
  3: `
    ALTER TABLE tasks ADD COLUMN yearly INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tasks ADD COLUMN months TEXT;`,
  4: `
    CREATE TABLE zones (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, sun TEXT NOT NULL, covered INTEGER NOT NULL DEFAULT 0);
    ALTER TABLE plants ADD COLUMN zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL;
    ALTER TABLE plants ADD COLUMN potted INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE plants ADD COLUMN water_cold_days INTEGER;
    ALTER TABLE tasks ADD COLUMN cold_repeat_days INTEGER;`,
  5: `
    ALTER TABLE plants ADD COLUMN annual INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE plants ADD COLUMN archived_on TEXT;
    ALTER TABLE plants ADD COLUMN photo TEXT;
    ALTER TABLE task_log ADD COLUMN prev_due_on TEXT;`,
  6: `
    CREATE TABLE catalog (name TEXT PRIMARY KEY NOT NULL, entry TEXT NOT NULL);
    ALTER TABLE plants ADD COLUMN size TEXT;
    ALTER TABLE plants ADD COLUMN pot_size TEXT;`,
  7: `
    ALTER TABLE plants ADD COLUMN covered INTEGER NOT NULL DEFAULT 0;`,
};

// A garden as the app of that version would have saved it: a rose and basil
// on the balcony, a tomato in the greenhouse, each with its watering, and one
// watering already done. Columns the version doesn't have yet are left out.
const PLANTS = [
  { id: 1, name: 'Rosa', location: 'Vasi balcone', sun: 'full', water_every_days: 3, preset: 'Rosa', zone_id: 1, potted: 1, annual: 0 },
  { id: 2, name: 'Basilico', location: 'Vasi balcone', sun: 'full', water_every_days: 1, preset: 'Basilico', zone_id: 1, potted: 1, annual: 1 },
  { id: 3, name: 'Pomodoro', location: 'Serra', sun: 'full', water_every_days: 2, preset: 'Pomodoro', zone_id: 2, potted: 0, annual: 1 },
];
const ZONES = [
  { id: 1, name: 'Vasi balcone', sun: 'full', covered: 0 },
  { id: 2, name: 'Serra', sun: 'full', covered: 1 },
];
const TASKS = PLANTS.map((p) => ({
  id: p.id, plant_id: p.id, type: 'water', title: 'Annaffiare', due_on: '2026-10-20', repeat_days: p.water_every_days,
}));
const LOG = [{ id: 1, task_id: 1, plant_id: 1, type: 'water', title: 'Annaffiare', done_on: '2026-10-17', prev_due_on: '2026-10-17' }];

function insert(d: MemoryDb, table: string, rows: Record<string, unknown>[]) {
  const columns = (d.raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => columns.includes(c));
    d.raw.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => row[c] as string | number));
  }
}

function gardenAt(version: number): MemoryDb {
  const d = openMemoryDb();
  for (let v = 1; v <= version; v++) d.raw.exec(SCHEMA[v]);
  d.raw.exec(`PRAGMA user_version = ${version}`);
  if (version >= 4) insert(d, 'zones', ZONES);
  insert(d, 'plants', PLANTS);
  insert(d, 'tasks', TASKS);
  insert(d, 'task_log', LOG);
  return d;
}

/** Every table's columns, to compare an updated database with a new one. */
async function schema(d: MemoryDb) {
  const tables = await d.getAllAsync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`);
  const out: Record<string, string[]> = {};
  for (const { name } of tables) {
    const cols = await d.getAllAsync<{ name: string; type: string; notnull: number; dflt_value: string | null }>(
      `PRAGMA table_info(${name})`,
    );
    out[name] = cols.map((c) => `${c.name} ${c.type} ${c.notnull} ${c.dflt_value}`).sort();
  }
  return out;
}

const newInstall = async () => {
  const d = openMemoryDb();
  await db.migrate(d);
  return schema(d);
};

for (let version = 1; version < db.DATABASE_VERSION; version++) {
  test(`a garden from version ${version} updates to the latest`, async () => {
    const d = gardenAt(version);
    await db.migrate(d);

    assert.equal((await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version, db.DATABASE_VERSION);
    assert.deepEqual(await schema(d), await newInstall());

    const plants = await db.listPlants(d);
    assert.deepEqual(plants.map((p) => p.name), ['Basilico', 'Pomodoro', 'Rosa']);
    const [basil, tomato, rose] = plants;
    assert.equal(await db.listPlantLog(d, rose.id).then((l) => l.length), 1);

    // The waterings are still there, once each, with a rest-of-year interval.
    const open = await db.listOpenTasks(d);
    const water = open.filter((t) => t.type === 'water');
    assert.deepEqual(water.map((t) => [t.plantName, t.dueOn]).sort(), [
      ['Basilico', '2026-10-20'],
      ['Pomodoro', '2026-10-20'],
      ['Rosa', '2026-10-20'],
    ]);
    if (version < 4) assert.deepEqual(water.map((t) => t.coldRepeatDays).sort(), [3, 6, 9]);

    // Free-text positions became zones, and the greenhouse is covered.
    const zones = await db.listZones(d);
    assert.deepEqual(zones.map((z) => [z.name, z.covered]), [['Serra', true], ['Vasi balcone', false]]);
    assert.equal(rose.zoneId, basil.zoneId);
    assert.equal(tomato.zoneId, zones[0].id);
    assert.deepEqual([rose.potted, basil.potted, tomato.potted], [true, true, false]);

    // Vegetables are annual, the rose is not.
    assert.deepEqual([basil.annual, tomato.annual, rose.annual], [true, true, false]);

    // Gardens from before seasonal care get the rose's, once.
    if (version < 3) {
      const prune = open.filter((t) => t.plantId === rose.id && t.type === 'prune');
      assert.equal(prune.length, 1);
      assert.deepEqual([prune[0].yearly, prune[0].months], [true, [2]]);
    }

    // The updated database works like a new one.
    assert.equal(await db.rained(d, '2026-10-20'), 2);
    await db.createPlant(d, { ...rose, name: 'Rosa 2', zoneId: null, waterEveryDays: 3 });
    assert.equal((await db.listPlants(d)).length, 4);
  });
}

test('frost tasks saved before v8 learn they move the plant, in either language', async () => {
  const d = gardenAt(7);
  insert(d, 'tasks', [
    { id: 10, plant_id: 1, type: 'other', title: 'Mettere al riparo dal gelo', due_on: '2026-11-01', yearly: 1, months: '11' },
    { id: 11, plant_id: 1, type: 'other', title: 'Move back outside', due_on: '2027-04-01', yearly: 1, months: '4' },
    { id: 12, plant_id: 1, type: 'other', title: 'Controllare se serve un vaso più grande', due_on: '2027-03-01', yearly: 1, months: '3' },
    // Written by hand, not seasonal: left alone.
    { id: 13, plant_id: 1, type: 'other', title: 'Riportare fuori', due_on: '2026-11-02' },
  ]);
  await db.migrate(d);
  const moves = (await db.listPlantTasks(d, 1)).filter((t) => t.type === 'other').map((t) => [t.id, t.moves]);
  assert.deepEqual(moves, [[10, 'in'], [13, null], [12, 'repot'], [11, 'out']]);
});

import type { SQLiteDatabase } from 'expo-sqlite';
import { BACKUP_TABLES, insertFor, makeBackup, type Backup, type Row } from './backup';
import { parseCatalogEntry } from './catalogFile';
import { customEntries, customFor, setCustomCatalog, type CustomEntry } from './custom';
import { kindFor } from './kinds';
import { planFor, regularWateringFrom, seasonalTasks, transplantReminder, type CareContext, type PlannedTask } from './plans';
import { local, tr } from './i18n';
import { isAnnual, presetFor } from './presets';
import { afterRain, completeTask, today } from './schedule';
import type { DayString, DoneEntry, LogEntry, Plant, Size, Stage, Sun, Task, TaskType, TaskWithPlant, Zone } from './types';

export const DATABASE_NAME = 'ortdirector.db';
export const DATABASE_VERSION = 6;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return loadCatalog(db);

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE plants (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        variety TEXT,
        location TEXT,
        sun TEXT NOT NULL,
        water_every_days INTEGER,
        planted_on TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY NOT NULL,
        plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        due_on TEXT NOT NULL,
        repeat_days INTEGER,
        done_on TEXT,
        notes TEXT
      );
      CREATE INDEX tasks_due ON tasks(done_on, due_on);
      CREATE TABLE task_log (
        id INTEGER PRIMARY KEY NOT NULL,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        plant_id INTEGER REFERENCES plants(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        done_on TEXT NOT NULL
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
    version = 1;
  }
  if (version === 1) {
    // Existing plants are taken to be in their final spot already.
    await db.execAsync(`
      ALTER TABLE plants ADD COLUMN stage TEXT NOT NULL DEFAULT 'ground';
      ALTER TABLE plants ADD COLUMN sown_on TEXT;
      ALTER TABLE plants ADD COLUMN preset TEXT;
      ALTER TABLE tasks ADD COLUMN ends_on TEXT;
    `);
    version = 2;
  }
  if (version === 2) {
    await db.execAsync(`
      ALTER TABLE tasks ADD COLUMN yearly INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tasks ADD COLUMN months TEXT;
    `);
    // Plants added before seasonal care existed get theirs now.
    const plants = await db.getAllAsync<PlantRow>('SELECT * FROM plants');
    for (const p of plants) {
      for (const t of seasonalTasks(planFor(presetFor(p)?.name), today())) await insertTask(db, p.id, t);
    }
    version = 3;
  }
  if (version === 3) {
    await db.execAsync(`
      CREATE TABLE zones (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        sun TEXT NOT NULL,
        covered INTEGER NOT NULL DEFAULT 0
      );
      ALTER TABLE plants ADD COLUMN zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL;
      ALTER TABLE plants ADD COLUMN potted INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE plants ADD COLUMN water_cold_days INTEGER;
      ALTER TABLE tasks ADD COLUMN cold_repeat_days INTEGER;
    `);
    // Each free-text position becomes a zone, with the sun of its first plant.
    // Watering gets a rest-of-year interval, a third as frequent as in summer.
    const plants = await db.getAllAsync<PlantRow>('SELECT * FROM plants ORDER BY id');
    const zoneIds = new Map<string, number>();
    for (const p of plants) {
      const name = p.location?.trim();
      const potted = /vaso|vasi|balcone|terrazz/i.test(`${name ?? ''} ${p.preset ?? p.name}`);
      let zoneId: number | null = null;
      if (name) {
        const key = name.toLowerCase();
        zoneId = zoneIds.get(key) ?? null;
        if (zoneId === null) {
          const covered = /serra|coperto|tettoia|casa|veranda/i.test(name) ? 1 : 0;
          zoneId = (await db.runAsync('INSERT INTO zones (name, sun, covered) VALUES (?, ?, ?)', name, p.sun, covered))
            .lastInsertRowId;
          zoneIds.set(key, zoneId);
        }
      }
      const cold = p.water_every_days ? coldWateringDefault(p.water_every_days) : null;
      await db.runAsync(
        'UPDATE plants SET zone_id = ?, potted = ?, water_cold_days = ? WHERE id = ?',
        zoneId, potted ? 1 : 0, cold, p.id,
      );
      await db.runAsync(
        `UPDATE tasks SET cold_repeat_days = ? WHERE plant_id = ? AND type = 'water'
         AND repeat_days IS NOT NULL AND ends_on IS NULL`,
        cold, p.id,
      );
    }
    version = 4;
  }
  if (version === 4) {
    await db.execAsync(`
      ALTER TABLE plants ADD COLUMN annual INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE plants ADD COLUMN archived_on TEXT;
      ALTER TABLE plants ADD COLUMN photo TEXT;
      ALTER TABLE task_log ADD COLUMN prev_due_on TEXT;
    `);
    const plants = await db.getAllAsync<PlantRow>('SELECT * FROM plants');
    for (const p of plants) {
      if (isAnnual(presetFor(p)?.name)) await db.runAsync('UPDATE plants SET annual = 1 WHERE id = ?', p.id);
    }
    version = 5;
  }
  if (version === 5) {
    // Plants added to the catalog from a file: the file's object, as written.
    // Plant and pot size, which set the watering; unknown for existing plants.
    await db.execAsync(`
      CREATE TABLE catalog (name TEXT PRIMARY KEY NOT NULL, entry TEXT NOT NULL);
      ALTER TABLE plants ADD COLUMN size TEXT;
      ALTER TABLE plants ADD COLUMN pot_size TEXT;
    `);
    version = 6;
  }
  // Future migrations: if (version === 6) { ...; version = 7; }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  await loadCatalog(db);
}

/** A starting guess for the rest of the year: a third as often as in summer, at most every 3 weeks. */
export const coldWateringDefault = (summer: number) => Math.min(summer * 3, 21);

// --- Row mapping -----------------------------------------------------------

interface PlantRow {
  id: number;
  name: string;
  variety: string | null;
  location: string | null;
  zone_id: number | null;
  potted: number;
  size: Size | null;
  pot_size: Size | null;
  sun: Sun;
  water_every_days: number | null;
  water_cold_days: number | null;
  stage: Stage;
  sown_on: string | null;
  planted_on: string | null;
  preset: string | null;
  annual: number;
  archived_on: string | null;
  photo: string | null;
  notes: string | null;
}

interface TaskRow {
  id: number;
  plant_id: number | null;
  type: TaskType;
  title: string;
  due_on: string;
  repeat_days: number | null;
  ends_on: string | null;
  yearly: number;
  months: string | null;
  cold_repeat_days: number | null;
  done_on: string | null;
  notes: string | null;
  plant_name?: string | null;
  plant_variety?: string | null;
  zone_name?: string | null;
}

const toPlant = (r: PlantRow): Plant => ({
  id: r.id,
  name: local(r.name),
  variety: r.variety,
  location: r.location,
  zoneId: r.zone_id,
  potted: r.potted === 1,
  size: r.size,
  potSize: r.pot_size,
  sun: r.sun,
  waterEveryDays: r.water_every_days,
  waterColdDays: r.water_cold_days,
  stage: r.stage,
  sownOn: r.sown_on,
  plantedOn: r.planted_on,
  preset: r.preset,
  annual: r.annual === 1,
  archivedOn: r.archived_on,
  photo: r.photo,
  notes: r.notes,
});

const toTask = (r: TaskRow): TaskWithPlant => ({
  id: r.id,
  plantId: r.plant_id,
  type: r.type,
  title: local(r.title),
  dueOn: r.due_on,
  repeatDays: r.repeat_days,
  endsOn: r.ends_on,
  yearly: r.yearly === 1,
  months: r.months ? r.months.split(',').map(Number) : null,
  coldRepeatDays: r.cold_repeat_days,
  doneOn: r.done_on,
  notes: r.notes,
  plantName: r.plant_name === null || r.plant_name === undefined ? null : local(r.plant_name),
  plantVariety: r.plant_variety ?? null,
  zoneName: r.zone_name ?? null,
});

const TASK_SELECT = `
  SELECT t.*, p.name AS plant_name, p.variety AS plant_variety, z.name AS zone_name
  FROM tasks t LEFT JOIN plants p ON p.id = t.plant_id
  LEFT JOIN zones z ON z.id = p.zone_id`;

// --- Plants ----------------------------------------------------------------

export type PlantInput = Omit<Plant, 'id'>;

export async function listPlants(db: SQLiteDatabase): Promise<Plant[]> {
  const rows = await db.getAllAsync<PlantRow>('SELECT * FROM plants ORDER BY name COLLATE NOCASE');
  return rows.map(toPlant);
}

export async function getPlant(db: SQLiteDatabase, id: number): Promise<Plant | null> {
  const row = await db.getFirstAsync<PlantRow>('SELECT * FROM plants WHERE id = ?', id);
  return row ? toPlant(row) : null;
}

/**
 * Creates the plant, its watering task due today if it has an interval, its
 * seasonal care, and for a sown plant in the catalog the "ready to
 * transplant" reminder. `care` says whether it fears frost and is young,
 * for plants created from a kind.
 */
export async function createPlant(
  db: SQLiteDatabase,
  p: PlantInput,
  care: Omit<CareContext, 'potted'> = { tender: false, young: false },
): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO plants (name, variety, location, zone_id, potted, size, pot_size, sun, water_every_days, water_cold_days,
       stage, sown_on, planted_on, preset, annual, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.name, p.variety, p.location, p.zoneId, p.potted ? 1 : 0, p.size, p.potSize, p.sun, p.waterEveryDays, p.waterColdDays,
      p.stage, p.sownOn, p.plantedOn, p.preset, p.annual ? 1 : 0, p.notes,
    );
    id = res.lastInsertRowId;
    if (p.waterEveryDays) await insertWaterTask(db, id, p);
    await syncTransplantReminder(db, id, p);
    const seasonal = seasonalTasks(planFor(presetFor(p)?.name), today(), { ...care, potted: p.potted });
    for (const t of seasonal) await insertTask(db, id, t);
  });
  return id;
}

/** Keeps the open "ready to transplant" reminder in line with the sowing day. */
async function syncTransplantReminder(db: SQLiteDatabase, plantId: number, p: PlantInput) {
  const reminder =
    p.stage === 'seedbed' && p.sownOn ? transplantReminder(planFor(presetFor(p)?.name), p.sownOn) : null;
  const open = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM tasks WHERE plant_id = ? AND type = 'transplant' AND done_on IS NULL`,
    plantId,
  );
  if (reminder && open) {
    await db.runAsync('UPDATE tasks SET due_on = ?, notes = ? WHERE id = ?', reminder.dueOn, reminder.notes, open.id);
  } else if (reminder) {
    await db.runAsync(
      `INSERT INTO tasks (plant_id, type, title, due_on, notes) VALUES (?, 'transplant', ?, ?, ?)`,
      plantId, tr('Pronta da trapiantare', 'Ready to transplant'), reminder.dueOn, reminder.notes,
    );
  } else if (open && p.stage === 'seedbed') {
    await db.runAsync('DELETE FROM tasks WHERE id = ?', open.id);
  }
}

/** Updates the plant and keeps its watering task in sync with the interval. */
export async function updatePlant(db: SQLiteDatabase, id: number, p: PlantInput) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE plants SET name = ?, variety = ?, location = ?, zone_id = ?, potted = ?, size = ?, pot_size = ?, sun = ?,
       water_every_days = ?, water_cold_days = ?, stage = ?, sown_on = ?, planted_on = ?, preset = ?, annual = ?, notes = ?
       WHERE id = ?`,
      p.name, p.variety, p.location, p.zoneId, p.potted ? 1 : 0, p.size, p.potSize, p.sun, p.waterEveryDays, p.waterColdDays,
      p.stage, p.sownOn, p.plantedOn, p.preset, p.annual ? 1 : 0, p.notes, id,
    );
    await syncTransplantReminder(db, id, p);
    // The regular watering task; plan watering has an end day.
    const water = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM tasks WHERE plant_id = ? AND type = 'water' AND repeat_days IS NOT NULL
       AND ends_on IS NULL AND done_on IS NULL`,
      id,
    );
    if (p.waterEveryDays && water) {
      await db.runAsync(
        'UPDATE tasks SET repeat_days = ?, cold_repeat_days = ? WHERE id = ?',
        p.waterEveryDays, p.waterColdDays, water.id,
      );
    } else if (p.waterEveryDays) {
      await insertWaterTask(db, id, p);
    } else if (water) {
      await db.runAsync('DELETE FROM tasks WHERE id = ?', water.id);
    }
  });
}

/** The plant's regular watering, due today. */
async function insertWaterTask(db: SQLiteDatabase, plantId: number, p: PlantInput) {
  await db.runAsync(
    `INSERT INTO tasks (plant_id, type, title, due_on, repeat_days, cold_repeat_days) VALUES (?, 'water', ?, ?, ?, ?)`,
    plantId, tr('Annaffiare', 'Water'), today(), p.waterEveryDays, p.waterColdDays,
  );
}

/**
 * Puts the plant in its final spot on `day`: closes its "ready to transplant"
 * reminder, logs the transplant and creates the chosen plan tasks. Regular
 * watering waits until the plan's establishment watering is over.
 */
export async function transplant(
  db: SQLiteDatabase,
  plantId: number,
  day: DayString,
  tasks: PlannedTask[],
  potted: boolean,
) {
  const plant = await getPlant(db, plantId);
  if (!plant) return;
  const plan = planFor(presetFor(plant)?.name);
  const establishing = tasks.some((t) => t.type === 'water' && t.endsOn);
  const waterFrom = plan && establishing ? regularWateringFrom(plan.steps, day) : null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE plants SET stage = 'ground', planted_on = ?, potted = ? WHERE id = ?`,
      day, potted ? 1 : 0, plantId,
    );
    await db.runAsync(
      `UPDATE tasks SET done_on = ? WHERE plant_id = ? AND type = 'transplant' AND done_on IS NULL`,
      day, plantId,
    );
    await db.runAsync(
      `INSERT INTO task_log (plant_id, type, title, done_on) VALUES (?, 'transplant', ?, ?)`,
      plantId,
      potted ? tr('Messa nel vaso definitivo', 'Potted up') : tr('Messa a dimora', 'Planted out'),
      day,
    );
    if (waterFrom) {
      await db.runAsync(
        `UPDATE tasks SET due_on = MAX(due_on, ?) WHERE plant_id = ? AND type = 'water'
         AND repeat_days IS NOT NULL AND ends_on IS NULL AND done_on IS NULL`,
        waterFrom, plantId,
      );
    }
    for (const t of tasks) await insertTask(db, plantId, t);
  });
}

export async function deletePlant(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM plants WHERE id = ?', id);
}

export async function setPlantPhoto(db: SQLiteDatabase, id: number, photo: string | null) {
  await db.runAsync('UPDATE plants SET photo = ? WHERE id = ?', photo, id);
}

/**
 * End of season: the plant and its history stay, its open tasks go, so it
 * no longer shows up in Oggi.
 */
export async function archivePlant(db: SQLiteDatabase, id: number, day: DayString = today()) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plants SET archived_on = ? WHERE id = ?', day, id);
    await db.runAsync('DELETE FROM tasks WHERE plant_id = ? AND done_on IS NULL', id);
  });
}

/** Brings an archived plant back, with its watering due today and its seasonal care. */
export async function restorePlant(db: SQLiteDatabase, id: number) {
  const p = await getPlant(db, id);
  if (!p) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plants SET archived_on = NULL WHERE id = ?', id);
    if (p.waterEveryDays) await insertWaterTask(db, id, p);
    // Whether it fears frost isn't saved: the kind's usual answer.
    const care = { potted: p.potted, tender: kindFor(p.preset)?.tender ?? customFor(p.preset)?.tender ?? false };
    for (const t of seasonalTasks(planFor(presetFor(p)?.name), today(), care)) await insertTask(db, id, t);
  });
}

// --- Tasks -----------------------------------------------------------------

export type TaskInput = Pick<
  Task,
  'plantId' | 'type' | 'title' | 'dueOn' | 'repeatDays' | 'endsOn' | 'yearly' | 'months' | 'coldRepeatDays' | 'notes'
>;

const monthsText = (months: number[] | null) => (months?.length ? months.join(',') : null);

async function insertTask(
  db: SQLiteDatabase,
  plantId: number | null,
  t: Omit<TaskInput, 'plantId' | 'notes' | 'coldRepeatDays'> & { notes?: string | null; coldRepeatDays?: number | null },
): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO tasks (plant_id, type, title, due_on, repeat_days, ends_on, yearly, months, cold_repeat_days, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    plantId, t.type, t.title, t.dueOn, t.repeatDays, t.endsOn, t.yearly ? 1 : 0, monthsText(t.months),
    t.coldRepeatDays ?? null, t.notes ?? null,
  );
  return res.lastInsertRowId;
}

export async function listOpenTasks(db: SQLiteDatabase): Promise<TaskWithPlant[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `${TASK_SELECT} WHERE t.done_on IS NULL ORDER BY t.due_on, t.type, p.name`,
  );
  return rows.map(toTask);
}

export async function listPlantTasks(db: SQLiteDatabase, plantId: number): Promise<TaskWithPlant[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `${TASK_SELECT} WHERE t.plant_id = ? AND t.done_on IS NULL ORDER BY t.due_on`,
    plantId,
  );
  return rows.map(toTask);
}

export async function getTask(db: SQLiteDatabase, id: number): Promise<TaskWithPlant | null> {
  const row = await db.getFirstAsync<TaskRow>(`${TASK_SELECT} WHERE t.id = ?`, id);
  return row ? toTask(row) : null;
}

export async function createTask(db: SQLiteDatabase, t: TaskInput): Promise<number> {
  return insertTask(db, t.plantId, t);
}

export async function updateTask(db: SQLiteDatabase, id: number, t: TaskInput) {
  await db.runAsync(
    `UPDATE tasks SET plant_id = ?, type = ?, title = ?, due_on = ?, repeat_days = ?, ends_on = ?,
     yearly = ?, months = ?, cold_repeat_days = ?, notes = ? WHERE id = ?`,
    t.plantId, t.type, t.title, t.dueOn, t.repeatDays, t.endsOn, t.yearly ? 1 : 0, monthsText(t.months),
    t.coldRepeatDays, t.notes, id,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

/** Logs the task as done; repeating tasks move to their next due day. */
export async function markDone(db: SQLiteDatabase, task: Task, doneOn: DayString = today()) {
  const next = completeTask(task, doneOn);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO task_log (task_id, plant_id, type, title, done_on, prev_due_on) VALUES (?, ?, ?, ?, ?, ?)',
      task.id, task.plantId, task.type, task.title, doneOn, task.dueOn,
    );
    if (next.dueOn) {
      await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ?', next.dueOn, task.id);
    } else {
      await db.runAsync('UPDATE tasks SET done_on = ? WHERE id = ?', next.doneOn, task.id);
    }
  });
}

/** What was done on `day`, with plant and zone names, for the checked rows in Oggi. */
export async function listDoneOn(db: SQLiteDatabase, day: DayString = today()): Promise<DoneEntry[]> {
  const rows = await db.getAllAsync<DoneEntry>(
    `SELECT l.id, l.task_id AS taskId, l.plant_id AS plantId, l.type, l.title, l.done_on AS doneOn,
       l.prev_due_on AS prevDueOn, p.name AS plantName, p.variety AS plantVariety, z.name AS zoneName
     FROM task_log l LEFT JOIN plants p ON p.id = l.plant_id LEFT JOIN zones z ON z.id = p.zone_id
     WHERE l.done_on = ? ORDER BY l.id`,
    day,
  );
  return rows.map((e) => ({ ...e, title: local(e.title), plantName: e.plantName === null ? null : local(e.plantName) }));
}

/**
 * Un-ticks a task: it goes back to the day it was due and leaves the
 * history. Ticks from before v5 didn't save that day, so those go back to
 * the day they were ticked. Transplants (no task) can't be undone here.
 */
export async function undoDone(db: SQLiteDatabase, entry: DoneEntry) {
  if (entry.taskId === null) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE tasks SET due_on = ?, done_on = NULL WHERE id = ?',
      entry.prevDueOn ?? entry.doneOn, entry.taskId,
    );
    await db.runAsync('DELETE FROM task_log WHERE id = ?', entry.id);
  });
}

export async function postpone(db: SQLiteDatabase, task: Task, toDay: DayString) {
  await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ?', toDay, task.id);
}

/**
 * "It rained": every open watering task counts as watered today, except for
 * plants in a covered zone (greenhouse, under a roof). Pots outdoors get the
 * rain too. Returns how many tasks moved.
 */
export async function rained(db: SQLiteDatabase, day: DayString = today()): Promise<number> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT t.* FROM tasks t JOIN plants p ON p.id = t.plant_id
     LEFT JOIN zones z ON z.id = p.zone_id
     WHERE t.type = 'water' AND t.done_on IS NULL AND t.repeat_days IS NOT NULL
     AND COALESCE(z.covered, 0) = 0`,
  );
  const moved: RainRecord['moved'] = [];
  const before = await getLastRain(db);
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      const t = toTask(r);
      const due = afterRain(t, day);
      if (due === t.dueOn) continue;
      await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ?', due, t.id);
      moved.push({ id: t.id, from: t.dueOn, to: due });
    }
    const record: RainRecord = { day, moved, previousDay: before?.day === day ? before.previousDay : before?.day };
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES ('last_rain', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      JSON.stringify(record),
    );
  });
  return moved.length;
}

/** The last time "it rained" was pressed, and which waterings it moved. */
export interface RainRecord {
  day: DayString;
  moved: { id: number; from: DayString; to: DayString }[];
  /** The rain before this one, shown again if this one is undone. */
  previousDay?: DayString;
}

export async function getLastRain(db: SQLiteDatabase): Promise<RainRecord | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM settings WHERE key = 'last_rain'`);
  if (!row) return null;
  try {
    const r = JSON.parse(row.value) as RainRecord;
    return typeof r.day === 'string' && Array.isArray(r.moved) ? r : null;
  } catch {
    return null;
  }
}

/**
 * Takes back the last rain: waterings it moved go back to their old day,
 * unless they have been done or moved again since.
 */
export async function undoRain(db: SQLiteDatabase): Promise<void> {
  const last = await getLastRain(db);
  if (!last) return;
  await db.withTransactionAsync(async () => {
    for (const m of last.moved) {
      await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ? AND due_on = ? AND done_on IS NULL', m.from, m.id, m.to);
    }
    if (last.previousDay) {
      await db.runAsync(
        `UPDATE settings SET value = ? WHERE key = 'last_rain'`,
        JSON.stringify({ day: last.previousDay, moved: [] } satisfies RainRecord),
      );
    } else {
      await db.runAsync(`DELETE FROM settings WHERE key = 'last_rain'`);
    }
  });
}

export async function listPlantLog(db: SQLiteDatabase, plantId: number, limit = 20): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<LogEntry>(
    `SELECT id, task_id AS taskId, plant_id AS plantId, type, title, done_on AS doneOn
     FROM task_log WHERE plant_id = ? ORDER BY done_on DESC, id DESC LIMIT ?`,
    plantId, limit,
  );
  return rows.map((e) => ({ ...e, title: local(e.title) }));
}

// --- Zones -----------------------------------------------------------------

interface ZoneRow {
  id: number;
  name: string;
  sun: Sun;
  covered: number;
}

const toZone = (r: ZoneRow): Zone => ({ id: r.id, name: r.name, sun: r.sun, covered: r.covered === 1 });

export async function listZones(db: SQLiteDatabase): Promise<Zone[]> {
  const rows = await db.getAllAsync<ZoneRow>('SELECT * FROM zones ORDER BY name COLLATE NOCASE');
  return rows.map(toZone);
}

export async function getZone(db: SQLiteDatabase, id: number): Promise<Zone | null> {
  const row = await db.getFirstAsync<ZoneRow>('SELECT * FROM zones WHERE id = ?', id);
  return row ? toZone(row) : null;
}

export async function saveZone(db: SQLiteDatabase, z: Omit<Zone, 'id'> & { id?: number }): Promise<number> {
  if (z.id) {
    await db.runAsync('UPDATE zones SET name = ?, sun = ?, covered = ? WHERE id = ?', z.name, z.sun, z.covered ? 1 : 0, z.id);
    return z.id;
  }
  const res = await db.runAsync('INSERT INTO zones (name, sun, covered) VALUES (?, ?, ?)', z.name, z.sun, z.covered ? 1 : 0);
  return res.lastInsertRowId;
}

/** Deletes the zone; its plants stay, without a zone. */
/** How many plants are in the zone, archived ones included. */
export async function countZonePlants(db: SQLiteDatabase, id: number): Promise<{ total: number; archived: number }> {
  const r = await db.getFirstAsync<{ total: number; archived: number | null }>(
    'SELECT COUNT(*) AS total, SUM(archived_on IS NOT NULL) AS archived FROM plants WHERE zone_id = ?',
    id,
  );
  return { total: r?.total ?? 0, archived: r?.archived ?? 0 };
}

/** Deletes an empty zone. Throws if plants are still in it. */
export async function deleteZone(db: SQLiteDatabase, id: number) {
  const { total } = await countZonePlants(db, id);
  if (total > 0) throw new Error(tr('La zona ha ancora delle piante.', 'The zone still has plants.'));
  await db.runAsync('DELETE FROM zones WHERE id = ?', id);
}

// --- Catalog added from files ------------------------------------------------

/** Reads the added plants into the catalog. A row that no longer checks out is skipped, not fatal. */
export async function loadCatalog(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ name: string; entry: string }>('SELECT * FROM catalog ORDER BY name COLLATE NOCASE');
  const entries: CustomEntry[] = [];
  for (const r of rows) {
    try {
      entries.push(parseCatalogEntry(JSON.parse(r.entry)));
    } catch (e) {
      console.warn(`Catalog entry ${r.name} skipped: ${(e as Error).message}`);
    }
  }
  setCustomCatalog(entries);
}

/** Adds the plants to the catalog; one with the name of an added plant replaces it. */
export async function addToCatalog(
  db: SQLiteDatabase,
  items: { entry: CustomEntry; raw: unknown }[],
): Promise<{ added: string[]; replaced: string[] }> {
  const known = new Set(customEntries().map((e) => e.name));
  await db.withTransactionAsync(async () => {
    for (const { entry, raw } of items) {
      await db.runAsync(
        'INSERT INTO catalog (name, entry) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET entry = excluded.entry',
        entry.name, JSON.stringify(raw),
      );
    }
  });
  await loadCatalog(db);
  const names = items.map((i) => i.entry.name);
  return { added: names.filter((n) => !known.has(n)), replaced: names.filter((n) => known.has(n)) };
}

/** Takes an added plant out of the catalog. Plants created from it keep their tasks. */
export async function removeFromCatalog(db: SQLiteDatabase, name: string) {
  await db.runAsync('DELETE FROM catalog WHERE name = ?', name);
  await loadCatalog(db);
}

// --- Backup ----------------------------------------------------------------

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const t of BACKUP_TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  return makeBackup(DATABASE_VERSION, tables);
}

/** Replaces every table with the backup's rows, all or nothing. */
export async function importBackup(db: SQLiteDatabase, backup: Backup) {
  await db.withTransactionAsync(async () => {
    for (const t of [...BACKUP_TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
      const columns = info.map((c) => c.name);
      for (const raw of backup.tables[t]) {
        // Backups from before v5 don't say whether a plant is annual: guess it as the migration does.
        const row =
          t === 'plants' && !('annual' in raw)
            ? { ...raw, annual: isAnnual(presetFor(raw as unknown as PlantRow)?.name) ? 1 : 0 }
            : raw;
        const insert = insertFor(t, row, columns);
        if (insert) await db.runAsync(insert.sql, insert.values);
      }
    }
  });
  await loadCatalog(db);
}

export async function getLastBackup(db: SQLiteDatabase): Promise<DayString | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM settings WHERE key = 'last_backup'`);
  return row?.value ?? null;
}

export async function setLastBackup(db: SQLiteDatabase, day: DayString) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('last_backup', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    day,
  );
}

// --- Settings --------------------------------------------------------------

export const DEFAULT_REMINDER_HOUR = 8;

export async function getReminderHour(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'reminder_hour'`,
  );
  const hour = row ? Number(row.value) : NaN;
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_REMINDER_HOUR;
}

export async function setReminderHour(db: SQLiteDatabase, hour: number) {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('reminder_hour', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(hour),
  );
}

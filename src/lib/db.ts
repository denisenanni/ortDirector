import type { SQLiteDatabase } from 'expo-sqlite';
import { completeTask, today } from './schedule';
import type { DayString, LogEntry, Plant, Sun, Task, TaskType, TaskWithPlant } from './types';

export const DATABASE_NAME = 'ortdirector.db';
const DATABASE_VERSION = 1;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

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
  // Future migrations: if (version === 1) { ...; version = 2; }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// --- Row mapping -----------------------------------------------------------

interface PlantRow {
  id: number;
  name: string;
  variety: string | null;
  location: string | null;
  sun: Sun;
  water_every_days: number | null;
  planted_on: string | null;
  notes: string | null;
}

interface TaskRow {
  id: number;
  plant_id: number | null;
  type: TaskType;
  title: string;
  due_on: string;
  repeat_days: number | null;
  done_on: string | null;
  notes: string | null;
  plant_name?: string | null;
}

const toPlant = (r: PlantRow): Plant => ({
  id: r.id,
  name: r.name,
  variety: r.variety,
  location: r.location,
  sun: r.sun,
  waterEveryDays: r.water_every_days,
  plantedOn: r.planted_on,
  notes: r.notes,
});

const toTask = (r: TaskRow): TaskWithPlant => ({
  id: r.id,
  plantId: r.plant_id,
  type: r.type,
  title: r.title,
  dueOn: r.due_on,
  repeatDays: r.repeat_days,
  doneOn: r.done_on,
  notes: r.notes,
  plantName: r.plant_name ?? null,
});

const TASK_SELECT = `
  SELECT t.*, p.name AS plant_name
  FROM tasks t LEFT JOIN plants p ON p.id = t.plant_id`;

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

/** Creates the plant and, if it has a watering interval, its watering task due today. */
export async function createPlant(db: SQLiteDatabase, p: PlantInput): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO plants (name, variety, location, sun, water_every_days, planted_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      p.name, p.variety, p.location, p.sun, p.waterEveryDays, p.plantedOn, p.notes,
    );
    id = res.lastInsertRowId;
    if (p.waterEveryDays) {
      await db.runAsync(
        `INSERT INTO tasks (plant_id, type, title, due_on, repeat_days) VALUES (?, 'water', ?, ?, ?)`,
        id, 'Annaffiare', today(), p.waterEveryDays,
      );
    }
  });
  return id;
}

/** Updates the plant and keeps its watering task in sync with the interval. */
export async function updatePlant(db: SQLiteDatabase, id: number, p: PlantInput) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE plants SET name = ?, variety = ?, location = ?, sun = ?, water_every_days = ?,
       planted_on = ?, notes = ? WHERE id = ?`,
      p.name, p.variety, p.location, p.sun, p.waterEveryDays, p.plantedOn, p.notes, id,
    );
    const water = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM tasks WHERE plant_id = ? AND type = 'water' AND repeat_days IS NOT NULL AND done_on IS NULL`,
      id,
    );
    if (p.waterEveryDays && water) {
      await db.runAsync('UPDATE tasks SET repeat_days = ? WHERE id = ?', p.waterEveryDays, water.id);
    } else if (p.waterEveryDays) {
      await db.runAsync(
        `INSERT INTO tasks (plant_id, type, title, due_on, repeat_days) VALUES (?, 'water', ?, ?, ?)`,
        id, 'Annaffiare', today(), p.waterEveryDays,
      );
    } else if (water) {
      await db.runAsync('DELETE FROM tasks WHERE id = ?', water.id);
    }
  });
}

export async function deletePlant(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM plants WHERE id = ?', id);
}

// --- Tasks -----------------------------------------------------------------

export type TaskInput = Pick<Task, 'plantId' | 'type' | 'title' | 'dueOn' | 'repeatDays' | 'notes'>;

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
  const res = await db.runAsync(
    `INSERT INTO tasks (plant_id, type, title, due_on, repeat_days, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    t.plantId, t.type, t.title, t.dueOn, t.repeatDays, t.notes,
  );
  return res.lastInsertRowId;
}

export async function updateTask(db: SQLiteDatabase, id: number, t: TaskInput) {
  await db.runAsync(
    `UPDATE tasks SET plant_id = ?, type = ?, title = ?, due_on = ?, repeat_days = ?, notes = ? WHERE id = ?`,
    t.plantId, t.type, t.title, t.dueOn, t.repeatDays, t.notes, id,
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
      'INSERT INTO task_log (task_id, plant_id, type, title, done_on) VALUES (?, ?, ?, ?, ?)',
      task.id, task.plantId, task.type, task.title, doneOn,
    );
    if (next.dueOn) {
      await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ?', next.dueOn, task.id);
    } else {
      await db.runAsync('UPDATE tasks SET done_on = ? WHERE id = ?', next.doneOn, task.id);
    }
  });
}

export async function postpone(db: SQLiteDatabase, task: Task, toDay: DayString) {
  await db.runAsync('UPDATE tasks SET due_on = ? WHERE id = ?', toDay, task.id);
}

export async function listPlantLog(db: SQLiteDatabase, plantId: number, limit = 20): Promise<LogEntry[]> {
  return db.getAllAsync<LogEntry>(
    `SELECT id, task_id AS taskId, plant_id AS plantId, type, title, done_on AS doneOn
     FROM task_log WHERE plant_id = ? ORDER BY done_on DESC, id DESC LIMIT ?`,
    plantId, limit,
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

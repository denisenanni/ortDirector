/// <reference types="node" />
// For tests only: an in-memory SQLite database from Node's node:sqlite behind
// the few expo-sqlite methods db.ts uses, so db.ts runs under `node --test`
// against a real SQLite (see db.test.ts and migrations.test.ts). The app never
// imports this file.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = SQLInputValue[];

// expo-sqlite takes the values either spread or as one array.
const params = (args: unknown[]): Params => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as Params;

// node:sqlite rows have no prototype; plain objects compare like the app's.
const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export interface MemoryDb extends SQLiteDatabase {
  /** The node:sqlite handle, to build old schemas with plain SQL. */
  raw: DatabaseSync;
}

export function openMemoryDb(): MemoryDb {
  const raw = new DatabaseSync(':memory:');
  const db = {
    raw,
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]) {
      return raw.prepare(sql).all(...params(args)).map((r) => plain<T>(r));
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      const row = raw.prepare(sql).get(...params(args));
      return row ? plain<T>(row) : null;
    },
    async runAsync(sql: string, ...args: unknown[]) {
      const res = raw.prepare(sql).run(...params(args));
      return { lastInsertRowId: Number(res.lastInsertRowid), changes: Number(res.changes) };
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db as unknown as MemoryDb;
}

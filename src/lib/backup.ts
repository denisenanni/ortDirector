// Backup file format: every table as raw rows, plus the schema version they
// came from. Pure logic, no React Native imports, so it runs under
// `node --test` (see backup.test.ts).
import { tr } from './i18n.ts';

/** Tables in insert order: each one only references tables before it. */
export const BACKUP_TABLES = ['catalog', 'zones', 'plants', 'tasks', 'task_log', 'settings'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type Row = Record<string, string | number | null>;

export interface Backup {
  app: 'ortdirector';
  /** Database version (PRAGMA user_version) the rows were written with. */
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, Row[]>;
}

export function makeBackup(version: number, tables: Record<BackupTable, Row[]>, now: Date = new Date()): Backup {
  return { app: 'ortdirector', version, exportedAt: now.toISOString(), tables };
}

/**
 * Checks a parsed file before anything is deleted. Throws a message in the
 * app's language that it can show as is. Backups from older app versions are accepted:
 * columns added since then take their defaults.
 */
export function parseBackup(text: string, currentVersion: number): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(tr('Il file non è un backup valido (non è JSON).', 'The file is not a valid backup (not JSON).'));
  }
  const b = data as Partial<Backup> | null;
  if (!b || b.app !== 'ortdirector' || typeof b.version !== 'number' || !b.tables) {
    throw new Error(tr('Il file non è un backup di ortDirector.', 'The file is not an ortDirector backup.'));
  }
  if (b.version > currentVersion) {
    throw new Error(
      tr(
        'Il backup viene da una versione più nuova dell’app: aggiorna l’app prima di importarlo.',
        'The backup comes from a newer version of the app: update the app before importing it.',
      ),
    );
  }
  for (const t of BACKUP_TABLES) {
    const rows = b.tables[t];
    if (rows === undefined && (t === 'zones' || t === 'catalog')) continue; // zones came with v4, catalog with v6
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      throw new Error(tr(`Il backup è danneggiato (tabella ${t}).`, `The backup is damaged (table ${t}).`));
    }
  }
  return {
    ...(b as Backup),
    tables: { ...b.tables, zones: b.tables.zones ?? [], catalog: b.tables.catalog ?? [] } as Backup['tables'],
  };
}

/**
 * The INSERT for one row, limited to columns the table really has, so a file
 * can't name columns that don't exist. Null when nothing is left to insert.
 */
export function insertFor(table: BackupTable, row: Row, columns: string[]): { sql: string; values: Row[string][] } | null {
  const cols = Object.keys(row).filter((c) => columns.includes(c));
  if (cols.length === 0) return null;
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values: cols.map((c) => row[c]),
  };
}

export function backupFileName(day: string): string {
  return `ortdirector-backup-${day}.json`;
}

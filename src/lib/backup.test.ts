/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertFor, makeBackup, parseBackup } from './backup.ts';

const empty = { catalog: [], zones: [], plants: [], tasks: [], task_log: [], settings: [] };

test('a backup survives a round trip through JSON', () => {
  const b = makeBackup(4, { ...empty, plants: [{ id: 1, name: 'Pomodoro' }] }, new Date('2026-10-20T08:00:00Z'));
  assert.deepEqual(parseBackup(JSON.stringify(b), 4), b);
});

test('parseBackup rejects files that are not ortDirector backups', () => {
  assert.throws(() => parseBackup('not json', 4), /non è JSON/);
  assert.throws(() => parseBackup('{"app":"other"}', 4), /non è un backup di ortDirector/);
  assert.throws(() => parseBackup(JSON.stringify(makeBackup(5, empty)), 4), /più nuova/);
  const broken = { ...makeBackup(4, empty), tables: { ...empty, tasks: 'x' } };
  assert.throws(() => parseBackup(JSON.stringify(broken), 4), /tabella tasks/);
});

test('parseBackup accepts backups from before zones and the added catalog existed', () => {
  const { zones: _zones, catalog: _catalog, ...old } = empty;
  const b = parseBackup(JSON.stringify({ app: 'ortdirector', version: 3, exportedAt: '', tables: old }), 4);
  assert.deepEqual(b.tables.zones, []);
  assert.deepEqual(b.tables.catalog, []);
});

test('insertFor keeps only real columns', () => {
  assert.deepEqual(insertFor('plants', { id: 1, name: 'Basilico', 'x); DROP TABLE plants; --': 1 }, ['id', 'name']), {
    sql: 'INSERT INTO plants (id, name) VALUES (?, ?)',
    values: [1, 'Basilico'],
  });
  assert.equal(insertFor('plants', { bogus: 1 }, ['id']), null);
});

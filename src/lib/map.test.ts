import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as map from './map.ts';
import type { Zone, ZoneShape } from './types';

const rect = (over: Partial<ZoneShape> = {}): ZoneShape => ({ kind: 'rect', x: 0, y: 0, width: 4, length: 2, rotation: 0, ...over });
const near = (a: map.Point, b: map.Point) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-9, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

test('measures snap to 10 cm and angles to 5 degrees', () => {
  assert.equal(map.snap(1.234), 1.2);
  assert.equal(map.snap(1.25), 1.3);
  assert.equal(map.snap(-0.04), 0);
  assert.equal(map.snapAngle(62), 60);
  assert.equal(map.snapAngle(-2), 0);
  assert.equal(map.snapAngle(-3), 355);
  assert.equal(map.snapAngle(358), 0);
  assert.equal(map.snapAngle(-50), 310);
});

test('a turned rectangle has its corners turned around the centre', () => {
  const [tl, tr] = map.corners(rect({ x: 10, y: 10, rotation: 90 }));
  // Turned a quarter clockwise, the top left corner ends up top right.
  near(tl, { x: 11, y: 8 });
  near(tr, { x: 11, y: 12 });
});

test('a point is inside a turned rectangle or a circle', () => {
  const s = rect({ rotation: 90 });
  assert.ok(map.contains(s, { x: 0, y: 1.9 }));
  assert.ok(!map.contains(s, { x: 1.9, y: 0 }));
  const c: ZoneShape = { kind: 'circle', x: 5, y: 5, width: 2, length: 2, rotation: 0 };
  assert.ok(map.contains(c, { x: 5.7, y: 5.7 }));
  assert.ok(!map.contains(c, { x: 5.8, y: 5.8 }));
});

test('the smaller zone is on top, so a pot inside a bed can be touched', () => {
  const zones = map.drawOrder([
    { id: 1, shape: { kind: 'circle', x: 0, y: 0, width: 0.6, length: 0.6, rotation: 0 } as ZoneShape },
    { id: 2, shape: rect() },
  ]);
  assert.deepEqual(zones.map((z) => z.id), [2, 1]);
  assert.equal(map.hit(zones, { x: 0, y: 0 }), 1);
  assert.equal(map.hit(zones, { x: 1.5, y: 0 }), 2);
  assert.equal(map.hit(zones, { x: 3, y: 0 }), null);
  assert.equal(map.hit(zones, { x: 2.2, y: 0 }, 0.3), 2);
});

test('resizing from the corner keeps the opposite corner still, also when turned', () => {
  const s = rect({ x: 2, y: 1, rotation: 30 });
  const fixed = map.corners(s)[0];
  const r = map.resize(s, map.toMap(s, { x: 3, y: 2.04 }));
  assert.deepEqual([r.width, r.length, r.rotation], [5, 3, 30]);
  const after = map.corners(r)[0];
  assert.ok(Math.hypot(after.x - fixed.x, after.y - fixed.y) < 0.1);
});

test('resizing never goes below 20 cm, and a circle grows from the centre', () => {
  const r = map.resize(rect({ x: 2, y: 1 }), { x: 0, y: 0 });
  assert.deepEqual([r.width, r.length], [0.2, 0.2]);
  const c = map.resize({ kind: 'circle', x: 1, y: 1, width: 2, length: 2, rotation: 0 }, { x: 2.5, y: 1 });
  assert.deepEqual([c.x, c.y, c.width, c.length], [1, 1, 3, 3]);
});

test('turning faces the top of the rectangle towards the finger', () => {
  assert.equal(map.turnTowards(rect(), { x: 5, y: 0 }).rotation, 90);
  assert.equal(map.turnTowards(rect(), { x: 0, y: 5 }).rotation, 180);
  assert.equal(map.turnTowards(rect(), { x: -3, y: -3 }).rotation, 315);
});

test('rectangle to circle keeps the centre and the width', () => {
  const c = map.withKind(rect({ x: 3, rotation: 40 }), 'circle');
  assert.deepEqual(c, { kind: 'circle', x: 3, y: 0, width: 4, length: 4, rotation: 0 });
  assert.deepEqual(map.withKind(c, 'rect'), { kind: 'rect', x: 3, y: 0, width: 4, length: 2, rotation: 0 });
});

test('a shape from the form goes right of what is drawn', () => {
  assert.deepEqual(map.freeSpot([], 2, 1), { x: 0, y: 0 });
  assert.deepEqual(map.freeSpot([rect()], 2, 1), { x: 4, y: -0.5 });
});

test('the view fits the drawing and zooms around the fingers', () => {
  const v = map.fitView([rect({ x: 10, y: 10 })], 400, 300, 0);
  assert.equal(v.scale, 100);
  near(map.toScreen(v, { x: 10, y: 10 }), { x: 200, y: 150 });
  const z = map.zoom(v, 2, { x: 100, y: 100 });
  near(map.fromScreen(z, { x: 100, y: 100 }), map.fromScreen(v, { x: 100, y: 100 }));
  assert.equal(z.scale, 200);
  assert.equal(map.zoom(v, 1000, { x: 0, y: 0 }).scale, map.MAX_SCALE);
  const p = map.pan(v, 50, 0);
  near(map.toScreen(p, { x: 10, y: 10 }), { x: 250, y: 150 });
});

test('grid lines stay far enough apart at any zoom', () => {
  assert.equal(map.gridStep(100), 0.5);
  assert.equal(map.gridStep(30), 1);
  assert.equal(map.gridStep(8), 5);
});

test('each zone counts its plants, what is due and the sun warning', () => {
  const zones: Zone[] = [
    { id: 1, name: 'Orto', sun: 'full', covered: false, shape: rect() },
    { id: 2, name: 'Ombra', sun: 'shade', covered: false, shape: null },
  ];
  const plants = [
    { id: 1, zoneId: 1, sun: 'full' as const, archivedOn: null },
    { id: 2, zoneId: 1, sun: 'full' as const, archivedOn: '2026-10-01' },
    { id: 3, zoneId: 2, sun: 'full' as const, archivedOn: null },
  ];
  const tasks = [
    { plantId: 1, dueOn: '2026-11-10' },
    { plantId: 2, dueOn: '2026-11-01' }, // archived plant: doesn't count
    { plantId: 3, dueOn: '2026-11-04' },
  ];
  const s = map.zoneStats(zones, plants, tasks, '2026-11-04');
  assert.deepEqual(s.get(1), { plants: 1, due: false, mismatch: false });
  assert.deepEqual(s.get(2), { plants: 1, due: true, mismatch: true });
});

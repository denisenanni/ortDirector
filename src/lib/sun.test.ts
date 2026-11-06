import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as sun from './sun.ts';
import type { Obstacle, ZoneShape } from './types';

const ROME = { lat: 41.9, lon: 12.5 };
const close = (a: number, b: number, tol: number, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} not within ${tol} of ${b}`);

const wall = (over: Partial<ZoneShape> = {}, height = 2, deciduous = false): Obstacle => ({
  id: 1,
  name: 'Muro',
  shape: { kind: 'rect', x: 0, y: 0, width: 10, length: 0.3, rotation: 0, ...over },
  height,
  deciduous,
});

test('the sun at noon stands south, as high as the latitude and the season say', () => {
  // Rome, summer solstice, local solar noon is about 11:10 UTC.
  const summer = sun.sunPosition(new Date('2026-06-21T11:10:00Z'), ROME);
  close(summer.altitude, 90 - 41.9 + 23.44, 0.5, 'summer altitude');
  close(summer.azimuth, 180, 3, 'summer azimuth');
  const winter = sun.sunPosition(new Date('2026-12-21T11:05:00Z'), ROME);
  close(winter.altitude, 90 - 41.9 - 23.44, 0.5, 'winter altitude');
  // Morning sun is east, evening sun west.
  assert.ok(sun.sunPosition(new Date('2026-06-21T06:00:00Z'), ROME).azimuth < 120);
  assert.ok(sun.sunPosition(new Date('2026-06-21T17:00:00Z'), ROME).azimuth > 240);
  // Midnight is below the horizon.
  assert.ok(sun.sunPosition(new Date('2026-06-21T23:10:00Z'), ROME).altitude < 0);
});

test('days are long in June and short in December, and 12 hours on the equator', () => {
  close(sun.dayLength(ROME, 2026, 6), 15.1, 0.3, 'Rome June');
  close(sun.dayLength(ROME, 2026, 12), 9.2, 0.3, 'Rome December');
  close(sun.dayLength({ lat: 0, lon: 0 }, 2026, 3), 12, 0.25, 'equator');
  close(sun.dayLength({ lat: -33.9, lon: 151.2 }, 2026, 12), 14.4, 0.3, 'Sydney December');
  // Far north, the sun never sets in June and never rises in December.
  assert.equal(sun.dayLength({ lat: 78, lon: 15 }, 2026, 6), 24);
  assert.equal(sun.dayLength({ lat: 78, lon: 15 }, 2026, 12), 0);
  assert.equal(sun.daylight({ lat: 78, lon: 15 }, 2026, 12), null);
});

test('a ray finds where it enters a rectangle or a circle', () => {
  const r: ZoneShape = { kind: 'rect', x: 0, y: -3, width: 2, length: 2, rotation: 0 };
  close(sun.entry(r, { x: 0, y: 0 }, { x: 0, y: -1 })!, 2, 1e-9);
  assert.equal(sun.entry(r, { x: 0, y: 0 }, { x: 0, y: 1 }), null);
  assert.equal(sun.entry(r, { x: 0, y: -3 }, { x: 1, y: 0 }), 0);
  // Turned 45 degrees, its corner points down: entered at the corner.
  close(sun.entry({ ...r, rotation: 45 }, { x: 0, y: 0 }, { x: 0, y: -1 })!, 3 - Math.SQRT2, 1e-9);
  const c: ZoneShape = { kind: 'circle', x: 5, y: 0, width: 2, length: 2, rotation: 0 };
  close(sun.entry(c, { x: 0, y: 0 }, { x: 1, y: 0 })!, 4, 1e-9);
  assert.equal(sun.entry(c, { x: 0, y: 0 }, { x: 0, y: 1 }), null);
  assert.equal(sun.entry(c, { x: 5.5, y: 0 }, { x: 0, y: 1 }), 0);
});

test('a wall to the south shades a bed close behind it, not one far away or to its south', () => {
  // North up: the wall at y = 0, the sun at noon comes from below (south).
  const noon = { altitude: 30, azimuth: 180 };
  const w = [wall()];
  // 2 m high, sun at 30 degrees: shadow 3.46 m long, to the north (up).
  assert.equal(sun.shaded({ x: 0, y: -2 }, w, noon, 0, 6), true);
  assert.equal(sun.shaded({ x: 0, y: -4 }, w, noon, 0, 6), false);
  assert.equal(sun.shaded({ x: 0, y: 2 }, w, noon, 0, 6), false);
  // Past the wall's end the sun gets through.
  assert.equal(sun.shaded({ x: 6, y: -2 }, w, noon, 0, 6), false);
  // With north turned to the bottom of the map, the same bed is on the sunny side.
  assert.equal(sun.shaded({ x: 0, y: -2 }, w, noon, 180, 6), false);
  assert.equal(sun.shaded({ x: 0, y: 2 }, w, noon, 180, 6), true);
  // At night everything is in the dark.
  assert.equal(sun.shaded({ x: 0, y: 2 }, [], { altitude: -5, azimuth: 0 }, 0, 6), true);
});

test('a tree that loses its leaves shades from April to October only', () => {
  const tree: Obstacle = { id: 2, name: 'Fico', shape: { kind: 'circle', x: 0, y: 2, width: 4, length: 4, rotation: 0 }, height: 5, deciduous: true };
  const noon = { altitude: 40, azimuth: 180 };
  assert.equal(sun.shaded({ x: 0, y: -1 }, [tree], noon, 0, 7), true);
  assert.equal(sun.shaded({ x: 0, y: -1 }, [tree], noon, 0, 1), false);
  assert.equal(sun.shaded({ x: 0, y: -1 }, [{ ...tree, deciduous: false }], noon, 0, 1), true);
  // Under its crown, in summer: shade.
  assert.equal(sun.shaded({ x: 0, y: 2 }, [tree], noon, 0, 7), true);
});

test('a bed north of a house gets less sun in a year than an open one, and its exposure follows', () => {
  const open = sun.yearSunHours({ x: 0, y: 0 }, [], ROME, 0, 2026);
  assert.equal(open.length, 12);
  close(open[5], sun.dayLength(ROME, 2026, 6), 1e-9);
  assert.deepEqual(sun.exposure(open).sun, 'full');

  // A 6 m house 1 m south of the bed.
  const house = wall({ y: 4, width: 12, length: 6 }, 6);
  const behind = sun.yearSunHours({ x: 0, y: 0 }, [house], ROME, 0, 2026);
  for (let m = 0; m < 12; m++) assert.ok(behind[m] <= open[m]);
  // Midday is behind the house; only the early and late hours reach it.
  assert.equal(behind[11], 0);
  assert.ok(behind[5] > 7, `June ${behind[5]}`);
  assert.ok(sun.exposure(behind).average < sun.exposure(open).average - 6);
  // Closer to a taller house, the season drops below 6 hours.
  const tall = { ...house, height: 10 };
  assert.equal(sun.exposure(sun.yearSunHours({ x: 0, y: 0.5 }, [tall], ROME, 0, 2026)).sun, 'partial');
});

test('hours become the exposure the app already uses', () => {
  assert.equal(sun.sunFromHours(6), 'full');
  assert.equal(sun.sunFromHours(5.9), 'partial');
  assert.equal(sun.sunFromHours(3), 'partial');
  assert.equal(sun.sunFromHours(2.9), 'shade');
  const hours = [0, 0, 0, 7, 7, 7, 1, 1, 1, 0, 0, 0];
  assert.deepEqual(sun.exposure(hours), { average: 4, sun: 'partial' });
});

test('an obstacle’s shadow falls away from the sun and grows as the sun goes down', () => {
  const post = wall({ width: 1, length: 1 }, 1);
  const high = sun.shadow(post, { altitude: 45, azimuth: 180 }, 0, 6)!;
  // Sun from the south: the shadow reaches 1 m north (up) of the post's north edge.
  close(Math.min(...high.map((p) => p.y)), -1.5, 1e-9);
  close(Math.max(...high.map((p) => p.y)), 0.5, 1e-9);
  const low = sun.shadow(post, { altitude: 10, azimuth: 180 }, 0, 6)!;
  assert.ok(Math.min(...low.map((p) => p.y)) < -5);
  // Morning sun from the east throws it west (left).
  const morning = sun.shadow(post, { altitude: 45, azimuth: 90 }, 0, 6)!;
  close(Math.min(...morning.map((p) => p.x)), -1.5, 1e-9);
  assert.equal(sun.shadow(post, { altitude: -1, azimuth: 0 }, 0, 6), null);
  assert.equal(sun.shadow({ ...post, deciduous: true }, { altitude: 30, azimuth: 180 }, 0, 12), null);
});

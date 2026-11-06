// Sun hours on the garden map: where the sun is (NOAA solar position
// formulas, good to a fraction of a degree), which obstacles shade a point,
// and the shadow an obstacle casts. Pure logic, no React Native imports, so it
// runs under `node --test` (see sun.test.ts). Map coordinates as in map.ts:
// x right, y down the screen, angles clockwise from map up; `north` is where
// north points on the map, clockwise from map up.
import { corners, rotate, toLocal, type Point } from './map.ts';
import type { Obstacle, Sun, ZoneShape } from './types';

export interface Place {
  /** Degrees, north positive. */
  lat: number;
  /** Degrees, east positive. */
  lon: number;
}

export interface SunPosition {
  /** Degrees above the horizon; negative at night. */
  altitude: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod = (v: number, n: number) => ((v % n) + n) % n;

/** Where the sun is at the moment, seen from the place. Refraction is left out. */
export function sunPosition(at: Date | number, place: Place): SunPosition {
  const ms = typeof at === 'number' ? at : at.getTime();
  const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) +
    Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eot =
    4 *
    deg(
      y * Math.sin(2 * rad(L0)) -
        2 * e * Math.sin(rad(M)) +
        4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) -
        0.5 * y * y * Math.sin(4 * rad(L0)) -
        1.25 * e * e * Math.sin(2 * rad(M)),
    );
  const minutes = mod(ms, 86400000) / 60000;
  const solar = mod(minutes + eot + 4 * place.lon, 1440);
  const ha = rad(solar / 4 - 180);
  const lat = rad(place.lat);
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const altitude = 90 - deg(Math.acos(Math.max(-1, Math.min(1, cosZ))));
  const azimuth = mod(deg(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat))) + 180, 360);
  return { altitude, azimuth };
}

/** Months a tree that loses its leaves lets the light through: November to March. */
export const LEAFLESS = [11, 12, 1, 2, 3];

/** Whether the obstacle casts shade in the month (1-12). */
export const shadesIn = (o: Pick<Obstacle, 'deciduous'>, month: number) => !o.deciduous || !LEAFLESS.includes(month);

/** Map direction (unit vector) towards the sun's azimuth. */
export function towards(azimuth: number, north: number): Point {
  return rotate({ x: 0, y: -1 }, north + azimuth);
}

/**
 * How far along the ray from p in direction d (unit) it enters the shape;
 * 0 when p is inside, null when it misses.
 */
export function entry(s: ZoneShape, p: Point, d: Point): number | null {
  if (s.kind === 'circle') {
    const r = s.width / 2;
    const f = { x: p.x - s.x, y: p.y - s.y };
    const b = f.x * d.x + f.y * d.y;
    const c = f.x * f.x + f.y * f.y - r * r;
    if (c <= 0) return 0;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : null;
  }
  const lp = toLocal(s, p);
  const ld = rotate(d, -s.rotation);
  let lo = 0;
  let hi = Infinity;
  for (const [o, v, half] of [
    [lp.x, ld.x, s.width / 2],
    [lp.y, ld.y, s.length / 2],
  ]) {
    if (Math.abs(v) < 1e-12) {
      if (o < -half || o > half) return null;
      continue;
    }
    const a = (-half - o) / v;
    const b = (half - o) / v;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return null;
  }
  return lo;
}

/**
 * Whether some obstacle stands between the point and the sun. An obstacle is
 * a block of its height: it shades p when the line to the sun enters it below
 * the top. A point inside an obstacle (under a tree's crown) is in its shade.
 */
export function shaded(p: Point, obstacles: Obstacle[], sun: SunPosition, north: number, month: number): boolean {
  if (sun.altitude <= 0) return true;
  const d = towards(sun.azimuth, north);
  const rise = Math.tan(rad(sun.altitude));
  return obstacles.some((o) => {
    if (o.height <= 0 || !shadesIn(o, month)) return false;
    const t = entry(o.shape, p, d);
    return t !== null && t * rise < o.height;
  });
}

/** The sun is checked every 15 minutes. */
export const SAMPLE_MINUTES = 15;

/** The typical day of the month (1-12): the 15th, at the place's solar midnight (ms). */
export function dayStart(year: number, month: number, place: Place): number {
  return Date.UTC(year, month - 1, 15, 0) - (place.lon / 15) * 3600000;
}

/** The moments of the month's typical day, every 15 minutes, middle of each slot. */
export function samples(year: number, month: number, place: Place): number[] {
  const start = dayStart(year, month, place);
  const n = (24 * 60) / SAMPLE_MINUTES;
  return Array.from({ length: n }, (_, k) => start + (k + 0.5) * SAMPLE_MINUTES * 60000);
}

/** Hours of direct sun the point gets on the month's typical day. */
export function sunHours(p: Point, obstacles: Obstacle[], place: Place, north: number, year: number, month: number): number {
  let n = 0;
  for (const at of samples(year, month, place)) if (!shaded(p, obstacles, sunPosition(at, place), north, month)) n++;
  return (n * SAMPLE_MINUTES) / 60;
}

/** Hours of direct sun for each month, January first. */
export function yearSunHours(p: Point, obstacles: Obstacle[], place: Place, north: number, year: number): number[] {
  return Array.from({ length: 12 }, (_, i) => sunHours(p, obstacles, place, north, year, i + 1));
}

/** Hours of daylight on the month's typical day, nothing in the way. */
export function dayLength(place: Place, year: number, month: number): number {
  return sunHours({ x: 0, y: 0 }, [], place, 0, year, month);
}

/** The months the zone's exposure is the average of: April to September. */
export const SEASON = [4, 5, 6, 7, 8, 9];

/** 6 hours or more is full sun, 3 to 6 part shade, under 3 shade. */
export function sunFromHours(h: number): Sun {
  return h >= 6 ? 'full' : h >= 3 ? 'partial' : 'shade';
}

/** The season's average hours and the exposure they make. */
export function exposure(hours: number[]): { average: number; sun: Sun } {
  const average = SEASON.reduce((s, m) => s + hours[m - 1], 0) / SEASON.length;
  return { average, sun: sunFromHours(average) };
}

/** First and last moment of the typical day with the sun up, or null when it never rises. */
export function daylight(place: Place, year: number, month: number): { rise: number; set: number } | null {
  const up = samples(year, month, place).filter((at) => sunPosition(at, place).altitude > 0);
  if (up.length === 0) return null;
  const half = (SAMPLE_MINUTES / 2) * 60000;
  return { rise: up[0] - half, set: up[up.length - 1] + half };
}

/** Longest shadow drawn, in metres: the sun just over the horizon makes them endless. */
const MAX_SHADOW = 60;

/** Convex hull, counter-clockwise (monotone chain). */
export function hull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** The shape's outline as points; a circle as a 32-sided polygon. */
export function outline(s: ZoneShape): Point[] {
  if (s.kind === 'rect') return corners(s);
  const r = s.width / 2;
  return Array.from({ length: 32 }, (_, i) => ({ x: s.x + r * Math.cos((i * Math.PI) / 16), y: s.y + r * Math.sin((i * Math.PI) / 16) }));
}

/**
 * The ground the obstacle shades at that moment: its footprint swept away
 * from the sun by the length of its shadow. Null at night, or when it casts
 * none (no height, a bare tree in winter).
 */
export function shadow(o: Obstacle, sun: SunPosition, north: number, month: number): Point[] | null {
  if (sun.altitude <= 0 || o.height <= 0 || !shadesIn(o, month)) return null;
  const len = Math.min(MAX_SHADOW, o.height / Math.tan(rad(sun.altitude)));
  const d = towards(sun.azimuth, north);
  const base = outline(o.shape);
  return hull([...base, ...base.map((p) => ({ x: p.x - d.x * len, y: p.y - d.y * len }))]);
}

// Garden map geometry, in metres. Pure logic, no React Native imports, so it
// runs under `node --test` (see map.test.ts). Map coordinates: x to the
// right, y down the screen; angles in degrees clockwise from map up.
import { sunMismatch } from './schedule.ts';
import type { DayString, Plant, Task, Zone, ZoneShape } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Measures are kept to 10 cm, angles to 5 degrees. */
export const STEP = 0.1;
export const ANGLE_STEP = 5;
/** The smallest side a shape can have. */
export const MIN_SIDE = 0.2;

const round = (v: number, step: number) => Math.round(Math.round(v / step) * step * 1000) / 1000 + 0;
export const snap = (v: number) => round(v, STEP);
export const snapAngle = (deg: number) => ((round(deg, ANGLE_STEP) % 360) + 360) % 360;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Turns a vector clockwise (on screen, y down) by deg. */
export function rotate(p: Point, deg: number): Point {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** From shape-local coordinates (centre at 0, unrotated) to the map. */
export function toMap(s: ZoneShape, local: Point): Point {
  const r = rotate(local, s.rotation);
  return { x: s.x + r.x, y: s.y + r.y };
}

/** From the map to shape-local coordinates. */
export function toLocal(s: ZoneShape, p: Point): Point {
  return rotate({ x: p.x - s.x, y: p.y - s.y }, -s.rotation);
}

/** A rectangle's corners, clockwise from top left. */
export function corners(s: ZoneShape): Point[] {
  const w = s.width / 2;
  const l = s.length / 2;
  return [
    { x: -w, y: -l },
    { x: w, y: -l },
    { x: w, y: l },
    { x: -w, y: l },
  ].map((c) => toMap(s, c));
}

/** Whether the point is inside the shape, or within `pad` metres of it. */
export function contains(s: ZoneShape, p: Point, pad = 0): boolean {
  if (s.kind === 'circle') return Math.hypot(p.x - s.x, p.y - s.y) <= s.width / 2 + pad;
  const l = toLocal(s, p);
  return Math.abs(l.x) <= s.width / 2 + pad && Math.abs(l.y) <= s.length / 2 + pad;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(shapes: ZoneShape[]): Bounds | null {
  if (shapes.length === 0) return null;
  const pts = shapes.flatMap((s) =>
    s.kind === 'circle'
      ? [
          { x: s.x - s.width / 2, y: s.y - s.width / 2 },
          { x: s.x + s.width / 2, y: s.y + s.width / 2 },
        ]
      : corners(s),
  );
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

/**
 * The zone on top under the point: the last drawn, which is the smallest.
 * When none is right under it, one within `pad` metres, so a thin hedge
 * can still be touched with a finger.
 */
export function hit(zones: { id: number; shape: ZoneShape }[], p: Point, pad = 0): number | null {
  for (let i = zones.length - 1; i >= 0; i--) if (contains(zones[i].shape, p)) return zones[i].id;
  if (pad > 0) for (let i = zones.length - 1; i >= 0; i--) if (contains(zones[i].shape, p, pad)) return zones[i].id;
  return null;
}

/** Smaller shapes on top, so a pot inside a bed can still be touched. */
export function drawOrder<T extends { shape: ZoneShape }>(zones: T[]): T[] {
  const area = (s: ZoneShape) => (s.kind === 'circle' ? (Math.PI * s.width * s.width) / 4 : s.width * s.length);
  return [...zones].sort((a, b) => area(b.shape) - area(a.shape));
}

export function move(s: ZoneShape, dx: number, dy: number): ZoneShape {
  return { ...s, x: snap(s.x + dx), y: snap(s.y + dy) };
}

/**
 * Where a rectangle's resize handle sits (bottom right corner) and a
 * circle's (right edge).
 */
export function resizeHandle(s: ZoneShape): Point {
  return s.kind === 'circle' ? { x: s.x + s.width / 2, y: s.y } : toMap(s, { x: s.width / 2, y: s.length / 2 });
}

/** Where the rotate handle sits: above the top edge, by `gap` metres. */
export function rotateHandle(s: ZoneShape, gap: number): Point {
  return toMap(s, { x: 0, y: -s.length / 2 - gap });
}

/**
 * Resizes from the bottom right corner to the point, the top left corner
 * staying where it was. Dragging past it flips the shape instead of going
 * below the minimum. A circle grows from its centre.
 */
export function resize(start: ZoneShape, p: Point): ZoneShape {
  if (start.kind === 'circle') {
    const d = Math.max(MIN_SIDE, snap(2 * Math.hypot(p.x - start.x, p.y - start.y)));
    return { ...start, width: d, length: d };
  }
  const fixed = toMap(start, { x: -start.width / 2, y: -start.length / 2 });
  const v = rotate({ x: p.x - fixed.x, y: p.y - fixed.y }, -start.rotation);
  const width = Math.max(MIN_SIDE, snap(Math.abs(v.x)));
  const length = Math.max(MIN_SIDE, snap(Math.abs(v.y)));
  const half = rotate({ x: (Math.sign(v.x || 1) * width) / 2, y: (Math.sign(v.y || 1) * length) / 2 }, start.rotation);
  return { ...start, width, length, x: snap(fixed.x + half.x), y: snap(fixed.y + half.y) };
}

/** Angle, clockwise from map up, of the point seen from the centre. */
export function angleTo(centre: Point, p: Point): number {
  return (Math.atan2(p.x - centre.x, -(p.y - centre.y)) * 180) / Math.PI;
}

/** Turns a rectangle so its top faces the point. */
export function turnTowards(s: ZoneShape, p: Point): ZoneShape {
  if (s.kind === 'circle') return s;
  return { ...s, rotation: snapAngle(angleTo(s, p)) };
}

/** Changes rectangle into circle and back, keeping the centre and the width. */
export function withKind(s: ZoneShape, kind: ZoneShape['kind']): ZoneShape {
  if (kind === s.kind) return s;
  if (kind === 'circle') return { ...s, kind, length: s.width, rotation: 0 };
  return { ...s, kind, length: snap(Math.max(MIN_SIDE, s.width / 2)) };
}

export const NEW_SHAPE = { width: 2, length: 1 };

/** A new 2 x 1 m bed at the point, snapped. */
export function shapeAt(p: Point, kind: ZoneShape['kind'] = 'rect'): ZoneShape {
  const s: ZoneShape = { kind: 'rect', x: snap(p.x), y: snap(p.y), width: NEW_SHAPE.width, length: NEW_SHAPE.length, rotation: 0 };
  return withKind(s, kind);
}

/** A free spot for a shape given from the zone form: right of what's drawn, 1 m apart. */
export function freeSpot(shapes: ZoneShape[], width: number, length: number): Point {
  const b = bounds(shapes);
  if (!b) return { x: 0, y: 0 };
  return { x: snap(b.maxX + 1 + width / 2), y: snap(b.minY + length / 2) };
}

// --- View: from metres to screen points ---------------------------------------

export interface View {
  /** Screen points per metre. */
  scale: number;
  /** The map point at the top left of the screen. */
  originX: number;
  originY: number;
}

export const MIN_SCALE = 8;
export const MAX_SCALE = 400;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export const toScreen = (v: View, p: Point): Point => ({ x: (p.x - v.originX) * v.scale, y: (p.y - v.originY) * v.scale });
export const fromScreen = (v: View, p: Point): Point => ({ x: p.x / v.scale + v.originX, y: p.y / v.scale + v.originY });

/** Everything drawn fits the screen, clear of the compass and the zoom buttons; an empty map shows about 8 m around 0. */
export function fitView(shapes: ZoneShape[], width: number, height: number, margin = 64): View {
  const b = bounds(shapes) ?? { minX: -4, minY: -4, maxX: 4, maxY: 4 };
  const w = Math.max(b.maxX - b.minX, 2);
  const h = Math.max(b.maxY - b.minY, 2);
  const scale = clampScale(Math.min((width - 2 * margin) / w, (height - 2 * margin) / h));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { scale, originX: cx - width / 2 / scale, originY: cy - height / 2 / scale };
}

/** Zooms by factor keeping the screen point `at` over the same map point. */
export function zoom(v: View, factor: number, at: Point): View {
  const scale = clampScale(v.scale * factor);
  const m = fromScreen(v, at);
  return { scale, originX: m.x - at.x / scale, originY: m.y - at.y / scale };
}

export function pan(v: View, dx: number, dy: number): View {
  return { ...v, originX: v.originX - dx / v.scale, originY: v.originY - dy / v.scale };
}

/** Grid spacing in metres: lines at least about 24 points apart. */
export function gridStep(scale: number): number {
  for (const step of [0.5, 1, 2, 5, 10, 20, 50]) if (step * scale >= 24) return step;
  return 100;
}

// --- What each zone shows --------------------------------------------------

export interface ZoneStats {
  plants: number;
  /** Some task is due today or late. */
  due: boolean;
  /** Some plant wants more or less sun than the zone gets. */
  mismatch: boolean;
}

export function zoneStats(
  zones: Zone[],
  plants: Pick<Plant, 'id' | 'zoneId' | 'sun' | 'archivedOn'>[],
  tasks: Pick<Task, 'plantId' | 'dueOn'>[],
  day: DayString,
): Map<number, ZoneStats> {
  const out = new Map<number, ZoneStats>(zones.map((z) => [z.id, { plants: 0, due: false, mismatch: false }]));
  const zoneOf = new Map<number, Zone>();
  for (const p of plants) {
    if (p.archivedOn || p.zoneId === null) continue;
    const z = zones.find((x) => x.id === p.zoneId);
    if (!z) continue;
    zoneOf.set(p.id, z);
    const s = out.get(z.id)!;
    s.plants++;
    if (sunMismatch(p.sun, z.sun)) s.mismatch = true;
  }
  for (const t of tasks) {
    const z = t.plantId === null ? undefined : zoneOf.get(t.plantId);
    if (z && t.dueOn <= day) out.get(z.id)!.due = true;
  }
  return out;
}

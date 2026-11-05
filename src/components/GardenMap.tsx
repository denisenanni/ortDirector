// The garden map: zones and obstacles drawn in metres on a grid, the north
// arrow, pan and zoom with one or two fingers, in edit mode moving, resizing
// and turning a shape, and in sun mode the zones coloured by their hours of
// sun with the obstacles' shadows. All geometry is in src/lib/map.ts and
// src/lib/sun.ts; this file only draws and turns touches into map points.
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, useColorScheme, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { IconButton, useTheme } from '@/components/ui';
import { tr } from '@/lib/i18n';
import * as m from '@/lib/map';
import { sunFromHours } from '@/lib/sun';
import type { Obstacle, Zone, ZoneShape } from '@/lib/types';

export type MapZone = Zone & { shape: ZoneShape };

/** What the map shows: plants and what's due, the drawing, or the sun. */
export type MapMode = 'view' | 'edit' | 'sun';

/** Zones and obstacles share the map: their keys are `z<id>` and `o<id>`. */
export const zoneKey = (id: number) => `z${id}`;
export const obstacleKey = (id: number) => `o${id}`;
export function parseKey(key: string): { kind: 'zone' | 'obstacle'; id: number } {
  return { kind: key[0] === 'o' ? 'obstacle' : 'zone', id: Number(key.slice(1)) };
}

/** Sun mode: the hours each zone gets in the month, the shadows at the hour, where the sun is. */
export interface SunView {
  hours: Map<number, number>;
  shadows: m.Point[][];
  /** Degrees clockwise from true north; null at night. */
  azimuth: number | null;
}

type Item = { id: string; shape: ZoneShape } & ({ zone: MapZone; obstacle?: undefined } | { obstacle: Obstacle; zone?: undefined });

const HANDLE = 9;
const GRAB = 24; // how near a handle a finger must land, in points
const TAP = 6; // a touch that moves less than this is a tap
const NEAR = 12; // a tap this close to a zone still touches it, in points
const COMPASS = { r: 22, margin: 14 };
const ROTATE_GAP = 26; // rotate handle above the top edge, in points

type Gesture =
  | { kind: 'pan'; view: m.View; start: m.Point; moved: boolean }
  | { kind: 'pinch'; view: m.View; d0: number; mid0: m.Point }
  | { kind: 'move' | 'resize' | 'rotate'; id: string; shape: ZoneShape; start: m.Point; moved: boolean; view: m.View }
  | { kind: 'north'; moved: boolean };

export function GardenMap({
  zones,
  obstacles,
  stats,
  north,
  mode,
  sun,
  selected,
  onSelect,
  onOpen,
  onShape,
  onNorth,
  onView,
}: {
  zones: MapZone[];
  obstacles: Obstacle[];
  stats: Map<number, m.ZoneStats>;
  north: number;
  mode: MapMode;
  sun?: SunView | null;
  /** Keys made with zoneKey and obstacleKey. */
  selected: string | null;
  onSelect: (key: string | null) => void;
  onOpen: (key: string) => void;
  /** A drag ended: save the shape. */
  onShape: (key: string, shape: ZoneShape) => void;
  onNorth: (degrees: number) => void;
  /** The view and screen size, to place a new zone in the middle of what's visible. */
  onView?: (view: m.View, width: number, height: number) => void;
}) {
  const t = useTheme();
  const editing = mode === 'edit';
  const dark = useColorScheme() === 'dark';
  const [size, setSize] = useState({ width: 0, height: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const [view, setView] = useState<m.View | null>(null);
  // The shape and north while a finger drags them, before they're saved.
  const [draft, setDraftState] = useState<{ id: string; shape: ZoneShape } | null>(null);
  const [northDraft, setNorthState] = useState<number | null>(null);
  // The same drafts, read when the finger lifts.
  const drafts = useRef<{ shape: { id: string; shape: ZoneShape } | null; north: number | null }>({ shape: null, north: null });
  const setDraft = (d: { id: string; shape: ZoneShape } | null) => {
    drafts.current.shape = d;
    setDraftState(d);
  };
  const setNorthDraft = (d: number | null) => {
    drafts.current.north = d;
    setNorthState(d);
  };
  const gesture = useRef<Gesture | null>(null);

  // One list, biggest first, so the smallest shape under a finger wins.
  const drawn = useMemo(() => {
    const items: Item[] = [
      ...zones.map((z) => ({ id: zoneKey(z.id), shape: z.shape, zone: z })),
      ...obstacles.map((o) => ({ id: obstacleKey(o.id), shape: o.shape, obstacle: o })),
    ];
    return m.drawOrder(items.map((i) => (draft && draft.id === i.id ? ({ ...i, shape: draft.shape } as Item) : i)));
  }, [zones, obstacles, draft]);
  const all = useMemo(() => [...zones.map((z) => z.shape), ...obstacles.map((o) => o.shape)], [zones, obstacles]);

  // The view fits what's drawn until the fingers or the zoom buttons move it,
  // then it stays where they left it.
  const touched = useRef(false);
  const ids = [...zones.map((z) => zoneKey(z.id)), ...obstacles.map((o) => obstacleKey(o.id))].join(',');
  useEffect(() => {
    if (size.width > 0 && (!touched.current || !view)) setView(m.fitView(all, size.width, size.height));
    // Refit only when zones come or go, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, ids]);
  useEffect(() => {
    if (view) onView?.(view, size.width, size.height);
  }, [view, size, onView]);

  // Everything the responder reads, fresh on every touch.
  const live = useRef({ view, drawn, editing, selected, size, north, onSelect, onOpen, onShape, onNorth });
  live.current = { view, drawn, editing, selected, size, north, onSelect, onOpen, onShape, onNorth };

  const compass = { x: size.width - COMPASS.margin - COMPASS.r, y: COMPASS.margin + COMPASS.r };

  const responder = useMemo(() => {
    const points = (e: GestureResponderEvent): m.Point[] => {
      const touches = e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent];
      return touches.map((p) => ({ x: p.pageX - offset.current.x, y: p.pageY - offset.current.y }));
    };
    const near = (a: m.Point, b: m.Point) => Math.hypot(a.x - b.x, a.y - b.y) <= GRAB;

    const begin = (e: GestureResponderEvent) => {
      const { view: v, drawn: zs, editing: edit, selected: sel, size: sz } = live.current;
      if (!v) return;
      const pts = points(e);
      if (pts.length >= 2) {
        const [a, b] = pts;
        gesture.current = { kind: 'pinch', view: v, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        return;
      }
      const p = pts[0];
      if (edit) {
        const c = { x: sz.width - COMPASS.margin - COMPASS.r, y: COMPASS.margin + COMPASS.r };
        if (Math.hypot(p.x - c.x, p.y - c.y) <= COMPASS.r + 6) {
          gesture.current = { kind: 'north', moved: false };
          return;
        }
        const current = zs.find((z) => z.id === sel);
        if (current) {
          const s = current.shape;
          if (near(p, m.toScreen(v, m.resizeHandle(s)))) {
            gesture.current = { kind: 'resize', id: current.id, shape: s, start: m.fromScreen(v, p), moved: false, view: v };
            return;
          }
          if (s.kind === 'rect' && near(p, m.toScreen(v, m.rotateHandle(s, ROTATE_GAP / v.scale)))) {
            gesture.current = { kind: 'rotate', id: current.id, shape: s, start: m.fromScreen(v, p), moved: false, view: v };
            return;
          }
        }
        const id = m.hit(zs, m.fromScreen(v, p), NEAR / v.scale);
        if (id !== null) {
          const z = zs.find((x) => x.id === id)!;
          live.current.onSelect(id);
          gesture.current = { kind: 'move', id, shape: z.shape, start: m.fromScreen(v, p), moved: false, view: v };
          return;
        }
      }
      gesture.current = { kind: 'pan', view: v, start: p, moved: false };
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        // The drawing lets touches through, so the touch lands on the box itself:
        // its location inside the box gives where the box is on the page.
        const n = e.nativeEvent;
        offset.current = { x: n.pageX - n.locationX, y: n.pageY - n.locationY };
        begin(e);
      },
      onPanResponderMove: (e, g) => {
        const pts = points(e);
        let cur = gesture.current;
        if (!cur) return;
        // A second finger turns any drag into a pinch.
        if (pts.length >= 2 && cur.kind !== 'pinch') {
          if (cur.kind !== 'pan' && cur.kind !== 'north') commit();
          begin(e);
          cur = gesture.current!;
        }
        const moved = Math.hypot(g.dx, g.dy) > TAP;
        switch (cur.kind) {
          case 'pinch': {
            touched.current = true;
            if (pts.length < 2) return;
            const [a, b] = pts;
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            setView(m.pan(m.zoom(cur.view, d / cur.d0, cur.mid0), mid.x - cur.mid0.x, mid.y - cur.mid0.y));
            return;
          }
          case 'pan':
            cur.moved ||= moved;
            if (cur.moved) touched.current = true;
            setView(m.pan(cur.view, g.dx, g.dy));
            return;
          case 'north': {
            cur.moved = true;
            const c = { x: live.current.size.width - COMPASS.margin - COMPASS.r, y: COMPASS.margin + COMPASS.r };
            setNorthDraft(m.snapAngle(m.angleTo(c, pts[0])));
            return;
          }
          default: {
            cur.moved ||= moved;
            if (!cur.moved) return;
            const p = m.fromScreen(cur.view, pts[0]);
            const shape =
              cur.kind === 'move'
                ? m.move(cur.shape, p.x - cur.start.x, p.y - cur.start.y)
                : cur.kind === 'resize'
                  ? m.resize(cur.shape, p)
                  : m.turnTowards(cur.shape, p);
            setDraft({ id: cur.id, shape });
          }
        }
      },
      onPanResponderRelease: (e) => {
        const cur = gesture.current;
        if (cur?.kind === 'pan' && !cur.moved) {
          const { view: v, drawn: zs, editing: edit } = live.current;
          const id = v ? m.hit(zs, m.fromScreen(v, points(e)[0]), NEAR / v.scale) : null;
          if (edit) live.current.onSelect(null);
          else if (id !== null) live.current.onOpen(id);
        }
        commit();
      },
      onPanResponderTerminate: () => commit(),
    });

    function commit() {
      const cur = gesture.current;
      gesture.current = null;
      if (!cur) return;
      if (cur.kind === 'north') {
        const d = drafts.current.north;
        if (d !== null) live.current.onNorth(d);
        setNorthDraft(null);
        return;
      }
      if (cur.kind === 'pan' || cur.kind === 'pinch' || !cur.moved) return;
      // The draft stays drawn until the saved zones come back.
      const d = drafts.current.shape;
      if (d) live.current.onShape(d.id, d.shape);
    }
  }, []);

  // Keep the dragged shape on screen until the saved one comes back.
  useEffect(() => {
    if (!gesture.current) setDraft(null);
  }, [zones, obstacles]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const zoomBy = (f: number) => {
    touched.current = true;
    if (view) setView(m.zoom(view, f, { x: size.width / 2, y: size.height / 2 }));
  };
  const fit = () => {
    touched.current = false;
    if (size.width > 0) setView(m.fitView(all, size.width, size.height));
  };

  const renderItem = (i: Item) =>
    i.zone ? (
      <ZoneShapeView
        key={i.id}
        zone={{ ...i.zone, shape: i.shape }}
        view={view!}
        stats={stats.get(i.zone.id)}
        selected={editing && i.id === selected}
        mode={mode}
        hours={sun?.hours.get(i.zone.id)}
      />
    ) : (
      <ObstacleView key={i.id} obstacle={{ ...i.obstacle!, shape: i.shape }} view={view!} selected={editing && i.id === selected} editing={editing} />
    );

  return (
    <View style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={StyleSheet.absoluteFill} onLayout={onLayout} {...responder.panHandlers}>
        {view && size.width > 0 ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={size.width} height={size.height}>
              <Grid view={view} width={size.width} height={size.height} color={t.border} />
              {(mode === 'sun' ? drawn.filter((i) => i.zone) : drawn).map((i) => renderItem(i))}
              {mode === 'sun' && sun
                ? sun.shadows.map((poly, k) => (
                    <Polygon key={`shadow${k}`} points={poly.map((p) => { const q = m.toScreen(view, p); return `${q.x},${q.y}`; }).join(' ')} fill="#000" fillOpacity={dark ? 0.4 : 0.14} />
                  ))
                : null}
              {mode === 'sun' ? drawn.filter((i) => i.obstacle).map((i) => renderItem(i)) : null}
              <Compass x={compass.x} y={compass.y} degrees={northDraft ?? north} editing={editing} sun={mode === 'sun' && sun?.azimuth != null ? (northDraft ?? north) + sun.azimuth : null} />
              <ScaleBar view={view} height={size.height} />
            </Svg>
          </View>
        ) : null}
      </View>
      <View style={styles.zoom} pointerEvents="box-none">
        <IconButton icon="zoomIn" label={tr('Ingrandisci', 'Zoom in')} onPress={() => zoomBy(1.5)} />
        <IconButton icon="zoomOut" label={tr('Rimpicciolisci', 'Zoom out')} onPress={() => zoomBy(1 / 1.5)} />
        <IconButton icon="fit" label={tr('Mostra tutto', 'Show all')} onPress={fit} />
      </View>
    </View>
  );
}

function Grid({ view, width, height, color }: { view: m.View; width: number; height: number; color: string }) {
  const step = m.gridStep(view.scale);
  const tl = m.fromScreen(view, { x: 0, y: 0 });
  const br = m.fromScreen(view, { x: width, y: height });
  const lines = [];
  for (let x = Math.ceil(tl.x / step) * step; x <= br.x; x += step) {
    const sx = (x - view.originX) * view.scale;
    const major = Math.abs(Math.round(x / (step * 5)) * step * 5 - x) < 1e-6;
    lines.push(<Line key={`x${x.toFixed(2)}`} x1={sx} y1={0} x2={sx} y2={height} stroke={color} strokeWidth={major ? 1.5 : 0.75} />);
  }
  for (let y = Math.ceil(tl.y / step) * step; y <= br.y; y += step) {
    const sy = (y - view.originY) * view.scale;
    const major = Math.abs(Math.round(y / (step * 5)) * step * 5 - y) < 1e-6;
    lines.push(<Line key={`y${y.toFixed(2)}`} x1={0} y1={sy} x2={width} y2={sy} stroke={color} strokeWidth={major ? 1.5 : 0.75} />);
  }
  return <G>{lines}</G>;
}

function plantsLabel(n: number) {
  return n === 1 ? tr('1 pianta', '1 plant') : tr(`${n} piante`, `${n} plants`);
}

/** Colour of a zone in sun mode: amber for full sun, paler for part shade, grey for shade. */
function sunFill(t: ReturnType<typeof useTheme>, hours: number | undefined) {
  if (hours === undefined) return { fill: t.accentSoft, fillOpacity: 0.85 };
  const sun = sunFromHours(hours);
  return sun === 'full' ? { fill: t.sun, fillOpacity: 0.5 } : sun === 'partial' ? { fill: t.sun, fillOpacity: 0.22 } : { fill: t.muted, fillOpacity: 0.3 };
}

function Outline({ s, view, ...style }: { s: ZoneShape; view: m.View } & Record<string, unknown>) {
  const c = m.toScreen(view, s);
  return s.kind === 'circle' ? (
    <Circle cx={c.x} cy={c.y} r={(s.width / 2) * view.scale} {...style} />
  ) : (
    <Polygon points={m.corners(s).map((p) => { const q = m.toScreen(view, p); return `${q.x},${q.y}`; }).join(' ')} {...style} />
  );
}

/** Resize corner, and for rectangles the turn handle above the top edge. */
function Handles({ s, view }: { s: ZoneShape; view: m.View }) {
  const t = useTheme();
  const r = m.toScreen(view, m.resizeHandle(s));
  const top = m.toScreen(view, m.toMap(s, { x: 0, y: -s.length / 2 }));
  const rot = m.toScreen(view, m.rotateHandle(s, ROTATE_GAP / view.scale));
  return (
    <G>
      <Circle cx={r.x} cy={r.y} r={HANDLE} fill={t.card} stroke={t.text} strokeWidth={2} />
      {s.kind === 'rect' ? (
        <>
          <Line x1={top.x} y1={top.y} x2={rot.x} y2={rot.y} stroke={t.text} strokeWidth={1.5} />
          <Circle cx={rot.x} cy={rot.y} r={HANDLE} fill={t.text} />
        </>
      ) : null}
    </G>
  );
}

/** Where a shape's name goes: inside when it fits, else under it. */
function labelSpot(s: ZoneShape, view: m.View, name: string): m.Point {
  const c = m.toScreen(view, s);
  const nameWidth = name.length * 7.5;
  const minSide = Math.min(s.width, s.length) * view.scale;
  const maxSide = Math.max(s.width, s.length) * view.scale;
  const fits = minSide >= 40 && nameWidth + 8 <= (s.kind === 'circle' ? minSide : maxSide);
  const box = m.bounds([s])!;
  return fits ? { x: c.x, y: c.y } : { x: c.x, y: (box.maxY - view.originY) * view.scale + 16 };
}

function ZoneShapeView({
  zone,
  view,
  stats,
  selected,
  mode,
  hours,
}: {
  zone: MapZone;
  view: m.View;
  stats?: m.ZoneStats;
  selected: boolean;
  mode: MapMode;
  hours?: number;
}) {
  const t = useTheme();
  const s = zone.shape;
  const editing = mode === 'edit';
  const stroke = stats?.mismatch && mode === 'view' ? t.warn : mode === 'sun' ? t.sun : t.accent;
  const common = {
    ...(mode === 'sun' ? sunFill(t, hours) : { fill: t.accentSoft, fillOpacity: 0.85 }),
    stroke: selected ? t.text : stroke,
    strokeWidth: selected ? 3 : stats?.mismatch && mode === 'view' ? 2.5 : 1.5,
    strokeDasharray: zone.covered ? '6 4' : undefined,
  };
  // Something due: a dot on the top right of the outline.
  const dot = m.toScreen(
    view,
    s.kind === 'circle' ? { x: s.x + (s.width / 2) * Math.SQRT1_2, y: s.y - (s.width / 2) * Math.SQRT1_2 } : m.toMap(s, { x: s.width / 2, y: -s.length / 2 }),
  );
  const label = labelSpot(s, view, zone.name);
  const detail = editing ? measures(s) : mode === 'sun' ? (hours === undefined ? '' : hoursLabel(hours)) : plantsLabel(stats?.plants ?? 0);
  return (
    <G>
      <Outline s={s} view={view} {...common} />
      <Label x={label.x} y={label.y} size={13} bold color={t.text} halo={t.card}>
        {zone.name}
      </Label>
      {detail ? (
        <Label x={label.x} y={label.y + 16} size={11} color={t.muted} halo={t.card}>
          {detail}
        </Label>
      ) : null}
      {mode === 'view' && stats?.due ? <Circle cx={dot.x} cy={dot.y} r={5.5} fill={t.warn} stroke={t.card} strokeWidth={1.5} /> : null}
      {selected ? <Handles s={s} view={view} /> : null}
    </G>
  );
}

const measures = (s: ZoneShape) =>
  s.kind === 'circle' ? `⌀ ${fmt(s.width)} m` : `${fmt(s.width)} × ${fmt(s.length)} m${s.rotation ? ` · ${s.rotation}°` : ''}`;

export const hoursLabel = (h: number) => tr(`${fmt(h)} h di sole`, `${fmt(h)} h of sun`);

/** A house, wall or tree: grey, dashed when it loses its leaves, with its height. */
function ObstacleView({ obstacle, view, selected, editing }: { obstacle: Obstacle; view: m.View; selected: boolean; editing: boolean }) {
  const t = useTheme();
  const s = obstacle.shape;
  const label = labelSpot(s, view, obstacle.name);
  return (
    <G>
      <Outline
        s={s}
        view={view}
        fill={t.muted}
        fillOpacity={0.35}
        stroke={selected ? t.text : t.muted}
        strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={obstacle.deciduous ? '3 3' : undefined}
      />
      <Label x={label.x} y={label.y} size={12} bold color={t.text} halo={t.card}>
        {obstacle.name}
      </Label>
      <Label x={label.x} y={label.y + 15} size={11} color={t.muted} halo={t.card}>
        {editing ? `${measures(s)} · h ${fmt(obstacle.height)} m` : tr(`alto ${fmt(obstacle.height)} m`, `${fmt(obstacle.height)} m high`)}
      </Label>
      {selected ? <Handles s={s} view={view} /> : null}
    </G>
  );
}

/** Text with an outline in the background colour, readable over grid and shapes. */
function Label({ x, y, size, bold, color, halo, children }: { x: number; y: number; size: number; bold?: boolean; color: string; halo: string; children: string }) {
  const common = { x, y, fontSize: size, fontFamily: FONT, fontWeight: bold ? ('600' as const) : ('400' as const), textAnchor: 'middle' as const };
  return (
    <G>
      <SvgText {...common} fill={halo} stroke={halo} strokeWidth={3} strokeLinejoin="round">
        {children}
      </SvgText>
      <SvgText {...common} fill={color}>
        {children}
      </SvgText>
    </G>
  );
}

// The web's SVG default is a serif; the phones already draw in the system font.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** The north arrow; in sun mode a sun on its ring shows where the sun stands. */
function Compass({ x, y, degrees, editing, sun }: { x: number; y: number; degrees: number; editing: boolean; sun: number | null }) {
  const t = useTheme();
  const r = COMPASS.r;
  const at = sun === null ? null : m.rotate({ x: 0, y: -r }, sun);
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={t.card} stroke={editing ? t.accent : t.border} strokeWidth={editing ? 2 : 1} />
      {at ? <Circle cx={x + at.x} cy={y + at.y} r={6} fill={t.sun} stroke={t.card} strokeWidth={1.5} /> : null}
      <G rotation={degrees} origin={`${x}, ${y}`}>
        <Polygon points={`${x},${y - r + 4} ${x + 6},${y + 2} ${x - 6},${y + 2}`} fill={t.warn} />
        <Polygon points={`${x},${y + r - 6} ${x + 6},${y + 2} ${x - 6},${y + 2}`} fill={t.muted} />
        <SvgText x={x} y={y - r - 4} fontSize={11} fontFamily={FONT} fontWeight="700" fill={t.warn} textAnchor="middle">
          N
        </SvgText>
      </G>
    </G>
  );
}

/** A bar of one grid step, bottom left, so the size reads without counting squares. */
function ScaleBar({ view, height }: { view: m.View; height: number }) {
  const t = useTheme();
  const step = m.gridStep(view.scale) * (m.gridStep(view.scale) * view.scale < 48 ? 2 : 1);
  const w = step * view.scale;
  const y = height - 18;
  return (
    <G>
      <Rect x={12} y={y - 12} width={w + 16} height={22} rx={6} fill={t.card} fillOpacity={0.85} />
      <Line x1={20} y1={y} x2={20 + w} y2={y} stroke={t.text} strokeWidth={2} />
      <Line x1={20} y1={y - 4} x2={20} y2={y + 4} stroke={t.text} strokeWidth={2} />
      <Line x1={20 + w} y1={y - 4} x2={20 + w} y2={y + 4} stroke={t.text} strokeWidth={2} />
      <SvgText x={20 + w / 2} y={y - 4} fontSize={10} fontFamily={FONT} fill={t.text} textAnchor="middle">
        {`${fmt(step)} m`}
      </SvgText>
    </G>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  zoom: { position: 'absolute', right: 10, bottom: 10, gap: 8 },
});

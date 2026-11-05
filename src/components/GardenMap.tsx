// The garden map: zones drawn in metres on a grid, the north arrow, pan and
// zoom with one or two fingers, and in edit mode moving, resizing and turning
// a zone. All geometry is in src/lib/map.ts; this file only draws and turns
// touches into map points.
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { IconButton, useTheme } from '@/components/ui';
import { tr } from '@/lib/i18n';
import * as m from '@/lib/map';
import type { Zone, ZoneShape } from '@/lib/types';

export type MapZone = Zone & { shape: ZoneShape };

const HANDLE = 9;
const GRAB = 24; // how near a handle a finger must land, in points
const TAP = 6; // a touch that moves less than this is a tap
const NEAR = 12; // a tap this close to a zone still touches it, in points
const COMPASS = { r: 22, margin: 14 };
const ROTATE_GAP = 26; // rotate handle above the top edge, in points

type Gesture =
  | { kind: 'pan'; view: m.View; start: m.Point; moved: boolean }
  | { kind: 'pinch'; view: m.View; d0: number; mid0: m.Point }
  | { kind: 'move' | 'resize' | 'rotate'; id: number; shape: ZoneShape; start: m.Point; moved: boolean; view: m.View }
  | { kind: 'north'; moved: boolean };

export function GardenMap({
  zones,
  stats,
  north,
  editing,
  selected,
  onSelect,
  onOpen,
  onShape,
  onNorth,
  onView,
}: {
  zones: MapZone[];
  stats: Map<number, m.ZoneStats>;
  north: number;
  editing: boolean;
  selected: number | null;
  onSelect: (id: number | null) => void;
  onOpen: (id: number) => void;
  /** A drag ended: save the shape. */
  onShape: (id: number, shape: ZoneShape) => void;
  onNorth: (degrees: number) => void;
  /** The view and screen size, to place a new zone in the middle of what's visible. */
  onView?: (view: m.View, width: number, height: number) => void;
}) {
  const t = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const [view, setView] = useState<m.View | null>(null);
  // The shape and north while a finger drags them, before they're saved.
  const [draft, setDraftState] = useState<{ id: number; shape: ZoneShape } | null>(null);
  const [northDraft, setNorthState] = useState<number | null>(null);
  // The same drafts, read when the finger lifts.
  const drafts = useRef<{ shape: { id: number; shape: ZoneShape } | null; north: number | null }>({ shape: null, north: null });
  const setDraft = (d: { id: number; shape: ZoneShape } | null) => {
    drafts.current.shape = d;
    setDraftState(d);
  };
  const setNorthDraft = (d: number | null) => {
    drafts.current.north = d;
    setNorthState(d);
  };
  const gesture = useRef<Gesture | null>(null);

  const drawn = useMemo(
    () => m.drawOrder(zones.map((z) => (draft && draft.id === z.id ? { ...z, shape: draft.shape } : z))),
    [zones, draft],
  );

  // The view fits what's drawn until the fingers or the zoom buttons move it,
  // then it stays where they left it.
  const touched = useRef(false);
  const ids = zones.map((z) => z.id).join(',');
  useEffect(() => {
    if (size.width > 0 && (!touched.current || !view)) setView(m.fitView(zones.map((z) => z.shape), size.width, size.height));
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
  }, [zones]);

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
    if (size.width > 0) setView(m.fitView(zones.map((z) => z.shape), size.width, size.height));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={StyleSheet.absoluteFill} onLayout={onLayout} {...responder.panHandlers}>
        {view && size.width > 0 ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={size.width} height={size.height}>
              <Grid view={view} width={size.width} height={size.height} color={t.border} />
              {drawn.map((z) => (
                <ZoneShapeView
                  key={z.id}
                  zone={z}
                  view={view}
                  stats={stats.get(z.id)}
                  selected={editing && z.id === selected}
                  editing={editing}
                />
              ))}
              <Compass x={compass.x} y={compass.y} degrees={northDraft ?? north} editing={editing} />
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

function ZoneShapeView({
  zone,
  view,
  stats,
  selected,
  editing,
}: {
  zone: MapZone;
  view: m.View;
  stats?: m.ZoneStats;
  selected: boolean;
  editing: boolean;
}) {
  const t = useTheme();
  const s = zone.shape;
  const c = m.toScreen(view, s);
  const stroke = stats?.mismatch ? t.warn : t.accent;
  const common = {
    fill: t.accentSoft,
    fillOpacity: 0.85,
    stroke: selected ? t.text : stroke,
    strokeWidth: selected ? 3 : stats?.mismatch ? 2.5 : 1.5,
    strokeDasharray: zone.covered ? '6 4' : undefined,
  };
  const outline =
    s.kind === 'circle' ? (
      <Circle cx={c.x} cy={c.y} r={(s.width / 2) * view.scale} {...common} />
    ) : (
      <Polygon points={m.corners(s).map((p) => { const q = m.toScreen(view, p); return `${q.x},${q.y}`; }).join(' ')} {...common} />
    );
  const handles = [];
  if (selected) {
    const r = m.toScreen(view, m.resizeHandle(s));
    handles.push(<Circle key="resize" cx={r.x} cy={r.y} r={HANDLE} fill={t.card} stroke={t.text} strokeWidth={2} />);
    if (s.kind === 'rect') {
      const top = m.toScreen(view, m.toMap(s, { x: 0, y: -s.length / 2 }));
      const rot = m.toScreen(view, m.rotateHandle(s, ROTATE_GAP / view.scale));
      handles.push(
        <Line key="stem" x1={top.x} y1={top.y} x2={rot.x} y2={rot.y} stroke={t.text} strokeWidth={1.5} />,
        <Circle key="rotate" cx={rot.x} cy={rot.y} r={HANDLE} fill={t.text} />,
      );
    }
  }
  // The name goes inside when it fits, else under the shape.
  const nameWidth = zone.name.length * 7.5;
  const minSide = Math.min(s.width, s.length) * view.scale;
  const maxSide = Math.max(s.width, s.length) * view.scale;
  const fits = minSide >= 40 && nameWidth + 8 <= (s.kind === 'circle' ? minSide : maxSide);
  const box = m.bounds([s])!;
  // Something due: a dot on the top right of the outline.
  const dot = m.toScreen(
    view,
    s.kind === 'circle' ? { x: s.x + (s.width / 2) * Math.SQRT1_2, y: s.y - (s.width / 2) * Math.SQRT1_2 } : m.toMap(s, { x: s.width / 2, y: -s.length / 2 }),
  );
  const label = fits ? { x: c.x, y: c.y } : { x: c.x, y: (box.maxY - view.originY) * view.scale + 16 };
  const measures =
    s.kind === 'circle' ? `⌀ ${fmt(s.width)} m` : `${fmt(s.width)} × ${fmt(s.length)} m${s.rotation ? ` · ${s.rotation}°` : ''}`;
  return (
    <G>
      {outline}
      <Label x={label.x} y={label.y} size={13} bold color={t.text} halo={t.card}>
        {zone.name}
      </Label>
      <Label x={label.x} y={label.y + 16} size={11} color={t.muted} halo={t.card}>
        {editing ? measures : plantsLabel(stats?.plants ?? 0)}
      </Label>
      {!editing && stats?.due ? <Circle cx={dot.x} cy={dot.y} r={5.5} fill={t.warn} stroke={t.card} strokeWidth={1.5} /> : null}
      {handles}
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

function Compass({ x, y, degrees, editing }: { x: number; y: number; degrees: number; editing: boolean }) {
  const t = useTheme();
  const r = COMPASS.r;
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={t.card} stroke={editing ? t.accent : t.border} strokeWidth={editing ? 2 : 1} />
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

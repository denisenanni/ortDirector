import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GardenMap, parseKey, zoneKey, type MapMode, type MapZone, type SunView } from '@/components/GardenMap';
import { SUN_SYMBOL } from '@/components/Icon';
import { TimeSlider } from '@/components/TimeSlider';
import { Body, Button, Chip, ChipRow, IconButton, LargeHeader, Screen, useTheme } from '@/components/ui';
import {
  deleteObstacle,
  getNorth,
  getPlace,
  listObstacles,
  listOpenTasks,
  listPlants,
  listZones,
  setNorth,
  setObstacleShape,
  setZoneShape,
} from '@/lib/db';
import { confirm } from '@/lib/dialogs';
import { locale, tr } from '@/lib/i18n';
import * as m from '@/lib/map';
import { today } from '@/lib/schedule';
import { daylight, shadow, sunHours, sunPosition, type Place } from '@/lib/sun';
import type { Obstacle, Plant, TaskWithPlant, Zone, ZoneShape } from '@/lib/types';

interface Data {
  zones: Zone[];
  obstacles: Obstacle[];
  plants: Plant[];
  tasks: TaskWithPlant[];
  north: number;
  place: Place | null;
}

const monthName = (month: number) => new Date(2026, month - 1, 1).toLocaleDateString(locale(), { month: 'short' });
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutesOf = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

export default function MapScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<MapMode>('view');
  const [selected, setSelected] = useState<string | null>(null);
  const shown = useRef<{ view: m.View; width: number; height: number } | null>(null);
  // Sun mode: the month and the time of day (minutes, phone clock) the shadows are drawn for.
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [minutes, setMinutes] = useState(12 * 60);

  const load = useCallback(async () => {
    const [zones, obstacles, plants, tasks, north, place] = await Promise.all([
      listZones(db),
      listObstacles(db),
      listPlants(db),
      listOpenTasks(db),
      getNorth(db),
      getPlace(db),
    ]);
    setData({ zones, obstacles, plants, tasks, north, place });
  }, [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const stats = useMemo(
    () => (data ? m.zoneStats(data.zones, data.plants, data.tasks, today()) : new Map<number, m.ZoneStats>()),
    [data],
  );
  const onView = useCallback((view: m.View, width: number, height: number) => (shown.current = { view, width, height }), []);

  const year = new Date().getFullYear();
  const day = useMemo(() => (data?.place ? daylight(data.place, year, month) : null), [data?.place, year, month]);
  const range = day ? { from: Math.ceil(minutesOf(day.rise) / 15) * 15, to: Math.floor(minutesOf(day.set) / 15) * 15 } : null;
  // A new month can move sunrise past the chosen time: keep it inside the day.
  useEffect(() => {
    if (range && range.from <= range.to) setMinutes((v) => Math.min(range.to, Math.max(range.from, v)));
  }, [range?.from, range?.to]);

  const sun = useMemo<SunView | null>(() => {
    if (mode !== 'sun' || !data?.place) return null;
    const place = data.place;
    const hours = new Map<number, number>();
    for (const z of data.zones) if (z.shape) hours.set(z.id, sunHours(z.shape, data.obstacles, place, data.north, year, month));
    const at = new Date(year, month - 1, 15, Math.floor(minutes / 60), minutes % 60);
    const pos = sunPosition(at, place);
    const shadows = data.obstacles.map((o) => shadow(o, pos, data.north, month)).filter((p): p is m.Point[] => p !== null);
    return { hours, shadows, azimuth: pos.altitude > 0 ? pos.azimuth : null };
  }, [mode, data, year, month, minutes]);

  if (!data) return <Screen>{null}</Screen>;
  const onMap = data.zones.filter((z): z is MapZone => z.shape !== null);
  const offMap = data.zones.filter((z) => z.shape === null);
  const sel = selected ? parseKey(selected) : null;
  const current = sel?.kind === 'zone' ? (onMap.find((z) => z.id === sel.id) ?? null) : null;
  const obstacle = sel?.kind === 'obstacle' ? (data.obstacles.find((o) => o.id === sel.id) ?? null) : null;

  const saveZoneShape = async (id: number, shape: ZoneShape | null) => {
    // Show it at once, then write it.
    setData((d) => d && { ...d, zones: d.zones.map((z) => (z.id === id ? { ...z, shape } : z)) });
    await setZoneShape(db, id, shape);
  };
  const saveObstacleShape = async (id: number, shape: ZoneShape) => {
    setData((d) => d && { ...d, obstacles: d.obstacles.map((o) => (o.id === id ? { ...o, shape } : o)) });
    await setObstacleShape(db, id, shape);
  };
  const onShape = (key: string, shape: ZoneShape) => {
    const k = parseKey(key);
    return k.kind === 'zone' ? saveZoneShape(k.id, shape) : saveObstacleShape(k.id, shape);
  };

  const centre = () => {
    const v = shown.current;
    return v ? m.fromScreen(v.view, { x: v.width / 2, y: v.height / 2 }) : { x: 0, y: 0 };
  };
  const place = async (z: Zone) => {
    await saveZoneShape(z.id, m.shapeAt(centre()));
    setSelected(zoneKey(z.id));
  };
  const newObstacle = () => {
    const c = centre();
    router.push({ pathname: '/obstacle/edit', params: { x: String(m.snap(c.x)), y: String(m.snap(c.y)) } });
  };
  const removeObstacle = async (o: Obstacle) => {
    if (!(await confirm(tr(`Eliminare ${o.name}?`, `Delete ${o.name}?`), tr('Non farà più ombra.', 'It will cast no more shade.'), tr('Elimina', 'Delete'), true))) return;
    setSelected(null);
    setData((d) => d && { ...d, obstacles: d.obstacles.filter((x) => x.id !== o.id) });
    await deleteObstacle(db, o.id);
  };

  const subtitle =
    mode === 'edit'
      ? current || obstacle
        ? tr(
            'Trascina per spostare, l’angolo per cambiare misura, il pallino nero per ruotare.',
            'Drag to move, the corner to resize, the black dot to turn.',
          )
        : tr('Tocca una zona o un ostacolo per modificarlo. Gira la freccia per il nord.', 'Tap a zone or an obstacle to change it. Turn the arrow to set north.')
      : mode === 'sun'
        ? data.place
          ? tr('Ore di sole diretto il 15 del mese, e l’ombra all’ora scelta.', 'Hours of direct sun on the 15th of the month, and the shade at the time chosen.')
          : tr('Per il sole serve sapere dov’è il giardino.', 'For the sun the app needs to know where the garden is.')
        : onMap.length === 0
          ? tr('Ancora vuota: tocca la matita per disegnare le zone.', 'Still empty: tap the pencil to draw your zones.')
          : tr('Tocca una zona per vedere le sue piante.', 'Tap a zone to see its plants.');

  const switchTo = (next: MapMode) => {
    setMode((cur) => (cur === next ? 'view' : next));
    setSelected(null);
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16 }}>
        <LargeHeader
          title={tr('Mappa', 'Map')}
          subtitle={subtitle}
          right={
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
              <IconButton
                icon="sunFull"
                tone="sun"
                label={mode === 'sun' ? tr('Chiudi il sole', 'Close the sun') : tr('Mostra il sole', 'Show the sun')}
                filled={mode === 'sun'}
                onPress={() => switchTo('sun')}
              />
              <IconButton
                icon={mode === 'edit' ? 'tick' : 'edit'}
                label={mode === 'edit' ? tr('Fine', 'Done') : tr('Modifica la mappa', 'Edit the map')}
                filled={mode === 'edit'}
                onPress={() => switchTo('edit')}
              />
            </View>
          }
        />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <GardenMap
          zones={onMap}
          obstacles={data.obstacles}
          stats={stats}
          north={data.north}
          mode={mode}
          sun={sun}
          selected={selected}
          onSelect={setSelected}
          onOpen={(key) => {
            const k = parseKey(key);
            if (k.kind === 'zone') router.push({ pathname: '/zone/[id]', params: { id: String(k.id) } });
            else router.push({ pathname: '/obstacle/edit', params: { id: String(k.id) } });
          }}
          onShape={onShape}
          onNorth={(deg) => {
            setData((d) => d && { ...d, north: deg });
            setNorth(db, deg);
          }}
          onView={onView}
        />
      </View>
      <View style={{ padding: 16, paddingBottom: 20, gap: 8 }}>
        {mode === 'sun' ? (
          data.place ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <Chip key={mo} label={monthName(mo)} selected={mo === month} onPress={() => setMonth(mo)} />
                ))}
              </ScrollView>
              {range && range.from <= range.to ? (
                <TimeSlider
                  value={minutes}
                  min={range.from}
                  max={range.to}
                  step={15}
                  format={clock}
                  label={tr('Ora', 'Time')}
                  onChange={setMinutes}
                />
              ) : (
                <Body muted>{tr('In questo mese il sole non sorge.', 'The sun doesn’t rise this month.')}</Body>
              )}
              <Body muted style={{ fontSize: 13 }}>
                {tr(
                  'Conta solo gli ostacoli disegnati, col terreno piatto; ogni zona è misurata nel suo centro.',
                  'Only obstacles drawn count, on flat ground; each zone is measured at its centre.',
                )}
              </Body>
            </>
          ) : (
            <Button icon="place" label={tr('Imposta la posizione del giardino', 'Set where the garden is')} onPress={() => router.push('/location')} />
          )
        ) : mode === 'edit' && current ? (
          <>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{current.name}</Text>
            <ChipRow>
              <Chip icon="rect" label={tr('Rettangolo', 'Rectangle')} selected={current.shape.kind === 'rect'} onPress={() => saveZoneShape(current.id, m.withKind(current.shape, 'rect'))} />
              <Chip icon="circle" label={tr('Cerchio', 'Circle')} selected={current.shape.kind === 'circle'} onPress={() => saveZoneShape(current.id, m.withKind(current.shape, 'circle'))} />
              <Chip icon="ruler" label={tr('Misure', 'Measures')} onPress={() => router.push({ pathname: '/zone/edit', params: { id: String(current.id) } })} />
              <Chip
                icon="remove"
                label={tr('Togli dalla mappa', 'Take off the map')}
                onPress={() => {
                  saveZoneShape(current.id, null);
                  setSelected(null);
                }}
              />
            </ChipRow>
          </>
        ) : mode === 'edit' && obstacle ? (
          <>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{obstacle.name}</Text>
            <ChipRow>
              <Chip icon="rect" label={tr('Rettangolo', 'Rectangle')} selected={obstacle.shape.kind === 'rect'} onPress={() => saveObstacleShape(obstacle.id, m.withKind(obstacle.shape, 'rect'))} />
              <Chip icon="circle" label={tr('Cerchio', 'Circle')} selected={obstacle.shape.kind === 'circle'} onPress={() => saveObstacleShape(obstacle.id, m.withKind(obstacle.shape, 'circle'))} />
              <Chip icon="ruler" label={tr('Misure e altezza', 'Size and height')} onPress={() => router.push({ pathname: '/obstacle/edit', params: { id: String(obstacle.id) } })} />
              <Chip icon="remove" label={tr('Elimina', 'Delete')} onPress={() => removeObstacle(obstacle)} />
            </ChipRow>
          </>
        ) : mode === 'edit' ? (
          <>
            <Body muted>{offMap.length > 0 ? tr('Metti sulla mappa:', 'Put on the map:') : tr('Tutte le zone sono sulla mappa.', 'Every zone is on the map.')}</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {offMap.map((z) => (
                <Chip key={z.id} icon="add" label={z.name} onPress={() => place(z)} />
              ))}
              <Chip icon="add" label={tr('Nuova zona', 'New zone')} onPress={() => router.push({ pathname: '/zone/edit', params: { map: '1' } })} />
              <Chip icon="obstacle" label={tr('Nuovo ostacolo', 'New obstacle')} onPress={newObstacle} />
            </ScrollView>
          </>
        ) : offMap.length > 0 ? (
          <>
            <Body muted>{tr('Fuori mappa:', 'Off the map:')}</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {offMap.map((z) => (
                <Chip
                  key={z.id}
                  icon={SUN_SYMBOL[z.sun]}
                  label={`${z.name} · ${stats.get(z.id)?.plants ?? 0}`}
                  onPress={() => router.push({ pathname: '/zone/[id]', params: { id: String(z.id) } })}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

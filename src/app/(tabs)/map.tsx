import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GardenMap, type MapZone } from '@/components/GardenMap';
import { SUN_SYMBOL } from '@/components/Icon';
import { Body, Chip, ChipRow, IconButton, LargeHeader, Screen, useTheme } from '@/components/ui';
import { getNorth, listOpenTasks, listPlants, listZones, setNorth, setZoneShape } from '@/lib/db';
import { tr } from '@/lib/i18n';
import * as m from '@/lib/map';
import { today } from '@/lib/schedule';
import type { Plant, TaskWithPlant, Zone, ZoneShape } from '@/lib/types';

export default function MapScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [data, setData] = useState<{ zones: Zone[]; plants: Plant[]; tasks: TaskWithPlant[]; north: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const shown = useRef<{ view: m.View; width: number; height: number } | null>(null);

  const load = useCallback(async () => {
    const [zones, plants, tasks, north] = await Promise.all([listZones(db), listPlants(db), listOpenTasks(db), getNorth(db)]);
    setData({ zones, plants, tasks, north });
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

  if (!data) return <Screen>{null}</Screen>;
  const onMap = data.zones.filter((z): z is MapZone => z.shape !== null);
  const offMap = data.zones.filter((z) => z.shape === null);
  const current = onMap.find((z) => z.id === selected) ?? null;

  const save = async (id: number, shape: ZoneShape | null) => {
    // Show it at once, then write it.
    setData((d) => d && { ...d, zones: d.zones.map((z) => (z.id === id ? { ...z, shape } : z)) });
    await setZoneShape(db, id, shape);
  };

  const place = async (z: Zone) => {
    const v = shown.current;
    const centre = v ? m.fromScreen(v.view, { x: v.width / 2, y: v.height / 2 }) : { x: 0, y: 0 };
    await save(z.id, m.shapeAt(centre));
    setSelected(z.id);
  };

  const subtitle = editing
    ? current
      ? tr(
          'Trascina per spostare, l’angolo per cambiare misura, il pallino nero per ruotare.',
          'Drag to move, the corner to resize, the black dot to turn.',
        )
      : tr('Tocca una zona per modificarla. Gira la freccia per il nord.', 'Tap a zone to change it. Turn the arrow to set north.')
    : onMap.length === 0
      ? tr('Ancora vuota: tocca la matita per disegnare le zone.', 'Still empty: tap the pencil to draw your zones.')
      : tr('Tocca una zona per vedere le sue piante.', 'Tap a zone to see its plants.');

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16 }}>
        <LargeHeader
          title={tr('Mappa', 'Map')}
          subtitle={subtitle}
          right={
            <View style={{ marginLeft: 'auto' }}>
              <IconButton
                icon={editing ? 'tick' : 'edit'}
                label={editing ? tr('Fine', 'Done') : tr('Modifica la mappa', 'Edit the map')}
                filled={editing}
                onPress={() => {
                  setEditing((e) => !e);
                  setSelected(null);
                }}
              />
            </View>
          }
        />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <GardenMap
          zones={onMap}
          stats={stats}
          north={data.north}
          editing={editing}
          selected={selected}
          onSelect={setSelected}
          onOpen={(id) => router.push({ pathname: '/zone/[id]', params: { id: String(id) } })}
          onShape={save}
          onNorth={(deg) => {
            setData((d) => d && { ...d, north: deg });
            setNorth(db, deg);
          }}
          onView={onView}
        />
      </View>
      <View style={{ padding: 16, paddingBottom: 20, gap: 8 }}>
        {editing && current ? (
          <>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{current.name}</Text>
            <ChipRow>
              <Chip icon="rect" label={tr('Rettangolo', 'Rectangle')} selected={current.shape.kind === 'rect'} onPress={() => save(current.id, m.withKind(current.shape, 'rect'))} />
              <Chip icon="circle" label={tr('Cerchio', 'Circle')} selected={current.shape.kind === 'circle'} onPress={() => save(current.id, m.withKind(current.shape, 'circle'))} />
              <Chip icon="ruler" label={tr('Misure', 'Measures')} onPress={() => router.push({ pathname: '/zone/edit', params: { id: String(current.id) } })} />
              <Chip
                icon="remove"
                label={tr('Togli dalla mappa', 'Take off the map')}
                onPress={() => {
                  save(current.id, null);
                  setSelected(null);
                }}
              />
            </ChipRow>
          </>
        ) : editing ? (
          <>
            <Body muted>{offMap.length > 0 ? tr('Metti sulla mappa:', 'Put on the map:') : tr('Tutte le zone sono sulla mappa.', 'Every zone is on the map.')}</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {offMap.map((z) => (
                <Chip key={z.id} icon="add" label={z.name} onPress={() => place(z)} />
              ))}
              <Chip icon="add" label={tr('Nuova zona', 'New zone')} onPress={() => router.push({ pathname: '/zone/edit', params: { map: '1' } })} />
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

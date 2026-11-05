import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SUN_SYMBOL } from '@/components/Icon';
import { PlantRow } from '@/components/PlantRow';
import { Body, Button, Group, Pill, PillRow, Screen, Title } from '@/components/ui';
import { getZone, listPlants } from '@/lib/db';
import { tr } from '@/lib/i18n';
import { SUN_LABEL } from '@/lib/presets';
import type { Plant, Zone } from '@/lib/types';

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** A zone and its plants: where a tap on the map leads. */
export default function ZoneScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ zone: Zone; plants: Plant[] } | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getZone(db, Number(id)), listPlants(db)]).then(([zone, plants]) =>
        setData(zone ? { zone, plants: plants.filter((p) => p.zoneId === zone.id && !p.archivedOn) } : null),
      );
    }, [db, id]),
  );

  if (data === undefined) return <Screen>{null}</Screen>;
  if (data === null) {
    return (
      <Screen>
        <Body muted style={{ padding: 16 }}>{tr('Questa zona non c’è più.', 'This zone no longer exists.')}</Body>
      </Screen>
    );
  }
  const { zone, plants } = data;
  const s = zone.shape;
  const size = !s
    ? tr('Fuori mappa', 'Off the map')
    : s.kind === 'circle'
      ? tr(`Cerchio, ⌀ ${fmt(s.width)} m`, `Circle, ⌀ ${fmt(s.width)} m`)
      : `${fmt(s.width)} × ${fmt(s.length)} m`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Title>{zone.name}</Title>
        <PillRow>
          <Pill icon={SUN_SYMBOL[zone.sun]} tone="sun" label={SUN_LABEL[zone.sun]} />
          {zone.covered ? <Pill icon="covered" label={tr('Al coperto', 'Covered')} /> : null}
          <Pill icon={s ? 'map' : 'place'} label={size} />
        </PillRow>
        {plants.length > 0 ? (
          <Group>
            {plants.map((p) => (
              <PlantRow key={p.id} plant={p} zone={zone} />
            ))}
          </Group>
        ) : (
          <Body muted>{tr('Nessuna pianta in questa zona.', 'No plants in this zone.')}</Body>
        )}
        <View style={{ height: 4 }} />
        <Button kind="secondary" icon="edit" label={tr('Modifica zona', 'Edit zone')} onPress={() => router.push({ pathname: '/zone/edit', params: { id: String(zone.id) } })} />
      </ScrollView>
    </Screen>
  );
}

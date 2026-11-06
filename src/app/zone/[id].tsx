import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SUN_SYMBOL } from '@/components/Icon';
import { PlantRow } from '@/components/PlantRow';
import { Body, Button, Card, Group, Pill, PillRow, Screen, SectionHeader, Title, useTheme } from '@/components/ui';
import { getNorth, getPlace, getZone, listObstacles, listPlants, saveZone } from '@/lib/db';
import { locale, tr } from '@/lib/i18n';
import { SUN_LABEL } from '@/lib/presets';
import { exposure, SEASON, sunFromHours, yearSunHours, type Place } from '@/lib/sun';
import type { Obstacle, Plant, Zone } from '@/lib/types';

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** A zone and its plants: where a tap on the map leads. */
export default function ZoneScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<
    { zone: Zone; plants: Plant[]; obstacles: Obstacle[]; place: Place | null; north: number } | null | undefined
  >(undefined);

  const load = useCallback(() => {
    Promise.all([getZone(db, Number(id)), listPlants(db), listObstacles(db), getPlace(db), getNorth(db)]).then(
      ([zone, plants, obstacles, place, north]) =>
        setData(zone ? { zone, plants: plants.filter((p) => p.zoneId === zone.id && !p.archivedOn), obstacles, place, north } : null),
    );
  }, [db, id]);
  useFocusEffect(load);

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
        {s ? (
          <SunHours
            zone={zone}
            obstacles={data.obstacles}
            place={data.place}
            north={data.north}
            onUse={async (sun) => {
              await saveZone(db, { id: zone.id, name: zone.name, sun, covered: zone.covered });
              load();
            }}
          />
        ) : null}
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

const monthLetter = (month: number) => new Date(2026, month - 1, 1).toLocaleDateString(locale(), { month: 'narrow' });
const monthLong = (month: number) => new Date(2026, month - 1, 1).toLocaleDateString(locale(), { month: 'long' });

/**
 * The zone's hours of direct sun month by month, the exposure they make, and
 * when it isn't the zone's, the offer to change it. Never changed alone.
 */
function SunHours({
  zone,
  obstacles,
  place,
  north,
  onUse,
}: {
  zone: Zone;
  obstacles: Obstacle[];
  place: Place | null;
  north: number;
  onUse: (sun: Zone['sun']) => void;
}) {
  const t = useTheme();
  const year = new Date().getFullYear();
  const hours = useMemo(
    () => (place && zone.shape ? yearSunHours(zone.shape, obstacles, place, north, year) : null),
    [place, zone.shape, obstacles, north, year],
  );
  if (!hours) {
    return (
      <>
        <SectionHeader>{tr('Ore di sole', 'Hours of sun')}</SectionHeader>
        <Card>
          <Body muted>{tr('Per stimare le ore di sole serve sapere dov’è il giardino.', 'To estimate the hours of sun the app needs to know where the garden is.')}</Body>
          <Button kind="secondary" icon="place" label={tr('Imposta la posizione', 'Set the location')} onPress={() => router.push('/location')} />
        </Card>
      </>
    );
  }
  const e = exposure(hours);
  const top = Math.max(12, ...hours);
  return (
    <>
      <SectionHeader>{tr('Ore di sole', 'Hours of sun')}</SectionHeader>
      <Card>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>
          {tr(`${fmt(e.average)} ore al giorno da aprile a settembre: ${SUN_LABEL[e.sun].toLowerCase()}`, `${fmt(e.average)} hours a day April to September: ${SUN_LABEL[e.sun].toLowerCase()}`)}
        </Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4, marginTop: 14 }}
          accessibilityLabel={hours.map((h, i) => `${monthLong(i + 1)} ${fmt(h)} h`).join(', ')}
        >
          {hours.map((h, i) => {
            const sun = sunFromHours(h);
            const inSeason = SEASON.includes(i + 1);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Text style={{ color: t.muted, fontSize: 10, marginBottom: 2 }}>{fmt(h)}</Text>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(2, (h / top) * 84),
                    borderRadius: 4,
                    backgroundColor: sun === 'shade' ? t.border : t.sun,
                    opacity: sun === 'partial' ? 0.45 : 1,
                  }}
                />
                <Text style={{ color: inSeason ? t.text : t.muted, fontSize: 11, marginTop: 4, fontWeight: inSeason ? '600' : '400' }}>{monthLetter(i + 1)}</Text>
              </View>
            );
          })}
        </View>
        <Body muted style={{ marginTop: 12, fontSize: 13 }}>
          {tr(
            'Sole diretto possibile il 15 di ogni mese, cielo sereno. Conta solo gli ostacoli disegnati, col terreno piatto, ed è misurato al centro della zona: in un’aiuola lunga una parte può avere più o meno sole.',
            'Possible direct sun on the 15th of each month, clear sky. Only obstacles drawn count, on flat ground, measured at the centre of the zone: part of a long bed can get more or less.',
          )}
        </Body>
        {e.sun !== zone.sun ? (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: t.sunSoft }}>
            <Body>
              {tr(
                `La zona è segnata ${SUN_LABEL[zone.sun].toLowerCase()}, la stima dice ${SUN_LABEL[e.sun].toLowerCase()}. Se nel giardino la vedi così, cambiala.`,
                `The zone is set to ${SUN_LABEL[zone.sun].toLowerCase()}, the estimate says ${SUN_LABEL[e.sun].toLowerCase()}. If that's what you see in the garden, change it.`,
              )}
            </Body>
            <Button kind="secondary" icon={SUN_SYMBOL[e.sun]} label={tr(`Segna ${SUN_LABEL[e.sun].toLowerCase()}`, `Set to ${SUN_LABEL[e.sun].toLowerCase()}`)} onPress={() => onUse(e.sun)} />
          </View>
        ) : null}
      </Card>
    </>
  );
}

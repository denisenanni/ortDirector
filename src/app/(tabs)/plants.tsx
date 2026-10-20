import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon, SUN_SYMBOL } from '@/components/Icon';
import {
  Body,
  Button,
  Empty,
  Group,
  IconButton,
  LargeHeader,
  Pill,
  PillRow,
  SERIF,
  Screen,
  SectionHeader,
  useTheme,
} from '@/components/ui';
import { listPlants, listZones } from '@/lib/db';
import { PlantAvatar, waterLabel } from '@/components/PlantAvatar';
import { photoUri } from '@/lib/photos';
import { SUN_LABEL } from '@/lib/presets';
import { sunMismatch } from '@/lib/schedule';
import type { Plant, Zone } from '@/lib/types';

export default function PlantsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [data, setData] = useState<{ plants: Plant[]; zones: Zone[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listPlants(db), listZones(db)]).then(([plants, zones]) => setData({ plants, zones }));
    }, [db]),
  );

  if (!data) return <Screen>{null}</Screen>;
  const { zones } = data;
  const plants = data.plants.filter((p) => !p.archivedOn);
  const archived = data.plants.filter((p) => p.archivedOn);

  const row = (p: Plant, zone?: Zone) => {
    const warn = zone && sunMismatch(p.sun, zone.sun);
    const uri = photoUri(p.photo);
    return (
      <Pressable
        key={p.id}
        onPress={() => router.push(`/plant/${p.id}`)}
        style={({ pressed }) => [
          { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, paddingRight: 14 },
          pressed && { opacity: 0.6 },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 14 }} />
        ) : (
          <PlantAvatar plant={p} />
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 23, color: t.text }}>
            {p.name}
            {p.variety ? <Text style={{ color: t.muted }}> {p.variety}</Text> : null}
          </Text>
          <PillRow>
            <Pill icon={SUN_SYMBOL[p.sun]} tone="sun" label={SUN_LABEL[p.sun]} />
            {p.waterEveryDays ? (
              <Pill
                icon="water"
                tone="water"
                label={waterLabel(p)}
              />
            ) : null}
            {p.potted ? <Pill label="In vaso" /> : null}
            {p.stage === 'seedbed' ? <Pill tone="accent" label="Da trapiantare" /> : null}
          </PillRow>
          {warn ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="warn" size={14} color={t.warn} />
              <Text style={{ color: t.warn, fontSize: 14, flex: 1 }}>{warn}</Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevron" size={16} color={t.muted} />
      </Pressable>
    );
  };

  // Zones with plants first, empty ones after the plants.
  const planted = zones.filter((z) => plants.some((p) => p.zoneId === z.id));
  const empty = zones.filter((z) => !planted.includes(z));
  const zoneHeader = (z: Zone) => (
    <SectionHeader
      icon={SUN_SYMBOL[z.sun]}
      onPress={() => router.push({ pathname: '/zone/edit', params: { id: String(z.id) } })}
    >
      {z.name}
      {z.covered ? <Text style={{ color: t.muted }}> · al coperto</Text> : null}
    </SectionHeader>
  );

  const noZone = plants.filter((p) => p.zoneId === null || !zones.some((z) => z.id === p.zoneId));

  const zoneCount = zones.length;
  const summary =
    plants.length === 0
      ? null
      : `${plants.length === 1 ? '1 pianta' : `${plants.length} piante`}` +
        (zoneCount > 0 ? ` in ${zoneCount === 1 ? '1 zona' : `${zoneCount} zone`}` : '');

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <LargeHeader
          title="Piante"
          subtitle={summary}
          right={<IconButton icon="add" label="Aggiungi pianta" filled onPress={() => router.push('/plant/edit')} />}
        />
        {data.plants.length === 0 && zones.length === 0 && (
          <Empty title="Nessuna pianta" hint="Aggiungi la prima pianta del tuo orto o giardino con il +." />
        )}
        {planted.map((z) => (
          <View key={z.id}>
            {zoneHeader(z)}
            <Group>{plants.filter((p) => p.zoneId === z.id).map((p) => row(p, z))}</Group>
          </View>
        ))}
        {noZone.length > 0 && zones.length > 0 && <SectionHeader>Senza zona</SectionHeader>}
        <Group>{noZone.map((p) => row(p))}</Group>
        {empty.map((z) => (
          <View key={z.id}>
            {zoneHeader(z)}
            <Body muted>Nessuna pianta in questa zona.</Body>
          </View>
        ))}
        {archived.length > 0 && <SectionHeader icon="archive">Archivio</SectionHeader>}
        <Group>{archived.map((p) => row(p))}</Group>
        <View style={{ height: 16 }} />
        <Button kind="secondary" icon="add" label="Nuova zona" onPress={() => router.push('/zone/edit')} />
      </ScrollView>
    </Screen>
  );
}

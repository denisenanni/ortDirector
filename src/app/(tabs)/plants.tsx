import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Body, Button, Card, Empty, Screen, SectionHeader, useTheme } from '@/components/ui';
import { listPlants, listZones } from '@/lib/db';
import { SUN_ICON, SUN_LABEL } from '@/lib/presets';
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
  const { plants, zones } = data;

  const card = (p: Plant, zone?: Zone) => {
    const warn = zone && sunMismatch(p.sun, zone.sun);
    return (
      <Pressable key={p.id} onPress={() => router.push(`/plant/${p.id}`)}>
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '600', color: t.text }}>
            {p.name}
            {p.variety ? <Text style={{ color: t.muted, fontWeight: '400' }}> · {p.variety}</Text> : null}
          </Text>
          <Body muted>
            {SUN_ICON[p.sun]} {SUN_LABEL[p.sun]}
            {p.waterEveryDays ? `  💧 ogni ${p.waterEveryDays === 1 ? 'giorno' : `${p.waterEveryDays} gg`}` : ''}
            {p.potted ? '  🪴 vaso' : ''}
            {p.stage === 'seedbed' ? '  🌱 da trapiantare' : ''}
          </Body>
          {warn ? <Body style={{ color: t.warn }}>⚠️ {warn}</Body> : null}
        </Card>
      </Pressable>
    );
  };

  const noZone = plants.filter((p) => p.zoneId === null || !zones.some((z) => z.id === p.zoneId));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {plants.length === 0 && zones.length === 0 && (
          <Empty title="Nessuna pianta" hint="Aggiungi la prima pianta del tuo orto o giardino." />
        )}
        {zones.map((z) => {
          const inZone = plants.filter((p) => p.zoneId === z.id);
          return (
            <View key={z.id}>
              <Pressable onPress={() => router.push({ pathname: '/zone/edit', params: { id: String(z.id) } })}>
                <SectionHeader>
                  {SUN_ICON[z.sun]} {z.name}
                  {z.covered ? ' · al coperto' : ''} ›
                </SectionHeader>
              </Pressable>
              {inZone.length === 0 && <Body muted>Nessuna pianta in questa zona.</Body>}
              {inZone.map((p) => card(p, z))}
            </View>
          );
        })}
        {noZone.length > 0 && zones.length > 0 && <SectionHeader>Senza zona</SectionHeader>}
        {noZone.map((p) => card(p))}
        <Button label="Aggiungi pianta" onPress={() => router.push('/plant/edit')} />
        <Button kind="secondary" label="Aggiungi zona" onPress={() => router.push('/zone/edit')} />
      </ScrollView>
    </Screen>
  );
}

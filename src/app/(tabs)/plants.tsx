import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Body, Button, Card, Empty, Screen, useTheme } from '@/components/ui';
import { listPlants } from '@/lib/db';
import { SUN_ICON, SUN_LABEL } from '@/lib/presets';
import type { Plant } from '@/lib/types';

export default function PlantsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [plants, setPlants] = useState<Plant[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listPlants(db).then(setPlants);
    }, [db]),
  );

  if (!plants) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {plants.length === 0 && (
          <Empty title="Nessuna pianta" hint="Aggiungi la prima pianta del tuo orto o giardino." />
        )}
        {plants.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/plant/${p.id}`)}>
            <Card>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.text }}>
                {p.name}
                {p.variety ? <Text style={{ color: t.muted, fontWeight: '400' }}> · {p.variety}</Text> : null}
              </Text>
              <Body muted>
                {SUN_ICON[p.sun]} {SUN_LABEL[p.sun]}
                {p.waterEveryDays ? `  💧 ogni ${p.waterEveryDays === 1 ? 'giorno' : `${p.waterEveryDays} gg`}` : ''}
                {p.location ? `  📍 ${p.location}` : ''}
              </Body>
            </Card>
          </Pressable>
        ))}
        <Button label="Aggiungi pianta" onPress={() => router.push('/plant/edit')} />
      </ScrollView>
    </Screen>
  );
}

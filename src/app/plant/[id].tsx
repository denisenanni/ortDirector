import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Body, Button, Card, Screen, SectionHeader, Title } from '@/components/ui';
import { getPlant, listPlantLog, listPlantTasks, markDone } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { PLANT_PRESETS, SUN_ICON, SUN_LABEL, TASK_ICON } from '@/lib/presets';
import { fromDay, relativeLabel, today as getToday } from '@/lib/schedule';
import type { LogEntry, Plant, TaskWithPlant } from '@/lib/types';

export default function PlantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [tasks, setTasks] = useState<TaskWithPlant[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const today = getToday();

  const load = useCallback(async () => {
    const [p, ts, l] = await Promise.all([
      getPlant(db, plantId),
      listPlantTasks(db, plantId),
      listPlantLog(db, plantId),
    ]);
    if (!p) {
      router.back();
      return;
    }
    setPlant(p);
    setTasks(ts);
    setLog(l);
  }, [db, plantId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDone = async (task: TaskWithPlant) => {
    await markDone(db, task);
    await load();
    syncReminders(db);
  };

  if (!plant) return <Screen>{null}</Screen>;

  const tip = PLANT_PRESETS.find((p) => p.name.toLowerCase() === plant.name.toLowerCase())?.tip;

  return (
    <Screen>
      <Stack.Screen options={{ title: plant.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card>
          {plant.variety ? <Title>{plant.variety}</Title> : null}
          <Body>
            {SUN_ICON[plant.sun]} {SUN_LABEL[plant.sun]}
          </Body>
          <Body>
            💧{' '}
            {plant.waterEveryDays
              ? `Ogni ${plant.waterEveryDays === 1 ? 'giorno' : `${plant.waterEveryDays} giorni`}`
              : 'Nessuna irrigazione programmata'}
          </Body>
          {plant.location ? <Body>📍 {plant.location}</Body> : null}
          {plant.plantedOn ? (
            <Body>🌱 Piantata il {fromDay(plant.plantedOn).toLocaleDateString('it-IT')}</Body>
          ) : null}
          {plant.notes ? <Body muted style={{ marginTop: 8 }}>{plant.notes}</Body> : null}
          {tip ? <Body muted style={{ marginTop: 8 }}>💡 {tip}</Body> : null}
        </Card>

        <SectionHeader>Attività</SectionHeader>
        {tasks.length === 0 && <Body muted>Nessuna attività aperta.</Body>}
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} today={today} onDone={onDone} showPlant={false} />
        ))}
        <Button
          kind="secondary"
          label="Aggiungi attività"
          onPress={() => router.push({ pathname: '/task/edit', params: { plantId: String(plant.id) } })}
        />

        {log.length > 0 && <SectionHeader>Storico</SectionHeader>}
        {log.map((e) => (
          <Body key={e.id} muted>
            {TASK_ICON[e.type]} {e.title} · {relativeLabel(e.doneOn, today)}
          </Body>
        ))}

        <Button
          kind="secondary"
          label="Modifica pianta"
          onPress={() => router.push({ pathname: '/plant/edit', params: { id: String(plant.id) } })}
        />
      </ScrollView>
    </Screen>
  );
}

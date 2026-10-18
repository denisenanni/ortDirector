import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Button, Empty, Screen, SectionHeader } from '@/components/ui';
import { listOpenTasks, markDone } from '@/lib/db';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { addDays, today as getToday } from '@/lib/schedule';
import type { TaskWithPlant } from '@/lib/types';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<TaskWithPlant[] | null>(null);
  const today = getToday();

  const load = useCallback(async () => {
    setTasks(await listOpenTasks(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Ask once, on first launch; later calls are no-ops.
      ensurePermission().then(() => syncReminders(db));
    }, [db, load]),
  );

  const onDone = async (task: TaskWithPlant) => {
    await markDone(db, task);
    await load();
    syncReminders(db);
  };

  if (!tasks) return <Screen>{null}</Screen>;

  const weekEnd = addDays(today, 7);
  const due = tasks.filter((t) => t.dueOn <= today);
  const soon = tasks.filter((t) => t.dueOn > today && t.dueOn <= weekEnd);
  const later = tasks.filter((t) => t.dueOn > weekEnd);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tasks.length === 0 ? (
          <Empty
            title="Niente da fare"
            hint="Aggiungi una pianta con un intervallo di irrigazione, o crea un’attività."
          />
        ) : null}

        {due.length > 0 && <SectionHeader>Da fare oggi</SectionHeader>}
        {due.map((t) => <TaskRow key={t.id} task={t} today={today} onDone={onDone} />)}

        {tasks.length > 0 && due.length === 0 && <SectionHeader>Oggi è tutto fatto ✨</SectionHeader>}

        {soon.length > 0 && <SectionHeader>Prossimi 7 giorni</SectionHeader>}
        {soon.map((t) => <TaskRow key={t.id} task={t} today={today} onDone={onDone} />)}

        {later.length > 0 && <SectionHeader>Più avanti</SectionHeader>}
        {later.map((t) => <TaskRow key={t.id} task={t} today={today} onDone={onDone} />)}

        <View style={{ height: 12 }} />
        <Button label="Nuova attività" onPress={() => router.push('/task/edit')} />
      </ScrollView>
    </Screen>
  );
}

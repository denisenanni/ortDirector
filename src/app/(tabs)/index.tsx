import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DoneRow, TaskRow } from '@/components/TaskRow';
import { Body, Button, Empty, Screen, SectionHeader } from '@/components/ui';
import { listDoneOn, listOpenTasks, markDone, rained, undoDone } from '@/lib/db';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { addDays, today as getToday } from '@/lib/schedule';
import type { DoneEntry, TaskWithPlant } from '@/lib/types';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<TaskWithPlant[] | null>(null);
  const [done, setDone] = useState<DoneEntry[]>([]);
  const [rainNote, setRainNote] = useState<string | null>(null);
  const today = getToday();

  const load = useCallback(async () => {
    const [open, ticked] = await Promise.all([listOpenTasks(db), listDoneOn(db)]);
    setTasks(open);
    setDone(ticked);
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

  const onUndo = async (entry: DoneEntry) => {
    await undoDone(db, entry);
    await load();
    syncReminders(db);
  };

  const onRain = async () => {
    const moved = await rained(db);
    setRainNote(
      moved === 0
        ? 'Nessuna annaffiatura da spostare.'
        : `Spostate ${moved === 1 ? '1 annaffiatura' : `${moved} annaffiature`}, tranne le zone al coperto.`,
    );
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
        {tasks.length === 0 && done.length === 0 ? (
          <Empty
            title="Niente da fare"
            hint="Aggiungi una pianta con un intervallo di irrigazione, o crea un’attività."
          />
        ) : null}

        {tasks.some((t) => t.type === 'water') && (
          <Button kind="secondary" label="🌧️ Ha piovuto" onPress={onRain} />
        )}
        {rainNote ? <Body muted style={{ marginTop: 6, textAlign: 'center' }}>{rainNote}</Body> : null}

        {due.length > 0 && <SectionHeader>Da fare oggi</SectionHeader>}
        {due.length === 0 && (tasks.length > 0 || done.length > 0) && <SectionHeader>Oggi è tutto fatto ✨</SectionHeader>}
        {due.map((t) => <TaskRow key={t.id} task={t} today={today} onDone={onDone} />)}
        {done.map((e) => <DoneRow key={`done-${e.id}`} entry={e} onUndo={onUndo} />)}

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

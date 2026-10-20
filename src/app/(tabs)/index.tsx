import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Icon } from '@/components/Icon';
import { DoneRow, TaskRow } from '@/components/TaskRow';
import { Body, Empty, Group, IconButton, LargeHeader, Screen, SectionHeader, useTheme } from '@/components/ui';
import { listDoneOn, listOpenTasks, markDone, rained, undoDone } from '@/lib/db';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { addDays, daysBetween, fromDay, today as getToday } from '@/lib/schedule';
import type { DoneEntry, TaskWithPlant } from '@/lib/types';
import { locale, tr } from '@/lib/i18n';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<TaskWithPlant[] | null>(null);
  const [done, setDone] = useState<DoneEntry[]>([]);
  const [rainNote, setRainNote] = useState<string | null>(null);
  const today = getToday();
  const t = useTheme();

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
        ? tr('Nessuna annaffiatura da spostare.', 'No watering to move.')
        : tr(
            `Spostate ${moved === 1 ? '1 annaffiatura' : `${moved} annaffiature`}, tranne le zone al coperto.`,
            `Moved ${moved === 1 ? '1 watering' : `${moved} waterings`}, except in covered zones.`,
          ),
    );
    await load();
    syncReminders(db);
  };

  if (!tasks) return <Screen>{null}</Screen>;

  const weekEnd = addDays(today, 7);
  const due = tasks.filter((t) => t.dueOn <= today);
  const soon = tasks.filter((t) => t.dueOn > today && t.dueOn <= weekEnd);
  const later = tasks.filter((t) => t.dueOn > weekEnd);

  const late = due.filter((task) => daysBetween(today, task.dueOn) < 0).length;
  const summary =
    due.length === 0
      ? tasks.length > 0 || done.length > 0
        ? tr('Per oggi è tutto fatto.', 'All done for today.')
        : null
      : tr(
          due.length === 1 ? '1 cosa da fare' : `${due.length} cose da fare`,
          due.length === 1 ? '1 thing to do' : `${due.length} things to do`,
        ) + (late > 0 ? tr(`, ${late} in ritardo`, `, ${late} late`) : '');
  const dateLine = fromDay(today).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <LargeHeader
          eyebrow={dateLine}
          title={tr('Oggi', 'Today')}
          subtitle={summary}
          right={<IconButton icon="add" label={tr('Nuova attività', 'New task')} filled onPress={() => router.push('/task/edit')} />}
        />

        {tasks.some((task) => task.type === 'water') && (
          <Pressable
            accessibilityRole="button"
            onPress={onRain}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
                gap: 8,
                marginTop: 6,
                paddingVertical: 9,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: t.waterSoft,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Icon name="rain" size={18} color={t.water} />
            <Text style={{ color: t.water, fontSize: 15, fontWeight: '600' }}>{tr('Ha piovuto', 'It rained')}</Text>
          </Pressable>
        )}
        {rainNote ? <Body muted style={{ marginTop: 8 }}>{rainNote}</Body> : null}

        {tasks.length === 0 && done.length === 0 ? (
          <Empty
            title={tr('Niente da fare', 'Nothing to do')}
            hint={tr(
              'Aggiungi una pianta con un intervallo di irrigazione, o crea un’attività con il +.',
              'Add a plant with a watering interval, or create a task with the +.',
            )}
          />
        ) : null}

        {(due.length > 0 || done.length > 0) && (
          <SectionHeader count={due.length > 0 ? due.length : undefined}>{tr('Da fare oggi', 'To do today')}</SectionHeader>
        )}
        <Group>
          {due.map((task) => <TaskRow key={task.id} task={task} today={today} onDone={onDone} />)}
          {done.map((e) => <DoneRow key={`done-${e.id}`} entry={e} onUndo={onUndo} />)}
        </Group>

        {soon.length > 0 && <SectionHeader count={soon.length}>{tr('Prossimi 7 giorni', 'Next 7 days')}</SectionHeader>}
        <Group>
          {soon.map((task) => <TaskRow key={task.id} task={task} today={today} onDone={onDone} />)}
        </Group>

        {later.length > 0 && <SectionHeader>{tr('Più avanti', 'Later')}</SectionHeader>}
        <Group>
          {later.map((task) => <TaskRow key={task.id} task={task} today={today} onDone={onDone} />)}
        </Group>
      </ScrollView>
    </Screen>
  );
}

import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { DoneRow, TaskRow } from '@/components/TaskRow';
import { Body, Empty, Group, IconButton, LargeHeader, Screen, SectionHeader, useTheme } from '@/components/ui';
import { getLastRain, listDoneOn, listOpenTasks, markDone, rained, undoDone, undoRain, type RainRecord } from '@/lib/db';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { addDays, daysBetween, fromDay, pastLabel, today as getToday } from '@/lib/schedule';
import type { DoneEntry, TaskWithPlant } from '@/lib/types';
import { locale, tr } from '@/lib/i18n';

function rainDetail(moved: number): string {
  if (moved === 0) return tr('Nessuna annaffiatura da spostare.', 'No watering to move.');
  return tr(
    `${moved === 1 ? '1 annaffiatura spostata' : `${moved} annaffiature spostate`}, tranne le piante al coperto.`,
    `${moved === 1 ? '1 watering moved' : `${moved} waterings moved`}, except for plants under cover.`,
  );
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const [tasks, setTasks] = useState<TaskWithPlant[] | null>(null);
  const [done, setDone] = useState<DoneEntry[]>([]);
  const [lastRain, setLastRain] = useState<RainRecord | null>(null);
  const today = getToday();
  const t = useTheme();

  const load = useCallback(async () => {
    const [open, ticked, rain] = await Promise.all([listOpenTasks(db), listDoneOn(db), getLastRain(db)]);
    setTasks(open);
    setDone(ticked);
    setLastRain(rain);
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
    await rained(db);
    await load();
    syncReminders(db);
  };

  const onUndoRain = async () => {
    await undoRain(db);
    await load();
    syncReminders(db);
  };

  if (!tasks) return <Screen>{null}</Screen>;

  const weekEnd = addDays(today, 7);
  const due = tasks.filter((t) => t.dueOn <= today);
  const soon = tasks.filter((t) => t.dueOn > today && t.dueOn <= weekEnd);
  const later = tasks.filter((t) => t.dueOn > weekEnd);
  // Today's tasks, open and done, grouped by zone: zones by name, no zone last.
  const zoneNames = [...new Set([...due, ...done].map((x) => x.zoneName))].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  );
  const todayByZone = zoneNames.map((zone) => ({
    zone,
    open: due.filter((x) => x.zoneName === zone),
    ticked: done.filter((x) => x.zoneName === zone),
  }));
  const zones = zoneNames.length;

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
  const rainedToday = lastRain?.day === today ? lastRain : null;
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

        {rainedToday ? (
          // Once pressed, the button gives way to what it did, with a way back.
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 6,
              padding: 14,
              borderRadius: 18,
              backgroundColor: t.waterSoft,
            }}
          >
            <Icon name="rain" size={22} color={t.water} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.water, fontSize: 16, fontWeight: '700' }}>
                {tr('Pioggia segnata oggi', 'Rain logged today')}
              </Text>
              <Text style={{ color: t.text, fontSize: 14, marginTop: 2 }}>{rainDetail(rainedToday.moved.length)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onUndoRain} hitSlop={10}>
              <Text style={{ color: t.water, fontSize: 15, fontWeight: '600' }}>{tr('Annulla', 'Undo')}</Text>
            </Pressable>
          </View>
        ) : tasks.some((task) => task.type === 'water') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onRain}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
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
            {lastRain ? (
              <Body muted style={{ flex: 1, fontSize: 14 }}>
                {tr('Ultima pioggia: ', 'Last rain: ') + pastLabel(lastRain.day, today).toLowerCase()}
              </Body>
            ) : null}
          </View>
        ) : null}

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
        {todayByZone.map(({ zone, open, ticked }) => (
          <View key={zone ?? ''}>
            {zones > 1 || zone !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 6 }}>
                <Icon name="place" size={14} color={t.muted} />
                <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>{zone ?? tr('Senza zona', 'No zone')}</Text>
              </View>
            ) : null}
            <Group>
              {open.map((task) => <TaskRow key={task.id} task={task} today={today} onDone={onDone} showZone={false} />)}
              {ticked.map((e) => <DoneRow key={`done-${e.id}`} entry={e} onUndo={onUndo} showZone={false} />)}
            </Group>
          </View>
        ))}

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

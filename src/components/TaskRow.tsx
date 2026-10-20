import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TASK_ICON, repeatLabel } from '@/lib/presets';
import { daysBetween, fromDay, relativeLabel } from '@/lib/schedule';
import type { DoneEntry, TaskWithPlant } from '@/lib/types';
import { useTheme } from './ui';

export function TaskRow({
  task,
  today,
  onDone,
  showPlant = true,
}: {
  task: TaskWithPlant;
  today: string;
  onDone: (t: TaskWithPlant) => void;
  showPlant?: boolean;
}) {
  const t = useTheme();
  const overdue = daysBetween(today, task.dueOn) < 0;
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
      {showPlant && task.zoneName ? <ZoneTag name={task.zoneName} /> : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Segna come fatto: ${task.title}`}
        onPress={() => (task.type === 'transplant' ? openTransplant(task) : onDone(task))}
        hitSlop={10}
        style={[styles.check, { borderColor: t.accent }]}
      />
      <Pressable
        style={{ flex: 1 }}
        onPress={() => router.push({ pathname: '/task/edit', params: { id: String(task.id) } })}
      >
        <Text style={[styles.title, { color: t.text }]}>
          {TASK_ICON[task.type]} {task.title}
          {showPlant && task.plantName ? <Text style={{ color: t.muted }}> · {task.plantName}</Text> : null}
        </Text>
        <Text style={{ color: overdue ? t.warn : t.muted, fontSize: 14, marginTop: 2 }}>
          {relativeLabel(task.dueOn, today)}
          {repeatLabel(task) ? ` · ${repeatLabel(task)}` : ''}
          {(task.repeatDays || task.yearly) && task.endsOn
            ? ` fino al ${fromDay(task.endsOn).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`
            : ''}
        </Text>
      </Pressable>
    </View>
  );
}

/** Something ticked today: stays in Oggi, checked; tapping the tick undoes it. */
export function DoneRow({ entry, onUndo }: { entry: DoneEntry; onUndo: (e: DoneEntry) => void }) {
  const t = useTheme();
  const undoable = entry.taskId !== null;
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border, opacity: 0.6 }]}>
      {entry.zoneName ? <ZoneTag name={entry.zoneName} /> : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true, disabled: !undoable }}
        accessibilityLabel={`Fatto: ${entry.title}${undoable ? '. Tocca per annullare' : ''}`}
        onPress={() => undoable && onUndo(entry)}
        disabled={!undoable}
        hitSlop={10}
        style={[styles.check, styles.checked, { borderColor: t.accent, backgroundColor: t.accent }]}
      >
        <Text style={{ color: t.accentText, fontSize: 15, fontWeight: '700' }}>✓</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text, textDecorationLine: 'line-through' }]}>
          {TASK_ICON[entry.type]} {entry.title}
          {entry.plantName ? <Text style={{ color: t.muted }}> · {entry.plantName}</Text> : null}
        </Text>
        <Text style={{ color: t.muted, fontSize: 14, marginTop: 2 }}>Fatto oggi</Text>
      </View>
    </View>
  );
}

function ZoneTag({ name }: { name: string }) {
  const t = useTheme();
  return (
    <View style={[styles.zone, { backgroundColor: t.accentSoft }]}>
      <Text numberOfLines={2} style={[styles.zoneText, { color: t.accent }]}>
        {name}
      </Text>
    </View>
  );
}

/** A transplant reminder is done by marking the transplant, which starts the plan. */
export function openTransplant(task: Pick<TaskWithPlant, 'plantId'>) {
  if (task.plantId !== null) {
    router.push({ pathname: '/plant/transplant', params: { id: String(task.plantId) } });
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  zone: { width: 76, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6 },
  zoneText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  checked: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '500' },
});

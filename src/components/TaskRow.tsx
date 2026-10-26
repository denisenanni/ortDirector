import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { repeatLabel } from '@/lib/presets';
import { daysBetween, fromDay, intervalOn, relativeLabel } from '@/lib/schedule';
import type { DoneEntry, TaskType, TaskWithPlant } from '@/lib/types';
import { Icon, TASK_SYMBOL } from './Icon';
import { IconTile, useTheme, type Tone } from './ui';
import { locale, tr } from '@/lib/i18n';

export const TASK_TONE: Record<TaskType, Tone> = {
  water: 'water',
  check: 'accent',
  prune: 'accent',
  fertilize: 'sun',
  treat: 'warn',
  harvest: 'sun',
  transplant: 'accent',
  other: 'neutral',
};

/** One task as a row of a Group: what, on which plant and where, when; the tick on the right. */
export function TaskRow({
  task,
  today,
  onDone,
  showPlant = true,
  showZone = true,
}: {
  task: TaskWithPlant;
  today: string;
  onDone: (t: TaskWithPlant) => void;
  showPlant?: boolean;
  /** Off where rows are already grouped under their zone. */
  showZone?: boolean;
}) {
  const t = useTheme();
  const overdue = daysBetween(today, task.dueOn) < 0;
  const where = showPlant ? [plantLabel(task), showZone && task.zoneName].filter(Boolean).join(' · ') : '';
  // Only the interval in force now; the task screen shows both seasons.
  const repeat = repeatLabel({ ...task, repeatDays: intervalOn(task, today), coldRepeatDays: null });
  const until =
    (task.repeatDays || task.yearly) && task.endsOn
      ? ` ${tr('fino al', 'until')} ${fromDay(task.endsOn).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`
      : '';
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.main}
        onPress={() => router.push({ pathname: '/task/edit', params: { id: String(task.id) } })}
      >
        <IconTile icon={TASK_SYMBOL[task.type]} tone={TASK_TONE[task.type]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>{task.title}</Text>
          {where ? <Text style={[styles.where, { color: t.text }]}>{where}</Text> : null}
          <Text style={[styles.meta, { color: t.muted }]}>
            <Text style={overdue ? { color: t.warn, fontWeight: '700' } : null}>{relativeLabel(task.dueOn, today)}</Text>
            {repeat ? ` · ${repeat}` : ''}
            {until}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={tr(`Segna come fatto: ${task.title}`, `Mark as done: ${task.title}`)}
        onPress={() => (task.type === 'transplant' ? openTransplant(task) : task.moves && task.plantId !== null ? openMoved(task) : onDone(task))}
        hitSlop={12}
        style={[styles.check, { borderColor: overdue ? t.warn : t.accent }]}
      />
    </View>
  );
}

/** Something ticked today: stays in Oggi, checked; tapping the tick undoes it. */
export function DoneRow({
  entry,
  onUndo,
  showZone = true,
}: {
  entry: DoneEntry;
  onUndo: (e: DoneEntry) => void;
  showZone?: boolean;
}) {
  const t = useTheme();
  const undoable = entry.taskId !== null;
  const where = [plantLabel(entry), showZone && entry.zoneName].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <View style={[styles.main, { opacity: 0.55 }]}>
        <IconTile icon={TASK_SYMBOL[entry.type]} tone="neutral" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text, textDecorationLine: 'line-through' }]}>{entry.title}</Text>
          {where ? <Text style={[styles.where, { color: t.text }]}>{where}</Text> : null}
          <Text style={[styles.meta, { color: t.muted }]}>{tr('Fatto oggi', 'Done today')}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: true, disabled: !undoable }}
        accessibilityLabel={tr(`Fatto: ${entry.title}`, `Done: ${entry.title}`) + (undoable ? tr('. Tocca per annullare', '. Tap to undo') : '')}
        onPress={() => undoable && onUndo(entry)}
        disabled={!undoable}
        hitSlop={12}
        style={[styles.check, styles.checked, { borderColor: t.accent, backgroundColor: t.accent }]}
      >
        <Icon name="tick" size={16} color={t.accentText} />
      </Pressable>
    </View>
  );
}

/** "Menta (piperita)": the variety tells apart plants of the same kind. */
function plantLabel(p: { plantName: string | null; plantVariety: string | null }): string | null {
  if (!p.plantName) return null;
  return p.plantVariety ? `${p.plantName} (${p.plantVariety})` : p.plantName;
}

/** A transplant reminder is done by marking the transplant, which starts the plan. */
export function openTransplant(task: Pick<TaskWithPlant, 'plantId'>) {
  if (task.plantId !== null) {
    router.push({ pathname: '/plant/transplant', params: { id: String(task.plantId) } });
  }
}

/** A task that moves the plant is done by saying where it is now. */
export function openMoved(task: Pick<TaskWithPlant, 'id'>, replace = false) {
  const to = { pathname: '/task/moved', params: { id: String(task.id) } } as const;
  if (replace) router.replace(to);
  else router.push(to);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 14 },
  title: { fontSize: 16, fontWeight: '600' },
  where: { fontSize: 15, marginTop: 1 },
  meta: { fontSize: 14, marginTop: 2 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, marginLeft: 12 },
  checked: { alignItems: 'center', justifyContent: 'center' },
});

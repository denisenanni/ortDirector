import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TASK_ICON } from '@/lib/presets';
import { daysBetween, relativeLabel } from '@/lib/schedule';
import type { TaskWithPlant } from '@/lib/types';
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
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Segna come fatto: ${task.title}`}
        onPress={() => onDone(task)}
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
          {task.repeatDays ? ` · ogni ${task.repeatDays === 1 ? 'giorno' : `${task.repeatDays} giorni`}` : ''}
        </Text>
      </Pressable>
    </View>
  );
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
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  title: { fontSize: 16, fontWeight: '500' },
});

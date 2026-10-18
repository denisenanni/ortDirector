import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen, Stepper } from '@/components/ui';
import {
  createTask,
  deleteTask,
  getTask,
  listPlants,
  markDone,
  postpone,
  updateTask,
  type TaskInput,
} from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { TASK_ICON, TASK_LABEL, TASK_TYPES } from '@/lib/presets';
import { addDays, daysBetween, relativeLabel, today as getToday } from '@/lib/schedule';
import type { Plant, Task, TaskType } from '@/lib/types';

export default function EditTaskScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; plantId?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const today = getToday();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [existing, setExisting] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>({
    plantId: params.plantId ? Number(params.plantId) : null,
    type: 'check',
    title: TASK_LABEL.check,
    dueOn: today,
    repeatDays: null,
    notes: null,
  });
  // Track whether the user typed a custom title, so switching type doesn't clobber it.
  const [customTitle, setCustomTitle] = useState(false);

  useEffect(() => {
    listPlants(db).then(setPlants);
    if (editingId !== null) {
      getTask(db, editingId).then((t) => {
        if (!t) return;
        setExisting(t);
        setForm({ plantId: t.plantId, type: t.type, title: t.title, dueOn: t.dueOn, repeatDays: t.repeatDays, notes: t.notes });
        setCustomTitle(t.title !== TASK_LABEL[t.type]);
      });
    }
  }, [db, editingId]);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setType = (type: TaskType) =>
    setForm((f) => ({ ...f, type, title: customTitle ? f.title : TASK_LABEL[type] }));

  const offset = daysBetween(today, form.dueOn);

  const finish = () => {
    syncReminders(db);
    router.back();
  };

  const save = async () => {
    const clean = { ...form, title: form.title.trim(), notes: form.notes?.trim() || null };
    if (editingId === null) await createTask(db, clean);
    else await updateTask(db, editingId, clean);
    finish();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {existing && (
            <>
              <Button
                label="✓ Fatto oggi"
                onPress={async () => {
                  await markDone(db, existing);
                  finish();
                }}
              />
              <Button
                kind="secondary"
                label="Rimanda a domani"
                onPress={async () => {
                  await postpone(db, existing, addDays(today, 1));
                  finish();
                }}
              />
            </>
          )}

          <Field label="Tipo">
            <ChipRow>
              {TASK_TYPES.map((t) => (
                <Chip key={t} label={`${TASK_ICON[t]} ${TASK_LABEL[t]}`} selected={form.type === t} onPress={() => setType(t)} />
              ))}
            </ChipRow>
          </Field>

          <Field label="Titolo">
            <Input
              value={form.title}
              onChangeText={(v) => {
                setCustomTitle(true);
                set('title', v);
              }}
            />
          </Field>

          <Field label="Pianta">
            <ChipRow>
              <Chip label="Nessuna" selected={form.plantId === null} onPress={() => set('plantId', null)} />
              {plants.map((p) => (
                <Chip key={p.id} label={p.name} selected={form.plantId === p.id} onPress={() => set('plantId', p.id)} />
              ))}
            </ChipRow>
          </Field>

          <Field label="Quando">
            <ChipRow>
              {[0, 1, 3, 7, 14].map((d) => (
                <Chip
                  key={d}
                  label={d === 0 ? 'Oggi' : d === 1 ? 'Domani' : `+${d} gg`}
                  selected={offset === d}
                  onPress={() => set('dueOn', addDays(today, d))}
                />
              ))}
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>{relativeLabel(form.dueOn, today)} · {form.dueOn}</Body>
            <Stepper
              value={Math.max(0, offset)}
              onChange={(v) => set('dueOn', addDays(today, v ?? 0))}
              min={0}
              format={(v) => (v === 0 ? 'Oggi' : `Tra ${v} giorni`)}
            />
          </Field>

          <Field label="Ripeti">
            <Stepper
              value={form.repeatDays}
              onChange={(v) => set('repeatDays', v)}
              allowOff="Una volta sola"
              format={(v) => (v === 1 ? 'Ogni giorno' : `Ogni ${v} giorni`)}
            />
          </Field>

          <Field label="Note">
            <Input value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline />
          </Field>

          <Button label="Salva" onPress={save} disabled={!form.title.trim()} />
          {existing && (
            <Button
              kind="danger"
              label="Elimina attività"
              onPress={async () => {
                await deleteTask(db, existing.id);
                finish();
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

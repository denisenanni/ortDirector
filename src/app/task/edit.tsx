import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { openTransplant } from '@/components/TaskRow';
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
import { MONTH_SHORT, TASK_LABEL, TASK_TYPES, monthsLabel } from '@/lib/presets';
import { addDays, daysBetween, fromDay, nextInSeason, relativeLabel, today as getToday } from '@/lib/schedule';
import type { Plant, Task, TaskType } from '@/lib/types';
import { TASK_SYMBOL } from '@/components/Icon';

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
    endsOn: null,
    yearly: false,
    months: null,
    coldRepeatDays: null,
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
        setForm({ plantId: t.plantId, type: t.type, title: t.title, dueOn: t.dueOn, repeatDays: t.repeatDays, endsOn: t.endsOn, yearly: t.yearly, months: t.months, coldRepeatDays: t.coldRepeatDays, notes: t.notes });
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
    const repeating = form.yearly || !!form.repeatDays;
    const months = repeating && form.months?.length ? form.months : null;
    const clean = {
      ...form,
      title: form.title.trim(),
      notes: form.notes?.trim() || null,
      months,
      // A task never starts outside its months.
      dueOn: nextInSeason(form.dueOn, months),
    };
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
              {existing.type === 'transplant' ? (
                <Button icon="transplant" label="Segna il trapianto" onPress={() => openTransplant(existing)} />
              ) : (
                <Button
                  icon="tick"
                  label="Fatto oggi"
                  onPress={async () => {
                    await markDone(db, existing);
                    finish();
                  }}
                />
              )}
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
                <Chip key={t} icon={TASK_SYMBOL[t]} label={TASK_LABEL[t]} selected={form.type === t} onPress={() => setType(t)} />
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
            <ChipRow>
              <Chip
                label="Una volta"
                selected={!form.yearly && !form.repeatDays}
                onPress={() => setForm((f) => ({ ...f, yearly: false, repeatDays: null }))}
              />
              <Chip
                label="Ogni tot giorni"
                selected={!form.yearly && !!form.repeatDays}
                onPress={() => setForm((f) => ({ ...f, yearly: false, repeatDays: f.repeatDays ?? 7 }))}
              />
              <Chip
                label="Ogni anno"
                selected={form.yearly}
                onPress={() => setForm((f) => ({ ...f, yearly: true, repeatDays: null }))}
              />
            </ChipRow>
            {!form.yearly && form.repeatDays ? (
              <View style={{ marginTop: 8 }}>
                <Stepper
                  value={form.repeatDays}
                  onChange={(v) => set('repeatDays', v ?? 1)}
                  format={(v) => (v === 1 ? 'Ogni giorno' : `Ogni ${v} giorni`)}
                />
              </View>
            ) : null}
            {(form.repeatDays || form.yearly) && form.endsOn ? (
              <>
                <Body muted style={{ marginTop: 8 }}>
                  Fino al {fromDay(form.endsOn).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                </Body>
                <Button kind="secondary" label="Ripeti senza scadenza" onPress={() => set('endsOn', null)} />
              </>
            ) : null}
          </Field>

          {form.repeatDays || form.yearly ? (
            <Field label="Solo in questi mesi">
              <ChipRow>
                {MONTH_SHORT.map((name, i) => {
                  const m = i + 1;
                  const on = !!form.months?.includes(m);
                  return (
                    <Chip
                      key={m}
                      label={name}
                      selected={on}
                      onPress={() =>
                        setForm((f) => {
                          const cur = f.months ?? [];
                          const next = on ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => a - b);
                          return { ...f, months: next.length ? next : null };
                        })
                      }
                    />
                  );
                })}
              </ChipRow>
              <Body muted style={{ marginTop: 8 }}>
                {form.months?.length
                  ? form.yearly
                    ? `Una volta l’anno, ${monthsLabel(form.months)}.`
                    : `Fuori da ${monthsLabel(form.months)} si ferma e riparte il primo giorno utile.`
                  : form.yearly
                    ? 'Nessun mese scelto: torna lo stesso giorno l’anno prossimo.'
                    : 'Nessun mese scelto: tutto l’anno.'}
              </Body>
            </Field>
          ) : null}

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

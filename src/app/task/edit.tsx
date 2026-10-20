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
import { TASK_LABEL, TASK_TYPES, everyDays, monthShort, monthsLabel } from '@/lib/presets';
import { addDays, daysBetween, fromDay, nextInSeason, relativeLabel, today as getToday } from '@/lib/schedule';
import type { Plant, Task, TaskType } from '@/lib/types';
import { TASK_SYMBOL } from '@/components/Icon';
import { capitalize, locale, tr } from '@/lib/i18n';

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
                <Button icon="transplant" label={tr('Segna il trapianto', 'Mark as transplanted')} onPress={() => openTransplant(existing)} />
              ) : (
                <Button
                  icon="tick"
                  label={tr('Fatto oggi', 'Done today')}
                  onPress={async () => {
                    await markDone(db, existing);
                    finish();
                  }}
                />
              )}
              <Button
                kind="secondary"
                label={tr('Rimanda a domani', 'Put off to tomorrow')}
                onPress={async () => {
                  await postpone(db, existing, addDays(today, 1));
                  finish();
                }}
              />
            </>
          )}

          <Field label={tr('Tipo', 'Type')}>
            <ChipRow>
              {TASK_TYPES.map((t) => (
                <Chip key={t} icon={TASK_SYMBOL[t]} label={TASK_LABEL[t]} selected={form.type === t} onPress={() => setType(t)} />
              ))}
            </ChipRow>
          </Field>

          <Field label={tr('Titolo', 'Title')}>
            <Input
              value={form.title}
              onChangeText={(v) => {
                setCustomTitle(true);
                set('title', v);
              }}
            />
          </Field>

          <Field label={tr('Pianta', 'Plant')}>
            <ChipRow>
              <Chip label={tr('Nessuna', 'None')} selected={form.plantId === null} onPress={() => set('plantId', null)} />
              {plants.map((p) => (
                <Chip key={p.id} label={p.name} selected={form.plantId === p.id} onPress={() => set('plantId', p.id)} />
              ))}
            </ChipRow>
          </Field>

          <Field label={tr('Quando', 'When')}>
            <ChipRow>
              {[0, 1, 3, 7, 14].map((d) => (
                <Chip
                  key={d}
                  label={d === 0 ? tr('Oggi', 'Today') : d === 1 ? tr('Domani', 'Tomorrow') : tr(`+${d} gg`, `+${d} d`)}
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
              format={(v) => (v === 0 ? tr('Oggi', 'Today') : tr(`Tra ${v} giorni`, `In ${v} days`))}
            />
          </Field>

          <Field label={tr('Ripeti', 'Repeat')}>
            <ChipRow>
              <Chip
                label={tr('Una volta', 'Once')}
                selected={!form.yearly && !form.repeatDays}
                onPress={() => setForm((f) => ({ ...f, yearly: false, repeatDays: null }))}
              />
              <Chip
                label={tr('Ogni tot giorni', 'Every few days')}
                selected={!form.yearly && !!form.repeatDays}
                onPress={() => setForm((f) => ({ ...f, yearly: false, repeatDays: f.repeatDays ?? 7 }))}
              />
              <Chip
                label={tr('Ogni anno', 'Every year')}
                selected={form.yearly}
                onPress={() => setForm((f) => ({ ...f, yearly: true, repeatDays: null }))}
              />
            </ChipRow>
            {!form.yearly && form.repeatDays ? (
              <View style={{ marginTop: 8 }}>
                <Stepper
                  value={form.repeatDays}
                  onChange={(v) => set('repeatDays', v ?? 1)}
                  format={(v) => capitalize(everyDays(v))}
                />
              </View>
            ) : null}
            {(form.repeatDays || form.yearly) && form.endsOn ? (
              <>
                <Body muted style={{ marginTop: 8 }}>
                  {tr('Fino al', 'Until')} {fromDay(form.endsOn).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}
                </Body>
                <Button kind="secondary" label={tr('Ripeti senza scadenza', 'Repeat with no end date')} onPress={() => set('endsOn', null)} />
              </>
            ) : null}
          </Field>

          {form.repeatDays || form.yearly ? (
            <Field label={tr('Solo in questi mesi', 'Only in these months')}>
              <ChipRow>
                {monthShort().map((name, i) => {
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
                    ? tr(`Una volta l’anno, ${monthsLabel(form.months)}.`, `Once a year, ${monthsLabel(form.months)}.`)
                    : tr(
                        `Fuori da ${monthsLabel(form.months)} si ferma e riparte il primo giorno utile.`,
                        `Outside ${monthsLabel(form.months)} it pauses and restarts on the first day it can.`,
                      )
                  : form.yearly
                    ? tr('Nessun mese scelto: torna lo stesso giorno l’anno prossimo.', 'No months chosen: it comes back on the same day next year.')
                    : tr('Nessun mese scelto: tutto l’anno.', 'No months chosen: all year.')}
              </Body>
            </Field>
          ) : null}

          <Field label={tr('Note', 'Notes')}>
            <Input value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline />
          </Field>

          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!form.title.trim()} />
          {existing && (
            <Button
              kind="danger"
              label={tr('Elimina attività', 'Delete task')}
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

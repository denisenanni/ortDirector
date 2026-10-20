import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, PastDayPicker, Screen, Stepper } from '@/components/ui';
import { createPlant, deletePlant, getPlant, updatePlant, type PlantInput } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { planFor } from '@/lib/plans';
import { PLANT_PRESETS, SUN_ICON, SUN_LABEL, presetFor } from '@/lib/presets';
import { today as getToday } from '@/lib/schedule';
import type { Sun } from '@/lib/types';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

/** How a new plant starts out. */
type Start = 'sown' | 'seedling' | 'ground';

const START_LABEL: Record<Start, string> = {
  sown: '🌰 Seminata',
  seedling: '🪴 Piantina da trapiantare',
  ground: '🌳 Già a dimora',
};

const EMPTY: PlantInput = {
  name: '',
  variety: null,
  location: null,
  sun: 'full',
  waterEveryDays: 3,
  stage: 'ground',
  sownOn: null,
  plantedOn: null,
  preset: null,
  notes: null,
};

export default function EditPlantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const [form, setForm] = useState<PlantInput>(EMPTY);
  const [tip, setTip] = useState<string | null>(null);
  const [start, setStart] = useState<Start>('ground');
  const today = getToday();

  useEffect(() => {
    if (editingId === null) return;
    getPlant(db, editingId).then((p) => {
      if (p) {
        const { id: _id, ...rest } = p;
        setForm(rest);
      }
    });
  }, [db, editingId]);

  const set = <K extends keyof PlantInput>(key: K, value: PlantInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const applyPreset = (name: string) => {
    if (form.preset === name) {
      setForm((f) => ({ ...f, preset: null }));
      setTip(null);
      return;
    }
    const preset = PLANT_PRESETS.find((p) => p.name === name)!;
    setForm((f) => ({
      ...f,
      name: preset.name,
      preset: preset.name,
      sun: preset.sun,
      waterEveryDays: preset.waterEveryDays,
    }));
    setTip(preset.tip);
  };

  const plan = planFor(presetFor(form)?.name);

  const save = async () => {
    const clean: PlantInput = {
      ...form,
      name: form.name.trim(),
      variety: form.variety?.trim() || null,
      location: form.location?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    if (editingId === null) {
      // A plant with a plan goes into the ground through the transplant
      // screen, which picks the day and the plan's tasks.
      const viaTransplant = start === 'ground' && !!plan;
      if (start === 'sown') {
        Object.assign(clean, { stage: 'seedbed', sownOn: clean.sownOn ?? today, plantedOn: null });
      } else if (start === 'seedling' || viaTransplant) {
        Object.assign(clean, { stage: 'seedbed', sownOn: null, plantedOn: null });
      } else {
        Object.assign(clean, { stage: 'ground', sownOn: null, plantedOn: clean.plantedOn ?? today });
      }
      const newId = await createPlant(db, clean);
      router.replace(`/plant/${newId}`);
      if (viaTransplant) router.push({ pathname: '/plant/transplant', params: { id: String(newId) } });
    } else {
      await updatePlant(db, editingId, clean);
      router.back();
    }
    syncReminders(db);
  };

  const remove = () => {
    if (editingId === null) return;
    Alert.alert('Eliminare la pianta?', 'Verranno eliminate anche le sue attività e lo storico.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await deletePlant(db, editingId);
          syncReminders(db);
          router.dismissTo('/plants');
        },
      },
    ]);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {editingId === null && (
            <Field label="Parti da una pianta comune">
              <ChipRow>
                {PLANT_PRESETS.map((p) => (
                  <Chip key={p.name} label={p.name} selected={form.preset === p.name} onPress={() => applyPreset(p.name)} />
                ))}
              </ChipRow>
              {tip ? <Body muted style={{ marginTop: 8 }}>💡 {tip}</Body> : null}
            </Field>
          )}

          {editingId === null && (
            <Field label="Com’è adesso">
              <ChipRow>
                {(Object.keys(START_LABEL) as Start[]).map((k) => (
                  <Chip key={k} label={START_LABEL[k]} selected={start === k} onPress={() => setStart(k)} />
                ))}
              </ChipRow>
              {start === 'sown' && plan?.sowToTransplantWeeks ? (
                <Body muted style={{ marginTop: 8 }}>
                  Ti ricordo di trapiantarla dopo {plan.sowToTransplantWeeks[0]}-{plan.sowToTransplantWeeks[1]} settimane.
                </Body>
              ) : null}
              {start === 'ground' && plan ? (
                <Body muted style={{ marginTop: 8 }}>
                  Dopo il salvataggio scegli quando l’hai messa a dimora e le attività del piano.
                </Body>
              ) : null}
            </Field>
          )}

          {(editingId === null ? start === 'sown' : form.stage === 'seedbed' && form.sownOn) ? (
            <Field label="Seminata">
              <PastDayPicker value={form.sownOn ?? today} onChange={(d) => set('sownOn', d)} today={today} />
            </Field>
          ) : null}
          {(editingId === null ? start === 'ground' && !plan : form.stage === 'ground' && form.plantedOn) ? (
            <Field label="A dimora dal">
              <PastDayPicker value={form.plantedOn ?? today} onChange={(d) => set('plantedOn', d)} today={today} />
            </Field>
          ) : null}

          <Field label="Nome">
            <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="Es. Pomodoro" />
          </Field>
          <Field label="Varietà (facoltativo)">
            <Input value={form.variety ?? ''} onChangeText={(v) => set('variety', v)} placeholder="Es. Cuore di bue" />
          </Field>
          <Field label="Posizione (facoltativo)">
            <Input value={form.location ?? ''} onChangeText={(v) => set('location', v)} placeholder="Es. Aiuola nord, vaso sul balcone" />
          </Field>
          <Field label="Esposizione">
            <ChipRow>
              {SUNS.map((s) => (
                <Chip key={s} label={`${SUN_ICON[s]} ${SUN_LABEL[s]}`} selected={form.sun === s} onPress={() => set('sun', s)} />
              ))}
            </ChipRow>
          </Field>
          <Field label="Irrigazione">
            <Stepper
              value={form.waterEveryDays}
              onChange={(v) => set('waterEveryDays', v)}
              max={60}
              allowOff="Nessun promemoria"
              format={(v) => (v === 1 ? 'Ogni giorno' : `Ogni ${v} giorni`)}
            />
          </Field>
          <Field label="Note">
            <Input value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline placeholder="Concime, problemi, osservazioni…" />
          </Field>

          <Button label="Salva" onPress={save} disabled={!form.name.trim()} />
          {editingId !== null && <Button kind="danger" label="Elimina pianta" onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

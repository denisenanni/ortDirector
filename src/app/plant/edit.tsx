import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen, Stepper } from '@/components/ui';
import { createPlant, deletePlant, getPlant, updatePlant, type PlantInput } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { PLANT_PRESETS, SUN_ICON, SUN_LABEL } from '@/lib/presets';
import type { Sun } from '@/lib/types';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

const EMPTY: PlantInput = {
  name: '',
  variety: null,
  location: null,
  sun: 'full',
  waterEveryDays: 3,
  plantedOn: null,
  notes: null,
};

export default function EditPlantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const [form, setForm] = useState<PlantInput>(EMPTY);
  const [tip, setTip] = useState<string | null>(null);

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
    const preset = PLANT_PRESETS.find((p) => p.name === name)!;
    setForm((f) => ({ ...f, name: preset.name, sun: preset.sun, waterEveryDays: preset.waterEveryDays }));
    setTip(preset.tip);
  };

  const save = async () => {
    const clean: PlantInput = {
      ...form,
      name: form.name.trim(),
      variety: form.variety?.trim() || null,
      location: form.location?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    if (editingId === null) {
      const newId = await createPlant(db, clean);
      router.replace(`/plant/${newId}`);
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
                  <Chip key={p.name} label={p.name} selected={form.name === p.name} onPress={() => applyPreset(p.name)} />
                ))}
              </ChipRow>
              {tip ? <Body muted style={{ marginTop: 8 }}>💡 {tip}</Body> : null}
            </Field>
          )}

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

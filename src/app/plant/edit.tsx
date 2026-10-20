import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, PastDayPicker, Screen, Stepper, useTheme } from '@/components/ui';
import { coldWateringDefault, createPlant, deletePlant, getPlant, listZones, updatePlant, type PlantInput } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { planFor } from '@/lib/plans';
import { PLANT_PRESETS, SUN_LABEL, isAnnual, presetFor } from '@/lib/presets';
import { deletePhoto } from '@/lib/photos';
import { sunMismatch, today as getToday } from '@/lib/schedule';
import type { Sun, Zone } from '@/lib/types';
import { SUN_SYMBOL } from '@/components/Icon';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

/** How a new plant starts out. */
type Start = 'sown' | 'seedling' | 'ground' | 'potted';

const START_LABEL: Record<Start, string> = {
  sown: 'Seminata',
  seedling: 'Piantina da trapiantare',
  ground: 'A dimora in terra',
  potted: 'In vaso',
};

const EMPTY: PlantInput = {
  name: '',
  variety: null,
  location: null,
  zoneId: null,
  potted: false,
  sun: 'full',
  waterEveryDays: 3,
  waterColdDays: 9,
  stage: 'ground',
  sownOn: null,
  plantedOn: null,
  preset: null,
  annual: false,
  archivedOn: null,
  photo: null,
  notes: null,
};

export default function EditPlantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const [form, setForm] = useState<PlantInput>(EMPTY);
  const [tip, setTip] = useState<string | null>(null);
  const [start, setStart] = useState<Start>('ground');
  const [zones, setZones] = useState<Zone[]>([]);
  const t = useTheme();
  const today = getToday();

  // Reload on focus, to pick up a zone just created from here, and select it.
  const knownZones = useRef<Set<number> | null>(null);
  useFocusEffect(
    useCallback(() => {
      listZones(db).then((list) => {
        const added = knownZones.current && list.find((z) => !knownZones.current!.has(z.id));
        knownZones.current = new Set(list.map((z) => z.id));
        setZones(list);
        if (added) setForm((f) => ({ ...f, zoneId: added.id }));
      });
    }, [db]),
  );

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
      annual: isAnnual(preset.name),
      sun: preset.sun,
      waterEveryDays: preset.waterEveryDays,
      waterColdDays: coldWateringDefault(preset.waterEveryDays),
    }));
    setTip(preset.tip);
  };

  const plan = planFor(presetFor(form)?.name);
  const zone = zones.find((z) => z.id === form.zoneId);
  const mismatch = zone ? sunMismatch(form.sun, zone.sun) : null;

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
      const final = start === 'ground' || start === 'potted';
      const viaTransplant = final && !!plan;
      clean.potted = start === 'potted';
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
          deletePhoto(form.photo);
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
              {/* Two scrolling rows instead of a wall of chips. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16 }}
              >
                <View style={{ gap: 8 }}>
                  {[0, 1].map((r) => (
                    <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
                      {PLANT_PRESETS.filter((_, i) => i % 2 === r).map((p) => (
                        <Chip
                          key={p.name}
                          label={p.name}
                          selected={form.preset === p.name}
                          onPress={() => applyPreset(p.name)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              {tip ? <Body muted style={{ marginTop: 8 }}>{tip}</Body> : null}
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
              {(start === 'ground' || start === 'potted') && plan ? (
                <Body muted style={{ marginTop: 8 }}>
                  Dopo il salvataggio scegli da quando è lì e le attività del piano.
                </Body>
              ) : null}
            </Field>
          )}

          {editingId !== null && form.stage === 'ground' ? (
            <Field label="Dove">
              <ChipRow>
                <Chip icon="ground" label="In terra" selected={!form.potted} onPress={() => set('potted', false)} />
                <Chip label="In vaso" selected={form.potted} onPress={() => set('potted', true)} />
              </ChipRow>
            </Field>
          ) : null}

          {(editingId === null ? start === 'sown' : form.stage === 'seedbed' && form.sownOn) ? (
            <Field label="Seminata">
              <PastDayPicker value={form.sownOn ?? today} onChange={(d) => set('sownOn', d)} today={today} />
            </Field>
          ) : null}
          {(editingId === null ? (start === 'ground' || start === 'potted') && !plan : form.stage === 'ground' && form.plantedOn) ? (
            <Field label={start === 'potted' || form.potted ? 'In vaso dal' : 'A dimora dal'}>
              <PastDayPicker value={form.plantedOn ?? today} onChange={(d) => set('plantedOn', d)} today={today} />
            </Field>
          ) : null}

          <Field label="Nome">
            <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="Es. Pomodoro" />
          </Field>
          <Field label="Varietà (facoltativo)">
            <Input value={form.variety ?? ''} onChangeText={(v) => set('variety', v)} placeholder="Es. Cuore di bue" />
          </Field>
          <Field label="Zona">
            <ChipRow>
              <Chip label="Nessuna" selected={form.zoneId === null} onPress={() => set('zoneId', null)} />
              {zones.map((z) => (
                <Chip
                  key={z.id}
                  icon={SUN_SYMBOL[z.sun]}
                  label={z.name}
                  selected={form.zoneId === z.id}
                  onPress={() => set('zoneId', z.id)}
                />
              ))}
              <Chip icon="add" label="Nuova zona" onPress={() => router.push('/zone/edit')} />
            </ChipRow>
            {mismatch ? <Body style={{ marginTop: 8, color: t.warn }}>{mismatch}</Body> : null}
          </Field>
          <Field label="Sole che le serve">
            <ChipRow>
              {SUNS.map((s) => (
                <Chip key={s} icon={SUN_SYMBOL[s]} label={SUN_LABEL[s]} selected={form.sun === s} onPress={() => set('sun', s)} />
              ))}
            </ChipRow>
          </Field>
          <Field label="Irrigazione da maggio a settembre">
            <Stepper
              value={form.waterEveryDays}
              onChange={(v) => set('waterEveryDays', v)}
              max={60}
              allowOff="Nessun promemoria"
              format={(v) => (v === 1 ? 'Ogni giorno' : `Ogni ${v} giorni`)}
            />
          </Field>
          {form.waterEveryDays ? (
            <Field label="Irrigazione nel resto dell’anno">
              <Stepper
                value={form.waterColdDays}
                onChange={(v) => set('waterColdDays', v)}
                max={90}
                allowOff="Come d’estate"
                format={(v) => (v === 1 ? 'Ogni giorno' : `Ogni ${v} giorni`)}
              />
            </Field>
          ) : null}
          <Field label="Ciclo">
            <ChipRow>
              <Chip label="Annuale" selected={form.annual} onPress={() => set('annual', true)} />
              <Chip label="Perenne" selected={!form.annual} onPress={() => set('annual', false)} />
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>
              Le annuali a fine stagione si archiviano: restano con il loro storico ma spariscono da Oggi.
            </Body>
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

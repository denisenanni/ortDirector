import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, PastDayPicker, Screen, Stepper, ToggleRow, useTheme } from '@/components/ui';
import { createPlant, deletePlant, getPlant, transplant, updatePlant, type PlantInput } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { PLANT_KINDS, kindFor } from '@/lib/kinds';
import { expandPlan, planFor } from '@/lib/plans';
import { PLANT_SIZE_LABEL, POT_LABEL, POT_SIZE_LABEL, SUN_LABEL, catalog, everyDays, isAnnual, presetFor, searchPresets } from '@/lib/presets';
import { customFor } from '@/lib/custom';
import { deletePhoto } from '@/lib/photos';
import { sunMismatch, today as getToday } from '@/lib/schedule';
import type { Size, Sun } from '@/lib/types';
import { plantWatering } from '@/lib/watering';
import { SUN_SYMBOL } from '@/components/Icon';
import { ZoneChips, useZones } from '@/components/ZoneChips';
import { capitalize, cat, tr } from '@/lib/i18n';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

/** How a new plant starts out. */
type Start = 'sown' | 'seedling' | 'ground' | 'potted';

const START_LABEL: Record<Start, string> = {
  get sown() { return tr('Seminata', 'Sown'); },
  get seedling() { return tr('Piantina da trapiantare', 'Seedling to transplant'); },
  get ground() { return tr('A dimora in terra', 'In the ground'); },
  get potted() { return tr('In vaso', 'In a pot'); },
};

const SIZES: Size[] = ['small', 'medium', 'large'];

/** The catalog's watering for the plant, scaled to its size and pot; unchanged without a catalog entry. */
const withWatering = (f: PlantInput): PlantInput => ({ ...f, ...plantWatering(f) });

/** Whether the watering is still the one worked out from the catalog, not one the user set. */
const computedWatering = (f: PlantInput) => {
  const w = plantWatering(f);
  return !w || (w.waterEveryDays === f.waterEveryDays && w.waterColdDays === f.waterColdDays);
};

const EMPTY: PlantInput = {
  name: '',
  variety: null,
  location: null,
  zoneId: null,
  potted: false,
  size: 'medium',
  potSize: 'medium',
  covered: false,
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
  const [query, setQuery] = useState('');
  const [start, setStart] = useState<Start>('ground');
  // For a plant outside the catalog, created from a kind.
  const [tender, setTender] = useState(false);
  const t = useTheme();
  const today = getToday();

  // A zone just created from here gets selected.
  const zones = useZones((zoneId) => setForm((f) => ({ ...f, zoneId })));

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
  /** Changes what decides the watering (start, size, pot), and recomputes it unless the user set their own. */
  const setWatering = (patch: Partial<PlantInput>) =>
    setForm((f) => (computedWatering(f) ? withWatering({ ...f, ...patch }) : { ...f, ...patch }));

  const applyPreset = (name: string) => {
    if (form.preset === name) {
      setForm((f) => ({ ...f, preset: null }));
      setTip(null);
      return;
    }
    const preset = catalog().find((p) => p.name === name)!;
    setForm((f) =>
      withWatering({ ...f, name: cat(preset.name), preset: preset.name, annual: isAnnual(preset.name), sun: preset.sun }),
    );
    // The search box shows what was picked, like an autocomplete.
    setQuery(cat(preset.name));
    setTip(cat(preset.tip));
  };

  const applyKind = (name: string) => {
    if (form.preset === name) {
      setForm((f) => ({ ...f, preset: null }));
      setTip(null);
      return;
    }
    const k = kindFor(name)!;
    setForm((f) => withWatering({ ...f, preset: k.name, annual: !!k.annual, sun: k.sun }));
    setTender(k.tender);
    setTip(cat(k.tip));
  };

  const kind = editingId === null ? kindFor(form.preset) : undefined;

  // A new plant's stage and pot follow how it starts out.
  const changeStart = (s: Start) => {
    setStart(s);
    setWatering({ stage: s === 'ground' || s === 'potted' ? 'ground' : 'seedbed', potted: s === 'potted' });
  };
  const inPlace = editingId === null ? start === 'ground' || start === 'potted' : form.stage === 'ground';
  const potted = editingId === null ? start === 'potted' : form.potted;

  const plan = planFor(presetFor(form)?.name);
  const matches = searchPresets(query).slice(0, 12);
  const chosen = form.preset ? catalog().find((p) => p.name === form.preset) : undefined;
  const inCatalog = catalog().some((p) => p.name === presetFor(form)?.name);
  const zone = zones.find((z) => z.id === form.zoneId);
  // Taking a plant out of the ground to put it elsewhere is a move, not a correction.
  const zoneLocked = editingId !== null && form.stage === 'ground' && !form.potted;
  const mismatch = zone ? sunMismatch(form.sun, zone.sun) : null;

  const save = async () => {
    const clean: PlantInput = {
      ...form,
      name: form.name.trim(),
      variety: form.variety?.trim() || null,
      location: form.location?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    // A seedling's size changes before it's planted out; a pot has a size only when there is one.
    if (!inPlace) Object.assign(clean, { size: null, potSize: null });
    if (!potted) clean.potSize = null;
    if (editingId === null) {
      clean.potted = start === 'potted';
      if (start === 'sown') {
        Object.assign(clean, { stage: 'seedbed', sownOn: clean.sownOn ?? today, plantedOn: null });
      } else if (start === 'seedling') {
        Object.assign(clean, { stage: 'seedbed', sownOn: null, plantedOn: null });
      } else {
        Object.assign(clean, { stage: 'ground', sownOn: null, plantedOn: clean.plantedOn ?? today });
      }
      // Already in the ground or its pot: the plan counts from that day, and
      // steps whose day has passed are left out, so an old plant doesn't
      // flood Oggi.
      const planned = clean.stage === 'ground' && plan ? expandPlan(plan.steps, clean.plantedOn!, today) : null;
      if (planned) Object.assign(clean, { stage: 'seedbed', plantedOn: null });
      // A plant added from a file says itself whether it fears frost.
      const fearsFrost = kind ? tender : customFor(clean.preset)?.tender ?? false;
      const newId = await createPlant(db, clean, { tender: fearsFrost, young: !!kind && clean.size === 'small' });
      if (planned) await transplant(db, newId, form.plantedOn ?? today, planned, clean);
      router.replace(`/plant/${newId}`);
    } else {
      await updatePlant(db, editingId, clean);
      router.back();
    }
    syncReminders(db);
  };

  const remove = () => {
    if (editingId === null) return;
    Alert.alert(
      tr('Eliminare la pianta?', 'Delete the plant?'),
      tr('Verranno eliminate anche le sue attività e lo storico.', 'Its tasks and history will be deleted too.'),
      [
        { text: tr('Annulla', 'Cancel'), style: 'cancel' },
        {
          text: tr('Elimina', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await deletePlant(db, editingId);
            deletePhoto(form.photo);
            syncReminders(db);
            router.dismissTo('/plants');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {editingId === null && (
            <Field label={tr('Cerca nel catalogo', 'Find it in the catalog')}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={tr('Cerca: pomodoro, insalata, cavolo, aromatiche…', 'Search: tomato, salad, cabbage, herbs…')}
                autoCorrect={false}
              />
              {matches.length > 0 || chosen ? (
                <View style={{ marginTop: 8 }}>
                  <ChipRow>
                    {chosen && !matches.includes(chosen) ? (
                      <Chip label={cat(chosen.name)} selected onPress={() => applyPreset(chosen.name)} />
                    ) : null}
                    {matches.map((p) => (
                      <Chip
                        key={p.name}
                        label={cat(p.name)}
                        selected={form.preset === p.name}
                        onPress={() => applyPreset(p.name)}
                      />
                    ))}
                  </ChipRow>
                </View>
              ) : query.trim() ? (
                <Body muted style={{ marginTop: 8 }}>
                  {tr('Non è nel catalogo: scegli qui sotto che tipo di pianta è e scrivi il nome.', 'Not in the catalog: pick below what kind of plant it is and type its name.')}
                </Body>
              ) : null}
              {tip && !kind ? <Body muted style={{ marginTop: 8 }}>{tip}</Body> : null}
            </Field>
          )}

          {editingId === null && !chosen && (
            <Field label={tr('Non è nel catalogo? Dimmi che pianta è', 'Not in the catalog? Tell me what it is')}>
              <ChipRow>
                {PLANT_KINDS.map((k) => (
                  <Chip key={k.name} label={cat(k.name)} selected={form.preset === k.name} onPress={() => applyKind(k.name)} />
                ))}
              </ChipRow>
              {tip && kind ? <Body muted style={{ marginTop: 8 }}>{tip}</Body> : null}
            </Field>
          )}

          {kind ? (
            <Field label={tr('Gelo', 'Frost')}>
              <View>
                <ToggleRow
                  label={tr('Teme il gelo', 'Fears frost')}
                  detail={tr(
                    'Ti ricordo di proteggerla a novembre e di toglierle la protezione in primavera.',
                    'I’ll remind you to protect it in November and to uncover it in spring.',
                  )}
                  on={tender}
                  onPress={() => setTender((v) => !v)}
                />
              </View>
            </Field>
          ) : null}

          {/* Right after what it is, so a plant outside the catalog gets its name without scrolling. */}
          <Field label={tr('Nome', 'Name')}>
            <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder={tr('Es. Pomodoro', 'E.g. Tomato')} />
          </Field>
          <Field label={tr('Varietà (facoltativo)', 'Variety (optional)')}>
            <Input value={form.variety ?? ''} onChangeText={(v) => set('variety', v)} placeholder={tr('Es. Cuore di bue', 'E.g. Beefsteak')} />
          </Field>

          {editingId === null && (
            <Field label={tr('Com’è adesso', 'Where it is now')}>
              <ChipRow>
                {(Object.keys(START_LABEL) as Start[]).map((k) => (
                  <Chip key={k} label={START_LABEL[k]} selected={start === k} onPress={() => changeStart(k)} />
                ))}
              </ChipRow>
              {start === 'sown' && plan?.sowToTransplantWeeks ? (
                <Body muted style={{ marginTop: 8 }}>
                  {tr(
                    `Ti ricordo di trapiantarla dopo ${plan.sowToTransplantWeeks[0]}-${plan.sowToTransplantWeeks[1]} settimane.`,
                    `I’ll remind you to transplant it after ${plan.sowToTransplantWeeks[0]}-${plan.sowToTransplantWeeks[1]} weeks.`,
                  )}
                </Body>
              ) : null}
              {(start === 'ground' || start === 'potted') && plan ? (
                <Body muted style={{ marginTop: 8 }}>
                  {tr(
                    'Le attività del piano partono dal giorno qui sotto; quelle già passate non vengono aggiunte.',
                    'The plan’s tasks count from the day below; the ones already past are left out.',
                  )}
                </Body>
              ) : null}
            </Field>
          )}

          {editingId !== null && form.stage === 'ground' ? (
            // Going from the ground to a pot or into another pot is something that happens to the
            // plant, with care after it and a line in its history: it has its own screen.
            <Field label={tr('Dove', 'Where')}>
              <Body>
                {form.potted
                  ? `${tr('In vaso', 'In a pot')}${form.potSize ? ` (${POT_LABEL[form.potSize].toLowerCase()})` : ''}`
                  : `${tr('In terra', 'In the ground')}${zone ? `, ${zone.name}` : ''}`}
              </Body>
              <Body muted style={{ marginTop: 4, marginBottom: 8 }}>
                {form.potted
                  ? tr(
                      'Per metterla in terra o in un vaso nuovo usa “Rinvasa o sposta”: aggiunge le cure dopo e lo segna nello storico.',
                      'To put it in the ground or in a new pot use “Repot or move”: it adds the care after it and logs it.',
                    )
                  : tr(
                      'Per metterla in vaso o in un’altra zona usa “Rinvasa o sposta”: aggiunge le cure dopo e lo segna nello storico.',
                      'To put it in a pot or in another zone use “Repot or move”: it adds the care after it and logs it.',
                    )}
              </Body>
              <Button
                kind="secondary"
                icon="transplant"
                label={tr('Rinvasa o sposta', 'Repot or move')}
                onPress={() => router.replace({ pathname: '/plant/move', params: { id: String(editingId) } })}
              />
            </Field>
          ) : null}

          {inPlace ? (
            <Field label={tr('Quanto è grande la pianta', 'How big the plant is')}>
              <ChipRow>
                {SIZES.map((k) => (
                  <Chip key={k} label={PLANT_SIZE_LABEL[k]} selected={form.size === k} onPress={() => setWatering({ size: k })} />
                ))}
              </ChipRow>
            </Field>
          ) : null}
          {editingId === null && inPlace && potted ? (
            <Field label={tr('Quanto è grande il vaso', 'How big the pot is')}>
              <ChipRow>
                {SIZES.map((k) => (
                  <Chip key={k} label={POT_SIZE_LABEL[k]} selected={form.potSize === k} onPress={() => setWatering({ potSize: k })} />
                ))}
              </ChipRow>
            </Field>
          ) : null}

          {(editingId === null ? start === 'sown' : form.stage === 'seedbed' && form.sownOn) ? (
            <Field label={tr('Seminata', 'Sown')}>
              <PastDayPicker value={form.sownOn ?? today} onChange={(d) => set('sownOn', d)} today={today} />
            </Field>
          ) : null}
          {(editingId === null ? start === 'ground' || start === 'potted' : form.stage === 'ground' && form.plantedOn) ? (
            <Field label={start === 'potted' || form.potted ? tr('In vaso dal', 'In its pot since') : tr('A dimora dal', 'In the ground since')}>
              <PastDayPicker value={form.plantedOn ?? today} onChange={(d) => set('plantedOn', d)} today={today} />
            </Field>
          ) : null}

          <Field label={zoneLocked ? tr('Riparo', 'Shelter') : tr('Zona', 'Zone')}>
            {zoneLocked ? null : <ZoneChips zones={zones} value={form.zoneId} onChange={(id) => set('zoneId', id)} />}
            {mismatch ? <Body style={{ marginTop: 8, color: t.warn }}>{mismatch}</Body> : null}
            <View style={{ marginTop: zoneLocked ? 0 : 12 }}>
              <ToggleRow
                label={tr('Al coperto', 'Under cover')}
                detail={
                  zone?.covered
                    ? tr('La zona è già al coperto.', 'The zone is under cover already.')
                    : tr(
                        'Sotto una tettoia, in casa, in serra: la pioggia non la bagna, quindi “Ha piovuto” non sposta la sua annaffiatura.',
                        'Under a roof, indoors, in a greenhouse: rain doesn’t reach it, so “It rained” doesn’t move its watering.',
                      )
                }
                on={form.covered || !!zone?.covered}
                disabled={!!zone?.covered}
                onPress={() => set('covered', !form.covered)}
              />
            </View>
          </Field>
          {/* The catalog knows the sun its plants need; kinds and plants outside it don't. */}
          {inCatalog ? null : (
            <Field label={tr('Sole che le serve', 'Sun it needs')}>
              <ChipRow>
                {SUNS.map((s) => (
                  <Chip key={s} icon={SUN_SYMBOL[s]} label={SUN_LABEL[s]} selected={form.sun === s} onPress={() => set('sun', s)} />
                ))}
              </ChipRow>
            </Field>
          )}
          <Field label={tr('Irrigazione da maggio a settembre', 'Watering from May to September')}>
            <Stepper
              value={form.waterEveryDays}
              onChange={(v) => set('waterEveryDays', v)}
              max={60}
              allowOff={tr('Nessun promemoria', 'No reminder')}
              format={(v) => capitalize(everyDays(v))}
            />
            {inPlace && presetFor(form) ? (
              <Body muted style={{ marginTop: 8 }}>
                {potted
                  ? tr('Calcolata dal catalogo, dalla pianta e dal vaso. Puoi cambiarla.', 'Worked out from the catalog, the plant and its pot. You can change it.')
                  : tr('Calcolata dal catalogo e dalla taglia della pianta. Puoi cambiarla.', 'Worked out from the catalog and the plant’s size. You can change it.')}
              </Body>
            ) : null}
          </Field>
          {form.waterEveryDays ? (
            <Field label={tr('Irrigazione nel resto dell’anno', 'Watering the rest of the year')}>
              <Stepper
                value={form.waterColdDays}
                onChange={(v) => set('waterColdDays', v)}
                max={90}
                allowOff={tr('Come d’estate', 'Same as summer')}
                format={(v) => capitalize(everyDays(v))}
              />
            </Field>
          ) : null}
          <Field label={tr('Ciclo', 'Life cycle')}>
            <ChipRow>
              <Chip label={tr('Annuale', 'Annual')} selected={form.annual} onPress={() => set('annual', true)} />
              <Chip label={tr('Perenne', 'Perennial')} selected={!form.annual} onPress={() => set('annual', false)} />
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>
              {tr(
                'Le annuali a fine stagione si archiviano: restano con il loro storico ma spariscono da Oggi.',
                'Annuals get archived at the end of the season: they keep their history but leave Today.',
              )}
            </Body>
          </Field>
          <Field label={tr('Note', 'Notes')}>
            <Input value={form.notes ?? ''} onChangeText={(v) => set('notes', v)} multiline placeholder={tr('Concime, problemi, osservazioni…', 'Feeding, problems, observations…')} />
          </Field>

          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!form.name.trim()} />
          {editingId !== null && <Button kind="danger" label={tr('Elimina pianta', 'Delete plant')} onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

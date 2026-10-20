import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen } from '@/components/ui';
import { countZonePlants, deleteZone, getZone, saveZone } from '@/lib/db';
import { confirm, notify } from '@/lib/dialogs';
import { SUN_LABEL } from '@/lib/presets';
import type { Sun, Zone } from '@/lib/types';
import { SUN_SYMBOL } from '@/components/Icon';
import { tr } from '@/lib/i18n';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

export default function EditZoneScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const [form, setForm] = useState<Omit<Zone, 'id'>>({ name: '', sun: 'full', covered: false });

  useEffect(() => {
    if (editingId === null) return;
    getZone(db, editingId).then((z) => {
      if (z) setForm({ name: z.name, sun: z.sun, covered: z.covered });
    });
  }, [db, editingId]);

  const save = async () => {
    await saveZone(db, { ...form, name: form.name.trim(), id: editingId ?? undefined });
    router.back();
  };

  const remove = async () => {
    if (editingId === null) return;
    const { total, archived } = await countZonePlants(db, editingId);
    if (total > 0) {
      const one = total === 1;
      const what = one ? tr('C’è ancora 1 pianta', 'There is still 1 plant') : tr(`Ci sono ancora ${total} piante`, `There are still ${total} plants`);
      const inArchive = archived > 0 ? tr(` (${archived} in archivio)`, ` (${archived} archived)`) : '';
      const fix = one
        ? tr('Spostala in un’altra zona o eliminala', 'Move it to another zone or delete it')
        : tr('Spostale in un’altra zona o eliminale', 'Move them to another zone or delete them');
      notify(
        tr('Non puoi eliminare la zona', 'You can’t delete the zone'),
        tr(`${what} in questa zona${inArchive}. ${fix}, poi riprova.`, `${what} in this zone${inArchive}. ${fix}, then try again.`),
      );
      return;
    }
    if (!(await confirm(tr('Eliminare la zona?', 'Delete the zone?'), tr('La zona è vuota.', 'The zone is empty.'), tr('Elimina', 'Delete'), true))) return;
    await deleteZone(db, editingId);
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Field label={tr('Nome', 'Name')}>
            <Input
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder={tr('Es. Aiuola nord, vasi del balcone, serra', 'E.g. North bed, balcony pots, greenhouse')}
            />
          </Field>
          <Field label={tr('Sole che prende davvero', 'Sun it really gets')}>
            <ChipRow>
              {SUNS.map((s) => (
                <Chip
                  key={s}
                  icon={SUN_SYMBOL[s]}
                  label={SUN_LABEL[s]}
                  selected={form.sun === s}
                  onPress={() => setForm((f) => ({ ...f, sun: s }))}
                />
              ))}
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>
              {tr(
                'Pieno sole: almeno 6 ore di sole diretto. Mezz’ombra: 3-6 ore. Ombra: meno di 3.',
                'Full sun: at least 6 hours of direct sun. Part shade: 3-6 hours. Shade: under 3.',
              )}
            </Body>
          </Field>
          <Field label={tr('Pioggia', 'Rain')}>
            <ChipRow>
              <Chip icon="rain" label={tr('All’aperto', 'Outdoors')} selected={!form.covered} onPress={() => setForm((f) => ({ ...f, covered: false }))} />
              <Chip icon="covered" label={tr('Al coperto', 'Covered')} selected={form.covered} onPress={() => setForm((f) => ({ ...f, covered: true }))} />
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>
              {tr(
                'Al coperto (serra, tettoia, in casa) la pioggia non conta come annaffiatura.',
                'Under cover (greenhouse, shelter, indoors) rain doesn’t count as watering.',
              )}
            </Body>
          </Field>

          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!form.name.trim()} />
          {editingId !== null && <Button kind="danger" label={tr('Elimina zona', 'Delete zone')} onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

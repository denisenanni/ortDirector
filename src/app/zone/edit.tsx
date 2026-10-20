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
      const what = one ? 'C’è ancora 1 pianta' : `Ci sono ancora ${total} piante`;
      const inArchive = archived > 0 ? ` (${archived} in archivio)` : '';
      const fix = one ? 'Spostala in un’altra zona o eliminala' : 'Spostale in un’altra zona o eliminale';
      notify('Non puoi eliminare la zona', `${what} in questa zona${inArchive}. ${fix}, poi riprova.`);
      return;
    }
    if (!(await confirm('Eliminare la zona?', 'La zona è vuota.', 'Elimina', true))) return;
    await deleteZone(db, editingId);
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Field label="Nome">
            <Input
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder="Es. Aiuola nord, vasi del balcone, serra"
            />
          </Field>
          <Field label="Sole che prende davvero">
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
              Pieno sole: almeno 6 ore di sole diretto. Mezz’ombra: 3-6 ore. Ombra: meno di 3.
            </Body>
          </Field>
          <Field label="Pioggia">
            <ChipRow>
              <Chip icon="rain" label="All’aperto" selected={!form.covered} onPress={() => setForm((f) => ({ ...f, covered: false }))} />
              <Chip icon="covered" label="Al coperto" selected={form.covered} onPress={() => setForm((f) => ({ ...f, covered: true }))} />
            </ChipRow>
            <Body muted style={{ marginTop: 8 }}>
              Al coperto (serra, tettoia, in casa) la pioggia non conta come annaffiatura.
            </Body>
          </Field>

          <Button label="Salva" onPress={save} disabled={!form.name.trim()} />
          {editingId !== null && <Button kind="danger" label="Elimina zona" onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

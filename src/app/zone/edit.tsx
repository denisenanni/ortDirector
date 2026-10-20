import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen } from '@/components/ui';
import { deleteZone, getZone, saveZone } from '@/lib/db';
import { SUN_ICON, SUN_LABEL } from '@/lib/presets';
import type { Sun, Zone } from '@/lib/types';

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

  const remove = () => {
    if (editingId === null) return;
    Alert.alert('Eliminare la zona?', 'Le piante restano, senza zona.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await deleteZone(db, editingId);
          router.back();
        },
      },
    ]);
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
                  label={`${SUN_ICON[s]} ${SUN_LABEL[s]}`}
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
              <Chip label="🌧️ All’aperto" selected={!form.covered} onPress={() => setForm((f) => ({ ...f, covered: false }))} />
              <Chip label="🏠 Al coperto" selected={form.covered} onPress={() => setForm((f) => ({ ...f, covered: true }))} />
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

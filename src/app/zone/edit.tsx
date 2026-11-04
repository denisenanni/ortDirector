import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen } from '@/components/ui';
import { countZonePlants, deleteZone, getZone, listZones, saveZone } from '@/lib/db';
import { confirm, notify } from '@/lib/dialogs';
import { SUN_LABEL } from '@/lib/presets';
import { freeSpot, MIN_SIDE, snap } from '@/lib/map';
import type { Sun, Zone, ZoneShape } from '@/lib/types';
import { SUN_SYMBOL } from '@/components/Icon';
import { tr } from '@/lib/i18n';

const SUNS: Sun[] = ['full', 'partial', 'shade'];

type ShapeKind = 'none' | ZoneShape['kind'];
/** The shape fields as typed: metres with a dot or a comma, degrees. */
interface ShapeForm {
  kind: ShapeKind;
  width: string;
  length: string;
  rotation: string;
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));
const metres = (s: string) => {
  const v = num(s);
  return Number.isFinite(v) && v >= MIN_SIDE && v <= 1000 ? snap(v) : null;
};
const show = (v: number) => String(v).replace('.', tr(',', '.'));

export default function EditZoneScreen() {
  const db = useSQLiteContext();
  const { id, map } = useLocalSearchParams<{ id?: string; map?: string }>();
  const editingId = id ? Number(id) : null;
  const [form, setForm] = useState<Omit<Zone, 'id' | 'shape'>>({ name: '', sun: 'full', covered: false });
  // From the map's "New zone" the zone goes on the map; elsewhere it starts off it.
  const [shape, setShape] = useState<ShapeForm>({ kind: map ? 'rect' : 'none', width: show(2), length: show(1), rotation: '0' });
  const [placed, setPlaced] = useState<ZoneShape | null>(null);

  useEffect(() => {
    if (editingId === null) return;
    getZone(db, editingId).then((z) => {
      if (!z) return;
      setForm({ name: z.name, sun: z.sun, covered: z.covered });
      setPlaced(z.shape);
      if (z.shape) {
        setShape({ kind: z.shape.kind, width: show(z.shape.width), length: show(z.shape.length), rotation: String(z.shape.rotation) });
      }
    });
  }, [db, editingId]);

  const width = metres(shape.width);
  const length = shape.kind === 'circle' ? width : metres(shape.length);
  const turn = num(shape.rotation || '0');
  const shapeOk = shape.kind === 'none' || (width !== null && length !== null && Number.isFinite(turn));

  const save = async () => {
    let next: ZoneShape | null = null;
    if (shape.kind !== 'none' && width !== null && length !== null) {
      // A zone already on the map stays where it is; a new one goes next to the others.
      const others = (await listZones(db)).filter((z) => z.id !== editingId && z.shape).map((z) => z.shape!);
      const at = placed ?? freeSpot(others, width, length);
      const rotation = shape.kind === 'circle' ? 0 : ((Math.round(turn) % 360) + 360) % 360;
      next = { kind: shape.kind, x: at.x, y: at.y, width, length, rotation };
    }
    await saveZone(db, { ...form, name: form.name.trim(), id: editingId ?? undefined, shape: next });
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

          <Field label={tr('Sulla mappa', 'On the map')}>
            <ChipRow>
              <Chip label={tr('No', 'No')} selected={shape.kind === 'none'} onPress={() => setShape((f) => ({ ...f, kind: 'none' }))} />
              <Chip icon="rect" label={tr('Rettangolo', 'Rectangle')} selected={shape.kind === 'rect'} onPress={() => setShape((f) => ({ ...f, kind: 'rect' }))} />
              <Chip icon="circle" label={tr('Cerchio', 'Circle')} selected={shape.kind === 'circle'} onPress={() => setShape((f) => ({ ...f, kind: 'circle' }))} />
            </ChipRow>
            {shape.kind === 'none' ? (
              <Body muted style={{ marginTop: 8 }}>
                {tr('Per le zone che non stanno in giardino: in casa, il davanzale.', 'For zones that aren’t in the garden: indoors, the windowsill.')}
              </Body>
            ) : null}
          </Field>
          {shape.kind !== 'none' ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={shape.kind === 'circle' ? tr('Diametro (m)', 'Diameter (m)') : tr('Larghezza (m)', 'Width (m)')}>
                  <Input value={shape.width} onChangeText={(width) => setShape((f) => ({ ...f, width }))} keyboardType="decimal-pad" accessibilityLabel={shape.kind === 'circle' ? tr('Diametro', 'Diameter') : tr('Larghezza', 'Width')} />
                </Field>
              </View>
              {shape.kind === 'rect' ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Field label={tr('Lunghezza (m)', 'Length (m)')}>
                      <Input value={shape.length} onChangeText={(length) => setShape((f) => ({ ...f, length }))} keyboardType="decimal-pad" accessibilityLabel={tr('Lunghezza', 'Length')} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={tr('Rotazione (°)', 'Rotation (°)')}>
                      <Input value={shape.rotation} onChangeText={(rotation) => setShape((f) => ({ ...f, rotation }))} keyboardType="numbers-and-punctuation" accessibilityLabel={tr('Rotazione', 'Rotation')} />
                    </Field>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
          {!shapeOk ? (
            <Body style={{ marginBottom: 12 }}>{tr('Le misure vanno da 0,2 m in su.', 'Measures start at 0.2 m.')}</Body>
          ) : null}

          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!form.name.trim() || !shapeOk} />
          {editingId !== null && <Button kind="danger" label={tr('Elimina zona', 'Delete zone')} onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

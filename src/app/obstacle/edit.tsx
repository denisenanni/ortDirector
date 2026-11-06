import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, Input, Screen, ToggleRow } from '@/components/ui';
import { deleteObstacle, getObstacle, saveObstacle } from '@/lib/db';
import { confirm } from '@/lib/dialogs';
import { tr } from '@/lib/i18n';
import { MIN_SIDE, snap } from '@/lib/map';
import type { ZoneShape } from '@/lib/types';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));
const metres = (s: string, lo = MIN_SIDE) => {
  const v = num(s);
  return Number.isFinite(v) && v >= lo && v <= 1000 ? snap(v) : null;
};
const show = (v: number) => String(v).replace('.', tr(',', '.'));

/** Typical obstacles, to fill the form in one tap. */
const KINDS: { name: () => string; kind: ZoneShape['kind']; width: number; length: number; height: number; deciduous: boolean }[] = [
  { name: () => tr('Casa', 'House'), kind: 'rect', width: 10, length: 8, height: 7, deciduous: false },
  { name: () => tr('Muro', 'Wall'), kind: 'rect', width: 5, length: 0.3, height: 2, deciduous: false },
  { name: () => tr('Siepe', 'Hedge'), kind: 'rect', width: 5, length: 1, height: 2, deciduous: false },
  { name: () => tr('Albero', 'Tree'), kind: 'circle', width: 4, length: 4, height: 6, deciduous: true },
];

/** Back where the form was opened from; to the map when it was opened by a link. */
const done = () => (router.canGoBack() ? router.back() : router.replace('/map'));

/** A house, wall, hedge or tree on the map: its size, height, and whether it loses its leaves. */
export default function EditObstacleScreen() {
  const db = useSQLiteContext();
  const { id, x, y } = useLocalSearchParams<{ id?: string; x?: string; y?: string }>();
  const editingId = id ? Number(id) : null;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ZoneShape['kind']>('rect');
  const [form, setForm] = useState({ width: show(5), length: show(1), rotation: '0', height: show(2) });
  const [deciduous, setDeciduous] = useState(false);
  const [at, setAt] = useState({ x: Number(x) || 0, y: Number(y) || 0 });

  useEffect(() => {
    if (editingId === null) return;
    getObstacle(db, editingId).then((o) => {
      if (!o) return;
      setName(o.name);
      setKind(o.shape.kind);
      setForm({ width: show(o.shape.width), length: show(o.shape.length), rotation: String(o.shape.rotation), height: show(o.height) });
      setDeciduous(o.deciduous);
      setAt({ x: o.shape.x, y: o.shape.y });
    });
  }, [db, editingId]);

  const width = metres(form.width);
  const length = kind === 'circle' ? width : metres(form.length);
  const height = metres(form.height, 0.1);
  const turn = num(form.rotation || '0');
  const ok = name.trim() !== '' && width !== null && length !== null && height !== null && Number.isFinite(turn);

  const save = async () => {
    if (!ok) return;
    const rotation = kind === 'circle' ? 0 : ((Math.round(turn) % 360) + 360) % 360;
    await saveObstacle(db, {
      id: editingId ?? undefined,
      name: name.trim(),
      shape: { kind, x: at.x, y: at.y, width: width!, length: length!, rotation },
      height: height!,
      deciduous,
    });
    done();
  };

  const remove = async () => {
    if (editingId === null) return;
    if (!(await confirm(tr('Eliminare l’ostacolo?', 'Delete the obstacle?'), tr('Non farà più ombra.', 'It will cast no more shade.'), tr('Elimina', 'Delete'), true))) return;
    await deleteObstacle(db, editingId);
    done();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {editingId === null ? (
            <Field label={tr('Cos’è', 'What it is')}>
              <ChipRow>
                {KINDS.map((k) => (
                  <Chip
                    key={k.name()}
                    icon={k.kind === 'circle' ? 'ground' : 'obstacle'}
                    label={k.name()}
                    selected={name === k.name()}
                    onPress={() => {
                      setName(k.name());
                      setKind(k.kind);
                      setForm({ width: show(k.width), length: show(k.length), rotation: '0', height: show(k.height) });
                      setDeciduous(k.deciduous);
                    }}
                  />
                ))}
              </ChipRow>
            </Field>
          ) : null}
          <Field label={tr('Nome', 'Name')}>
            <Input value={name} onChangeText={setName} placeholder={tr('Es. Casa, muro del vicino, fico', 'E.g. House, neighbour’s wall, fig tree')} />
          </Field>
          <Field label={tr('Forma', 'Shape')}>
            <ChipRow>
              <Chip icon="rect" label={tr('Rettangolo', 'Rectangle')} selected={kind === 'rect'} onPress={() => setKind('rect')} />
              <Chip icon="circle" label={tr('Cerchio', 'Circle')} selected={kind === 'circle'} onPress={() => setKind('circle')} />
            </ChipRow>
            {kind === 'circle' ? (
              <Body muted style={{ marginTop: 8 }}>{tr('Per un albero: largo quanto la chioma.', 'For a tree: as wide as its crown.')}</Body>
            ) : null}
          </Field>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label={kind === 'circle' ? tr('Diametro (m)', 'Diameter (m)') : tr('Larghezza (m)', 'Width (m)')}>
                <Input value={form.width} onChangeText={(v) => setForm((f) => ({ ...f, width: v }))} keyboardType="decimal-pad" accessibilityLabel={kind === 'circle' ? tr('Diametro', 'Diameter') : tr('Larghezza', 'Width')} />
              </Field>
            </View>
            {kind === 'rect' ? (
              <>
                <View style={{ flex: 1 }}>
                  <Field label={tr('Lunghezza (m)', 'Length (m)')}>
                    <Input value={form.length} onChangeText={(v) => setForm((f) => ({ ...f, length: v }))} keyboardType="decimal-pad" accessibilityLabel={tr('Lunghezza', 'Length')} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={tr('Rotazione (°)', 'Rotation (°)')}>
                    <Input value={form.rotation} onChangeText={(v) => setForm((f) => ({ ...f, rotation: v }))} keyboardType="numbers-and-punctuation" accessibilityLabel={tr('Rotazione', 'Rotation')} />
                  </Field>
                </View>
              </>
            ) : null}
          </View>
          <Field label={tr('Altezza (m)', 'Height (m)')}>
            <Input value={form.height} onChangeText={(v) => setForm((f) => ({ ...f, height: v }))} keyboardType="decimal-pad" accessibilityLabel={tr('Altezza', 'Height')} />
          </Field>
          <ToggleRow
            label={tr('Perde le foglie', 'Loses its leaves')}
            icon="ground"
            detail={tr('Fico, noce, tiglio: da novembre a marzo non fa ombra.', 'Fig, walnut, lime: no shade from November to March.')}
            on={deciduous}
            onPress={() => setDeciduous((d) => !d)}
          />
          {width === null || length === null || height === null ? (
            <Body style={{ marginVertical: 12 }}>{tr('Le misure vanno da 0,2 m in su, l’altezza da 0,1 m.', 'Measures start at 0.2 m, height at 0.1 m.')}</Body>
          ) : null}
          <View style={{ height: 12 }} />
          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!ok} />
          {editingId !== null && <Button kind="danger" label={tr('Elimina ostacolo', 'Delete obstacle')} onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

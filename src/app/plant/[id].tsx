import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon, SUN_SYMBOL, TASK_SYMBOL, type IconName } from '@/components/Icon';
import { waterLabel } from '@/components/PlantAvatar';
import { TASK_TONE, TaskRow } from '@/components/TaskRow';
import {
  Body,
  Button,
  Card,
  Group,
  IconTile,
  Pill,
  PillRow,
  SERIF,
  Screen,
  SectionHeader,
  useTheme,
  type Tone,
} from '@/components/ui';
import { archivePlant, getPlant, getZone, listPlantLog, listPlantTasks, markDone, restorePlant, setPlantPhoto } from '@/lib/db';
import { confirm } from '@/lib/dialogs';
import { syncReminders } from '@/lib/notifications';
import { deletePhoto, photoUri, takePhoto } from '@/lib/photos';
import { planFor } from '@/lib/plans';
import { SUN_LABEL, presetFor } from '@/lib/presets';
import { daysBetween, fromDay, pastLabel, sunMismatch, today as getToday } from '@/lib/schedule';
import type { LogEntry, Plant, TaskWithPlant, Zone } from '@/lib/types';

export default function PlantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [tasks, setTasks] = useState<TaskWithPlant[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [zone, setZone] = useState<Zone | null>(null);
  const t = useTheme();
  const today = getToday();

  const load = useCallback(async () => {
    const [p, ts, l] = await Promise.all([
      getPlant(db, plantId),
      listPlantTasks(db, plantId),
      listPlantLog(db, plantId),
    ]);
    if (!p) {
      router.back();
      return;
    }
    setPlant(p);
    setZone(p.zoneId === null ? null : await getZone(db, p.zoneId));
    setTasks(ts);
    setLog(l);
  }, [db, plantId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDone = async (task: TaskWithPlant) => {
    await markDone(db, task);
    await load();
    syncReminders(db);
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    if (!plant) return;
    const photo = await takePhoto(plant.id, source);
    if (!photo) return;
    deletePhoto(plant.photo);
    await setPlantPhoto(db, plant.id, photo);
    await load();
  };

  const removePhoto = async () => {
    if (!plant || !(await confirm('Togliere la foto?', '', 'Togli', true))) return;
    deletePhoto(plant.photo);
    await setPlantPhoto(db, plant.id, null);
    await load();
  };

  const archive = async () => {
    if (!plant) return;
    const ok = await confirm(
      'Archiviare la pianta?',
      'Le sue attività aperte vengono tolte. La scheda e lo storico restano in Archivio, da dove puoi ripristinarla.',
      'Archivia',
    );
    if (!ok) return;
    await archivePlant(db, plant.id);
    await load();
    syncReminders(db);
  };

  const restore = async () => {
    if (!plant) return;
    await restorePlant(db, plant.id);
    await load();
    syncReminders(db);
  };

  if (!plant) return <Screen>{null}</Screen>;

  const uri = photoUri(plant.photo);

  const preset = presetFor(plant);
  const tip = preset?.tip;
  const weeks = planFor(preset?.name)?.sowToTransplantWeeks;
  const longDate = (day: string) => fromDay(day).toLocaleDateString('it-IT');
  const days = (n: number) => (n === 1 ? 'giorno' : `${n} giorni`);
  const mismatch = zone ? sunMismatch(plant.sun, zone.sun) : null;

  const fact = (icon: IconName, tone: Tone, label: string, value: string) => (
    <View key={label} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, paddingRight: 16 }}>
      <IconTile icon={icon} tone={tone} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Body>{value}</Body>
      </View>
    </View>
  );

  const photoButton = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: uri ? t.accentSoft : t.card,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={icon} size={16} color={t.accent} />
      <Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
  const photoButtons = (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {Platform.OS !== 'web' && photoButton('camera', 'Scatta', () => pickPhoto('camera'))}
      {photoButton('photo', uri ? 'Cambia' : 'Scegli foto', () => pickPhoto('library'))}
      {uri ? photoButton('close', 'Togli', removePhoto) : null}
    </View>
  );

  const water = plant.waterEveryDays
    ? `Ogni ${days(plant.waterEveryDays)} da maggio a settembre` +
      (plant.waterColdDays && plant.waterColdDays !== plant.waterEveryDays
        ? `, ogni ${days(plant.waterColdDays)} il resto dell’anno`
        : '')
    : 'Nessuna irrigazione programmata';
  const place = zone
    ? `${zone.name} · ${SUN_LABEL[zone.sun].toLowerCase()}${zone.covered ? ' · al coperto' : ''}`
    : plant.location;
  let stage: string | null = null;
  if (plant.stage === 'seedbed' && plant.sownOn) {
    stage =
      `Seminata il ${longDate(plant.sownOn)}, ${Math.floor(daysBetween(plant.sownOn, today) / 7)} settimane fa.` +
      (weeks ? ` Si trapianta a ${weeks[0]}-${weeks[1]} settimane.` : '');
  } else if (plant.stage === 'seedbed') {
    stage = 'Piantina da trapiantare';
  } else if (plant.plantedOn) {
    stage = `${plant.potted ? 'Nel vaso dal' : 'A dimora dal'} ${longDate(plant.plantedOn)}`;
  } else if (plant.potted) {
    stage = 'In vaso';
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Modifica pianta"
              hitSlop={10}
              style={{ padding: 6 }}
              onPress={() => router.push({ pathname: '/plant/edit', params: { id: String(plant.id) } })}
            >
              <Icon name="edit" size={22} color={t.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {uri ? (
          <>
            <Image
              source={{ uri }}
              accessibilityLabel={`Foto di ${plant.name}`}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 20, marginBottom: 10 }}
            />
            {photoButtons}
          </>
        ) : (
          <View
            style={{
              borderRadius: 20,
              backgroundColor: t.accentSoft,
              paddingVertical: 28,
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Icon name={plant.stage === 'seedbed' ? 'sprout' : 'plants'} size={44} color={t.accent} />
            {photoButtons}
          </View>
        )}

        <Text style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 38, color: t.text, marginTop: 18 }}>
          {plant.name}
        </Text>
        {plant.variety ? (
          <Text style={{ fontFamily: SERIF, fontSize: 20, lineHeight: 26, color: t.muted }}>{plant.variety}</Text>
        ) : null}
        <View style={{ marginTop: 10, marginBottom: 16 }}>
          <PillRow>
            <Pill icon={SUN_SYMBOL[plant.sun]} tone="sun" label={SUN_LABEL[plant.sun]} />
            {plant.waterEveryDays ? (
              <Pill
                icon="water"
                tone="water"
                label={waterLabel(plant)}
              />
            ) : null}
            {plant.potted ? <Pill label="In vaso" /> : null}
            <Pill label={plant.annual ? 'Annuale' : 'Perenne'} />
          </PillRow>
        </View>

        {mismatch ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: t.warnSoft, borderColor: t.warnSoft }}>
            <Icon name="warn" size={18} color={t.warn} />
            <Body style={{ color: t.warn, flex: 1 }}>{mismatch}</Body>
          </Card>
        ) : null}

        {plant.archivedOn ? (
          <Card>
            <Body>In archivio dal {longDate(plant.archivedOn)}. Non ha attività e non compare in Oggi.</Body>
            <Button icon="restore" label="Ripristina" onPress={restore} />
          </Card>
        ) : null}

        <Group>
          {fact(SUN_SYMBOL[plant.sun], 'sun', 'Sole', `Le serve ${SUN_LABEL[plant.sun].toLowerCase()}`)}
          {fact('water', 'water', 'Irrigazione', water)}
          {place ? fact('place', 'accent', 'Dove', place) : null}
          {stage ? fact(plant.stage === 'seedbed' ? 'sprout' : 'ground', 'accent', 'Fase', stage) : null}
        </Group>

        {tip ? (
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: t.sunSoft, borderColor: t.sunSoft, marginTop: 4 }}>
            <Icon name="tip" size={20} color={t.sun} />
            <Body style={{ flex: 1 }}>{tip}</Body>
          </Card>
        ) : null}
        {plant.notes ? (
          <Card>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Note</Text>
            <Body>{plant.notes}</Body>
          </Card>
        ) : null}

        {plant.stage === 'seedbed' && !plant.archivedOn && (
          <Button
            icon="transplant"
            label="Segna il trapianto"
            onPress={() => router.push({ pathname: '/plant/transplant', params: { id: String(plant.id) } })}
          />
        )}

        {!plant.archivedOn && (
          <>
            <SectionHeader count={tasks.length || undefined}>Attività</SectionHeader>
            {tasks.length === 0 && <Body muted>Nessuna attività aperta.</Body>}
            <Group>
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} today={today} onDone={onDone} showPlant={false} />
              ))}
            </Group>
            <Button
              kind="secondary"
              icon="add"
              label="Aggiungi attività"
              onPress={() => router.push({ pathname: '/task/edit', params: { plantId: String(plant.id) } })}
            />
          </>
        )}

        {log.length > 0 && <SectionHeader>Storico</SectionHeader>}
        <Group>
          {log.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingLeft: 14 }}>
              <IconTile icon={TASK_SYMBOL[e.type]} tone={TASK_TONE[e.type]} size={32} />
              <Body style={{ flex: 1 }}>{e.title}</Body>
              <Body muted style={{ fontSize: 14, marginRight: 6 }}>{pastLabel(e.doneOn, today)}</Body>
            </View>
          ))}
        </Group>

        {!plant.archivedOn && (
          <View style={{ marginTop: 16 }}>
            <Button
              kind="ghost"
              icon="archive"
              label={plant.annual ? 'Fine stagione: archivia' : 'Archivia'}
              onPress={archive}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

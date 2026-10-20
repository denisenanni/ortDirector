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
import { SUN_LABEL, everyDays, presetFor } from '@/lib/presets';
import { daysBetween, fromDay, pastLabel, sunMismatch, today as getToday } from '@/lib/schedule';
import type { LogEntry, Plant, TaskWithPlant, Zone } from '@/lib/types';
import { capitalize, cat, locale, tr } from '@/lib/i18n';

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
    if (!plant || !(await confirm(tr('Togliere la foto?', 'Remove the photo?'), '', tr('Togli', 'Remove'), true))) return;
    deletePhoto(plant.photo);
    await setPlantPhoto(db, plant.id, null);
    await load();
  };

  const archive = async () => {
    if (!plant) return;
    const ok = await confirm(
      tr('Archiviare la pianta?', 'Archive the plant?'),
      tr(
        'Le sue attività aperte vengono tolte. La scheda e lo storico restano in Archivio, da dove puoi ripristinarla.',
        'Its open tasks are removed. The plant and its history stay in the Archive, where you can restore it.',
      ),
      tr('Archivia', 'Archive'),
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
  const tip = preset ? cat(preset.tip) : undefined;
  const weeks = planFor(preset?.name)?.sowToTransplantWeeks;
  const longDate = (day: string) => fromDay(day).toLocaleDateString(locale());
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
      {Platform.OS !== 'web' && photoButton('camera', tr('Scatta', 'Take photo'), () => pickPhoto('camera'))}
      {photoButton('photo', uri ? tr('Cambia', 'Change') : tr('Scegli foto', 'Choose photo'), () => pickPhoto('library'))}
      {uri ? photoButton('close', tr('Togli', 'Remove'), removePhoto) : null}
    </View>
  );

  const water = plant.waterEveryDays
    ? capitalize(everyDays(plant.waterEveryDays)) +
      tr(' da maggio a settembre', ' from May to September') +
      (plant.waterColdDays && plant.waterColdDays !== plant.waterEveryDays
        ? `, ${everyDays(plant.waterColdDays)}` + tr(' il resto dell’anno', ' the rest of the year')
        : '')
    : tr('Nessuna irrigazione programmata', 'No watering scheduled');
  const place = zone
    ? `${zone.name} · ${SUN_LABEL[zone.sun].toLowerCase()}${zone.covered ? tr(' · al coperto', ' · covered') : ''}`
    : plant.location;
  let stage: string | null = null;
  if (plant.stage === 'seedbed' && plant.sownOn) {
    stage =
      tr(
        `Seminata il ${longDate(plant.sownOn)}, ${Math.floor(daysBetween(plant.sownOn, today) / 7)} settimane fa.`,
        `Sown on ${longDate(plant.sownOn)}, ${Math.floor(daysBetween(plant.sownOn, today) / 7)} weeks ago.`,
      ) +
      (weeks
        ? tr(` Si trapianta a ${weeks[0]}-${weeks[1]} settimane.`, ` Transplant at ${weeks[0]}-${weeks[1]} weeks.`)
        : '');
  } else if (plant.stage === 'seedbed') {
    stage = tr('Piantina da trapiantare', 'Seedling to transplant');
  } else if (plant.plantedOn) {
    stage = `${plant.potted ? tr('Nel vaso dal', 'In its pot since') : tr('A dimora dal', 'In the ground since')} ${longDate(plant.plantedOn)}`;
  } else if (plant.potted) {
    stage = tr('In vaso', 'In a pot');
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Modifica pianta', 'Edit plant')}
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
              accessibilityLabel={tr(`Foto di ${plant.name}`, `Photo of ${plant.name}`)}
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
            {plant.potted ? <Pill label={tr('In vaso', 'In a pot')} /> : null}
            <Pill label={plant.annual ? tr('Annuale', 'Annual') : tr('Perenne', 'Perennial')} />
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
            <Body>
              {tr(
                `In archivio dal ${longDate(plant.archivedOn)}. Non ha attività e non compare in Oggi.`,
                `Archived since ${longDate(plant.archivedOn)}. It has no tasks and doesn’t show in Today.`,
              )}
            </Body>
            <Button icon="restore" label={tr('Ripristina', 'Restore')} onPress={restore} />
          </Card>
        ) : null}

        <Group>
          {fact(SUN_SYMBOL[plant.sun], 'sun', tr('Sole', 'Sun'), tr('Le serve: ', 'Needs: ') + SUN_LABEL[plant.sun].toLowerCase())}
          {fact('water', 'water', tr('Irrigazione', 'Watering'), water)}
          {place ? fact('place', 'accent', tr('Dove', 'Where'), place) : null}
          {stage ? fact(plant.stage === 'seedbed' ? 'sprout' : 'ground', 'accent', tr('Fase', 'Stage'), stage) : null}
        </Group>

        {tip ? (
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: t.sunSoft, borderColor: t.sunSoft, marginTop: 4 }}>
            <Icon name="tip" size={20} color={t.sun} />
            <Body style={{ flex: 1 }}>{tip}</Body>
          </Card>
        ) : null}
        {plant.notes ? (
          <Card>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{tr('Note', 'Notes')}</Text>
            <Body>{plant.notes}</Body>
          </Card>
        ) : null}

        {plant.stage === 'seedbed' && !plant.archivedOn && (
          <Button
            icon="transplant"
            label={tr('Segna il trapianto', 'Mark as transplanted')}
            onPress={() => router.push({ pathname: '/plant/transplant', params: { id: String(plant.id) } })}
          />
        )}

        {!plant.archivedOn && (
          <>
            <SectionHeader count={tasks.length || undefined}>{tr('Attività', 'Tasks')}</SectionHeader>
            {tasks.length === 0 && <Body muted>{tr('Nessuna attività aperta.', 'No open tasks.')}</Body>}
            <Group>
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} today={today} onDone={onDone} showPlant={false} />
              ))}
            </Group>
            <Button
              kind="secondary"
              icon="add"
              label={tr('Aggiungi attività', 'Add task')}
              onPress={() => router.push({ pathname: '/task/edit', params: { plantId: String(plant.id) } })}
            />
          </>
        )}

        {log.length > 0 && <SectionHeader>{tr('Storico', 'History')}</SectionHeader>}
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
              label={plant.annual ? tr('Fine stagione: archivia', 'End of season: archive') : tr('Archivia', 'Archive')}
              onPress={archive}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

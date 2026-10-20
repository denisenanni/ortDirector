import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Image, Platform, ScrollView, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Body, Button, Card, Screen, SectionHeader, Title, useTheme } from '@/components/ui';
import { archivePlant, getPlant, getZone, listPlantLog, listPlantTasks, markDone, restorePlant, setPlantPhoto } from '@/lib/db';
import { confirm } from '@/lib/dialogs';
import { syncReminders } from '@/lib/notifications';
import { deletePhoto, photoUri, takePhoto } from '@/lib/photos';
import { planFor } from '@/lib/plans';
import { SUN_ICON, SUN_LABEL, TASK_ICON, presetFor } from '@/lib/presets';
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

  return (
    <Screen>
      <Stack.Screen options={{ title: plant.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {uri ? (
          <Image
            source={{ uri }}
            accessibilityLabel={`Foto di ${plant.name}`}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 8 }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Platform.OS !== 'web' && (
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label="📷 Scatta" onPress={() => pickPhoto('camera')} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button kind="secondary" label={uri ? '🖼️ Cambia' : '🖼️ Scegli foto'} onPress={() => pickPhoto('library')} />
          </View>
          {uri ? (
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label="Togli" onPress={removePhoto} />
            </View>
          ) : null}
        </View>

        {plant.archivedOn ? (
          <Card>
            <Body>🗄️ In archivio dal {longDate(plant.archivedOn)}. Non ha attività e non compare in Oggi.</Body>
            <Button label="↩️ Ripristina" onPress={restore} />
          </Card>
        ) : null}

        <Card>
          {plant.variety ? <Title>{plant.variety}</Title> : null}
          <Body>
            {SUN_ICON[plant.sun]} Le serve: {SUN_LABEL[plant.sun].toLowerCase()}
          </Body>
          <Body>
            💧{' '}
            {plant.waterEveryDays
              ? `Ogni ${days(plant.waterEveryDays)} da maggio a settembre` +
                (plant.waterColdDays && plant.waterColdDays !== plant.waterEveryDays
                  ? `, ogni ${days(plant.waterColdDays)} il resto dell’anno`
                  : '')
              : 'Nessuna irrigazione programmata'}
          </Body>
          {zone ? (
            <Body>
              📍 {zone.name} · {SUN_ICON[zone.sun]} {SUN_LABEL[zone.sun].toLowerCase()}
              {zone.covered ? ' · al coperto' : ''}
            </Body>
          ) : plant.location ? (
            <Body>📍 {plant.location}</Body>
          ) : null}
          {plant.potted && plant.stage === 'ground' && !plant.plantedOn ? <Body>🪴 In vaso</Body> : null}
          {mismatch ? <Body style={{ color: t.warn }}>⚠️ {mismatch}</Body> : null}
          {plant.stage === 'seedbed' && plant.sownOn ? (
            <Body>
              🌰 Seminata il {longDate(plant.sownOn)}, {Math.floor(daysBetween(plant.sownOn, today) / 7)} settimane fa.
              {weeks ? ` Si trapianta a ${weeks[0]}-${weeks[1]} settimane.` : ''}
            </Body>
          ) : null}
          {plant.stage === 'seedbed' && !plant.sownOn ? <Body>🌱 Piantina da trapiantare</Body> : null}
          {plant.stage === 'ground' && plant.plantedOn ? (
            <Body>{plant.potted ? '🪴 Nel vaso dal' : '🌳 A dimora dal'} {longDate(plant.plantedOn)}</Body>
          ) : null}
          {plant.notes ? <Body muted style={{ marginTop: 8 }}>{plant.notes}</Body> : null}
          {tip ? <Body muted style={{ marginTop: 8 }}>💡 {tip}</Body> : null}
        </Card>

        {plant.stage === 'seedbed' && !plant.archivedOn && (
          <Button
            label="🌱 Segna il trapianto"
            onPress={() => router.push({ pathname: '/plant/transplant', params: { id: String(plant.id) } })}
          />
        )}

        {!plant.archivedOn && (
          <>
            <SectionHeader>Attività</SectionHeader>
            {tasks.length === 0 && <Body muted>Nessuna attività aperta.</Body>}
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} onDone={onDone} showPlant={false} />
            ))}
            <Button
              kind="secondary"
              label="Aggiungi attività"
              onPress={() => router.push({ pathname: '/task/edit', params: { plantId: String(plant.id) } })}
            />
          </>
        )}

        {log.length > 0 && <SectionHeader>Storico</SectionHeader>}
        {log.map((e) => (
          <Body key={e.id} muted>
            {TASK_ICON[e.type]} {e.title} · {pastLabel(e.doneOn, today)}
          </Body>
        ))}

        <Button
          kind="secondary"
          label="Modifica pianta"
          onPress={() => router.push({ pathname: '/plant/edit', params: { id: String(plant.id) } })}
        />
        {!plant.archivedOn && (
          <Button
            kind="secondary"
            label={plant.annual ? '🗄️ Fine stagione: archivia' : '🗄️ Archivia'}
            onPress={archive}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

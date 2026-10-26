import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Button, Field, Screen, ToggleRow } from '@/components/ui';
import { ZoneChips, useZones } from '@/components/ZoneChips';
import { getPlant, getTask, markDone, spotBeforeShelter } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import type { Plant, TaskWithPlant } from '@/lib/types';
import { tr } from '@/lib/i18n';

/**
 * Done for a task that moves the plant: under cover for the winter, back
 * out, or a check that may end in a bigger pot. Asks where the plant is
 * now, so its zone and the rain follow it.
 */
export default function MovedScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<TaskWithPlant | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  // A zone just created from here gets selected.
  const zones = useZones(setZoneId);
  const [covered, setCovered] = useState(false);
  // Back out: the spot it stood in before going in, when the app saw it go.
  const [remembered, setRemembered] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getTask(db, Number(id));
      const p = t?.plantId != null ? await getPlant(db, t.plantId) : null;
      setTask(t);
      setPlant(p);
      if (!t || !p) return;
      const before = t.moves === 'out' ? await spotBeforeShelter(db, p.id) : null;
      setRemembered(!!before);
      setZoneId(before ? before.zoneId : p.zoneId);
      setCovered(before ? before.covered : t.moves === 'in');
    })();
  }, [db, id]);

  if (!task || !plant) return <Screen>{null}</Screen>;

  const zone = zones.find((z) => z.id === zoneId);
  const name = plant.name.toLowerCase();

  const done = async (spot: boolean) => {
    await markDone(db, task, undefined, spot ? { zoneId, covered: covered && !zone?.covered } : null);
    syncReminders(db);
  };

  if (task.moves === 'repot') {
    return (
      <Screen>
        <Stack.Screen options={{ title: task.title }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Field label={tr(`Hai rinvasato ${name}?`, `Did you repot the ${name}?`)}>
            <Body muted>
              {tr(
                'Se sì, segna il rinvaso: cambiano vaso e annaffiature, e arrivano le cure dopo il rinvaso.',
                'If so, mark the repotting: pot and watering change, and the care after repotting comes with it.',
              )}
            </Body>
          </Field>
          <Button
            icon="transplant"
            label={tr('Sì, segna il rinvaso', 'Yes, mark the repotting')}
            onPress={async () => {
              await done(false);
              router.replace({ pathname: '/plant/move', params: { id: String(plant.id) } });
            }}
          />
          <Button
            kind="secondary"
            label={tr('No, il vaso va bene', 'No, the pot is fine')}
            onPress={async () => {
              await done(false);
              router.back();
            }}
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: task.title }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Field label={task.moves === 'in' ? tr(`Dove metti ${name}?`, `Where does the ${name} go?`) : tr(`Dove torna ${name}?`, `Where does the ${name} go back to?`)}>
          {task.moves === 'out' && remembered ? (
            <Body muted style={{ marginBottom: 10 }}>
              {tr('È già scelto il posto dove stava prima di metterla al riparo.', 'The spot it stood in before going under cover is picked already.')}
            </Body>
          ) : null}
          <ZoneChips zones={zones} value={zoneId} onChange={setZoneId} />
          <View style={{ marginTop: 12 }}>
            <ToggleRow
              label={tr('Al coperto', 'Under cover')}
              detail={
                zone?.covered
                  ? tr('La zona è già al coperto.', 'The zone is under cover already.')
                  : tr('In casa, sotto una tettoia, in serra: la pioggia non la bagna.', 'Indoors, under a roof, in a greenhouse: rain doesn’t reach it.')
              }
              on={covered || !!zone?.covered}
              disabled={!!zone?.covered}
              onPress={() => setCovered(!covered)}
            />
          </View>
        </Field>

        <Button
          icon="tick"
          label={tr('Fatto oggi', 'Done today')}
          onPress={async () => {
            await done(true);
            router.back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

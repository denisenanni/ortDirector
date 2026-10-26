import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, PastDayPicker, Screen, ToggleRow } from '@/components/ui';
import { getPlant, movePlant } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { REPOT_NO_FEED_DAYS, REPOT_STEPS, expandPlan } from '@/lib/plans';
import { PLANT_SIZE_LABEL, POT_SIZE_LABEL, everyDays, repeatLabel } from '@/lib/presets';
import { daysBetween, fromDay, today as getToday } from '@/lib/schedule';
import type { Plant, Size } from '@/lib/types';
import { plantWatering } from '@/lib/watering';
import { TASK_SYMBOL } from '@/components/Icon';
import { ZoneChips, useZones } from '@/components/ZoneChips';
import { cat, locale, tr } from '@/lib/i18n';

const SIZES: Size[] = ['small', 'medium', 'large'];

export default function MoveScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const today = getToday();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [day, setDay] = useState(today);
  const [potted, setPotted] = useState(true);
  const [size, setSize] = useState<Size>('medium');
  const [potSize, setPotSize] = useState<Size>('medium');
  const [zoneId, setZoneId] = useState<number | null>(null);
  // A zone just created from here gets selected.
  const zones = useZones(setZoneId);
  const [covered, setCovered] = useState(false);
  const [holdFeeding, setHoldFeeding] = useState(true);
  // After-care steps (by index) the user switched off.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    getPlant(db, plantId).then((p) => {
      setPlant(p);
      if (!p) return;
      // Most moves of a plant in the ground are into a pot; a pot is usually going bigger or back in the ground.
      setPotted(true);
      setSize(p.size ?? 'medium');
      setPotSize(p.potted && p.potSize ? p.potSize : 'medium');
      setZoneId(p.zoneId);
      setCovered(p.covered);
    });
  }, [db, plantId]);

  if (!plant) return <Screen>{null}</Screen>;

  const zone = zones.find((z) => z.id === zoneId);
  const planned = REPOT_STEPS.map((s) => expandPlan([s], day, today)[0]);
  const watering = plantWatering({ ...plant, stage: 'ground', potted, size, potSize });

  const toggle = (i: number) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const save = async () => {
    const tasks = planned.filter((t, i) => t && !skipped.has(i));
    await movePlant(db, plant.id, day, tasks, { potted, size, potSize, watering, zoneId, covered, holdFeeding });
    syncReminders(db);
    router.back();
  };

  const when = (dueOn: string) => {
    const d = daysBetween(day, dueOn);
    return d === 0 ? tr('Il giorno stesso', 'The same day') : tr(`Dopo ${d} giorni`, `After ${d} days`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Field label={tr(`Quando hai spostato ${plant.name.toLowerCase()}?`, `When did you move the ${plant.name.toLowerCase()}?`)}>
          <PastDayPicker value={day} onChange={setDay} today={today} />
        </Field>

        <Field label={tr('Dove va', 'Where it goes')}>
          <ChipRow>
            <Chip icon="ground" label={tr('In terra', 'In the ground')} selected={!potted} onPress={() => setPotted(false)} />
            <Chip label={tr('In vaso', 'In a pot')} selected={potted} onPress={() => setPotted(true)} />
          </ChipRow>
        </Field>

        <Field label={tr('Quanto è grande la pianta', 'How big the plant is')}>
          <ChipRow>
            {SIZES.map((k) => (
              <Chip key={k} label={PLANT_SIZE_LABEL[k]} selected={size === k} onPress={() => setSize(k)} />
            ))}
          </ChipRow>
        </Field>
        {potted ? (
          <Field label={tr('Quanto è grande il vaso', 'How big the pot is')}>
            <ChipRow>
              {SIZES.map((k) => (
                <Chip key={k} label={POT_SIZE_LABEL[k]} selected={potSize === k} onPress={() => setPotSize(k)} />
              ))}
            </ChipRow>
          </Field>
        ) : null}

        <Field label={tr('Zona', 'Zone')}>
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

        {watering && plant.waterEveryDays ? (
          <Body muted style={{ marginBottom: 18 }}>
            {tr(
              `Da maggio a settembre la annaffierai ${everyDays(watering.waterEveryDays)}, il resto dell’anno ${everyDays(watering.waterColdDays)}.`,
              `From May to September you’ll water it ${everyDays(watering.waterEveryDays)}, the rest of the year ${everyDays(watering.waterColdDays)}.`,
            )}
          </Body>
        ) : null}

        <Field label={tr('Cure dopo lo spostamento', 'Care after the move')}>
          <Body muted style={{ marginBottom: 8 }}>
            {tr(
              'Le radici hanno sofferto come a un trapianto. Togli quelle che non ti servono.',
              'Its roots got disturbed as at a transplant. Untick the ones you don’t need.',
            )}
          </Body>
          {REPOT_STEPS.map((s, i) => {
            const t = planned[i];
            const detail = !t
              ? tr('Già passata', 'Already past')
              : `${when(t.dueOn)}${repeatLabel(t) ? `, ${repeatLabel(t)}` : ''}` +
                (t.endsOn
                  ? ` ${tr('fino al', 'until')} ${fromDay(t.endsOn).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`
                  : '');
            return (
              <ToggleRow
                key={i}
                icon={TASK_SYMBOL[s.type]}
                label={cat(s.title)}
                detail={detail}
                on={!!t && !skipped.has(i)}
                disabled={!t}
                onPress={() => toggle(i)}
              />
            );
          })}
          <ToggleRow
            icon={TASK_SYMBOL.fertilize}
            label={tr('Niente concime per un po’', 'No feeding for a while')}
            detail={tr(
              `Le concimazioni dei prossimi ${REPOT_NO_FEED_DAYS} giorni slittano dopo.`,
              `Feeding due in the next ${REPOT_NO_FEED_DAYS} days moves after them.`,
            )}
            on={holdFeeding}
            onPress={() => setHoldFeeding(!holdFeeding)}
          />
        </Field>

        <Button icon="transplant" label={tr('Segna lo spostamento', 'Mark as moved')} onPress={save} />
      </ScrollView>
    </Screen>
  );
}

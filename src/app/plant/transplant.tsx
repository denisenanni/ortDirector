import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Body, Button, Chip, ChipRow, Field, PastDayPicker, Screen, ToggleRow } from '@/components/ui';
import { getPlant, transplant } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import { expandPlan, planFor } from '@/lib/plans';
import { presetFor, repeatLabel } from '@/lib/presets';
import { daysBetween, fromDay, today as getToday } from '@/lib/schedule';
import type { Plant } from '@/lib/types';
import { TASK_SYMBOL } from '@/components/Icon';

export default function TransplantScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plantId = Number(id);
  const today = getToday();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [day, setDay] = useState(today);
  const [potted, setPotted] = useState(false);
  // Plan steps (by index) the user switched off for this plant.
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  useEffect(() => {
    getPlant(db, plantId).then((p) => {
      setPlant(p);
      if (p) setPotted(p.potted);
    });
  }, [db, plantId]);

  if (!plant) return <Screen>{null}</Screen>;

  const plan = planFor(presetFor(plant)?.name);
  const steps = plan?.steps ?? [];
  const planned = steps.map((s) => expandPlan([s], day, today)[0]);

  const toggle = (i: number) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const save = async () => {
    const tasks = planned.filter((t, i) => t && !skipped.has(i));
    await transplant(db, plant.id, day, tasks, potted);
    syncReminders(db);
    router.back();
  };

  const when = (dueOn: string) => {
    const d = daysBetween(day, dueOn);
    return d === 0 ? 'Dal giorno stesso' : `Dopo ${d} giorni`;
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Field label={`Quando hai messo a dimora ${plant.name.toLowerCase()}?`}>
          <PastDayPicker value={day} onChange={setDay} today={today} />
        </Field>

        <Field label="Dove">
          <ChipRow>
            <Chip icon="ground" label="In terra" selected={!potted} onPress={() => setPotted(false)} />
            <Chip label="In vaso" selected={potted} onPress={() => setPotted(true)} />
          </ChipRow>
        </Field>

        {plan ? (
          <Field label="Attività dal piano">
            <Body muted style={{ marginBottom: 8 }}>
              Contate dal trapianto. Togli quelle che non ti servono; dopo puoi modificarle una per una.
            </Body>
            {steps.map((s, i) => {
              const t = planned[i];
              const detail = !t
                ? 'Già passata'
                : `${when(t.dueOn)}${repeatLabel(t) ? `, ${repeatLabel(t)}` : ''}` +
                  (t.endsOn ? ` fino al ${fromDay(t.endsOn).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : '');
              return (
                <ToggleRow
                  key={i}
                  icon={TASK_SYMBOL[s.type]}
                  label={s.title}
                  detail={detail}
                  on={!!t && !skipped.has(i)}
                  disabled={!t}
                  onPress={() => toggle(i)}
                />
              );
            })}
          </Field>
        ) : (
          <Body muted style={{ marginBottom: 18 }}>
            Questa pianta non è nel catalogo, quindi non ha un piano automatico. Aggiungi tu le attività dalla sua scheda.
          </Body>
        )}

        <Button icon="transplant" label="Segna il trapianto" onPress={save} />
      </ScrollView>
    </Screen>
  );
}

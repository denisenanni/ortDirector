import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Body, Button, Field, Screen, Stepper } from '@/components/ui';
import { getReminderHour, setReminderHour } from '@/lib/db';
import { ensurePermission, syncReminders } from '@/lib/notifications';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [hour, setHour] = useState<number | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      getReminderHour(db).then(setHour);
      Notifications.getPermissionsAsync().then((p) => setGranted(p.granted));
    }, [db]),
  );

  const changeHour = async (h: number | null) => {
    if (h === null) return;
    setHour(h);
    await setReminderHour(db, h);
    syncReminders(db);
  };

  const enable = async () => {
    const ok = await ensurePermission();
    setGranted(ok);
    if (ok) syncReminders(db);
    else Linking.openSettings();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Field label="Ora del promemoria giornaliero">
          {hour !== null && (
            <Stepper
              value={hour}
              onChange={changeHour}
              min={0}
              max={23}
              format={(h) => `${String(h).padStart(2, '0')}:00`}
            />
          )}
        </Field>
        <Body muted>
          Ogni giorno con attività in scadenza ricevi una sola notifica a quest’ora, con l’elenco di cosa fare.
        </Body>
        {granted === false && (
          <>
            <Body style={{ marginTop: 18 }}>Le notifiche sono disattivate.</Body>
            <Button label="Attiva notifiche" onPress={enable} />
          </>
        )}
        <Body muted style={{ marginTop: 24 }}>
          I dati restano solo su questo telefono.
        </Body>
      </ScrollView>
    </Screen>
  );
}

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Body, Button, Field, Screen, SectionHeader, Stepper, useTheme } from '@/components/ui';
import { parseBackup } from '@/lib/backup';
import { pickBackupFile, saveBackupFile } from '@/lib/backupFile';
import {
  DATABASE_VERSION,
  exportBackup,
  getLastBackup,
  getReminderHour,
  importBackup,
  setLastBackup,
  setReminderHour,
} from '@/lib/db';
import { fromDay, today } from '@/lib/schedule';
import { ensurePermission, syncReminders } from '@/lib/notifications';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [hour, setHour] = useState<number | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [lastBackup, setLast] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<{ text: string; error?: boolean } | null>(null);
  const t = useTheme();

  useFocusEffect(
    useCallback(() => {
      getReminderHour(db).then(setHour);
      getLastBackup(db).then(setLast);
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

  const doExport = async () => {
    try {
      await saveBackupFile(await exportBackup(db));
      await setLastBackup(db, today());
      setLast(today());
      setBackupNote(null);
    } catch (e) {
      setBackupNote({ text: `Esportazione non riuscita: ${(e as Error).message}`, error: true });
    }
  };

  const doImport = async () => {
    let text: string | null;
    try {
      text = await pickBackupFile();
    } catch (e) {
      setBackupNote({ text: `Non riesco a leggere il file: ${(e as Error).message}`, error: true });
      return;
    }
    if (text === null) return;
    let backup;
    try {
      backup = parseBackup(text, DATABASE_VERSION);
    } catch (e) {
      setBackupNote({ text: (e as Error).message, error: true });
      return;
    }
    const day = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('it-IT') : 'data sconosciuta';
    const summary = `${backup.tables.plants.length} piante e ${backup.tables.tasks.length} attività, salvato il ${day}`;
    const run = async () => {
      await importBackup(db, backup);
      setBackupNote({ text: `Backup importato: ${summary}.` });
      getReminderHour(db).then(setHour);
      getLastBackup(db).then(setLast);
      syncReminders(db);
    };
    const question = `Il backup (${summary}) sostituisce tutti i dati attuali.`;
    if (Platform.OS === 'web') {
      if (window.confirm(question)) await run();
      return;
    }
    Alert.alert('Importare il backup?', question, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Sostituisci', style: 'destructive', onPress: run },
    ]);
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
        <SectionHeader>Backup</SectionHeader>
        <Body muted>
          I dati restano solo su questo telefono: se lo perdi, perdi tutto. Esporta un backup ogni tanto e salvalo su
          iCloud Drive o dove vuoi. Le foto delle piante non sono nel backup.
        </Body>
        {lastBackup ? (
          <Body muted style={{ marginTop: 6 }}>
            Ultimo backup: {fromDay(lastBackup).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </Body>
        ) : null}
        <Button label="Esporta backup" onPress={doExport} />
        <Button kind="secondary" label="Importa backup" onPress={doImport} />
        {backupNote ? (
          <Body style={{ marginTop: 8, color: backupNote.error ? t.danger : t.muted }}>{backupNote.text}</Body>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

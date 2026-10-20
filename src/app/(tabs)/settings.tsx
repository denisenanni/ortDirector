import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Body, Button, Card, Field, LargeHeader, Screen, SectionHeader, Stepper, useTheme } from '@/components/ui';
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
import { locale, tr } from '@/lib/i18n';

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
      setBackupNote({ text: tr('Esportazione non riuscita: ', 'Export failed: ') + (e as Error).message, error: true });
    }
  };

  const doImport = async () => {
    let text: string | null;
    try {
      text = await pickBackupFile();
    } catch (e) {
      setBackupNote({ text: tr('Non riesco a leggere il file: ', 'Can’t read the file: ') + (e as Error).message, error: true });
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
    const day = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString(locale()) : tr('data sconosciuta', 'unknown date');
    const summary = tr(
      `${backup.tables.plants.length} piante e ${backup.tables.tasks.length} attività, salvato il ${day}`,
      `${backup.tables.plants.length} plants and ${backup.tables.tasks.length} tasks, saved on ${day}`,
    );
    const run = async () => {
      await importBackup(db, backup);
      setBackupNote({ text: tr(`Backup importato: ${summary}.`, `Backup imported: ${summary}.`) });
      getReminderHour(db).then(setHour);
      getLastBackup(db).then(setLast);
      syncReminders(db);
    };
    const question = tr(
      `Il backup (${summary}) sostituisce tutti i dati attuali.`,
      `The backup (${summary}) replaces all current data.`,
    );
    if (Platform.OS === 'web') {
      if (window.confirm(question)) await run();
      return;
    }
    Alert.alert(tr('Importare il backup?', 'Import the backup?'), question, [
      { text: tr('Annulla', 'Cancel'), style: 'cancel' },
      { text: tr('Sostituisci', 'Replace'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <LargeHeader title={tr('Impostazioni', 'Settings')} />
        <SectionHeader>{tr('Promemoria', 'Reminders')}</SectionHeader>
        <Card>
          <Field label={tr('Ora del promemoria giornaliero', 'Daily reminder time')}>
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
            {tr(
              'Ogni giorno con attività in scadenza ricevi una sola notifica a quest’ora, con l’elenco di cosa fare.',
              'On each day with tasks due you get a single notification at this time, listing what to do.',
            )}
          </Body>
          {granted === false && (
            <>
              <Body style={{ marginTop: 18 }}>{tr('Le notifiche sono disattivate.', 'Notifications are turned off.')}</Body>
              <Button label={tr('Attiva notifiche', 'Turn on notifications')} onPress={enable} />
            </>
          )}
        </Card>
        <SectionHeader>Backup</SectionHeader>
        <Card>
          <Body muted>
            {tr(
              'I dati restano solo su questo telefono: se lo perdi, perdi tutto. Esporta un backup ogni tanto e salvalo su iCloud Drive o dove vuoi. Le foto delle piante non sono nel backup.',
              'Your data stays on this phone only: lose the phone and you lose everything. Export a backup now and then and keep it on iCloud Drive or wherever you like. Plant photos are not in the backup.',
            )}
          </Body>
          {lastBackup ? (
            <Body muted style={{ marginTop: 6 }}>
              {tr('Ultimo backup:', 'Last backup:')} {fromDay(lastBackup).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}
            </Body>
          ) : null}
          <Button label={tr('Esporta backup', 'Export backup')} onPress={doExport} />
          <Button kind="secondary" label={tr('Importa backup', 'Import backup')} onPress={doImport} />
          {backupNote ? (
            <Body style={{ marginTop: 8, color: backupNote.error ? t.danger : t.muted }}>{backupNote.text}</Body>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

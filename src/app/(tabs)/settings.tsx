import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Body, Button, Card, Chip, ChipRow, Field, IconButton, LargeHeader, Screen, SectionHeader, Stepper, useTheme } from '@/components/ui';
import { parseBackup } from '@/lib/backup';
import { parseCatalogFile } from '@/lib/catalogFile';
import { customEntries } from '@/lib/custom';
import { confirm } from '@/lib/dialogs';
import { pickJsonFile, saveBackupFile } from '@/lib/backupFile';
import {
  DATABASE_VERSION,
  addToCatalog,
  exportBackup,
  getLastBackup,
  getReminderHour,
  importBackup,
  removeFromCatalog,
  setLastBackup,
  setReminderHour,
} from '@/lib/db';
import { fromDay, today } from '@/lib/schedule';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { cat, locale, tr } from '@/lib/i18n';
import { chooseLanguage, languageChoice, type LanguageChoice } from '@/lib/locale';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [hour, setHour] = useState<number | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [lastBackup, setLast] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [added, setAdded] = useState(customEntries);
  const [catalogNote, setCatalogNote] = useState<{ text: string; error?: boolean } | null>(null);
  const t = useTheme();
  const [choice, setChoice] = useState(languageChoice);

  const changeLanguage = (c: LanguageChoice) => {
    if (c === choice) return;
    setChoice(c);
    // Every screen is redrawn in the new language; come back here.
    chooseLanguage(c);
    setTimeout(() => router.navigate('/settings'), 0);
    syncReminders(db);
  };

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
      text = await pickJsonFile();
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
      setAdded(customEntries());
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

  const doCatalogImport = async () => {
    let items;
    try {
      const text = await pickJsonFile();
      if (text === null) return;
      items = parseCatalogFile(text);
    } catch (e) {
      setCatalogNote({ text: (e as Error).message, error: true });
      return;
    }
    const { added: fresh, replaced } = await addToCatalog(db, items);
    setAdded(customEntries());
    const names = (list: string[]) => list.map(cat).join(', ');
    setCatalogNote({
      text: [
        fresh.length ? tr(`Aggiunte al catalogo: ${names(fresh)}.`, `Added to the catalog: ${names(fresh)}.`) : '',
        replaced.length ? tr(`Aggiornate: ${names(replaced)}.`, `Updated: ${names(replaced)}.`) : '',
      ].filter(Boolean).join(' '),
    });
  };

  const removeAdded = async (name: string) => {
    const ok = await confirm(
      tr(`Togliere “${cat(name)}” dal catalogo?`, `Remove “${cat(name)}” from the catalog?`),
      tr(
        'Le piante già create da questa voce restano, con le loro attività.',
        'Plants already created from it stay, with their tasks.',
      ),
      tr('Togli', 'Remove'),
      true,
    );
    if (!ok) return;
    await removeFromCatalog(db, name);
    setAdded(customEntries());
    setCatalogNote(null);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <LargeHeader title={tr('Impostazioni', 'Settings')} />
        <SectionHeader>{tr('Lingua', 'Language')}</SectionHeader>
        <Card>
          <ChipRow>
            {(['system', 'it', 'en'] as LanguageChoice[]).map((c) => (
              <Chip
                key={c}
                label={c === 'system' ? tr('Come il telefono', 'Same as phone') : c === 'it' ? 'Italiano' : 'English'}
                selected={choice === c}
                onPress={() => changeLanguage(c)}
              />
            ))}
          </ChipRow>
        </Card>
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
        <SectionHeader>{tr('Catalogo', 'Catalog')}</SectionHeader>
        <Card>
          <Body muted>
            {tr(
              'Aggiungi al catalogo piante che non ci sono, con le loro cure, da un file JSON. Si aggiungono a quelle che hai: non cancella niente.',
              'Add plants that aren’t in the catalog, with their care, from a JSON file. They go on top of what you have: nothing is deleted.',
            )}
          </Body>
          {added.map((e) => (
            <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
              <Body style={{ flex: 1 }}>{cat(e.name)}</Body>
              <IconButton icon="close" tone="neutral" label={tr('Togli dal catalogo', 'Remove from the catalog')} onPress={() => removeAdded(e.name)} />
            </View>
          ))}
          <Button kind="secondary" label={tr('Aggiungi piante da file', 'Add plants from a file')} onPress={doCatalogImport} />
          {catalogNote ? (
            <Body style={{ marginTop: 8, color: catalogNote.error ? t.danger : t.muted }}>{catalogNote.text}</Body>
          ) : null}
        </Card>
        <SectionHeader>Backup</SectionHeader>
        <Card>
          <Body muted>
            {tr(
              'I dati restano solo su questo telefono: se lo perdi, perdi tutto. Esporta un backup ogni tanto e salvalo su iCloud Drive o dove vuoi. Le piante aggiunte al catalogo sono nel backup, le foto no.',
              'Your data stays on this phone only: lose the phone and you lose everything. Export a backup now and then and keep it on iCloud Drive or wherever you like. Plants added to the catalog are in the backup, photos are not.',
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

// Saving backup files, and opening backup and catalog files. On the phone the file goes through the
// share sheet (Save to Files, iCloud Drive, AirDrop…); in the web preview it
// downloads.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { backupFileName, type Backup } from './backup';
import { today } from './schedule';

export async function saveBackupFile(backup: Backup): Promise<void> {
  const name = backupFileName(today());
  const json = JSON.stringify(backup, null, 1);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: name });
}

/** The text of a file the user picks, or null if they cancel. */
export async function pickJsonFile(): Promise<string | null> {
  // Any file: iOS doesn't always tag .json files from iCloud Drive as JSON.
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

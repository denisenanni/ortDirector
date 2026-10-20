// One photo per plant, kept in the app's documents folder. The database
// stores only the file name, because the folder's full path can change when
// iOS updates the app. The web preview has no file system, so there the photo
// is stored inline as a data URL.
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const folder = () => new Directory(Paths.document, 'photos');

export function photoUri(photo: string | null): string | null {
  if (!photo) return null;
  if (photo.startsWith('data:')) return photo;
  // Missing after restoring a backup on another phone: backups carry no photos.
  const f = new File(folder(), photo);
  return f.exists ? f.uri : null;
}

/** Camera access was refused; iOS asks only once, after that only Settings can change it. */
export class CameraPermissionError extends Error {
  constructor() {
    super('Camera access denied');
  }
}

/**
 * Lets the user take or pick a photo, cropped 4:3, and stores it. Returns the
 * value for the plant's photo column, or null if they cancel. Throws
 * CameraPermissionError when camera access is refused.
 */
export async function takePhoto(plantId: number, source: 'camera' | 'library'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.6,
    base64: Platform.OS === 'web',
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraPermissionError();
  }
  const res =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    return asset.uri.startsWith('data:') ? asset.uri : `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  // A new name each time, so the image isn't served stale from cache.
  const name = `plant-${plantId}-${Date.now()}.${ext}`;
  new File(asset.uri).copySync(new File(dir, name));
  return name;
}

/** Removes a stored photo file; data URLs and missing files are fine. */
export function deletePhoto(photo: string | null) {
  if (!photo || photo.startsWith('data:')) return;
  try {
    const f = new File(folder(), photo);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn('deletePhoto', e);
  }
}

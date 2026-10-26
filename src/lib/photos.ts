// One photo per plant, kept in the app's documents folder. The database
// stores only the file name, because the folder's full path can change when
// iOS updates the app. The web preview has no file system, so there the photo
// is stored inline as a data URL.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageResult } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const folder = () => new Directory(Paths.document, 'photos');

/** Longest side of a stored photo: plenty for a phone screen, about 200 KB as JPEG. */
const MAX_SIDE = 1280;
/** Photos saved before they were shrunk are bigger than this, and get shrunk for the backup. */
const BIG_FILE = 500_000;

/** Re-encodes an image as JPEG, scaled down to MAX_SIDE if it is bigger. */
async function shrink(uri: string, base64: boolean): Promise<ImageResult> {
  let img = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(img.width, img.height) > MAX_SIDE) {
    const size = img.width >= img.height ? { width: MAX_SIDE } : { height: MAX_SIDE };
    img = await ImageManipulator.manipulate(img).resize(size).renderAsync();
  }
  return img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64 });
}

export function photoUri(photo: string | null): string | null {
  if (!photo) return null;
  if (photo.startsWith('data:')) return photo;
  // Missing if writing it back from a backup failed.
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
    quality: 1, // shrink() compresses it once
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new CameraPermissionError();
  }
  const res =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled) return null;
  const web = Platform.OS === 'web';
  const img = await shrink(res.assets[0].uri, web);
  if (web) return `data:image/jpeg;base64,${img.base64}`;
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  // A new name each time, so the image isn't served stale from cache.
  const name = `plant-${plantId}-${Date.now()}.jpg`;
  new File(img.uri).moveSync(new File(dir, name));
  return name;
}

/**
 * The named photo files as base64, for a backup. Missing files are left out;
 * big ones from before photos were shrunk go in shrunk, the file itself stays.
 */
export async function readPhotos(names: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (Platform.OS === 'web') return out;
  for (const name of names) {
    const f = new File(folder(), name);
    if (!f.exists) continue;
    out[name] = (f.size ?? 0) > BIG_FILE ? (await shrink(f.uri, true)).base64! : await f.base64();
  }
  return out;
}

/**
 * After a backup is restored: writes its photos back and removes every file
 * that no plant uses any more. `keep` is the photos the restored plants use;
 * an older backup without photos keeps those already on this phone.
 */
export function restorePhotos(photos: Record<string, string>, keep: string[]) {
  if (Platform.OS === 'web') return;
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  for (const name of keep) {
    if (photos[name] === undefined) continue;
    try {
      const f = new File(dir, name);
      f.create({ overwrite: true });
      f.write(photos[name], { encoding: 'base64' });
    } catch (e) {
      console.warn('restorePhotos', name, e);
    }
  }
  for (const entry of dir.list()) {
    if (entry instanceof File && !keep.includes(entry.name)) deletePhoto(entry.name);
  }
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

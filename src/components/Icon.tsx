// One icon set for the whole app: SF Symbols on iOS, Material Symbols on
// Android and web (both through expo-symbols, which Expo Go ships).
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import type { Sun, TaskType } from '@/lib/types';

const ICONS = {
  water: { ios: 'drop.fill', android: 'water_drop' },
  check: { ios: 'magnifyingglass', android: 'search' },
  prune: { ios: 'scissors', android: 'content_cut' },
  fertilize: { ios: 'flask.fill', android: 'science' },
  treat: { ios: 'ant.fill', android: 'pest_control' },
  harvest: { ios: 'basket.fill', android: 'shopping_basket' },
  transplant: { ios: 'camera.macro', android: 'psychiatry' },
  other: { ios: 'note.text', android: 'notes' },
  sunFull: { ios: 'sun.max.fill', android: 'sunny' },
  sunPartial: { ios: 'cloud.sun.fill', android: 'partly_cloudy_day' },
  sunShade: { ios: 'cloud.fill', android: 'cloud' },
  rain: { ios: 'cloud.rain.fill', android: 'rainy' },
  today: { ios: 'calendar', android: 'calendar_today' },
  plants: { ios: 'leaf.fill', android: 'eco' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  tick: { ios: 'checkmark', android: 'check' },
  add: { ios: 'plus', android: 'add' },
  place: { ios: 'mappin', android: 'location_on' },
  tip: { ios: 'lightbulb.fill', android: 'lightbulb' },
  warn: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  photo: { ios: 'photo', android: 'image' },
  archive: { ios: 'archivebox', android: 'archive' },
  restore: { ios: 'arrow.uturn.backward', android: 'unarchive' },
  edit: { ios: 'pencil', android: 'edit' },
  chevron: { ios: 'chevron.right', android: 'chevron_right' },
  ground: { ios: 'tree.fill', android: 'yard' },
  sprout: { ios: 'leaf', android: 'spa' },
  close: { ios: 'xmark', android: 'close' },
  covered: { ios: 'house.fill', android: 'home' },
} as const;

export type IconName = keyof typeof ICONS;

export const TASK_SYMBOL: Record<TaskType, IconName> = {
  water: 'water',
  check: 'check',
  prune: 'prune',
  fertilize: 'fertilize',
  treat: 'treat',
  harvest: 'harvest',
  transplant: 'transplant',
  other: 'other',
};

export const SUN_SYMBOL: Record<Sun, IconName> = { full: 'sunFull', partial: 'sunPartial', shade: 'sunShade' };

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} type="monochrome" />;
}

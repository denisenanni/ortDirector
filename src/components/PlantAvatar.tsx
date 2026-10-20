import { Text, View } from 'react-native';
import { intervalOn, today } from '@/lib/schedule';
import type { Plant } from '@/lib/types';
import { Icon } from './Icon';
import { SERIF, useTheme } from './ui';

/** Square stand-in for a plant without a photo: its initial, or a sprout while it waits to be transplanted. */
export function PlantAvatar({ plant, size = 52 }: { plant: Pick<Plant, 'name' | 'stage'>; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: t.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {plant.stage === 'seedbed' ? (
        <Icon name="sprout" size={size * 0.48} color={t.accent} />
      ) : (
        <Text style={{ fontFamily: SERIF, fontSize: size * 0.46, lineHeight: size * 0.56, color: t.accent }}>
          {plant.name.trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** The watering interval in force today, short: "ogni 3 gg". */
export function waterLabel(plant: Pick<Plant, 'waterEveryDays' | 'waterColdDays'>): string {
  const days = intervalOn({ repeatDays: plant.waterEveryDays, coldRepeatDays: plant.waterColdDays }, today());
  return days === 1 ? 'ogni giorno' : `ogni ${days} gg`;
}

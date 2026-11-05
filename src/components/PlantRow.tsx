import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { Icon, SUN_SYMBOL } from '@/components/Icon';
import { PlantAvatar, waterLabel } from '@/components/PlantAvatar';
import { Pill, PillRow, SERIF, useTheme } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { photoUri } from '@/lib/photos';
import { SUN_LABEL } from '@/lib/presets';
import { sunMismatch } from '@/lib/schedule';
import type { Plant, Zone } from '@/lib/types';

/** A plant in a list: photo, name, sun and water, and the warning if the zone's sun is wrong for it. */
export function PlantRow({ plant: p, zone }: { plant: Plant; zone?: Zone }) {
  const t = useTheme();
  const warn = zone && sunMismatch(p.sun, zone.sun);
  const uri = photoUri(p.photo);
  return (
    <Pressable
      onPress={() => router.push(`/plant/${p.id}`)}
      style={({ pressed }) => [
        { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, paddingRight: 14 },
        pressed && { opacity: 0.6 },
      ]}
    >
      {uri ? <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: 14 }} /> : <PlantAvatar plant={p} />}
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 23, color: t.text }}>
          {p.name}
          {p.variety ? <Text style={{ color: t.muted }}> {p.variety}</Text> : null}
        </Text>
        <PillRow>
          <Pill icon={SUN_SYMBOL[p.sun]} tone="sun" label={SUN_LABEL[p.sun]} />
          {p.waterEveryDays ? <Pill icon="water" tone="water" label={waterLabel(p)} /> : null}
          {p.potted ? <Pill label={tr('In vaso', 'In a pot')} /> : null}
          {p.stage === 'seedbed' ? <Pill tone="accent" label={tr('Da trapiantare', 'To transplant')} /> : null}
        </PillRow>
        {warn ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="warn" size={14} color={t.warn} />
            <Text style={{ color: t.warn, fontSize: 14, flex: 1 }}>{warn}</Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron" size={16} color={t.muted} />
    </Pressable>
  );
}

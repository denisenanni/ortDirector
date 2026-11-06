// A slider for a value in steps: drag along the track, or tap − and +.
// Plain PanResponder, like the map, so it works in Expo Go and on the web.
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { IconButton, useTheme } from '@/components/ui';
import { tr } from '@/lib/i18n';

export function TimeSlider({
  value,
  min,
  max,
  step,
  label,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const live = useRef({ width, min, max, onChange, clamp });
  live.current = { width, min, max, onChange, clamp };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
      onPanResponderMove: (e) => at(e.nativeEvent.locationX),
    }),
  ).current;
  function at(x: number) {
    const { width: w, min: lo, max: hi, onChange: change, clamp: c } = live.current;
    if (w <= 0) return;
    change(c(lo + (Math.min(w, Math.max(0, x)) / w) * (hi - lo)));
  }

  const frac = max > min ? (value - min) / (max - min) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton icon="minus" tone="neutral" label={tr('Prima', 'Earlier')} onPress={() => onChange(clamp(value - step))} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 4 }} accessibilityLiveRegion="polite">
          {`${label} ${format(value)}`}
        </Text>
        <View
          style={styles.hit}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: format(value) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
          {...responder.panHandlers}
        >
          <View pointerEvents="none" style={[styles.track, { backgroundColor: t.border }]}>
            <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: t.sun }]} />
          </View>
          <View pointerEvents="none" style={[styles.thumb, { left: frac * width - 11, backgroundColor: t.card, borderColor: t.sun }]} />
        </View>
      </View>
      <IconButton icon="add" tone="neutral" label={tr('Dopo', 'Later')} onPress={() => onChange(clamp(value + step))} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 28, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  thumb: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 11, borderWidth: 3 },
});

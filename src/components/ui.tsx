import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

const light = {
  bg: '#F4F6EF',
  card: '#FFFFFF',
  text: '#1D2618',
  muted: '#68725F',
  border: '#DCE2D3',
  accent: '#3F7D20',
  accentText: '#FFFFFF',
  danger: '#B3261E',
  warn: '#A15C00',
};

const dark: typeof light = {
  bg: '#12160F',
  card: '#1C2218',
  text: '#E8EDE2',
  muted: '#9AA591',
  border: '#2E3729',
  accent: '#7CC152',
  accentText: '#0E1409',
  danger: '#F2B8B5',
  warn: '#FFB95C',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.muted }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : t.border },
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? t.accent : t.border, backgroundColor: selected ? t.accent : t.card },
      ]}
    >
      <Text style={{ color: selected ? t.accentText : t.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[
        styles.input,
        { color: t.text, borderColor: t.border, backgroundColor: t.card },
        props.multiline && { minHeight: 80, textAlignVertical: 'top' },
      ]}
    />
  );
}

/** Integer stepper; `null` means "off" when `allowOff` is set. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 365,
  format,
  allowOff,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  format: (v: number) => string;
  allowOff?: string;
}) {
  const t = useTheme();
  const dec = () => {
    if (value === null) return;
    if (value <= min) onChange(allowOff ? null : min);
    else onChange(value - 1);
  };
  const inc = () => onChange(value === null ? min : Math.min(max, value + 1));
  return (
    <View style={[styles.stepper, { borderColor: t.border, backgroundColor: t.card }]}>
      <Pressable accessibilityLabel="Diminuisci" onPress={dec} style={styles.stepBtn} hitSlop={8}>
        <Text style={[styles.stepSign, { color: t.accent }]}>−</Text>
      </Pressable>
      <Text style={[styles.body, { color: t.text, flex: 1, textAlign: 'center' }]}>
        {value === null ? allowOff : format(value)}
      </Text>
      <Pressable accessibilityLabel="Aumenta" onPress={inc} style={styles.stepBtn} hitSlop={8}>
        <Text style={[styles.stepSign, { color: t.accent }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>🌱</Text>
      <Title>{title}</Title>
      <Body muted style={{ textAlign: 'center', marginTop: 6 }}>{hint}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  section: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: { borderRadius: 999, borderWidth: 1, paddingVertical: 7, paddingHorizontal: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10 },
  stepBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  stepSign: { fontSize: 24, fontWeight: '500' },
});

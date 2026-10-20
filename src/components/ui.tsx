import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { locale, tr } from '@/lib/i18n';
import { addDays, daysBetween, fromDay, toDay } from '@/lib/schedule';
import { Icon, type IconName } from './Icon';

// Garden-notebook palette: warm paper, deep leaf green, terracotta for what's
// late, water blue and sun amber for the two things every plant needs.
const light = {
  bg: '#F4F0E6',
  card: '#FFFDF8',
  text: '#1E2A1B',
  muted: '#6E7464',
  border: '#E6DFCF',
  accent: '#2F5E3B',
  accentText: '#FFFFFF',
  accentSoft: '#E2EBDB',
  danger: '#B3261E',
  warn: '#B4532A',
  warnSoft: '#F7E3D8',
  water: '#2F6F98',
  waterSoft: '#E0ECF3',
  sun: '#9A6A00',
  sunSoft: '#F8EBC8',
};

const dark: typeof light = {
  bg: '#121611',
  card: '#1C221A',
  text: '#E9EDE3',
  muted: '#9CA493',
  border: '#2C3428',
  accent: '#8CC67A',
  accentText: '#10180D',
  accentSoft: '#25331F',
  danger: '#F2B8B5',
  warn: '#F0A27E',
  warnSoft: '#3A2419',
  water: '#8FC3E6',
  waterSoft: '#1B2C38',
  sun: '#F0C75E',
  sunSoft: '#352B12',
};

export type Theme = typeof light;
export type Tone = 'accent' | 'water' | 'sun' | 'warn' | 'neutral';

/** Display serif for titles and plant names, loaded in the root layout. */
export const SERIF = 'Fraunces_600SemiBold';

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function toneColors(t: Theme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'accent':
      return { fg: t.accent, bg: t.accentSoft };
    case 'water':
      return { fg: t.water, bg: t.waterSoft };
    case 'sun':
      return { fg: t.sun, bg: t.sunSoft };
    case 'warn':
      return { fg: t.warn, bg: t.warnSoft };
    default:
      return { fg: t.muted, bg: t.border };
  }
}

export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
}

/** Big serif title at the top of a tab, in place of the navigation bar. */
export function LargeHeader({
  title,
  eyebrow,
  subtitle,
  right,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 12, marginBottom: 8 }}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: t.muted }]}>{eyebrow}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[styles.largeTitle, { color: t.text }]}>{title}</Text>
        {right}
      </View>
      {subtitle ? <Text style={[styles.body, { color: t.muted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

/** Rows stacked in one card with hairlines between them, like an iOS grouped list. */
export function Group({ children }: { children: ReactNode }) {
  const t = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  if (rows.length === 0) return null;
  return (
    <View style={[styles.group, { backgroundColor: t.card, borderColor: t.border }]}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 ? <View style={[styles.separator, { backgroundColor: t.border }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.text }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: muted ? t.muted : t.text }, style]}>{children}</Text>;
}

export function SectionHeader({
  children,
  count,
  icon,
  onPress,
}: {
  children: ReactNode;
  count?: number;
  icon?: IconName;
  onPress?: () => void;
}) {
  const t = useTheme();
  const content = (
    <View style={styles.sectionRow}>
      {icon ? <Icon name={icon} size={18} color={t.muted} /> : null}
      <Text style={[styles.section, { color: t.text }]}>{children}</Text>
      {count !== undefined ? (
        <View style={[styles.count, { backgroundColor: t.accentSoft }]}>
          <Text style={{ color: t.accent, fontSize: 13, fontWeight: '700' }}>{count}</Text>
        </View>
      ) : null}
      {onPress ? (
        <View style={{ marginLeft: 'auto' }}>
          <Icon name="chevron" size={16} color={t.muted} />
        </View>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'secondary' ? t.accentSoft : 'transparent';
  const fg = kind === 'primary' ? t.accentText : kind === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        kind === 'ghost' || kind === 'danger' ? { paddingVertical: 10 } : null,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Round icon-only button, for header actions. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'accent',
  filled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: Tone;
  filled?: boolean;
}) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: filled ? c.fg : c.bg },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={icon} size={20} color={filled ? (tone === 'accent' ? t.accentText : t.card) : c.fg} />
    </Pressable>
  );
}

/** Small tinted label: sun, water, pot, warnings. */
export function Pill({ label, icon, tone = 'neutral' }: { label: string; icon?: IconName; tone?: Tone }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={13} color={c.fg} /> : null}
      <Text style={{ color: c.fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

/** Square tinted tile holding an icon, at the start of a row. */
export function IconTile({ icon, tone, size = 40 }: { icon: IconName; tone: Tone; size?: number }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: c.bg }]}>
      <Icon name={icon} size={size * 0.5} color={c.fg} />
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const fg = selected ? t.accentText : t.text;
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
      {icon ? <Icon name={icon} size={15} color={selected ? fg : t.accent} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: selected ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
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
      <Pressable accessibilityLabel={tr('Diminuisci', 'Decrease')} onPress={dec} style={styles.stepBtn} hitSlop={8}>
        <Text style={[styles.stepSign, { color: t.accent }]}>−</Text>
      </Pressable>
      <Text style={[styles.body, { color: t.text, flex: 1, textAlign: 'center' }]}>
        {value === null ? allowOff : format(value)}
      </Text>
      <Pressable accessibilityLabel={tr('Aumenta', 'Increase')} onPress={inc} style={styles.stepBtn} hitSlop={8}>
        <Text style={[styles.stepSign, { color: t.accent }]}>+</Text>
      </Pressable>
    </View>
  );
}

const daysAgo = (n: number) =>
  n === 0 ? tr('Oggi', 'Today') : n === 1 ? tr('Ieri', 'Yesterday') : tr(`${n} giorni fa`, `${n} days ago`);

/** Picks today or a day in the past, as "N days ago". */
export function PastDayPicker({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (day: string) => void;
  today: string;
}) {
  const t = useTheme();
  const ago = Math.max(0, daysBetween(value, today));
  const longDate = fromDay(value).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const pick = (date?: Date) => {
    if (date) onChange(toDay(date) > today ? today : toDay(date));
  };
  const range = { value: fromDay(value), maximumDate: fromDay(today), minimumDate: fromDay(addDays(today, -365 * 5)) };
  return (
    <>
      <ChipRow>
        {[0, 1, 7, 14, 30].map((d) => (
          <Chip
            key={d}
            label={daysAgo(d)}
            selected={ago === d}
            onPress={() => onChange(addDays(today, -d))}
          />
        ))}
      </ChipRow>
      <View style={{ height: 8 }} />
      {Platform.OS === 'ios' ? (
        // Compact: shows the date; a tap opens the iOS calendar.
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: t.muted, fontSize: 15 }}>{tr('Altra data:', 'Other date:')}</Text>
          <DateTimePicker
            mode="date"
            display="compact"
            locale={locale()}
            {...range}
            onValueChange={(_, date) => pick(date)}
          />
        </View>
      ) : Platform.OS === 'android' ? (
        <Chip
          icon="today"
          label={longDate}
          selected={false}
          onPress={() => DateTimePickerAndroid.open({ mode: 'date', ...range, onValueChange: (_, date) => pick(date) })}
        />
      ) : (
        // The web preview has no native picker: the stepper counts days from
        // a year ago, so − goes back in time and + towards today.
        <Stepper
          value={365 - Math.min(ago, 365)}
          onChange={(v) => onChange(addDays(today, -(365 - (v ?? 365))))}
          min={0}
          max={365}
          format={(v) => {
            const n = 365 - v;
            return (
              daysAgo(n) +
              ` · ${fromDay(addDays(today, -n)).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`
            );
          }}
        />
      )}
      {ago > 0 ? (
        <Text style={{ color: t.muted, fontSize: 14, marginTop: 6 }}>
          {longDate} · {daysAgo(ago).toLowerCase()}
        </Text>
      ) : null}
    </>
  );
}

/** A full-width row that can be switched on and off, with a detail line. */
export function ToggleRow({
  label,
  icon,
  detail,
  on,
  disabled,
  onPress,
}: {
  label: string;
  icon?: IconName;
  detail: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.toggleRow, { backgroundColor: t.card, borderColor: on ? t.accent : t.border }, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.toggleBox, { borderColor: t.accent, backgroundColor: on ? t.accent : 'transparent' }]}>
        {on ? <Icon name="tick" size={15} color={t.accentText} /> : null}
      </View>
      {icon ? <Icon name={icon} size={18} color={t.muted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: t.text }]}>{label}</Text>
        <Text style={{ color: t.muted, fontSize: 14, marginTop: 2 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

export function Empty({ title, hint, icon = 'sprout' }: { title: string; hint: string; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' }}>
      <View style={[styles.emptyIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name={icon} size={34} color={t.accent} />
      </View>
      <Title style={{ textAlign: 'center' }}>{title}</Title>
      <Body muted style={{ textAlign: 'center', marginTop: 6 }}>{hint}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  largeTitle: { fontFamily: SERIF, fontSize: 34, lineHeight: 40, flex: 1 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  group: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 8 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  title: { fontFamily: SERIF, fontSize: 21, lineHeight: 27 },
  body: { fontSize: 16, lineHeight: 22 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 10, minHeight: 26 },
  section: { fontFamily: SERIF, fontSize: 20, lineHeight: 26 },
  count: { borderRadius: 999, minWidth: 24, paddingHorizontal: 7, height: 22, alignItems: 'center', justifyContent: 'center' },
  button: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  tile: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  toggleBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  stepBtn: { paddingHorizontal: 18, paddingVertical: 8 },
  stepSign: { fontSize: 24, fontWeight: '500' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
});

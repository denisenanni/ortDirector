import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/components/ui';
import { tr, useLanguage } from '@/lib/i18n';

const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Icon name={name} size={24} color={color} />;

export default function TabsLayout() {
  const t = useTheme();
  useLanguage();
  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own large title.
        headerShown: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('Oggi', 'Today'), tabBarIcon: icon('today') }} />
      <Tabs.Screen name="plants" options={{ title: tr('Piante', 'Plants'), tabBarIcon: icon('plants') }} />
      <Tabs.Screen name="settings" options={{ title: tr('Impostazioni', 'Settings'), tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}

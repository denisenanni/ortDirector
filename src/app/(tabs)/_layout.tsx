import { Tabs } from 'expo-router/tabs';
import { Text } from 'react-native';
import { useTheme } from '@/components/ui';

const icon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Oggi', tabBarIcon: icon('🗓️') }} />
      <Tabs.Screen name="plants" options={{ title: 'Piante', tabBarIcon: icon('🌿') }} />
      <Tabs.Screen name="settings" options={{ title: 'Impostazioni', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}

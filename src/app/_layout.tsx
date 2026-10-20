// First, so every module below sees the chosen language.
import '@/lib/locale';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/components/ui';
import { DATABASE_NAME, migrate } from '@/lib/db';
import { tr, useLanguage } from '@/lib/i18n';
import '@/lib/notifications';

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });
  // Changing language in Impostazioni redraws every screen from scratch.
  const lang = useLanguage();
  if (!fontsLoaded) return null;
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <StatusBar style="auto" />
      <Stack
        key={lang}
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.accent,
          headerTitleStyle: { color: t.text, fontFamily: 'Fraunces_600SemiBold' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: tr('Indietro', 'Back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plant/[id]" options={{ title: '' }} />
        <Stack.Screen name="plant/edit" options={{ presentation: 'modal', title: tr('Pianta', 'Plant') }} />
        <Stack.Screen name="plant/transplant" options={{ presentation: 'modal', title: tr('Trapianto', 'Transplant') }} />
        <Stack.Screen name="zone/edit" options={{ presentation: 'modal', title: tr('Zona', 'Zone') }} />
        <Stack.Screen name="task/edit" options={{ presentation: 'modal', title: tr('Attività', 'Task') }} />
      </Stack>
    </SQLiteProvider>
  );
}

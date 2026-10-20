import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/components/ui';
import { DATABASE_NAME, migrate } from '@/lib/db';
import '@/lib/notifications';

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold });
  if (!fontsLoaded) return null;
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.accent,
          headerTitleStyle: { color: t.text, fontFamily: 'Fraunces_600SemiBold' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: 'Indietro',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plant/[id]" options={{ title: '' }} />
        <Stack.Screen name="plant/edit" options={{ presentation: 'modal', title: 'Pianta' }} />
        <Stack.Screen name="plant/transplant" options={{ presentation: 'modal', title: 'Trapianto' }} />
        <Stack.Screen name="zone/edit" options={{ presentation: 'modal', title: 'Zona' }} />
        <Stack.Screen name="task/edit" options={{ presentation: 'modal', title: 'Attività' }} />
      </Stack>
    </SQLiteProvider>
  );
}

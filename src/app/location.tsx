import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Body, Button, Field, Input, Screen, useTheme } from '@/components/ui';
import { getPlace, setPlace, validPlace } from '@/lib/db';
import { tr } from '@/lib/i18n';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')));
const show = (v: number) => String(Math.round(v * 10000) / 10000).replace('.', tr(',', '.'));

/**
 * Where the garden is, for the sun's path: from the GPS once, or typed. The
 * sun is worked out on the phone; nothing goes on the network.
 */
export default function LocationScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPlace(db).then((p) => {
      if (!p) return;
      setLat(show(p.lat));
      setLon(show(p.lon));
    });
  }, [db]);

  const place = { lat: num(lat), lon: num(lon) };
  const ok = validPlace(place);

  const locate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setNote({ text: tr('Senza il permesso alla posizione, scrivi latitudine e longitudine a mano.', 'Without location access, type latitude and longitude by hand.'), error: true });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(show(pos.coords.latitude));
      setLon(show(pos.coords.longitude));
      setNote({ text: tr('Trovata. Controlla e salva.', 'Found. Check it and save.') });
    } catch {
      setNote({ text: tr('Posizione non trovata. Riprova all’aperto o scrivila a mano.', 'Location not found. Try outdoors or type it by hand.'), error: true });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!ok) return;
    await setPlace(db, place);
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Body muted style={{ marginBottom: 16 }}>
            {tr(
              'Serve per il percorso del sole, che l’app calcola sul telefono. La posizione resta qui: niente va in rete.',
              'It gives the sun’s path, which the app works out on the phone. The location stays here: nothing goes on the network.',
            )}
          </Body>
          <Button kind="secondary" icon="locate" label={busy ? tr('Cerco…', 'Locating…') : tr('Usa la mia posizione', 'Use my location')} onPress={locate} disabled={busy} />
          {note ? <Body style={{ marginTop: 8, color: note.error ? t.danger : t.muted }}>{note.text}</Body> : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Field label={tr('Latitudine', 'Latitude')}>
                <Input value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="45,07" accessibilityLabel={tr('Latitudine', 'Latitude')} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={tr('Longitudine', 'Longitude')}>
                <Input value={lon} onChangeText={setLon} keyboardType="numbers-and-punctuation" placeholder="7,69" accessibilityLabel={tr('Longitudine', 'Longitude')} />
              </Field>
            </View>
          </View>
          <Body muted style={{ marginBottom: 16 }}>
            {tr('In gradi: nord ed est positivi, sud e ovest negativi.', 'In degrees: north and east positive, south and west negative.')}
          </Body>
          <Button label={tr('Salva', 'Save')} onPress={save} disabled={!ok} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

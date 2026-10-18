# ortDirector

App per gestire orto e giardino: cosa ha bisogno ogni pianta (sole, acqua) e cosa c'è da fare oggi.
React Native + Expo (SDK 58), TypeScript, dati solo sul telefono (SQLite), promemoria con notifiche locali.

## Cosa fa

- **Piante**: nome, varietà, posizione, esposizione, ogni quanti giorni annaffiare, note.
  Ci sono ~25 piante comuni (pomodoro, basilico, lavanda, ortensia…) che precompilano sole e acqua con un consiglio.
- **Attività**: annaffiare, controllo, potatura, concimazione, trattamento, raccolta, altro.
  Una volta o ripetute ogni N giorni. Le ripetute ripartono dal giorno in cui le segni fatte.
  Ogni pianta con un intervallo di irrigazione ha la sua attività "Annaffiare" automatica.
- **Oggi**: cosa scade oggi o è in ritardo, i prossimi 7 giorni, e più avanti. Tocca il cerchio per segnare fatto.
- **Promemoria**: una sola notifica al giorno (ora configurabile, default 8:00) con l'elenco delle attività.
- **Storico** per pianta.

## Provarla sull'iPhone

Serve un computer (Mac, Windows o Linux) con Node 20+ sulla stessa Wi-Fi dell'iPhone.

1. Installa **Expo Go** dall'App Store.
2. Sul computer:
   ```sh
   git clone https://github.com/denisenanni/ortDirector.git
   cd ortDirector
   npm install
   npx expo start
   ```
3. Inquadra il QR code con la fotocamera dell'iPhone, si apre in Expo Go.

Se il telefono non vede il computer (reti aziendali, VPN): `npx expo start --tunnel`.

Expo Go deve supportare SDK 58. Se dice che la versione non è compatibile, aggiorna Expo Go.

## Sviluppo

```sh
npm run typecheck   # tsc
npm test            # test della logica di date e promemoria (node --test)
npx expo start --web  # anteprima nel browser
```

Struttura:

- `src/app/` schermate (Expo Router). `(tabs)/` sono Oggi, Piante, Impostazioni.
- `src/lib/db.ts` schema SQLite, migrazioni (`PRAGMA user_version`) e query.
- `src/lib/schedule.ts` logica pura di date e promemoria, testata in `schedule.test.ts`.
- `src/lib/notifications.ts` permessi e sincronizzazione delle notifiche.
- `src/lib/presets.ts` piante comuni ed etichette.

## Prossimi passi possibili

- Mappa schematica del giardino (aiuole, posizione delle piante).
- Foto delle piante.
- Build vera per iPhone (EAS) invece di Expo Go, e Android.

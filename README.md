# ortDirector

App per gestire orto e giardino: cosa ha bisogno ogni pianta (sole, acqua) e cosa c'è da fare oggi.
React Native + Expo (SDK 57), TypeScript, dati solo sul telefono (SQLite), promemoria con notifiche locali.

## Cosa fa

- **Piante**: nome, varietà, posizione, esposizione, ogni quanti giorni annaffiare, note.
  Ci sono ~25 piante comuni (pomodoro, basilico, lavanda, ortensia…) che precompilano sole e acqua con un consiglio.
- **Attività**: annaffiare, controllo, potatura, concimazione, trattamento, raccolta, altro.
  Una volta o ripetute ogni N giorni. Le ripetute ripartono dal giorno in cui le segni fatte.
  Ogni pianta con un intervallo di irrigazione ha la sua attività "Annaffiare" automatica.
- **Semenzaio e trapianto**: una pianta nasce *seminata*, *piantina da trapiantare* o *già a dimora*.
  Per le piante del catalogo arriva il promemoria "Pronta da trapiantare" dopo le settimane tipiche dalla semina.
  Segnando il trapianto (data di default oggi) l'app crea le attività del piano della pianta, contate da quel giorno:
  per il pomodoro irrigazione fitta le prime 2 settimane, tutore a +7, concimazione da +15, femminelle ogni settimana, raccolta da +70.
  Le attività del piano si possono togliere prima di confermare e modificare una per una dopo. I piani sono in `src/lib/plans.ts`.
- **Ricorrenze stagionali**: un'attività può ripetersi ogni N giorni solo in certi mesi (concime ogni 3 settimane, apr–set) o una volta l'anno (potatura a febbraio).
  Fuori stagione salta al primo giorno del mese utile. Le perenni del catalogo (rosa, lavanda, ortensia, limone…) ricevono da sole le loro cure annuali,
  e i passi estivi dei piani dell'orto (raccolta, concime) stanno nella loro stagione.
- **Zone**: aiuole, vasi del balcone, serra… con il sole che prendono davvero e se sono al coperto. In Piante le piante sono raggruppate per zona,
  e se il sole della zona non va bene per la pianta (pomodoro in ombra, ortensia in pieno sole) compare un avviso.
- **Pioggia e stagioni**: il pulsante "Ha piovuto" in Oggi conta come annaffiate tutte le piante tranne quelle nelle zone al coperto.
  Ogni pianta ha un intervallo di irrigazione da maggio a settembre e uno per il resto dell'anno.
- **Backup**: in Impostazioni "Esporta backup" crea un file JSON con tutti i dati da salvare su iCloud Drive o dove vuoi;
  "Importa backup" lo rimette al posto dei dati attuali, dopo una conferma.
- **Oggi**: cosa scade oggi o è in ritardo, i prossimi 7 giorni, e più avanti. Tocca il cerchio per segnare fatto.
- **Promemoria**: una sola notifica al giorno (ora configurabile, default 8:00) con l'elenco delle attività.
- **Storico** per pianta.

## Provarla sull'iPhone

Serve un computer (Mac, Windows o Linux) con **Node 24 LTS** (c’è `.nvmrc`; Expo non supporta le versioni dispari di Node) e corepack attivo (`corepack enable`) sulla stessa Wi-Fi dell’iPhone.

1. Installa **Expo Go** dall'App Store.
2. Sul computer:
   ```sh
   git clone https://github.com/denisenanni/ortDirector.git
   cd ortDirector
   yarn install
   yarn start
   ```
3. Inquadra il QR code con la fotocamera dell'iPhone, si apre in Expo Go.

Se il telefono non vede il computer (reti aziendali, VPN): `yarn start --tunnel`.

Il progetto resta su SDK 57 perché è l’ultima che Expo Go dell’App Store supporta. Quando Expo Go passa a 58 si può aggiornare con `yarn expo install expo@^58 --fix`.

## Sviluppo

```sh
yarn typecheck         # tsc
yarn test              # test della logica di date, promemoria e piani (node --test)
yarn web               # anteprima nel browser
```

Struttura:

- `src/app/` schermate (Expo Router). `(tabs)/` sono Oggi, Piante, Impostazioni.
- `src/lib/db.ts` schema SQLite, migrazioni (`PRAGMA user_version`) e query.
- `src/lib/schedule.ts` logica pura di date e promemoria, testata in `schedule.test.ts`.
- `src/lib/notifications.ts` permessi e sincronizzazione delle notifiche.
- `src/lib/presets.ts` piante comuni ed etichette.
- `src/lib/plans.ts` piani di cura dal trapianto per le piante comuni, testati in `plans.test.ts`.

## Prossimi passi possibili

- Mappa schematica del giardino (aiuole, posizione delle piante).
- Foto delle piante.
- Build vera per iPhone (EAS) invece di Expo Go, e Android.

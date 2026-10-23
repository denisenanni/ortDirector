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
  Una pianta aggiunta già a dimora o in vaso prende il piano dal giorno indicato nel form, senza le attività già passate.
  Le date si scelgono col calendario del telefono (nell'anteprima web con un contatore).
- **Ricorrenze stagionali**: un'attività può ripetersi ogni N giorni solo in certi mesi (concime ogni 3 settimane, apr–set) o una volta l'anno (potatura a febbraio).
  Fuori stagione salta al primo giorno del mese utile. Le perenni del catalogo (rosa, lavanda, ortensia, limone…) ricevono da sole le loro cure annuali,
  e i passi estivi dei piani dell'orto (raccolta, concime) stanno nella loro stagione.
- **Zone**: aiuole, vasi del balcone, serra… con il sole che prendono davvero e se sono al coperto. In Piante le piante sono raggruppate per zona,
  e se il sole della zona non va bene per la pianta (pomodoro in ombra, ortensia in pieno sole) compare un avviso.
  Una zona si può eliminare solo quando è vuota.
- **Pioggia e stagioni**: il pulsante "Ha piovuto" in Oggi conta come annaffiate tutte le piante tranne quelle al coperto: nelle zone al coperto o segnate "Al coperto" nel loro form.
  Ogni pianta ha un intervallo di irrigazione da maggio a settembre e uno per il resto dell'anno.
- **Backup**: in Impostazioni "Esporta backup" crea un file JSON con tutti i dati da salvare su iCloud Drive o dove vuoi;
  "Importa backup" lo rimette al posto dei dati attuali, dopo una conferma. Le foto non sono nel backup.
- **Foto**: una per pianta, scattata o scelta dalla libreria, nella sua scheda.
- **Annuali e perenni**: a fine stagione un'annuale si archivia; le sue attività spariscono, scheda e storico restano in Archivio
  (in fondo a Piante) e si può ripristinare.
- **Oggi**: cosa scade oggi o è in ritardo, i prossimi 7 giorni, e più avanti, con la zona a sinistra. Tocca il cerchio per segnare fatto:
  quello che hai fatto oggi resta spuntato fino a domani, e toccandolo di nuovo lo annulli.
- **Promemoria**: una sola notifica al giorno (ora configurabile, default 8:00) con l'elenco delle attività.
- **Storico** per pianta.

Come funziona dentro (dati, attività, acqua, pioggia, stagioni, trapianto, backup, test): [docs/come-funziona.md](docs/come-funziona.md).

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

## Installarla sull'iPhone (senza Expo Go)

Con un Apple ID gratuito si installa da Xcode sul Mac. L'app gira da sola, senza computer né Wi-Fi, ma **ogni 7 giorni** il certificato scade: l'app non si apre più finché non la reinstalli con `yarn iphone`. I dati restano.

Una volta sola:

1. Installa **Xcode** dall'App Store del Mac, aprilo e accetta la licenza. Poi `xcode-select --install` e `brew install cocoapods`.
2. Xcode → Settings → Accounts → **+** → Apple ID, accedi con il tuo.
3. iPhone collegato col cavo: sblocca e tocca "Autorizza". Poi Impostazioni → Privacy e sicurezza → **Modalità sviluppatore** → attiva (il telefono si riavvia).

Ogni volta (prima installazione e ogni 7 giorni):

```sh
yarn install
yarn iphone
```

Scegli il tuo iPhone dalla lista. La prima volta chiede il team di firma: scegli il tuo nome ("Personal Team").
Se invece si ferma con un errore di firma, apri `ios/ortDirector.xcworkspace` in Xcode, target ortDirector → Signing & Capabilities → Team = il tuo Personal Team, e rilancia `yarn iphone`.

Alla prima apertura iOS dice "Sviluppatore non attendibile": Impostazioni → Generali → VPN e gestione dispositivi → il tuo Apple ID → **Autorizza**.

La cartella `ios/` viene generata e non va committata (è in `.gitignore`). Dopo aver cambiato `app.json` o aggiunto un pacchetto nativo: `yarn expo prebuild -p ios --clean` e poi `yarn iphone`.

L'app installata e Expo Go hanno dati separati: per portare le piante esporta il backup da Expo Go (Impostazioni → Esporta backup) e importalo nell'app installata.

## Sviluppo

```sh
yarn typecheck         # tsc
yarn test              # test della logica e del database su SQLite in memoria (node --test)
yarn e2e               # percorsi completi nell'app web, con Playwright
yarn web               # anteprima nel browser
```

### Test sul simulatore iPhone (Maestro)

I percorsi in `.maestro/` girano sull'app iOS vera, nel simulatore: vedono anche quello che il browser non vede (notifiche e permessi). Serve il Mac con Xcode e [Maestro](https://maestro.dev) installato.

```sh
yarn simulator         # una volta, e dopo ogni modifica: compila l'app e la installa nel simulatore
yarn maestro           # tutti i percorsi; uno solo: maestro test .maestro/pioggia.yaml
```

Ogni percorso parte da un'app vuota e la mette in italiano, qualunque sia la lingua del simulatore. `maestro studio` apre il simulatore nel browser e mostra il nome di ogni elemento, utile per scrivere un percorso nuovo.

Struttura:

- `src/app/` schermate (Expo Router). `(tabs)/` sono Oggi, Piante, Impostazioni.
- `src/lib/db.ts` schema SQLite, migrazioni (`PRAGMA user_version`) e query, testati in `db.test.ts` e `migrations.test.ts` con `memoryDb.ts` (SQLite di Node al posto di expo-sqlite). Ogni nuova versione del database aggiunge il suo schema in `migrations.test.ts`.
- `src/lib/schedule.ts` logica pura di date e promemoria, testata in `schedule.test.ts`.
- `src/lib/notifications.ts` permessi e sincronizzazione delle notifiche.
- `src/lib/presets.ts` piante comuni ed etichette.
- `src/lib/plans.ts` piani di cura dal trapianto per le piante comuni, testati in `plans.test.ts`.

## Prossimi passi possibili

- Mappa schematica del giardino (aiuole, posizione delle piante).
- Build EAS e TestFlight (serve l'account Apple Developer a pagamento), e Android.

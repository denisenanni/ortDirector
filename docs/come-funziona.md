# Come funziona ortDirector

Cosa succede davvero quando aggiungi una pianta, spunti un'attività o premi "Ha piovuto". Per installare e lanciare l'app vedi il [README](../README.md).

## La forma dell'app

Tutto sta sul telefono. Niente server, niente account, niente rete. I dati vivono in un file SQLite, `ortdirector.db`, dentro l'app. Se cancelli l'app senza backup, perdi tutto.

Il codice è diviso in due strati:

- **Le schermate** (`src/app/`): Oggi, Piante, Mappa, Impostazioni, il dettaglio pianta e della zona, i form. Mostrano dati e chiamano funzioni. Decidono poco.
- **La logica** (`src/lib/`), di due tipi:
  - *Logica pura*: calcoli su date e numeri, senza database né telefono. `schedule.ts` (date, ripetizioni, pioggia, promemoria), `watering.ts` (intervalli), `plans.ts` (piani di cura), `presets.ts` e `kinds.ts` (catalogo), `map.ts` (geometria della mappa), `backup.ts`, `catalogFile.ts`.
  - *Database*: `db.ts`. Prende le decisioni della logica pura e le scrive nelle tabelle: crea attività, le sposta, le chiude, migra lo schema, importa i backup.

Quando l'app parte, `src/app/_layout.tsx` apre il database e chiama `migrate()`, che porta lo schema all'ultima versione e carica in memoria le piante aggiunte al catalogo da file. Poi le schermate rileggono dal database ogni volta che tornano in primo piano.

## I dati

Sette tabelle. Le date sono testo `AAAA-MM-GG` in ora locale, così "oggi" è sempre il tuo oggi.

| Tabella | Cosa contiene |
| --- | --- |
| `plants` | Una riga per pianta: nome, voce di catalogo (`preset`), zona, in vaso sì/no, taglia pianta e vaso, al coperto, sole che le serve, intervallo d'acqua estivo e invernale, fase (semenzaio o a dimora), date di semina e trapianto, annuale, archiviata, foto, note. |
| `tasks` | Le attività aperte e chiuse. Ogni attività ha una scadenza (`due_on`) e, se si ripete, un intervallo, un intervallo invernale, una data di fine, i mesi ammessi, o "una volta l'anno". |
| `task_log` | Lo storico: cosa hai fatto e quando. Salva anche la scadenza di prima, per poter togliere la spunta. |
| `zones` | Aiuole, vasi, serra: nome, sole che prende davvero, coperta sì/no, e la forma sulla mappa se c'è. |
| `obstacles` | Case, muri, siepi, alberi sulla mappa: nome, forma come le zone, altezza, perde le foglie sì/no. |
| `catalog` | Le piante aggiunte al catalogo da file JSON, salvate così come erano nel file. |
| `settings` | Chiave/valore: ora del promemoria, ultima pioggia, ultimo backup, direzione del nord sulla mappa, posizione del giardino (`place`, latitudine e longitudine). |

### Le versioni del database

Ogni funzione che ha richiesto una colonna nuova ha alzato di uno la versione del database (`PRAGMA user_version`). All'avvio `migrate()` legge la versione salvata e applica in ordine i passi mancanti: un telefono fermo alla v2 passa per tutte le versioni dopo, fino all’ultima, in un colpo solo.

| Ver. | Cosa ha aggiunto | Cosa fa ai dati esistenti |
| --- | --- | --- |
| 1 | Piante, attività, storico, impostazioni | Crea le tabelle |
| 2 | Fase semenzaio, data di semina, voce di catalogo, fine di un'attività | Le piante esistenti sono considerate già a dimora |
| 3 | Attività annuali e mesi ammessi | Crea la cura stagionale per le piante già presenti |
| 4 | Zone, vaso, intervallo invernale | Ogni posizione scritta a mano diventa una zona. "serra", "tettoia", "casa" diventano zone coperte; "vaso", "balcone" segnano la pianta in vaso. Intervallo invernale = estivo × 3, al massimo 21 giorni |
| 5 | Annuali, archivio, foto, scadenza precedente nello storico | Segna come annuali gli ortaggi del catalogo |
| 6 | Catalogo da file, taglia pianta e vaso | Niente: taglie sconosciute contano come medie |
| 7 | Pianta "al coperto" singola | Niente |
| 8 | Attività che spostano la pianta | Segna come spostamenti le attività stagionali che lo sono, dal titolo |
| 9 | Forma della zona sulla mappa | Niente: le zone esistenti restano fuori mappa |
| 10 | Ostacoli per le ore di sole | Niente: la mappa parte senza ostacoli |

Una nuova versione va aggiunta in fondo a `migrate()` e, con il suo schema, in `migrations.test.ts`. Le versioni già uscite non si toccano più.

## Attività e ripetizioni

Un'attività è una riga in `tasks` con una data. Oggi mostra tutte quelle aperte con data di oggi o passata. Quando la spunti (`markDone`) succedono due cose, in un'unica transazione:

1. Una riga va nello storico, con il giorno in cui l'hai fatta e la scadenza che aveva.
2. `completeTask` calcola la prossima data e l'attività si sposta lì. Se non c'è una prossima data, si chiude.

Le regole della prossima data:

- **Si conta da quando l'hai fatta, non da quando scadeva.** Annaffiare ogni 3 giorni, in ritardo di 2: torna 3 giorni dopo oggi.
- **Fuori stagione salta al primo giorno del primo mese ammesso.** "Concimare ogni 21 giorni, maggio-ottobre" spuntata il 20 ottobre torna il 1° maggio.
- **Annuale con mesi**: torna all'inizio della finestra dell'anno dopo (potatura a febbraio). **Annuale senza mesi**: stessa data fra 12 mesi.
- **Con data di fine**: se la prossima data cade dopo, l'attività si chiude. Così finisce l'annaffiatura di attecchimento.
- **Senza ripetizione**: si chiude.

Togliere la spunta (`undoDone`) cancella la riga di storico e rimette l'attività alla scadenza di prima. "Rimanda a domani", nella scheda dell'attività, cambia solo la data.

```mermaid
flowchart LR
  A[Attività aperta<br/>scade il giorno X] -->|spunti| B[Riga nello storico<br/>fatta oggi, scadeva X]
  B --> C{Si ripete?}
  C -->|no| D[Chiusa]
  C -->|sì| E[oggi + intervallo<br/>poi dentro i mesi ammessi]
  E --> F{Oltre la data di fine?}
  F -->|sì| D
  F -->|no| A2[Aperta con la nuova data]
  A2 -.->|togli spunta| A
```

## Annaffiatura

Ogni pianta ha due intervalli: quello estivo (maggio-settembre) e quello per il resto dell'anno. L'attività "Annaffiare" della pianta li copia entrambi, e ogni volta che la spunti usa quello del mese in corso.

Da dove vengono i numeri, per una pianta del catalogo già a dimora (`watering.ts`):

1. Il catalogo dà l'intervallo per una pianta *media in piena terra*. Pomodoro: 2 giorni.
2. Lo moltiplichi per un fattore che dipende dalla taglia. Arrotondato, minimo 1 giorno, massimo 60.
3. L'intervallo invernale viene dal tipo di pianta se lo specifica, altrimenti è 3 volte quello estivo, al massimo 21 giorni.

| In piena terra | piccola | media | grande |
| --- | --- | --- | --- |
| fattore | ×0,5 | ×1 | ×1,5 |

| In vaso: pianta ↓ / vaso → | piccolo | medio | grande |
| --- | --- | --- | --- |
| pianta piccola | ×0,5 | ×0,7 | ×0,9 |
| pianta media | ×0,35 | ×0,5 | ×0,7 |
| pianta grande | ×0,25 | ×0,35 | ×0,5 |

Esempio: rosa (catalogo: ogni 3 giorni) grande in un vaso piccolo. 3 × 0,25 = 0,75, arrotondato a 1: ogni giorno d'estate, ogni 3 giorni il resto dell'anno.

Le piantine nel semenzaio usano il numero del catalogo senza scala. Se modifichi la pianta e cambi l'intervallo a mano, `updatePlant` aggiorna l'annaffiatura esistente invece di crearne una nuova.

## Pioggia

"Ha piovuto" non usa il meteo. Fa come se oggi avessi annaffiato tutte le piante che la pioggia raggiunge (`rained` in `db.ts`, `afterRain` in `schedule.ts`):

- Prende ogni annaffiatura aperta e ripetuta, **tranne** quelle di piante in una zona coperta o segnate "al coperto". I vasi all'aperto la pioggia la prendono.
- Nuova data = oggi + intervallo del mese. Se era già più lontana resta dov'era: la pioggia non anticipa mai niente.
- Salva in `settings` quali attività ha spostato e da che data, così "Annulla" le rimette dov'erano. Un'attività che hai spuntato o spostato nel frattempo non viene toccata.

Anche le annaffiature di attecchimento dopo un trapianto sono ripetute, quindi la pioggia sposta anche quelle.

## Stagioni

Ci sono due tipi di cura (`plans.ts`):

- **Cura dal trapianto** (`steps`): conta i giorni da quando la pianta è a dimora. Pomodoro: tutore al giorno 7, femminelle ogni 7 giorni dal 14 al 120, raccolta ogni 3 giorni dal 70 al 150. Molti passi hanno i mesi ammessi, così un trapianto tardivo non ti programma una raccolta a gennaio: se la stagione tornerebbe dopo la fine del passo, il passo non viene creato.
- **Cura stagionale** (`seasonal`): segue il calendario, per le perenni. Potare la rosa a febbraio, ritirare il limone a novembre. Viene creata quando aggiungi la pianta, alla prossima stagione utile, e torna ogni anno. Alcuni passi valgono solo per piante in vaso, in terra o che temono il gelo.

Archiviare un'annuale a fine stagione cancella le sue attività aperte e tiene lo storico. Ripristinarla ricrea annaffiatura e cura stagionale.

## Semina e trapianto

1. **Semini.** La pianta è "in semenzaio" con la data di semina. Se il catalogo sa dopo quante settimane si trapianta (pomodoro: 6-8), nasce l'attività "Pronta da trapiantare" al minimo, 6 settimane dopo. Se cambi la data di semina, l'attività si sposta.
2. **Segni il trapianto.** La schermata propone i passi del piano contati dal giorno del trapianto e chiede vaso e taglie. I passi che non vuoi si tolgono.
3. **Cosa scrive `transplant()`**: pianta a dimora con data e taglie, intervallo d'acqua ricalcolato con le tabelle sopra, "Pronta da trapiantare" chiusa, una riga nello storico, i passi scelti creati. Se il piano ha un'annaffiatura di attecchimento (pomodoro: ogni giorno per 2 settimane), quella normale viene spostata a dopo la sua fine, così non annaffi due volte.
4. **Trapianto con data passata.** I passi singoli già passati vengono saltati, quelli ripetuti partono dalla prossima data utile da oggi. Così segnare un trapianto vecchio non riempie Oggi di ritardi.
5. **Rinvaso o spostamento** (pianta già a dimora: dalla terra al vaso, a un vaso più grande, in casa). Il pulsante "Rinvasa o sposta" nella scheda chiede data, terra o vaso, taglie, zona e al coperto. `movePlant()` salva il posto nuovo e ricalcola l'acqua, scrive nello storico "Messa in vaso", "Messa in terra" o "Rinvaso", aggiunge le cure dopo lo spostamento (`REPOT_STEPS`: annaffiare bene il giorno stesso, controllare il terriccio ogni 2 giorni per 2 settimane, controllare al quinto giorno che non soffra) e, se lasci acceso "Niente concime per un po'", sposta le concimazioni dei prossimi 21 giorni a dopo. Se cambia tra terra e vaso, scambia anche le cure stagionali che ne dipendono: per un vaso "Mettere al riparo dal gelo" e "Riportare fuori", per la terra pacciamare e coprire.
6. **Cosa si cambia da Modifica e cosa no.** Modifica serve a correggere: nome, varietà, date, taglia della pianta, zona e al coperto, acqua, ciclo, note. Terra o vaso e la misura del vaso lì si vedono soltanto, perché cambiarli è uno spostamento: si passa da "Rinvasa o sposta", che aggiunge le cure dopo e lo segna nello storico. Se hai sbagliato quando l'hai inserita, usa comunque "Rinvasa o sposta" e togli le cure.

## Mappa

Una griglia in metri, una sola per tutto il giardino, senza bordo: la vista si adatta a quello che c'è disegnato. Ogni zona ha al massimo una forma, salvata sulla riga della zona (`shape` = `rect` o `circle`, `x` e `y` il centro, `width`, `length`, `rotation` in gradi in senso orario). Il cerchio ha `length` = `width` = diametro e non ruota. Le coordinate vanno con x a destra e y verso il basso dello schermo; il nord sta in `settings` come gradi in senso orario da "su" della mappa (0 = in alto).

- **Guardare**: ogni zona mostra nome e piante; un pallino se ha attività di oggi o in ritardo; il bordo arancione se una pianta vuole più o meno sole di quello che la zona prende, come nella lista Piante. Un tocco apre la pagina della zona con le sue piante. Le zone senza forma sono elencate sotto, "Fuori mappa".
- **Modifica** (la matita): toccare una zona la seleziona; trascinarla la sposta, l'angolo in basso a destra la ridimensiona (l'angolo opposto resta fermo), il pallino nero sopra la ruota. Tutto si ferma ai 10 cm e ai 5°. La freccia del nord si gira col dito. Sotto la mappa: rettangolo o cerchio, misure (apre il form), togli dalla mappa; senza selezione, le zone fuori mappa da metterci e "Nuova zona".
- **Zoom**: due dita, o i pulsanti + e −; "Mostra tutto" rifà l'inquadratura.
- **Form della zona**: "Sulla mappa" No / Rettangolo / Cerchio, con larghezza, lunghezza e rotazione scritte a mano. Una zona nuova con forma va a destra di quello che c'è già.

La geometria (snap, rotazioni, ridimensionamento, cosa sta sotto il dito, zoom) è tutta in `map.ts` ed è provata in `map.test.ts`; `GardenMap.tsx` disegna con `react-native-svg` e trasforma i tocchi in punti in metri. Il backup copia le tabelle intere, quindi la mappa ci va da sola.

## Ore di sole

Servono la posizione del giardino (Impostazioni o la mappa: "Usa la mia posizione" col GPS una volta, oppure latitudine e longitudine a mano; tutto resta sul telefono) e gli ostacoli disegnati sulla mappa in modalità Modifica, con "Nuovo ostacolo": rettangoli o cerchi come le zone, con un'altezza. Un albero è un cerchio largo quanto la chioma; con "Perde le foglie" da novembre a marzo non fa ombra.

Il calcolo (`sun.ts`) prende il 15 di ogni mese, la posizione del sole ogni 15 minuti (formule NOAA, senza rifrazione), e per ogni momento guarda se dal centro della zona, verso il sole, si incontra un ostacolo più alto della linea del sole in quel punto. Ogni ostacolo è un blocco pieno fino alla sua altezza; un centro sotto la chioma di un albero è all'ombra. La somma dà le ore di sole diretto possibile di quel giorno, a cielo sereno.

- **Pagina della zona**: le ore mese per mese e la media da aprile a settembre, che dà l'esposizione (6 ore o più pieno sole, da 3 a 6 mezz'ombra, meno di 3 ombra). Se non è quella della zona l'app lo dice e offre il pulsante per cambiarla; da sola non la cambia.
- **Mappa, modalità Sole** (il pulsante col sole): le zone colorate per le ore del mese scelto, l'ombra degli ostacoli all'ora scelta col cursore, e sulla bussola un pallino dove sta il sole.

Limiti, scritti anche accanto ai numeri: contano solo gli ostacoli disegnati, il terreno è piatto, la zona è misurata nel suo centro.

## Catalogo da file

Impostazioni › Catalogo apre un file JSON (formato in [catalog-file.md](catalog-file.md)). `catalogFile.ts` controlla ogni voce e dice cosa non va e dove. Una voce non può ridefinire una pianta già nel catalogo integrato. Le voci buone finiscono nella tabella `catalog` così come le hai scritte, e a ogni avvio vengono rilette in memoria accanto a quelle integrate. Togliere una voce non tocca le piante già create da quella voce.

## Backup

- **Esporta**: tutte le tabelle diventano un file JSON con la versione del database, più le foto delle piante in base64 sotto `photos` (nome file → contenuto). Passa dal foglio di condivisione di iOS (File, iCloud, AirDrop).
- **Importa**: prima controlla che sia un backup di ortDirector e non di una versione più nuova dell'app. Poi, in una transazione unica, svuota tutto e reinserisce le righe del file, scartando colonne che non esistono. Se qualcosa va storto a metà, non cambia niente.
- I backup vecchi sono accettati: le colonne arrivate dopo prendono il valore di default.
- **Foto**: dopo l'importazione `restorePhotos` (in `photos.ts`) riscrive i file in `documents/photos` e cancella quelli che nessuna pianta usa più. Un backup vecchio senza `photos` tiene le foto già sul telefono con lo stesso nome. I nomi che escono dalla cartella (`../`) rendono il file non valido.
- Le foto vengono ridotte quando le scatti o le scegli: JPEG, lato lungo massimo 1280 px, circa 200 KB. Quelle salvate prima, se sopra i 500 KB, entrano nel backup ridotte (il file sul telefono resta com'è). Così il backup pesa circa 250 KB a pianta con foto.

## Notifiche

Una notifica al giorno, all'ora scelta in Impostazioni (8 di default), per i prossimi 30 giorni. Elenca fino a 3 attività e dice "e altre N". Quelle in ritardo finiscono nella notifica di oggi. Dopo ogni modifica l'app cancella le notifiche programmate e le ricrea da zero (`notifications.ts`). Una al giorno invece di una per attività perché iOS ne tiene al massimo 64 in coda.

## Test

`yarn test` fa girare tutto con `node --test`, in un secondo, e GitHub lo lancia a ogni pull request insieme a `yarn typecheck`.

| File | Cosa verifica |
| --- | --- |
| `schedule.test.ts` | Date, ripetizioni, stagioni, pioggia come calcolo, promemoria |
| `plans.test.ts` | Piani di cura, tabelle dell'acqua, tipi di pianta |
| `catalogFile.test.ts`, `backup.test.ts` | Lettura dei file di catalogo e di backup |
| `i18n.test.ts` | Traduzioni del catalogo e delle etichette |
| `db.test.ts` | Cosa scrive ogni azione su un SQLite vero in memoria: spunta, pioggia, trapianto, rinvaso, archivio, zone, catalogo, backup |
| `migrations.test.ts` | Un giardino a ogni versione vecchia del database, aggiornato all'ultima |
| `map.test.ts` | Geometria della mappa: snap, zone ruotate, ridimensionamento, tocchi, zoom, cosa mostra ogni zona |
| `sun.test.ts` | Posizione del sole (altezza a mezzogiorno, lunghezza del giorno a Roma, all'equatore, a Sydney, al polo), ombra di muri, case e alberi, ore e esposizione, forma dell'ombra |

`db.test.ts` e `migrations.test.ts` usano `memoryDb.ts`: il SQLite di Node dietro i pochi metodi di expo-sqlite che `db.ts` usa.

`yarn e2e` prova l'app intera nel browser (Playwright su Chromium, a misura di iPhone): costruisce la versione web, la apre e usa le schermate vere come faresti sul telefono. I percorsi sono in `e2e/garden.spec.ts`: aggiungere una pianta e spuntarla, la pioggia con le piante al coperto, semina e trapianto, il basilico messo in vaso in casa, l'avviso sole della zona, un'attività rimandata, il backup portato su un altro "telefono". In `e2e/map.spec.ts`: una zona disegnata, ridimensionata e spostata col mouse, che resta dopo il riavvio e apre le sue piante. In `e2e/sun.spec.ts`: la posizione scritta a mano, una casa a sud di un'aiuola che le toglie il sole, la proposta di cambiare l'esposizione, la mappa in modalità Sole. Ogni test parte da un orto vuoto il 15 giugno 2026, così le date non dipendono da quando gira. Su GitHub gira a ogni pull request, accanto a `yarn test`.

Per l'app iOS vera ci sono i percorsi Maestro in `.maestro/` (`yarn maestro`, solo sul Mac con il simulatore): gli stessi giri principali più le notifiche negate. Non girano su GitHub. Restano senza test automatici fotocamera, foglio di condivisione e date picker di iOS.

# Requisiti ortDirector v2

Stato: **concordati** con denise il 2026-10-27.

Parte da [requirements.md](requirements.md) (v1, fatta) e dall'app com'è oggi: zone con nome, esposizione e "al coperto"; piante in una zona, in vaso o in terra; avviso quando il sole che serve alla pianta non è quello della zona.

Vincoli che restano: Expo + TypeScript, tutto sul telefono, niente server né account, niente rete. Quello che la v2 usa deve girare anche in Expo Go (`react-native-svg`, `expo-location` ci sono già), così si prova senza rifare la build.

## Ordine

La v2 ha due fasi, in quest'ordine, e la seconda non parte prima che la prima sia sul telefono. Android è un lavoro a parte, che non dipende dalle due fasi:

1. **Mappa del giardino**, costruita sulle zone che esistono già.
2. **Ore di sole stimate** per zona, dalla posizione GPS, dal percorso del sole e dagli ostacoli disegnati sulla mappa.

La fase 2 ha bisogno di misure vere e del nord. Per questo la mappa le chiede dalla fase 1: disegnare tutto a occhio e poi ridisegnarlo in metri per avere il sole vorrebbe dire fare la mappa due volte.

## Fase 1: mappa

### Cosa c'è sulla mappa

- **Il foglio**: una griglia in metri, una sola per tutto il giardino. Non ha un bordo fisso: si allarga per contenere quello che ci disegni. Le zone possono stare lontane fra loro e non toccarsi (l'aiuola davanti casa e l'orto dietro stanno sulla stessa mappa, con il vuoto in mezzo).
- **Il nord**: una freccia che si gira. Di default in alto.
- **Le zone** diventano forme che si spostano e si ridimensionano: rettangoli (che si ruotano anche) e cerchi, per un vaso grande o un'aiuola tonda. Niente forme libere: un'aiuola a L sono due zone. Misure in metri, arrotondate a 10 cm.
- **Le zone fuori mappa** (casa, serra di un'altra persona, il davanzale) restano zone normali senza forma. La mappa le elenca sotto, non le nasconde.

Ogni zona ha al massimo una forma. Una zona senza forma funziona come oggi: niente di quello che c'è smette di funzionare se la mappa non la disegni mai.

### Cosa si fa con la mappa

- **Guardare**: una nuova scheda "Mappa". Ogni zona mostra il nome, quante piante ha e un pallino se ha attività in ritardo o di oggi. Le zone con una pianta che vuole più o meno sole del posto hanno il bordo dell'avviso, lo stesso che c'è già nella lista Piante.
- **Toccare una zona** apre quello che apre oggi la zona nella lista Piante: le sue piante, e da lì il dettaglio.
- **Disegnare**: un pulsante "Modifica" passa alla modalità disegno. Si aggiunge una zona nuova o si dà una forma a una che c'è già, si trascina, si ridimensiona dagli angoli, si ruota. Fuori dalla modalità disegno la mappa non si sposta per sbaglio sotto il dito.
- **Zoom e spostamento** con due dita, in tutte e due le modalità.
- **Le misure** si possono anche scrivere a mano nel form della zona (larghezza, lunghezza, rotazione), per chi ha misurato col metro.

### Dati

- Nuova versione del database (v9): la direzione del nord in `settings` e le colonne della forma sulla zona (tipo rettangolo o cerchio, x, y, larghezza, lunghezza, rotazione; per il cerchio larghezza = diametro). Le zone esistenti restano senza forma.
- La mappa va nel backup e torna con l'import. Un backup senza mappa (fatto prima della v2) si importa come oggi.

## Fase 2: ore di sole

### Cosa serve in più sulla mappa

- **La posizione** del giardino: un tocco su "Usa la mia posizione" (GPS, una volta sola, poi salvata) oppure latitudine e longitudine scritte a mano. Niente rete: il percorso del sole si calcola sul telefono.
- **Gli ostacoli**: casa, muri, siepi, alberi. Sono rettangoli o cerchi come le zone, con in più un'**altezza** in metri. Un albero è un cerchio grande quanto la sua chioma. Non hanno piante e non sono zone.

### Cosa calcola

Per ogni zona disegnata, le **ore di sole diretto** in un giorno tipo di ogni mese: il sole si calcola ogni 15 minuti dall'alba al tramonto, e il centro della zona è al sole se nessun ostacolo gli fa ombra in quel momento. Il cielo coperto non conta: sono ore di sole possibile, non ore di sole avuto.

Le ore diventano l'esposizione che l'app usa già:

| Ore di sole diretto | Esposizione |
|---|---|
| 6 o più | Pieno sole |
| da 3 a 6 | Mezz'ombra |
| meno di 3 | Ombra |

### Alberi che perdono le foglie

Un albero ostacolo ha la spunta **"Perde le foglie"** (fico, noce, tiglio). Con la spunta, da novembre a marzo non fa ombra: i rami nudi lasciano passare quasi tutta la luce. Senza spunta fa ombra tutto l'anno (sempreverdi, muri, casa).

### Cosa mostra

- Nel dettaglio della zona: le ore di sole mese per mese, e l'esposizione che ne viene.
- Se l'esposizione calcolata non è quella che la zona ha, l'app lo dice e propone di cambiarla. Non la cambia da sola: la stima può sbagliare e chi vede il giardino ha l'ultima parola.
- Sulla mappa, in modalità "Sole", le zone colorate per ore di sole, e l'ombra degli ostacoli a un'ora e un mese scelti con un cursore.

### Limiti dichiarati

La stima conta solo gli ostacoli disegnati. Un tetto del vicino non disegnato non fa ombra. Il terreno è piatto. La zona è valutata nel suo centro: in un'aiuola lunga metà può essere al sole e metà no. L'app lo scrive accanto al numero, non in una pagina di aiuto.

## Android

L'app gira anche su un telefono Android, con le stesse funzioni dell'iPhone. Il codice ha già i rami Android per icone, date e icona dell'app; quello che manca è provarla davvero:

- Build installabile sul telefono Android (APK, senza Play Store).
- Giro completo su un telefono vero: aggiungere una pianta, foto da fotocamera e galleria, promemoria (su Android servono il canale delle notifiche e il permesso esplicito da Android 13), backup su file e import, catalogo da file.
- Quello che si rompe si sistema; i test e2e esistenti restano verdi.

Il Play Store non è in v2.

## Non in v2

Restano dove erano dopo la v1, salvo decisione diversa:

- Calendario di semina e raccolta per pianta.
- Diario con foto nel tempo.
- Catalogo modificabile dentro l'app (oggi si aggiunge da file JSON, ed è sufficiente).
- Build vera per iPhone (EAS, account Apple Developer) e Play Store.
- Posizione delle singole piante dentro un'aiuola (rotazione delle colture).
- Foto o piantina come sfondo della mappa.

## Decisioni

1. **Una mappa sola**, con zone anche lontane e non collegate fra loro.
2. **Misure in metri**, anche prese a passi, e il nord.
3. **Rettangoli ruotabili e cerchi**, per le zone e per gli ostacoli (alberi). Niente poligoni liberi. (Il 2026-10-27 denise ha rimesso i cerchi, servono per l'ombra degli alberi.)
4. **Niente piante singole** sulla mappa: basta la zona.
5. **Niente sfondo** (foto o piantina).
6. **L'esposizione della zona** è la media delle ore di sole da aprile a settembre; gli altri mesi si vedono nel dettaglio. Si potrà affinare dopo averla usata.
7. **"Perde le foglie"** sugli alberi ostacolo: da novembre a marzo non fanno ombra.
8. **Calendario di semina, diario e catalogo modificabile** restano dopo la v2.
9. **Android in v2** (2026-10-27), con APK installato a mano; Play Store dopo.

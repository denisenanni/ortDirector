# Requisiti ortDirector v2

Stato: **bozza**, 2026-10-26. Le domande aperte in fondo vanno chiuse prima di scrivere codice.

Parte da [requirements.md](requirements.md) (v1, fatta) e dall'app com'è oggi: zone con nome, esposizione e "al coperto"; piante in una zona, in vaso o in terra; avviso quando il sole che serve alla pianta non è quello della zona.

Vincoli che restano: iPhone prima, Expo + TypeScript, tutto sul telefono, niente server né account, niente rete. Quello che la v2 usa deve girare anche in Expo Go (`react-native-svg`, `expo-location` ci sono già), così si prova senza rifare la build.

## Ordine

La v2 ha due fasi, in quest'ordine, e la seconda non parte prima che la prima sia sul telefono:

1. **Mappa del giardino**, costruita sulle zone che esistono già.
2. **Ore di sole stimate** per zona, dalla posizione GPS, dal percorso del sole e dagli ostacoli disegnati sulla mappa.

La fase 2 ha bisogno di misure vere e del nord. Per questo la mappa le chiede dalla fase 1: disegnare tutto a occhio e poi ridisegnarlo in metri per avere il sole vorrebbe dire fare la mappa due volte.

## Fase 1: mappa

### Cosa c'è sulla mappa

- **Il giardino**: un rettangolo con le sue misure in metri (es. 12 × 8). È il foglio su cui si disegna.
- **Il nord**: una freccia che si gira. Di default in alto.
- **Le zone** diventano forme dentro il giardino: rettangoli che si spostano, si ridimensionano e si ruotano, e cerchi per vasi singoli e alberi. Misure in metri, arrotondate a 10 cm.
- **Le zone fuori mappa** (casa, serra di un'altra persona, il davanzale) restano zone normali senza forma. La mappa le elenca sotto, non le nasconde.

Ogni zona ha al massimo una forma. Una zona senza forma funziona come oggi: niente di quello che c'è smette di funzionare se la mappa non la disegni mai.

### Cosa si fa con la mappa

- **Guardare**: una nuova scheda "Mappa". Ogni zona mostra il nome, quante piante ha e un pallino se ha attività in ritardo o di oggi. Le zone con una pianta che vuole più o meno sole del posto hanno il bordo dell'avviso, lo stesso che c'è già nella lista Piante.
- **Toccare una zona** apre quello che apre oggi la zona nella lista Piante: le sue piante, e da lì il dettaglio.
- **Disegnare**: un pulsante "Modifica" passa alla modalità disegno. Si aggiunge una zona nuova o si dà una forma a una che c'è già, si trascina, si ridimensiona dagli angoli, si ruota. Fuori dalla modalità disegno la mappa non si sposta per sbaglio sotto il dito.
- **Zoom e spostamento** con due dita, in tutte e due le modalità.
- **Le misure** si possono anche scrivere a mano nel form della zona (larghezza, lunghezza, rotazione), per chi ha misurato col metro.

### Dati

- Nuova versione del database (v9): tabella `garden` (larghezza, lunghezza, direzione del nord) e colonne della forma sulla zona (tipo, x, y, larghezza, lunghezza, rotazione). Le zone esistenti restano senza forma.
- La mappa va nel backup e torna con l'import. Un backup senza mappa (fatto prima della v2) si importa come oggi.

## Fase 2: ore di sole

### Cosa serve in più sulla mappa

- **La posizione** del giardino: un tocco su "Usa la mia posizione" (GPS, una volta sola, poi salvata) oppure latitudine e longitudine scritte a mano. Niente rete: il percorso del sole si calcola sul telefono.
- **Gli ostacoli**: casa, muri, siepi, alberi. Sono forme come le zone (rettangoli e cerchi) con in più un'**altezza** in metri. Non hanno piante e non sono zone.

### Cosa calcola

Per ogni zona disegnata, le **ore di sole diretto** in un giorno tipo di ogni mese: il sole si calcola ogni 15 minuti dall'alba al tramonto, e il centro della zona è al sole se nessun ostacolo gli fa ombra in quel momento. Il cielo coperto non conta: sono ore di sole possibile, non ore di sole avuto.

Le ore diventano l'esposizione che l'app usa già:

| Ore di sole diretto | Esposizione |
|---|---|
| 6 o più | Pieno sole |
| da 3 a 6 | Mezz'ombra |
| meno di 3 | Ombra |

### Cosa mostra

- Nel dettaglio della zona: le ore di sole mese per mese, e l'esposizione che ne viene.
- Se l'esposizione calcolata non è quella che la zona ha, l'app lo dice e propone di cambiarla. Non la cambia da sola: la stima può sbagliare e chi vede il giardino ha l'ultima parola.
- Sulla mappa, in modalità "Sole", le zone colorate per ore di sole, e l'ombra degli ostacoli a un'ora e un mese scelti con un cursore.

### Limiti dichiarati

La stima conta solo gli ostacoli disegnati. Un tetto del vicino non disegnato non fa ombra. Il terreno è piatto. La zona è valutata nel suo centro: in un'aiuola lunga metà può essere al sole e metà no. L'app lo scrive accanto al numero, non in una pagina di aiuto.

## Non in v2

Restano dove erano dopo la v1, salvo decisione diversa:

- Calendario di semina e raccolta per pianta.
- Diario con foto nel tempo.
- Catalogo modificabile dentro l'app (oggi si aggiunge da file JSON, ed è sufficiente).
- Build vera (EAS, account Apple Developer) e Android.
- Posizione delle singole piante dentro un'aiuola (rotazione delle colture). Vedi domanda 4.

## Domande aperte

Accanto a ognuna la proposta, che vale se non dici altro.

1. **Una mappa o più?** Giardino davanti, terrazzo, balcone possono essere posti separati, ognuno col suo nord. *Proposta: una mappa sola in v2; i posti lontani restano zone fuori mappa.*
2. **Misure vere o schizzo?** *Proposta: metri, anche presi a passi. Senza misure e nord la fase 2 non si può fare.*
3. **Che forme?** *Proposta: rettangoli ruotabili e cerchi. Niente poligoni liberi: costano molto e un'aiuola a L sono due rettangoli.*
4. **Le piante sulla mappa?** Come pallini dentro la loro aiuola, o basta sapere in che zona stanno? *Proposta: basta la zona in v2. Le posizioni singole servono per la rotazione dell'orto, che non è in v2.*
5. **Sfondo**: una foto dall'alto o una piantina del giardino sotto la mappa, per ricalcarla? *Proposta: no in v2. Si disegna sul foglio bianco a quadretti.*
6. **Quale periodo decide l'esposizione** della zona? Una zona può essere al sole a giugno e in ombra a dicembre. *Proposta: la media da aprile a settembre, quando l'orto lavora; gli altri mesi si vedono nel dettaglio.*
7. **Alberi che perdono le foglie** fanno ombra anche d'inverno? *Proposta: un'opzione "perde le foglie" sull'ostacolo albero, che da novembre a marzo non fa ombra.*
8. **Le voci di "Non in v2"**: ce n'è qualcuna che ti serve prima della mappa? *Proposta: no, restano dopo.*

# Requisiti ortDirector

Stato: **bozza**, da confermare. Le domande aperte sono in fondo.

Vincoli fissi: iPhone prima (Android dopo), Expo + TypeScript, dati solo sul telefono (SQLite), nessun account e nessun server, interfaccia in italiano.

## v1

### Già nell'MVP (PR #1)

- **Piante**: nome, varietà, posizione (testo libero), esposizione, irrigazione ogni N giorni, note.
- **Catalogo** di ~25 piante comuni che precompila sole, acqua e un consiglio.
- **Attività**: annaffiare, controllo, potatura, concimazione, trattamento, raccolta, altro. Una volta sola o ogni N giorni, che ripartono da quando le segni fatte.
- **Oggi**: in ritardo e da fare oggi, prossimi 7 giorni, più avanti. Segna fatto, rimanda.
- **Promemoria**: una notifica riassuntiva al giorno, ora configurabile.
- **Storico** delle attività fatte, per pianta.

### Da aggiungere

1. **Zone** (aiuole, vasi, serra) come entità vera al posto del testo libero: nome, esposizione reale, in vaso o in terra. Ogni pianta sta in una zona. Serve per filtrare, per i controlli sotto e come base della mappa.
2. **Sole: bisogno vs realtà.** La pianta ha un bisogno di sole (dal catalogo), la zona ha un'esposizione. Se non combaciano (pomodoro in zona d'ombra) l'app lo segnala.
3. **Ricorrenze stagionali.** "Ogni N giorni" non basta: la potatura è "una volta l'anno, a febbraio", la concimazione "ogni 3 settimane da aprile a settembre". Servono ricorrenze annuali per mese e finestre stagionali.
4. **Irrigazione realistica.** Un intervallo fisso sbaglia appena piove o arriva l'autunno. In v1: pulsante "ha piovuto" che sposta in avanti tutte le annaffiature in terra (non i vasi), e intervallo diverso per estate e resto dell'anno.
5. **Annuali e perenni.** Le annuali dell'orto finiscono a fine stagione: si archiviano (con il loro storico) invece di cancellarle.
6. **Backup.** Dati solo sul telefono vuol dire che se lo perdi perdi tutto. Esporta e importa un file (JSON) da salvare su iCloud Drive o dove vuoi.
7. **Foto**: una foto per pianta, salvata in locale.

## Dopo la v1

- Mappa schematica del giardino: le zone diventano rettangoli disegnabili, le piante ci stanno dentro.
- Calendario di semina e raccolta per pianta del catalogo.
- Diario con foto nel tempo.
- Catalogo più grande, o modificabile.
- Build vera (EAS, account Apple Developer) e Android.

## Fuori scope

- Account, cloud, sincronizzazione tra telefoni.
- Meteo da internet (rompe l'offline; il pulsante "ha piovuto" copre il caso a costo zero).
- Riconoscimento delle piante da foto, community, consigli generati.

## Domande aperte

1. Orto, giardino ornamentale o tutti e due?
2. Lo usi da sola o in due sullo stesso orto?
3. Irrigazione: basta "ha piovuto" + intervallo stagionale, o vuoi il meteo vero?
4. Mappa: in v1 o dopo?
5. Foto in v1 o dopo?

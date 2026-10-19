# Requisiti ortDirector

Stato: **concordati** il 2026-10-18.

Vincoli fissi: iPhone prima (Android dopo), Expo + TypeScript, dati solo sul telefono (SQLite), nessun account e nessun server, interfaccia in italiano.
L'app copre sia l'orto sia il giardino ornamentale, ed è pensata per una persona sola su un telefono.

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
8. **Trapianto a terra.** È l'evento da cui partono quasi tutti i promemoria dell'orto.
   - Una pianta è *in semenzaio/vaso* o *a terra*. Se nasce da seme si segna la data di semina, se è comprata già cresciuta si parte direttamente dal trapianto.
   - In semenzaio: promemoria "pronta da trapiantare" dopo le settimane tipiche della pianta (es. pomodoro 6-8 dalla semina).
   - Segnare il trapianto è un tocco solo (data di default oggi). Da quella data l'app crea le attività del piano della pianta, contate dal trapianto. Esempio pomodoro: irrigazione più fitta le prime 2 settimane, tutore a +7 giorni, prima concimazione a +15, sfemminellatura ogni settimana, raccolta prevista da +70.
   - Il piano viene dal catalogo (le ~25 piante comuni), è modificabile per pianta, e le piante fuori catalogo non hanno piano automatico.

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

## Decisioni

1. **Orto e giardino ornamentale**, tutti e due: per questo servono annuali/perenni e ricorrenze stagionali.
2. **Una persona sola**: niente sincronizzazione, che richiederebbe un server.
3. **Irrigazione senza meteo**: pulsante "ha piovuto" e intervallo estate/resto dell'anno.
4. **Mappa dopo la v1**: in v1 solo le zone, su cui la mappa verrà disegnata.
5. **Foto in v1**: una per pianta.
6. **Trapianto a terra in v1** (aggiunto il 2026-10-19): fa partire il piano di attività della pianta.

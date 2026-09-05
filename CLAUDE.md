# Championsito — brief di progetto

## Cos'è
Webapp di pronostici tra amici sulla **fase campionato (fase a gironi) della UEFA Champions League**: 36 squadre, formato svizzero (ogni squadra gioca 8 partite contro avversari diversi, un'unica classifica generale), 8 giornate. Le prime 8 accedono direttamente agli ottavi, dalla 9ª alla 24ª giocano lo spareggio, dalla 25ª alla 36ª sono eliminate.

Nome: **Championsito** — nella stessa famiglia "-ino/-ito" di Wimbledino, Medusino e Mondialito.

Cartella satellite dentro `WIMBLEDINO/`, come Medusino: **nuovo progetto Firebase indipendente**, dati e utenti propri (deciso 2026-09-03).

**Due competizioni indipendenti in sequenza, ciascuna con classifica propria (deciso 2026-09-05, sostituisce la decisione precedente "il gioco continua nella fase a eliminazione diretta")**:
- **Fase 1** (questo documento la descrive per intero): pronostici sulle 8 giornate della fase a campionato. La competizione **si conclude con la classifica finale a 36 squadre** — punteggio, premi e "Domande aperte" di questo file riguardano solo questa fase.
- **Fase 2** (da progettare a parte, quando si deciderà come impostarla): tabellone a eliminazione diretta (spareggio, ottavi, quarti, semifinale, finale). **Classifica azzerata**, nuovo punteggio proprio — riparte da zero, non è un prolungamento dei punti di Fase 1. Userà come dato di ingresso le fasce/qualificate emerse dalla classifica finale di Fase 1 (chi accede direttamente agli ottavi, chi gioca lo spareggio), ma senza ereditarne i punti.
  - Struttura reale della Champions League da riprodurre quando si progetterà: spareggio andata/ritorno (9ª vs 24ª, 10ª vs 23ª, ... 16ª vs 17ª), ottavi/quarti/semifinale andata/ritorno, finale gara secca. Pronostico "chi vince/passa il turno" (bracket forgiving per squadra, stesso principio di Wimbledino/Mondialito).
  - Le funzioni di simulazione del KO esistono già in `simulazione/sim_championsito.py` (`simula_doppia_sfida`, `simula_ko_completo`) ma non sono usate nel calcolo del punteggio di Fase 1 — restano pronte per quando si calibrerà il punteggio di Fase 2.

## Pronostici richiesti all'utente (Fase 1)
1. **Segno 1X2** per ciascuna partita, per ciascuna delle 8 giornate della fase a campionato (nessun risultato esatto richiesto — solo il segno, diversamente dal modello Mondialito).
2. **Classifica finale prevista**: l'utente ordina tutte le 36 squadre (o quantomeno assegna ciascuna a una fascia — prime 8 / playoff / eliminate — e una posizione dentro la fascia). **Corretto in fase di implementazione (2026-09-05)**: a differenza del Mondialito, qui questo NON è derivabile dai segni pronosticati — nel Mondialito un girone da 4 squadre è un mini-campionato completo (tutte giocano contro tutte, risultato esatto richiesto), quindi il piazzamento finale è calcolabile in automatico. Qui invece ogni squadra gioca solo 8 delle 35 avversarie possibili (calendario sparso, formato svizzero) e si chiede solo il segno, non il risultato esatto: due squadre pronosticate a pari punti non hanno un modo per essere ordinate senza differenza reti, che il segno da solo non dà. Va quindi pronosticata esplicitamente, una volta sola (non per giornata) — è coerente con come è già stata calibrata la simulazione Monte Carlo (il pronosticatore "esperto"/"casuale" vi produce sempre una classifica indipendente dai segni).
3. **Bonus una tantum, validi per l'intera fase a gironi** (si compilano una volta sola, non per giornata — stesso pattern delle classifiche bonus di Wimbledino/Medusino):
   - Capocannoniere (marcatori) della fase a gironi
   - Miglior assistman della fase a gironi
   - Squadra con più cartellini (ammonizioni) della fase a gironi

## Punteggi (Fase 1 — solo fase a campionato, nessun KO)

Valori calibrati con simulazione Monte Carlo (400 tornei simulati, vedi metodo sotto). **Aggiornato 2026-09-05**: rispetto alla prima calibrazione, le voci di punteggio legate al tabellone KO sono state rimosse (il KO è ora una competizione separata, Fase 2, con punteggio proprio da calibrare a parte) e i pesi delle voci rimaste sono stati ricalcolati perché la classifica finale di Fase 1 è ora essa stessa il traguardo della competizione, non una tappa intermedia.

| Voce | Descrizione | Punti |
|---|---|---|
| Segno 1X2 corretto | per partita, ogni giornata | **3** |
| Capocannoniere indovinato | bonus fine fase | **60** |
| Assistman indovinato | bonus fine fase | **60** |
| Squadra più ammonita indovinata | bonus fine fase | **60** |
| Squadra pronosticata entro le prime 8 | qualificazione diretta indovinata | **20** |
| Squadra pronosticata ai playoff (9ª-24ª) | fascia indovinata | **10** |
| Squadra pronosticata eliminata (25ª-36ª) | fascia indovinata | **6** |
| Posizione esatta in classifica — zona prime 8 | bonus aggiuntivo (oltre al punto "fascia" sopra) | **70** |
| Posizione esatta in classifica — zona playoff | bonus aggiuntivo | **35** |
| Posizione esatta in classifica — zona eliminazione | bonus aggiuntivo | **15** |

**Metodo di calibrazione** — script [`simulazione/sim_championsito.py`](./simulazione/sim_championsito.py). Si simulano 400 tornei fittizi (36 squadre di forza casuale, modello di Poisson per i gol, girone Swiss-like a 8 giornate, **classifica finale come unico traguardo**), confrontando un pronosticatore "esperto" (stesse forze/calendario reali, esito indipendente — sa valutare le squadre ma non conosce la fortuna della singola partita) e uno "casuale" (nessuna competenza). Con la tabella qui sopra, sul pronosticatore esperto la distribuzione è: segno ~38%, bonus fine-fase ~4%, fascia ~40%, posizione esatta ~17%. Segno e fascia restano le due componenti principali — coerente col fatto che, senza KO a valle, sia l'attività settimanale (segno) sia l'esito finale della classifica (fascia + posizione esatta, insieme ~57%) sono ciò che la competizione premia. Il pronosticatore esperto totalizza in media circa 1.8 volte il casuale — la separazione è un po' più bassa che con il KO incluso (che dava un boost di 2.1×), perché è normale: con una sola fase, la componente di puro merito ha meno terreno su cui distinguersi rispetto ad averne due. Tre iterazioni di tabelle candidate sono documentate nello script stesso.

→ Nota architetturale: questo è esattamente il caso d'uso per cui è nato il **descrittore di torneo** di Pronò! (vedi `PRONÒ!/schema-dati.md`) — un `formato` diverso da quello a gironi piccoli del Mondiale (qui è un'unica classifica generale da 36, non N gironi da 4), che richiede solo nuovi criteri di ranking e una nuova funzione di risoluzione qualificazione "per fascia di piazzamento" invece che "per girone". Il motore `engine/ranking.js` di Pronò! (classifica con punti/differenza reti/scontri diretti/ordine manuale) è già riusabile così com'è: gli si passano tutte le 36 squadre come un unico girone.

## Montepremi (crediti/punti virtuali, deciso 2026-09-03 — nessun denaro reale, nessun processore di pagamenti)

**Nota 2026-09-05**: con lo split in due competizioni, questi premi si riferiscono alla classifica finale della **sola Fase 1**. L'"iscrizione al tabellone KO/finale" resta valida come porta d'ingresso alla Fase 2 (che comunque riparte a punteggio zero) — non è più un premio "dentro la stessa classifica".

- **Podio finale** (primi 3 della classifica generale di Fase 1): premiati con ripartizione classica dei crediti — *percentuali da confermare (proposta: 50/30/20)*.
- I **primi 3** hanno accesso gratuito (0 crediti di quota) all'iscrizione alla Fase 2 (tabellone KO).
- **Vincitore di ogni giornata** (fase a campionato): metà quota-crediti d'iscrizione alla Fase 2 accreditata. Bonus cumulabile fino a 2 giornate vinte → iscrizione gratuita alla Fase 2.
- Essendo crediti virtuali interni all'app, il modello dati è semplice: un saldo/quota per utente per competizione, movimentato da eventi (vittoria giornata, piazzamento podio) — nessuna integrazione esterna necessaria.

## Colori
Direzione "Champions League standard" — palette ufficiale UEFA Champions League (rebrand 2021, "starball"): base blu notte quasi nero, accesi da blu elettrico, viola e magenta come colori di accento.
- Blu scuro `#010056`
- Blu `#0232FF`
- Viola `#9A00FF`
- Magenta `#FF51A2`
- Rosso `#FF0045`
- Grigio `#B2BEBE`

Fonte: [teamcolorcodes.com](https://teamcolorcodes.com/soccer/uefa-champions-league-colors/). Per fedeltà pixel-perfect (se serve per materiali ufficiali) andrebbero verificati contro le linee guida di brand UEFA 2024-27, non consultate direttamente in questa sessione.

## Domande ancora aperte
1. ~~Valori numerici di tutti i punteggi in tabella~~ — **risolto 2026-09-05**: calibrati con simulazione Monte Carlo per la sola Fase 1 (nessun KO), vedi tabella Punteggi sopra e `simulazione/sim_championsito.py`.
2. Percentuali esatte di ripartizione del podio (proposta di partenza: 50/30/20).
3. Fonte dati per il sync automatico: verificare se l'endpoint ESPN calcio già previsto per il pilota Pronò! copre anche la Champions League (probabile, ma non verificato in questa sessione) — altrimenti serve un adapter/fonte dedicata.
4. **Nuovo**: progettare la Fase 2 (tabellone KO) come competizione a sé — struttura dati (classifica separata che riparte da zero, come collegare l'ingresso alle fasce/qualificate di Fase 1), e calibrarne il punteggio con una simulazione dedicata quando si deciderà come impostarla.

/**
 * CHAMPIONSITO — functions/espn.js
 *
 * Placeholder: la sync automatica dei risultati non è ancora stata
 * implementata (vedi CLAUDE.md, "Domande ancora aperte" #3 — va verificato
 * se l'endpoint ESPN calcio previsto per il pilota Pronò! copre anche la
 * Champions League). Fino ad allora i risultati si inseriscono a mano
 * dall'admin (js/admin.js, tab "Risultati") scrivendo direttamente su
 * risultati/ufficiali — la Cloud Function ricalcolaClassifica in index.js
 * si attiva comunque, a prescindere da come viene scritto il documento.
 *
 * Quando si implementerà la sync: esportare da qui un fetch/parse verso
 * l'endpoint scelto e una funzione schedulata (onSchedule) in index.js che
 * scrive risultati/ufficiali con lo stesso identico formato usato
 * dall'inserimento manuale (golCasa/golTrasferta per partita), così
 * ranking.js e punteggi.js restano invariati qualunque sia la fonte dati.
 */
'use strict';

module.exports = {};

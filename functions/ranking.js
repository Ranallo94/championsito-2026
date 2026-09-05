/**
 * CHAMPIONSITO — functions/ranking.js  (CommonJS)
 *
 * Classifica generale a 36 squadre della fase a campionato (formato svizzero):
 * punti, differenza reti, gol fatti, poi nome squadra come ultimo fallback
 * deterministico (niente scontri diretti: con un calendario sparso da 8
 * partite su 35 avversarie possibili, la maggior parte delle coppie di
 * squadre non si affronta mai — lo scontro diretto non è quasi mai
 * applicabile su scala. Vedi CLAUDE.md e simulazione/sim_championsito.py
 * per la stessa semplificazione già dichiarata in fase di calibrazione).
 *
 * Usata sia per la classifica REALE (da risultati/ufficiali, con gol veri)
 * sia per la classifica PREVISTA di ciascun utente (classificaPrevista):
 * da quando il pronostico include il risultato esatto (2026-09-05), la
 * classifica finale prevista non è più un ordinamento scelto a mano ma viene
 * derivata dai risultati pronosticati, esattamente come nel Mondialito —
 * vedi CLAUDE.md, "Pronostici richiesti all'utente", punto 2.
 *
 * ATTENZIONE: questo file (CommonJS, Cloud Functions) ha un gemello ES module
 * in ../js/ranking.js usato dal browser per l'anteprima live. La logica deve
 * restare identica — test_punteggi.js li confronta sullo stesso dataset.
 */
'use strict';

const N_SQUADRE_TOP8 = 8;
const N_SQUADRE_PLAYOFF = 16; // 9ª-24ª
// le restanti (25ª-36ª, 12 squadre) sono eliminate

/**
 * Calcola la classifica generale dalle giornate ufficiali.
 * @param {Array} squadre   [{ id, nome }, ...] (36 squadre)
 * @param {Array} giornate  [{ numero, partite: [{ id, casa, trasferta, golCasa, golTrasferta }] }]
 * @returns {Array} ordine  [{ squadraId, nome, punti, gf, gs, dr, giocate }] ordinato dal 1° al 36°
 */
function classificaSquadre(squadre, giornate) {
  const stats = {};
  (squadre || []).forEach((sq) => {
    stats[sq.id] = { squadraId: sq.id, nome: sq.nome, punti: 0, gf: 0, gs: 0, dr: 0, giocate: 0 };
  });

  (giornate || []).forEach((giornata) => {
    (giornata.partite || []).forEach((p) => {
      if (p.golCasa == null || p.golTrasferta == null) return; // partita non ancora giocata
      const casa = stats[p.casa];
      const trasferta = stats[p.trasferta];
      if (!casa || !trasferta) return;

      casa.gf += p.golCasa; casa.gs += p.golTrasferta; casa.giocate += 1;
      trasferta.gf += p.golTrasferta; trasferta.gs += p.golCasa; trasferta.giocate += 1;

      if (p.golCasa > p.golTrasferta) casa.punti += 3;
      else if (p.golCasa < p.golTrasferta) trasferta.punti += 3;
      else { casa.punti += 1; trasferta.punti += 1; }
    });
  });

  const ordine = Object.values(stats).map((s) => ({ ...s, dr: s.gf - s.gs }));
  ordine.sort((a, b) => {
    if (b.punti !== a.punti) return b.punti - a.punti;
    if (b.dr !== a.dr) return b.dr - a.dr;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.nome.localeCompare(b.nome); // fallback deterministico, non un vero criterio UEFA
  });
  return ordine;
}

/**
 * Assegna la fascia (top8 / playoff / eliminate) a ciascuna posizione.
 * @param {Array} ordine  array di squadraId (o di oggetti classificaSquadre) in ordine di classifica
 * @returns {Object} { top8: Set, playoff: Set, eliminate: Set }
 */
function fasceDaOrdine(ordineIds) {
  const top8 = new Set(ordineIds.slice(0, N_SQUADRE_TOP8));
  const playoff = new Set(ordineIds.slice(N_SQUADRE_TOP8, N_SQUADRE_TOP8 + N_SQUADRE_PLAYOFF));
  const eliminate = new Set(ordineIds.slice(N_SQUADRE_TOP8 + N_SQUADRE_PLAYOFF));
  return { top8, playoff, eliminate };
}

// ── Classifica PREVISTA (derivata dal pronostico dell'utente) ──────────

// Se l'utente ha dato solo il segno senza risultato esatto, si assume un
// punteggio "minimo" convenzionale: 1-0 / 1-1 / 0-1. Serve solo a far
// tornare i conti di punti e gol nella classifica prevista; il calcolo del
// punteggio utente (segno / risultato esatto) NON dipende da questa
// convenzione.
const SCORE_DA_SEGNO = { '1': [1, 0], X: [1, 1], '2': [0, 1] };

/**
 * Risultato pronosticato per una partita: risultato esatto se presente,
 * altrimenti convenzione da segno, altrimenti null (partita non pronosticata).
 */
function risultatoPrevisto(pron, matchId) {
  const esatto = pron && pron.risultatiEsatti && pron.risultatiEsatti[matchId];
  if (esatto && esatto.golCasa != null && esatto.golTrasferta != null) {
    return { golCasa: Number(esatto.golCasa), golTrasferta: Number(esatto.golTrasferta) };
  }
  const segno = pron && pron.segni && pron.segni[matchId];
  if (segno && SCORE_DA_SEGNO[segno]) {
    const [gc, gt] = SCORE_DA_SEGNO[segno];
    return { golCasa: gc, golTrasferta: gt };
  }
  return null;
}

/**
 * Copia delle giornate con i gol sostituiti dai gol pronosticati (null dove
 * la partita non è pronosticata, quindi non conteggiata).
 */
function giornatePreviste(pron, giornate) {
  return (giornate || []).map((g) => ({
    ...g,
    partite: (g.partite || []).map((p) => {
      const r = risultatoPrevisto(pron, p.id);
      return { ...p, golCasa: r ? r.golCasa : null, golTrasferta: r ? r.golTrasferta : null };
    }),
  }));
}

/**
 * Classifica a 36 squadre derivata dal pronostico. Stessa struttura di
 * ritorno di classificaSquadre; si aggiorna man mano che l'utente
 * pronostica altre giornate (le partite non pronosticate non contano).
 */
function classificaPrevista(pron, squadre, giornate) {
  return classificaSquadre(squadre, giornatePreviste(pron, giornate));
}

module.exports = {
  classificaSquadre, fasceDaOrdine, N_SQUADRE_TOP8, N_SQUADRE_PLAYOFF,
  risultatoPrevisto, giornatePreviste, classificaPrevista, SCORE_DA_SEGNO,
};

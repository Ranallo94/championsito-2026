/**
 * CHAMPIONSITO — functions/punteggi.js  (CommonJS, usato dalle Cloud Functions)
 *
 * Tabella punti Fase 1, calibrata con simulazione Monte Carlo — vedi CLAUDE.md
 * ("Punteggi") e ../simulazione/sim_championsito.py per il metodo. QUESTA
 * TABELLA È L'UNICA FONTE DI VERITÀ per i valori: se si ricalibra la
 * simulazione, aggiornare qui E in CLAUDE.md.
 */
'use strict';

const { classificaSquadre, fasceDaOrdine } = require('./ranking.js');

const TABELLA_PUNTI = {
  segno: 3,
  bonusFineFase: 60, // capocannoniere / assistman / squadra più ammonita, ciascuno
  fascia: { top8: 20, playoff: 10, eliminate: 6 },
  posizioneEsatta: { top8: 70, playoff: 35, eliminate: 15 },
};

function _zonaDi(squadraId, top8, playoff) {
  if (top8.has(squadraId)) return 'top8';
  if (playoff.has(squadraId)) return 'playoff';
  return 'eliminate';
}

/**
 * Calcola il punteggio Fase 1 di un pronostico.
 * @param {Object} pron       documento pronostici/{uid}
 *   { segni: {matchId: '1'|'X'|'2'}, classificaFinale: [squadraId,...36], bonus: {capocannoniere, assistman, cartellini} }
 * @param {Object} risultati  documento risultati/ufficiali
 *   { squadre: [{id,nome}], giornate: [...], bonus: {...}, congelata: bool }
 */
function calcolaPunteggio(pron, risultati) {
  const segniPron = (pron && pron.segni) || {};
  const classificaPron = (pron && pron.classificaFinale) || [];
  const bonusPron = (pron && pron.bonus) || {};

  const giornate = (risultati && risultati.giornate) || [];
  const bonusReale = (risultati && risultati.bonus) || {};
  const congelata = !!(risultati && risultati.congelata);

  // ── A. Segno per partita ──────────────────────────────
  let puntiSegno = 0, segniIndovinati = 0, segniGiocati = 0;
  giornate.forEach((g) => {
    (g.partite || []).forEach((p) => {
      if (p.golCasa == null || p.golTrasferta == null) return; // non ancora giocata
      segniGiocati++;
      const segnoReale = p.golCasa > p.golTrasferta ? '1' : (p.golCasa < p.golTrasferta ? '2' : 'X');
      if (segniPron[p.id] === segnoReale) {
        puntiSegno += TABELLA_PUNTI.segno;
        segniIndovinati++;
      }
    });
  });

  // ── B. Bonus fine-fase (3 voci indipendenti) ──────────
  let puntiBonus = 0, bonusIndovinati = 0;
  ['capocannoniere', 'assistman', 'cartellini'].forEach((chiave) => {
    const scelto = bonusPron[chiave];
    const reale = bonusReale[chiave];
    if (scelto && reale && scelto === reale) {
      puntiBonus += TABELLA_PUNTI.bonusFineFase;
      bonusIndovinati++;
    }
  });

  // ── C. + D. Fascia e posizione esatta (solo a classifica congelata) ──
  let puntiFascia = 0, puntiPosizione = 0, fasceIndovinate = 0, posizioniIndovinate = 0;
  if (congelata && risultati.squadre && risultati.squadre.length) {
    const ordineReale = classificaSquadre(risultati.squadre, giornate);
    const ordineRealeIds = ordineReale.map((s) => s.squadraId);
    const { top8: top8R, playoff: playoffR } = fasceDaOrdine(ordineRealeIds);

    const { top8: top8P, playoff: playoffP } = fasceDaOrdine(classificaPron);

    const posizioneRealeById = {};
    ordineRealeIds.forEach((id, i) => { posizioneRealeById[id] = i; });
    const posizionePronById = {};
    classificaPron.forEach((id, i) => { posizionePronById[id] = i; });

    (risultati.squadre || []).forEach((sq) => {
      const id = sq.id;
      if (!(id in posizioneRealeById) || !(id in posizionePronById)) return;
      const zonaReale = _zonaDi(id, top8R, playoffR);
      const zonaPron = _zonaDi(id, top8P, playoffP);
      if (zonaReale === zonaPron) {
        puntiFascia += TABELLA_PUNTI.fascia[zonaReale];
        fasceIndovinate++;
        if (posizioneRealeById[id] === posizionePronById[id]) {
          puntiPosizione += TABELLA_PUNTI.posizioneEsatta[zonaReale];
          posizioniIndovinate++;
        }
      }
    });
  }

  const totale = puntiSegno + puntiBonus + puntiFascia + puntiPosizione;
  const breakdown = { segno: puntiSegno, bonus: puntiBonus, fascia: puntiFascia, posizione: puntiPosizione };
  // Spareggio: nell'ordine di importanza della tabella punti (posizione esatta
  // pesa di più, quindi decide per prima in caso di parità totale).
  const spareggio = [posizioniIndovinate, fasceIndovinate, bonusIndovinati, segniIndovinati];

  return { totale, breakdown, spareggio, meta: { segniGiocati, segniIndovinati, congelata } };
}

module.exports = { TABELLA_PUNTI, calcolaPunteggio };

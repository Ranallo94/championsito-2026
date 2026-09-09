/**
 * CHAMPIONSITO — js/punteggi.js  (ES module, browser)
 *
 * GEMELLO di ../functions/punteggi.js (CommonJS, Cloud Functions): stessa
 * identica logica di calcolo del punteggio di un pronostico. Serve al
 * pannello admin per ricalcolare classifica/snapshot direttamente dal
 * browser (ricalcolaClassificaLocale in admin.js) — nato il 2026-09-09
 * perché il deploy delle Cloud Functions era bloccato e la classifica
 * online restava ferma alla formula senza risultato esatto.
 *
 * Se modifichi qui, modifica anche là: test_punteggi.js confronta i due
 * file sullo stesso dataset. La tabella punti vive in ranking.js.
 */

import { classificaSquadre, fasceDaOrdine, classificaPrevista, TABELLA_PUNTI } from './ranking.js';

function _zonaDi(squadraId, top8, playoff) {
  if (top8.has(squadraId)) return 'top8';
  if (playoff.has(squadraId)) return 'playoff';
  return 'eliminate';
}

export function calcolaPunteggio(pron, risultati) {
  const segniPron = (pron && pron.segni) || {};
  const risultatiEsattiPron = (pron && pron.risultatiEsatti) || {};
  const bonusPron = (pron && pron.bonus) || {};

  const giornate = (risultati && risultati.giornate) || [];
  const bonusReale = (risultati && risultati.bonus) || {};
  const congelata = !!(risultati && risultati.congelata);

  let puntiSegno = 0, segniIndovinati = 0, segniGiocati = 0;
  let puntiRisultatoEsatto = 0, risultatiEsattiIndovinati = 0;
  giornate.forEach((g) => {
    (g.partite || []).forEach((p) => {
      if (p.golCasa == null || p.golTrasferta == null) return;
      segniGiocati++;
      const segnoReale = p.golCasa > p.golTrasferta ? '1' : (p.golCasa < p.golTrasferta ? '2' : 'X');
      if (segniPron[p.id] === segnoReale) {
        puntiSegno += TABELLA_PUNTI.segno;
        segniIndovinati++;
      }
      const esatto = risultatiEsattiPron[p.id];
      if (esatto && Number(esatto.golCasa) === p.golCasa && Number(esatto.golTrasferta) === p.golTrasferta) {
        puntiRisultatoEsatto += TABELLA_PUNTI.risultatoEsatto;
        risultatiEsattiIndovinati++;
      }
    });
  });

  let puntiBonus = 0, bonusIndovinati = 0;
  ['capocannoniere', 'assistman', 'cartellini'].forEach((chiave) => {
    const scelto = bonusPron[chiave];
    const reale = bonusReale[chiave];
    if (scelto && reale && scelto === reale) {
      puntiBonus += TABELLA_PUNTI.bonusFineFase;
      bonusIndovinati++;
    }
  });

  let puntiFascia = 0, puntiPosizione = 0, fasceIndovinate = 0, posizioniIndovinate = 0;
  if (congelata && risultati.squadre && risultati.squadre.length) {
    const ordineReale = classificaSquadre(risultati.squadre, giornate);
    const ordineRealeIds = ordineReale.map((s) => s.squadraId);
    const { top8: top8R, playoff: playoffR } = fasceDaOrdine(ordineRealeIds);

    const classificaPron = classificaPrevista(pron, risultati.squadre, giornate).map((s) => s.squadraId);
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

  const totale = puntiSegno + puntiRisultatoEsatto + puntiBonus + puntiFascia + puntiPosizione;
  const breakdown = {
    segno: puntiSegno,
    risultatoEsatto: puntiRisultatoEsatto,
    bonus: puntiBonus,
    fascia: puntiFascia,
    posizione: puntiPosizione,
  };
  const spareggio = [posizioniIndovinate, fasceIndovinate, bonusIndovinati, risultatiEsattiIndovinati, segniIndovinati];

  return {
    totale,
    breakdown,
    spareggio,
    meta: { segniGiocati, segniIndovinati, risultatiEsattiIndovinati, congelata },
  };
}

/**
 * Ordina i partecipanti come fa la Cloud Function (functions/index.js):
 * totale, poi spareggio voce per voce.
 */
export function ordinaClassifica(partecipanti) {
  return [...partecipanti].sort((a, b) => {
    if (b.totale !== a.totale) return b.totale - a.totale;
    const sa = a.spareggio || [], sb = b.spareggio || [];
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      if ((sb[i] || 0) !== (sa[i] || 0)) return (sb[i] || 0) - (sa[i] || 0);
    }
    return 0;
  });
}

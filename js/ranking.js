/**
 * CHAMPIONSITO — js/ranking.js  (ES module, browser)
 *
 * GEMELLO di ../functions/ranking.js (CommonJS, Cloud Functions). Stessa
 * identica logica: classifica a 36 squadre (punti, differenza reti, gol
 * fatti, nome) e classifica PREVISTA derivata dal pronostico dell'utente.
 *
 * Il browser la usa per l'anteprima live della classifica prevista nella
 * scheda Pronostici; la Cloud Function usa la copia CommonJS per il calcolo
 * ufficiale del punteggio. Se modifichi qui, modifica anche là:
 * test_punteggi.js confronta i due file sullo stesso dataset.
 */

export const N_SQUADRE_TOP8 = 8;
export const N_SQUADRE_PLAYOFF = 16; // 9ª-24ª

export function classificaSquadre(squadre, giornate) {
  const stats = {};
  (squadre || []).forEach((sq) => {
    stats[sq.id] = { squadraId: sq.id, nome: sq.nome, punti: 0, gf: 0, gs: 0, dr: 0, giocate: 0 };
  });

  (giornate || []).forEach((giornata) => {
    (giornata.partite || []).forEach((p) => {
      if (p.golCasa == null || p.golTrasferta == null) return;
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
    return a.nome.localeCompare(b.nome);
  });
  return ordine;
}

export function fasceDaOrdine(ordineIds) {
  const top8 = new Set(ordineIds.slice(0, N_SQUADRE_TOP8));
  const playoff = new Set(ordineIds.slice(N_SQUADRE_TOP8, N_SQUADRE_TOP8 + N_SQUADRE_PLAYOFF));
  const eliminate = new Set(ordineIds.slice(N_SQUADRE_TOP8 + N_SQUADRE_PLAYOFF));
  return { top8, playoff, eliminate };
}

export const SCORE_DA_SEGNO = { '1': [1, 0], X: [1, 1], '2': [0, 1] };

export function risultatoPrevisto(pron, matchId) {
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

export function giornatePreviste(pron, giornate) {
  return (giornate || []).map((g) => ({
    ...g,
    partite: (g.partite || []).map((p) => {
      const r = risultatoPrevisto(pron, p.id);
      return { ...p, golCasa: r ? r.golCasa : null, golTrasferta: r ? r.golTrasferta : null };
    }),
  }));
}

export function classificaPrevista(pron, squadre, giornate) {
  return classificaSquadre(squadre, giornatePreviste(pron, giornate));
}

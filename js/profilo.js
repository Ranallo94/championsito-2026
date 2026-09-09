/**
 * CHAMPIONSITO — profilo.js
 * Scheda profilo di un partecipante, aperta dalla classifica cliccando sul
 * nome: sintesi dei pronostici più rilevanti + dettaglio giornata per giornata.
 *
 * Visibilità: i pronostici di UN ALTRO utente si vedono solo per le
 * giornate già chiuse dall'admin (altrimenti basterebbe aprire la scheda del
 * primo in classifica per copiarlo). I bonus si vedono quando G1 è chiusa.
 * La classifica prevista mostrata agli altri è calcolata solo sulle
 * giornate chiuse. Sul proprio profilo si vede tutto.
 */

import { getRisultati, getPronostici, getClassifica } from './db.js';
import { getCurrentUser } from './auth.js';
import { classificaPrevista, risultatoPrevisto, TABELLA_PUNTI } from './ranking.js';
import { etichettaGiocatore } from './giocatori.js';
import { navigaA } from './app.js';

let _paginaPrecedente = 'classifica';

export async function apriProfilo(uid, daPagina = 'classifica') {
  _paginaPrecedente = daPagina;
  const page = document.getElementById('page-profilo');
  if (!page) return;
  page.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Caricamento profilo…</p></div>';
  navigaA('profilo');

  try {
    const [risultati, pron, classifica] = await Promise.all([
      getRisultati(), getPronostici(uid), getClassifica(),
    ]);
    _render(page, uid, risultati || {}, pron || {}, classifica || []);
  } catch (e) {
    console.error('[profilo] errore:', e);
    page.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="btn-profilo-indietro">← Indietro</button>
      <div class="info-banner info-banner--yellow" style="margin-top:12px"><span>⚠️</span><span>Impossibile caricare la scheda (${_esc(e.code || e.message)}).</span></div>`;
    page.querySelector('#btn-profilo-indietro').addEventListener('click', () => navigaA(_paginaPrecedente));
  }
}

function _render(page, uid, risultati, pron, classifica) {
  const me = getCurrentUser();
  const mio = !!me && me.id === uid;
  const squadre = risultati.squadre || [];
  const giornate = risultati.giornate || [];
  const nomi = {};
  squadre.forEach((s) => { nomi[s.id] = s.nome; });

  const idx = classifica.findIndex((p) => p.id === uid);
  const voce = idx >= 0 ? classifica[idx] : null;
  const nome = voce ? voce.nome : (mio ? (me.nickname || me.nome) : 'Partecipante');
  const b = (voce && voce.breakdown) || {};

  const segni = pron.segni || {};
  const esatti = pron.risultatiEsatti || {};
  const bonus = pron.bonus || {};

  // ── visibilità ──
  const visibile = (g) => mio || g.aperta === false;
  const g1 = giornate.find((g) => g.numero === 1);
  const bonusVisibili = mio || (g1 && g1.aperta === false);

  // ── statistiche per giornata (solo partite giocate, cioè con risultato reale) ──
  const perGiornata = giornate.map((g) => {
    let giocate = 0, segniOk = 0, esattiOk = 0, punti = 0, pronosticate = 0;
    (g.partite || []).forEach((p) => {
      const prev = risultatoPrevisto(pron, p.id);
      if (prev) pronosticate++;
      if (p.golCasa == null || p.golTrasferta == null || !prev) return;
      giocate++;
      const segnoReale = _segno(p.golCasa, p.golTrasferta);
      const segnoPron = segni[p.id] || _segno(prev.golCasa, prev.golTrasferta);
      if (segnoPron === segnoReale) { segniOk++; punti += TABELLA_PUNTI.segno; }
      // prev = inserito o convenzione 1-0/1-1/0-1: vale anche per l'esatto
      if (prev.golCasa === p.golCasa && prev.golTrasferta === p.golTrasferta) {
        esattiOk++; punti += TABELLA_PUNTI.risultatoEsatto;
      }
    });
    return { g, giocate, segniOk, esattiOk, punti, pronosticate, tot: (g.partite || []).length };
  });
  const totGiocate = perGiornata.reduce((n, x) => n + x.giocate, 0);
  const totSegniOk = perGiornata.reduce((n, x) => n + x.segniOk, 0);
  const totEsattiOk = perGiornata.reduce((n, x) => n + x.esattiOk, 0);
  const totPronosticate = perGiornata.reduce((n, x) => n + x.pronosticate, 0);
  const totPartite = perGiornate_tot(perGiornata);
  const maxPuntiGiornata = Math.max(1, ...perGiornata.map((x) => x.punti));
  const migliore = perGiornata.filter((x) => x.giocate > 0).sort((a, c) => c.punti - a.punti)[0];

  // ── classifica prevista (per gli altri: solo dalle giornate chiuse) ──
  const pronVisibile = mio ? pron : {
    segni: Object.fromEntries(Object.entries(segni).filter(([id]) => _giornataDiPartita(giornate, id)?.aperta === false)),
    risultatiEsatti: Object.fromEntries(Object.entries(esatti).filter(([id]) => _giornataDiPartita(giornate, id)?.aperta === false)),
  };
  const prevista = classificaPrevista(pronVisibile, squadre, giornate);
  const nGiornateVisibili = giornate.filter(visibile).length;

  page.innerHTML = `
    <div class="profilo-testa">
      <button class="btn btn-secondary btn-sm" id="btn-profilo-indietro">← ${_paginaPrecedente === 'classifica' ? 'Classifica' : 'Indietro'}</button>
    </div>
    <div class="page-header">
      <h2 class="page-title">${mio ? '🙋' : '👤'} ${_esc(nome)}</h2>
      <span class="page-subtitle">${voce ? `${_posizione(idx + 1)} in classifica · <strong>${voce.totale} pt</strong>` : 'Non ancora in classifica'}</span>
    </div>
    ${voce ? `
    <div class="profilo-breakdown">
      <span title="Segni">⚽ Segno <strong>${b.segno || 0}</strong></span>
      <span title="Risultati esatti">🎯 Esatto <strong>${b.risultatoEsatto || 0}</strong></span>
      <span title="Bonus fine fase">🌟 Bonus <strong>${b.bonus || 0}</strong></span>
      <span title="Fascia">🏁 Fascia <strong>${b.fascia || 0}</strong></span>
      <span title="Posizione esatta">📍 Posizione <strong>${b.posizione || 0}</strong></span>
    </div>` : ''}

    <div class="inner-tabs" id="profilo-tabs">
      <button class="tab active" data-tab="tab-profilo-sintesi">Sintesi</button>
      <button class="tab" data-tab="tab-profilo-dettaglio">Dettaglio pronostici</button>
    </div>

    <div id="tab-profilo-sintesi" class="tab-content active">
      <div class="profilo-kpi">
        <div class="kpi"><div class="kpi-val">${totGiocate ? Math.round(100 * totSegniOk / totGiocate) : '—'}${totGiocate ? '%' : ''}</div><div class="kpi-lbl">Segni indovinati<br><small>${totSegniOk} su ${totGiocate} giocate</small></div></div>
        <div class="kpi"><div class="kpi-val">${totGiocate ? Math.round(100 * totEsattiOk / totGiocate) : '—'}${totGiocate ? '%' : ''}</div><div class="kpi-lbl">Risultati esatti<br><small>${totEsattiOk} su ${totGiocate}</small></div></div>
        <div class="kpi"><div class="kpi-val">${totPronosticate}/${totPartite}</div><div class="kpi-lbl">Partite pronosticate</div></div>
        <div class="kpi"><div class="kpi-val">${migliore ? `G${migliore.g.numero}` : '—'}</div><div class="kpi-lbl">Giornata migliore<br><small>${migliore ? `${migliore.punti} pt` : 'nessuna giocata'}</small></div></div>
      </div>

      <h3 class="reg-section-title" style="margin-top:20px">Punti per giornata</h3>
      <div class="profilo-barre">
        ${perGiornata.map((x) => `
          <div class="pbar" title="G${x.g.numero}: ${x.punti} pt — ${x.segniOk} segni, ${x.esattiOk} esatti su ${x.giocate} giocate">
            <div class="pbar-track"><div class="pbar-fill" style="height:${Math.round(100 * x.punti / maxPuntiGiornata)}%"></div></div>
            <div class="pbar-val">${x.giocate ? x.punti : '·'}</div>
            <div class="pbar-lbl">${x.g.aperta === false ? '🔒' : ''}G${x.g.numero}</div>
          </div>`).join('')}
      </div>

      <h3 class="reg-section-title" style="margin-top:20px">Bonus di fase</h3>
      ${bonusVisibili ? `
      <div class="profilo-bonus">
        <div><span class="lbl">Capocannoniere</span><span>${_esc(etichettaGiocatore(bonus.capocannoniere, squadre))}</span></div>
        <div><span class="lbl">Assistman</span><span>${_esc(etichettaGiocatore(bonus.assistman, squadre))}</span></div>
        <div><span class="lbl">Più cartellini</span><span>${_esc(nomi[bonus.cartellini] || '—')}</span></div>
      </div>` : '<p class="field-hint">🔒 Visibili dopo la chiusura della giornata 1.</p>'}

      <h3 class="reg-section-title" style="margin-top:20px">La sua classifica prevista${!mio ? ` <small>(dalle ${nGiornateVisibili} giornate chiuse)</small>` : ''}</h3>
      ${nGiornateVisibili || mio ? `
      <div class="profilo-prevista">
        ${prevista.map((s, i) => `
          <div class="pp-riga pp-riga--${i < 8 ? 'top8' : (i < 24 ? 'playoff' : 'eliminate')}">
            <span class="pp-pos">${i + 1}</span><span class="pp-nome">${_esc(s.nome)}</span><span class="pp-pt">${s.punti}</span>
          </div>`).join('')}
      </div>` : '<p class="field-hint">🔒 Visibile man mano che le giornate si chiudono.</p>'}
    </div>

    <div id="tab-profilo-dettaglio" class="tab-content">
      ${giornate.map((g) => {
        const x = perGiornata.find((y) => y.g.numero === g.numero);
        if (!visibile(g)) {
          return `<div class="profilo-giornata"><h3 class="reg-section-title">G${g.numero}${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''}</h3><p class="field-hint">🔒 Pronostici visibili dopo la chiusura della giornata.</p></div>`;
        }
        return `
        <div class="profilo-giornata">
          <h3 class="reg-section-title">G${g.numero}${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''} <span class="pg-pt">${x.giocate ? `${x.punti} pt` : ''}</span></h3>
          ${(g.partite || []).map((p) => {
            const prev = risultatoPrevisto(pron, p.id);
            const e = esatti[p.id];
            const testoPrev = e ? `${e.golCasa}-${e.golTrasferta}` : (prev ? `${prev.golCasa}-${prev.golTrasferta} <small>(${segni[p.id]})</small>` : '—');
            const giocata = p.golCasa != null && p.golTrasferta != null;
            let esito = '', cls = '';
            if (giocata && prev) {
              const segnoPron = segni[p.id] || _segno(prev.golCasa, prev.golTrasferta);
              const okSegno = segnoPron === _segno(p.golCasa, p.golTrasferta);
              const okEsatto = prev.golCasa === p.golCasa && prev.golTrasferta === p.golTrasferta;
              if (okEsatto) { esito = `+${TABELLA_PUNTI.segno + TABELLA_PUNTI.risultatoEsatto}`; cls = 'esatto'; }
              else if (okSegno) { esito = `+${TABELLA_PUNTI.segno}`; cls = 'segno'; }
              else { esito = '0'; cls = 'ko'; }
            }
            return `
            <div class="pd-riga ${cls ? `pd-riga--${cls}` : ''}">
              <span class="pd-sq">${_esc(nomi[p.casa] || p.casa)}</span>
              <span class="pd-prev" title="Pronostico">${testoPrev}</span>
              <span class="pd-reale" title="Risultato">${giocata ? `${p.golCasa}-${p.golTrasferta}` : '·'}</span>
              <span class="pd-sq pd-sq--t">${_esc(nomi[p.trasferta] || p.trasferta)}</span>
              <span class="pd-pt">${esito}</span>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>
  `;

  page.querySelector('#btn-profilo-indietro').addEventListener('click', () => navigaA(_paginaPrecedente));
}

function perGiornate_tot(perGiornata) {
  return perGiornata.reduce((n, x) => n + x.tot, 0);
}

function _giornataDiPartita(giornate, matchId) {
  return giornate.find((g) => (g.partite || []).some((p) => p.id === matchId));
}

function _segno(gc, gt) {
  return gc > gt ? '1' : (gc < gt ? '2' : 'X');
}

function _posizione(n) {
  return n === 1 ? '🥇 1º' : n === 2 ? '🥈 2º' : n === 3 ? '🥉 3º' : `${n}º`;
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

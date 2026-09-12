/**
 * CHAMPIONSITO — risultati.js
 * Tab pubblico "Risultati": esiti reali delle partite giornata per giornata
 * (solo risultato esatto, nessun pronostico), classifica reale delle 36
 * squadre e le tre classifiche bonus (marcatori, assistman, cartellini).
 *
 * I dati delle classifiche bonus stanno in risultati/ufficiali.classifiche,
 * compilati dall'admin nella scheda Admin › Statistiche bonus:
 *   { marcatori:  [{ g: 'sqXX|Nome Cognome', v: 5 }, …],
 *     assist:     [{ g: 'sqXX|Nome Cognome', v: 4 }, …],
 *     cartellini: [{ sq: 'sqXX', gialli: 12, rossi: 1 }, …] }
 * Sono classifiche informative: NON incidono sul punteggio, che continua a
 * dipendere solo dai bonus reali scelti dall'admin (risultati.bonus).
 */

import { onRisultatiSnapshot } from './db.js';
import { showEmpty } from './ui.js';
import { classificaSquadre } from './ranking.js';
import { etichettaGiocatore } from './giocatori.js';

let _risultati = null;
let _nomiSquadra = {};
let _giornataAttiva = null;
let _unsubRisultati = null;

/** Quante posizioni mostrare nelle classifiche marcatori e assistman. */
export const CLASSIFICA_MAX_RIGHE = 10;

export async function initRisultati() {
  const page = document.getElementById('page-risultati');
  if (page) page.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Caricamento risultati…</p></div>';

  _unsubRisultati = onRisultatiSnapshot((dati) => {
    _risultati = dati || {};
    _nomiSquadra = {};
    (_risultati.squadre || []).forEach((s) => { _nomiSquadra[s.id] = s.nome; });
    try {
      _render();
    } catch (e) {
      console.error('[risultati] Errore nel render:', e);
      _mostraErrore(`Errore nel mostrare i risultati: ${e.message}. Dettagli in console (F12).`);
    }
  }, (err) => {
    _mostraErrore(`Errore nel caricare i risultati (${err.code || err.message}). Controlla le Firestore Rules o riprova più tardi.`);
  });
}

export function cleanupRisultati() {
  if (_unsubRisultati) { _unsubRisultati(); _unsubRisultati = null; }
  _risultati = null;
  _giornataAttiva = null;
}

function _mostraErrore(msg) {
  const page = document.getElementById('page-risultati');
  if (!page) return;
  page.innerHTML = `<div class="info-banner info-banner--yellow"><span>⚠️</span><span>${_esc(msg)}</span></div>`;
}

function _render() {
  const page = document.getElementById('page-risultati');
  if (!page) return;

  if (!_risultati || !(_risultati.squadre || []).length) {
    page.innerHTML = '';
    showEmpty('page-risultati', 'Il calendario non è ancora stato pubblicato — torna più tardi.', '🗓️');
    return;
  }

  const giornate = _risultati.giornate || [];
  // Prima apertura: mostriamo l'ultima giornata con almeno un risultato
  // inserito (è quella che interessa), non sempre la G1.
  if (!_giornataAttiva || !giornate.some((g) => g.numero === _giornataAttiva)) {
    _giornataAttiva = _ultimaGiornataGiocata(giornate);
  }

  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">⚽ Risultati</h2>
      <span class="page-subtitle">Esiti reali, classifica e classifiche bonus</span>
    </div>

    <div class="inner-tabs" id="ris-inner-tabs">
      <button class="tab active" data-tab="tab-ris-partite">Partite</button>
      <button class="tab" data-tab="tab-ris-classifica">Classifica squadre</button>
      <button class="tab" data-tab="tab-ris-bonus">Classifiche bonus</button>
    </div>

    <div id="tab-ris-partite" class="tab-content active">
      <div class="giornata-selector" id="ris-giornata-selector"></div>
      <div id="ris-partite"></div>
    </div>

    <div id="tab-ris-classifica" class="tab-content">
      <div class="info-banner info-banner--blue">
        <span>📌</span>
        <span>Classifica reale della fase a campionato, aggiornata con i risultati inseriti finora. Prime 8 agli ottavi diretti, dalla 9ª alla 24ª allo spareggio, dalla 25ª alla 36ª eliminate.</span>
      </div>
      <div id="ris-classifica-squadre"></div>
    </div>

    <div id="tab-ris-bonus" class="tab-content">
      <div class="info-banner info-banner--blue">
        <span>📊</span>
        <span>Classifiche informative su marcatori, assist e cartellini, aggiornate dall'organizzatore. <strong>Non danno punti</strong>: servono a seguire come stanno andando i bonus di fase che hai pronosticato.</span>
      </div>
      <div id="ris-classifiche-bonus"></div>
    </div>
  `;

  _renderGiornataSelector(giornate);
  _renderPartite(giornate);
  _renderClassificaSquadre();
  _renderClassificheBonus();
}

function _ultimaGiornataGiocata(giornate) {
  let ultima = giornate[0]?.numero || 1;
  giornate.forEach((g) => {
    if ((g.partite || []).some((p) => p.golCasa != null && p.golTrasferta != null)) ultima = g.numero;
  });
  return ultima;
}

function _renderGiornataSelector(giornate) {
  const el = document.getElementById('ris-giornata-selector');
  if (!el) return;
  el.innerHTML = giornate.map((g) => {
    const giocate = (g.partite || []).filter((p) => p.golCasa != null && p.golTrasferta != null).length;
    const tot = (g.partite || []).length;
    return `<button class="giornata-btn ${g.numero === _giornataAttiva ? 'active' : ''}" data-giornata="${g.numero}" title="${_esc(g.dataLabel || '')} — ${giocate}/${tot} partite con risultato">G${g.numero}${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''}</button>`;
  }).join('');
  el.querySelectorAll('.giornata-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      _giornataAttiva = Number(btn.dataset.giornata);
      _renderGiornataSelector(giornate);
      _renderPartite(giornate);
    });
  });
}

function _renderPartite(giornate) {
  const el = document.getElementById('ris-partite');
  if (!el) return;
  const giornata = giornate.find((g) => g.numero === _giornataAttiva);
  if (!giornata) { el.innerHTML = '<p class="field-hint">Nessuna giornata selezionata.</p>'; return; }

  const partite = giornata.partite || [];
  const giocate = partite.filter((p) => p.golCasa != null && p.golTrasferta != null).length;

  el.innerHTML = `
    <p class="field-hint" style="margin:10px 0">
      ${giornata.dataLabel ? `${_esc(giornata.dataLabel)} — ` : ''}${giocate} partite su ${partite.length} con risultato.
    </p>
    ${partite.map((p) => {
      const giocata = p.golCasa != null && p.golTrasferta != null;
      const esito = giocata
        ? (p.golCasa > p.golTrasferta ? 'casa' : (p.golCasa < p.golTrasferta ? 'trasferta' : 'pari'))
        : null;
      return `
        <div class="ris-partita ${giocata ? '' : 'ris-partita--attesa'}">
          <span class="ris-squadra ris-squadra--casa ${esito === 'casa' ? 'ris-squadra--vince' : ''}">${_esc(_nomiSquadra[p.casa] || p.casa)}</span>
          <span class="ris-score">${giocata ? `${p.golCasa}<span class="ris-score-sep">-</span>${p.golTrasferta}` : '<span class="ris-score-vuoto">— : —</span>'}</span>
          <span class="ris-squadra ris-squadra--trasferta ${esito === 'trasferta' ? 'ris-squadra--vince' : ''}">${_esc(_nomiSquadra[p.trasferta] || p.trasferta)}</span>
        </div>`;
    }).join('')}
  `;
}

function _renderClassificaSquadre() {
  const el = document.getElementById('ris-classifica-squadre');
  if (!el) return;
  const ordine = classificaSquadre(_risultati.squadre || [], _risultati.giornate || []);
  const nessunaGiocata = ordine.every((s) => s.giocate === 0);

  if (nessunaGiocata) {
    el.innerHTML = '<p class="field-hint">Nessun risultato inserito finora: la classifica è a zero per tutte le squadre.</p>';
    return;
  }

  el.innerHTML = `
    <div class="cf-riga cf-riga--header">
      <span class="cf-pos">#</span>
      <span class="cf-nome">Squadra</span>
      <span class="cf-stat" title="Partite giocate">G</span>
      <span class="cf-stat" title="Differenza reti">DR</span>
      <span class="cf-stat cf-stat--punti" title="Punti">Pt</span>
      <span class="cf-zona"></span>
    </div>
  ` + ordine.map((s, i) => {
    const zona = i < 8 ? 'top8' : (i < 24 ? 'playoff' : 'eliminate');
    const zonaLabel = { top8: 'Ottavi diretti', playoff: 'Spareggio', eliminate: 'Eliminata' }[zona];
    return `
      <div class="cf-riga cf-riga--${zona}">
        <span class="cf-pos">${i + 1}</span>
        <span class="cf-nome">${_esc(s.nome)}</span>
        <span class="cf-stat">${s.giocate}</span>
        <span class="cf-stat">${s.dr > 0 ? '+' : ''}${s.dr}</span>
        <span class="cf-stat cf-stat--punti">${s.punti}</span>
        <span class="cf-zona">${zonaLabel}</span>
      </div>`;
  }).join('');
}

/**
 * Classifica cartellini DERIVATA dai gialli/rossi per squadra inseriti in
 * admin: ordine per totale (gialli + rossi) decrescente, a parità più rossi —
 * esattamente la regola del bonus di fase. Esportata perché admin.js la usa
 * per l'anteprima e per suggerire il bonus reale.
 */
export function classificaCartellini(righe) {
  return (righe || [])
    .filter((r) => r && r.sq && ((Number(r.gialli) || 0) + (Number(r.rossi) || 0)) > 0)
    .map((r) => ({
      sq: r.sq,
      gialli: Number(r.gialli) || 0,
      rossi: Number(r.rossi) || 0,
      totale: (Number(r.gialli) || 0) + (Number(r.rossi) || 0),
    }))
    .sort((a, b) => (b.totale - a.totale) || (b.rossi - a.rossi));
}

/** Classifica giocatori (marcatori / assist): valore decrescente, poi nome. */
export function classificaGiocatori(righe) {
  return (righe || [])
    .filter((r) => r && r.g && (Number(r.v) || 0) > 0)
    .map((r) => ({ g: r.g, v: Number(r.v) || 0 }))
    .sort((a, b) => (b.v - a.v) || String(a.g).localeCompare(String(b.g)));
}

function _renderClassificheBonus() {
  const el = document.getElementById('ris-classifiche-bonus');
  if (!el) return;
  const clf = _risultati.classifiche || {};
  const squadre = _risultati.squadre || [];

  const marcatoriTutti = classificaGiocatori(clf.marcatori);
  const assistTutti = classificaGiocatori(clf.assist);
  const marcatori = marcatoriTutti.slice(0, CLASSIFICA_MAX_RIGHE);
  const assist = assistTutti.slice(0, CLASSIFICA_MAX_RIGHE);
  const cartellini = classificaCartellini(clf.cartellini);
  // "— Top 10" solo quando la lista è davvero tagliata, non quando le righe
  // compilate sono meno del massimo (leggere "Top 3" con 3 righe confonde).
  const suffisso = (tutti) => (tutti.length > CLASSIFICA_MAX_RIGHE ? ` — Top ${CLASSIFICA_MAX_RIGHE}` : '');

  if (!marcatori.length && !assist.length && !cartellini.length) {
    el.innerHTML = '<p class="field-hint">Le classifiche bonus non sono ancora state pubblicate.</p>';
    return;
  }

  const cardGiocatori = (emoji, titolo, unita, rows) => {
    if (!rows.length) return '';
    return `
      <div class="clf-card">
        <h4 class="clf-title">${emoji} ${titolo}</h4>
        <ol class="clf-list">
          ${rows.map((r, i) => `
            <li class="clf-row${i < 3 ? ` clf-row--top clf-row--${i + 1}` : ''}">
              <span class="clf-pos">${i + 1}</span>
              <span class="clf-name">${_esc(etichettaGiocatore(r.g, squadre))}</span>
              <span class="clf-val">${r.v}<small>${unita}</small></span>
            </li>`).join('')}
        </ol>
      </div>`;
  };

  const cardCartellini = () => {
    if (!cartellini.length) return '';
    return `
      <div class="clf-card">
        <h4 class="clf-title">🟨 Cartellini per squadra</h4>
        <p class="field-hint" style="margin:0 0 8px">Gialli + rossi; a parità di totale, chi ha più rossi.</p>
        <ol class="clf-list">
          ${cartellini.map((r, i) => `
            <li class="clf-row${i < 3 ? ` clf-row--top clf-row--${i + 1}` : ''}">
              <span class="clf-pos">${i + 1}</span>
              <span class="clf-name">${_esc(_nomiSquadra[r.sq] || r.sq)}</span>
              <span class="clf-cards"><span class="card-giallo">${r.gialli}</span><span class="card-rosso">${r.rossi}</span></span>
              <span class="clf-val">${r.totale}</span>
            </li>`).join('')}
        </ol>
      </div>`;
  };

  el.innerHTML = `<div class="clf-grid">
    ${cardGiocatori('⚽', `Marcatori${suffisso(marcatoriTutti)}`, ' gol', marcatori)}
    ${cardGiocatori('🅰️', `Assistman${suffisso(assistTutti)}`, ' assist', assist)}
    ${cardCartellini()}
  </div>`;
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

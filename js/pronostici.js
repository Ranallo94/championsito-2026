/**
 * CHAMPIONSITO — pronostici.js
 * Scheda pronostici Fase 1: segno 1X2 per giornata, classifica finale
 * prevista (ordinamento delle 36 squadre), bonus una tantum.
 */

import { getPronostici, savePronostici, onRisultatiSnapshot } from './db.js';
import { getCurrentUser } from './auth.js';
import { showToast, showEmpty } from './ui.js';
import { classificaPrevista, giornatePreviste } from './ranking.js';

let _risultati = null;
let _pron = null;
let _nomiSquadra = {};
let _giornataAttiva = 1;
let _unsubRisultati = null;

export async function initPronostici() {
  const utente = getCurrentUser();
  if (!utente) return;

  // Stato "in caricamento" subito: prima di questa funzione la pagina
  // restava sempre vuota (nessun placeholder statico in index.html) finché
  // non arrivava il primo _render() — se qualcosa a valle falliva o
  // impiegava tempo, sembrava "non si vede niente" senza nessun indizio.
  const page = document.getElementById('page-pronostici');
  if (page) page.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Caricamento pronostici…</p></div>';

  try {
    _pron = await getPronostici(utente.id);
  } catch (e) {
    console.error('[pronostici] Errore leggendo il pronostico:', e.code || e.message, e);
    _mostraErrore(`Errore nel caricare il tuo pronostico (${e.code || e.message}).`);
    return;
  }
  // Normalizzazione campo per campo: il documento pronostici/{uid} viene
  // scritto con merge parziali (il tasto "Salva pronostici di questa giornata"
  // scrive solo segni + risultatiEsatti, quello dei bonus solo bonus, ecc.),
  // quindi può esistere con alcuni campi mancanti. Prima si difendeva solo
  // il caso "documento assente del tutto" e _render() crashava su
  // _pron.bonus.capocannoniere se mancava bonus.
  if (!_pron) _pron = {};
  if (!_pron.segni) _pron.segni = {};
  if (!_pron.risultatiEsatti) _pron.risultatiEsatti = {};
  if (!_pron.bonus) _pron.bonus = {};

  // Ascolto live su risultati/ufficiali: senza questo, un cambiamento fatto
  // dall'admin (nuovo calendario, apertura/chiusura di una giornata, un
  // risultato inserito) non si vedeva finché non si ricaricava la pagina —
  // navigare fra le tab non richiama initPronostici() una seconda volta
  // (vedi app.js, mostraApp: gira solo una volta per sessione), quindi senza
  // uno snapshot live i dati restavano quelli del primo caricamento.
  _unsubRisultati = onRisultatiSnapshot((dati) => {
    _risultati = dati || {};
    _nomiSquadra = {};
    (_risultati.squadre || []).forEach((s) => { _nomiSquadra[s.id] = s.nome; });
    try {
      _render();
    } catch (e) {
      console.error('[pronostici] Errore nel render:', e);
      _mostraErrore(`Errore nel mostrare i pronostici: ${e.message}. Dettagli in console (F12).`);
    }
  }, (err) => {
    _mostraErrore(`Errore nel caricare il calendario (${err.code || err.message}). Controlla le Firestore Rules o riprova più tardi.`);
  });
}

function _mostraErrore(msg) {
  const page = document.getElementById('page-pronostici');
  if (!page) return;
  page.innerHTML = `
    <div class="info-banner info-banner--yellow">
      <span>⚠️</span><span>${_esc(msg)}</span>
    </div>`;
}

export function cleanupPronostici() {
  if (_unsubRisultati) { _unsubRisultati(); _unsubRisultati = null; }
  _risultati = null;
  _pron = null;
}

// Una giornata è chiusa ai pronostici solo se esplicitamente marcata tale
// dall'admin (giornata.aperta === false). Assenza del campo = aperta, per
// compatibilità con calendari già generati prima di questa funzionalità.
function _giornataChiusa(giornata) {
  return !!giornata && giornata.aperta === false;
}

function _render() {
  const page = document.getElementById('page-pronostici');
  if (!page) return;

  if (!_risultati || !_risultati.squadre || !_risultati.squadre.length) {
    page.innerHTML = '';
    showEmpty('page-pronostici', 'Il calendario non è ancora stato pubblicato — torna più tardi.', '🗓️');
    return;
  }

  const giornate = _risultati.giornate || [];

  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">📋 Pronostici — Fase 1</h2>
      <span class="page-subtitle">Segno, classifica finale, bonus di fase</span>
    </div>

    <div class="inner-tabs" id="pron-inner-tabs">
      <button class="tab active" data-tab="tab-pron-segni">Segno &amp; risultato esatto</button>
      <button class="tab" data-tab="tab-pron-classifica">Classifica finale</button>
      <button class="tab" data-tab="tab-pron-bonus">Bonus di fase</button>
    </div>

    <div id="tab-pron-segni" class="tab-content active">
      <div class="giornata-selector" id="giornata-selector"></div>
      <div id="pron-banner-giornata-chiusa" class="info-banner info-banner--yellow" style="display:none">
        <span>🔒</span><span>I pronostici per questa giornata sono chiusi. Puoi consultarli ma non modificarli.</span>
      </div>
      <div id="giornata-partite"></div>
      <button class="btn btn-primary" id="btn-salva-segni" style="margin-top:16px">Salva pronostici di questa giornata</button>
    </div>

    <div id="tab-pron-classifica" class="tab-content">
      <div class="info-banner info-banner--blue">
        <span>📌</span>
        <span>Classifica calcolata automaticamente dai tuoi pronostici, giornata dopo giornata: si aggiorna man mano che inserisci segni e risultati, fino all'ultima partita della fase a gironi. Le prime 8 vanno agli ottavi diretti, dalla 9ª alla 24ª giocano lo spareggio, dalla 25ª alla 36ª sono eliminate. Se per una partita dai solo il segno senza risultato, si assume 1-0 / 1-1 / 0-1.</span>
      </div>
      <p id="classifica-prevista-stato" class="field-hint"></p>
      <div id="classifica-prevista-list"></div>
    </div>

    <div id="tab-pron-bonus" class="tab-content">
      <div class="field-group">
        <label class="field-label">Capocannoniere della fase a gironi</label>
        <input id="bonus-capocannoniere" type="text" class="field-input" placeholder="Nome giocatore" value="${_esc(_pron.bonus.capocannoniere)}">
      </div>
      <div class="field-group">
        <label class="field-label">Miglior assistman della fase a gironi</label>
        <input id="bonus-assistman" type="text" class="field-input" placeholder="Nome giocatore" value="${_esc(_pron.bonus.assistman)}">
      </div>
      <div class="field-group">
        <label class="field-label">Squadra con più cartellini (ammonizioni)</label>
        <select id="bonus-cartellini" class="field-input">
          <option value="">— scegli una squadra —</option>
          ${(_risultati.squadre || []).map((s) => `<option value="${s.id}" ${_pron.bonus.cartellini === s.id ? 'selected' : ''}>${_esc(s.nome)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" id="btn-salva-bonus" style="margin-top:16px">Salva bonus</button>
    </div>
  `;

  _renderGiornataSelector(giornate);
  _renderPartite(giornate);
  _renderClassificaPrevista();

  document.getElementById('btn-salva-segni').addEventListener('click', () => _salva(['segni', 'risultatiEsatti']));
  document.getElementById('btn-salva-bonus').addEventListener('click', () => _salva(['bonus']));
}

function _renderGiornataSelector(giornate) {
  const el = document.getElementById('giornata-selector');
  if (!el) return;
  el.innerHTML = giornate.map((g) => `
    <button class="giornata-btn ${g.numero === _giornataAttiva ? 'active' : ''}" data-giornata="${g.numero}" title="${_esc(g.dataLabel || '')}">${_giornataChiusa(g) ? '🔒 ' : ''}G${g.numero}${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''}</button>
  `).join('');
  el.querySelectorAll('.giornata-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      _giornataAttiva = Number(btn.dataset.giornata);
      _renderGiornataSelector(giornate);
      _renderPartite(giornate);
    });
  });
}

function _renderPartite(giornate) {
  const el = document.getElementById('giornata-partite');
  if (!el) return;
  const giornata = giornate.find((g) => g.numero === _giornataAttiva);
  if (!giornata) { el.innerHTML = ''; return; }

  const chiusa = _giornataChiusa(giornata);
  const bannerGiornata = document.getElementById('pron-banner-giornata-chiusa');
  if (bannerGiornata) bannerGiornata.style.display = chiusa ? '' : 'none';

  el.innerHTML = giornata.partite.map((p) => {
    const scelta = _pron.segni[p.id] || null;
    const esatto = _pron.risultatiEsatti[p.id] || {};
    const disabled = chiusa ? 'disabled' : '';
    return `
      <div class="partita-riga" data-match="${p.id}">
        <span class="partita-squadra partita-squadra--casa">${_esc(_nomiSquadra[p.casa] || p.casa)}</span>
        <div class="segno-scelta">
          ${['1', 'X', '2'].map((s) => `
            <button class="segno-btn ${scelta === s ? 'active' : ''}" data-segno="${s}" ${disabled}>${s}</button>
          `).join('')}
        </div>
        <div class="risultato-esatto-scelta">
          <input type="number" min="0" class="risultato-esatto-input" data-lato="golCasa" value="${esatto.golCasa ?? ''}" placeholder="—" ${disabled}>
          <span>-</span>
          <input type="number" min="0" class="risultato-esatto-input" data-lato="golTrasferta" value="${esatto.golTrasferta ?? ''}" placeholder="—" ${disabled}>
        </div>
        <span class="partita-squadra partita-squadra--trasferta">${_esc(_nomiSquadra[p.trasferta] || p.trasferta)}</span>
      </div>`;
  }).join('');

  if (!chiusa) {
    el.querySelectorAll('.partita-riga').forEach((riga) => {
      const matchId = riga.dataset.match;

      riga.querySelectorAll('.segno-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          _pron.segni[matchId] = btn.dataset.segno;
          riga.querySelectorAll('.segno-btn').forEach((b) => b.classList.toggle('active', b === btn));
          _renderClassificaPrevista();
        });
      });

      const inputCasa = riga.querySelector('.risultato-esatto-input[data-lato="golCasa"]');
      const inputTrasferta = riga.querySelector('.risultato-esatto-input[data-lato="golTrasferta"]');
      const aggiornaEsatto = () => {
        const gc = inputCasa.value, gt = inputTrasferta.value;
        if (gc === '' || gt === '') {
          delete _pron.risultatiEsatti[matchId];
          _renderClassificaPrevista();
          return;
        }
        _pron.risultatiEsatti[matchId] = { golCasa: Number(gc), golTrasferta: Number(gt) };
        // Il punteggio esatto implica il segno: lo deriviamo e aggiorniamo il
        // bottone corrispondente, restando comunque un dato indipendente
        // (l'utente può ancora cliccare un segno diverso a mano se preferisce
        // non specificare il risultato esatto per quella partita).
        const segnoDerivato = Number(gc) > Number(gt) ? '1' : (Number(gc) < Number(gt) ? '2' : 'X');
        _pron.segni[matchId] = segnoDerivato;
        riga.querySelectorAll('.segno-btn').forEach((b) => b.classList.toggle('active', b.dataset.segno === segnoDerivato));
        _renderClassificaPrevista();
      };
      inputCasa.addEventListener('input', aggiornaEsatto);
      inputTrasferta.addEventListener('input', aggiornaEsatto);
    });
  }
}

// Classifica prevista: DERIVATA dai pronostici (segni + risultati esatti),
// stessa logica di ranking della classifica reale — nessun ordinamento a
// mano. Si ricalcola a ogni click/inserimento, non serve salvarla: la Cloud
// Function la ricava a sua volta da segni + risultatiEsatti (functions/ranking.js).
function _renderClassificaPrevista() {
  const el = document.getElementById('classifica-prevista-list');
  if (!el || !_risultati) return;

  const squadre = _risultati.squadre || [];
  const giornate = _risultati.giornate || [];
  const ordine = classificaPrevista(_pron, squadre, giornate);

  const totPartite = giornate.reduce((n, g) => n + (g.partite || []).length, 0);
  const previste = giornatePreviste(_pron, giornate)
    .reduce((n, g) => n + g.partite.filter((p) => p.golCasa != null).length, 0);
  const stato = document.getElementById('classifica-prevista-stato');
  if (stato) {
    stato.textContent = previste === 0
      ? 'Nessuna partita ancora pronosticata: la classifica è a zero punti per tutte.'
      : `Basata su ${previste} partite pronosticate su ${totPartite}${previste < totPartite ? ' — si completerà con le giornate mancanti.' : '.'}`;
  }

  el.innerHTML = `
    <div class="cf-riga cf-riga--header">
      <span class="cf-pos">#</span>
      <span class="cf-nome">Squadra</span>
      <span class="cf-stat" title="Partite pronosticate">G</span>
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

async function _salva(sezioni) {
  const utente = getCurrentUser();
  if (!utente) return;

  if (sezioni.includes('bonus')) {
    _pron.bonus = {
      capocannoniere: document.getElementById('bonus-capocannoniere').value.trim(),
      assistman: document.getElementById('bonus-assistman').value.trim(),
      cartellini: document.getElementById('bonus-cartellini').value,
    };
  }

  try {
    const patch = {};
    sezioni.forEach((s) => { patch[s] = _pron[s]; });
    await savePronostici(utente.id, patch);
    showToast('Salvato!', 'success');
  } catch (e) {
    showToast('Errore nel salvataggio: ' + e.message, 'error');
  }
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

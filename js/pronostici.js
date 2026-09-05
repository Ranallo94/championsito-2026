/**
 * CHAMPIONSITO — pronostici.js
 * Scheda pronostici Fase 1: segno 1X2 per giornata, classifica finale
 * prevista (ordinamento delle 36 squadre), bonus una tantum.
 */

import { getRisultati, getPronostici, savePronostici, onSistemaSnapshot } from './db.js';
import { getCurrentUser } from './auth.js';
import { showToast, showEmpty } from './ui.js';

let _risultati = null;
let _pron = null;
let _nomiSquadra = {};
let _aperti = true;
let _giornataAttiva = 1;

export async function initPronostici() {
  onSistemaSnapshot((cfg) => {
    _aperti = cfg && cfg.pronostici_aperti !== false;
    _aggiornaBannerChiusura();
  });

  await _carica();
  _render();
}

export function cleanupPronostici() {
  _risultati = null;
  _pron = null;
}

async function _carica() {
  const utente = getCurrentUser();
  if (!utente) return;
  [_risultati, _pron] = await Promise.all([
    getRisultati(),
    getPronostici(utente.id),
  ]);
  _nomiSquadra = {};
  (_risultati.squadre || []).forEach((s) => { _nomiSquadra[s.id] = s.nome; });
  if (!_pron) _pron = { segni: {}, risultatiEsatti: {}, classificaFinale: [], bonus: {} };
  if (!_pron.risultatiEsatti) _pron.risultatiEsatti = {};
  if (!_pron.classificaFinale || !_pron.classificaFinale.length) {
    _pron.classificaFinale = (_risultati.squadre || []).map((s) => s.id);
  }
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
    <div id="pron-banner-chiuso" class="info-banner info-banner--yellow" style="display:none">
      <span>🔒</span><span>I pronostici sono chiusi. Puoi consultare la tua scheda ma non modificarla.</span>
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
        <span>Ordina le 36 squadre da 1ª a 36ª. Le prime 8 vanno agli ottavi diretti, dalla 9ª alla 24ª giocano lo spareggio, dalla 25ª alla 36ª sono eliminate.</span>
      </div>
      <div id="classifica-prevista-list"></div>
      <button class="btn btn-primary" id="btn-salva-classifica" style="margin-top:16px">Salva classifica prevista</button>
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
  _aggiornaBannerChiusura();

  document.getElementById('btn-salva-segni').addEventListener('click', () => _salva(['segni', 'risultatiEsatti']));
  document.getElementById('btn-salva-classifica').addEventListener('click', () => _salva(['classificaFinale']));
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
  if (bannerGiornata) bannerGiornata.style.display = (chiusa && _aperti) ? '' : 'none';

  el.innerHTML = giornata.partite.map((p) => {
    const scelta = _pron.segni[p.id] || null;
    const esatto = _pron.risultatiEsatti[p.id] || {};
    const disabled = (!_aperti || chiusa) ? 'disabled' : '';
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

  if (_aperti && !chiusa) {
    el.querySelectorAll('.partita-riga').forEach((riga) => {
      const matchId = riga.dataset.match;

      riga.querySelectorAll('.segno-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          _pron.segni[matchId] = btn.dataset.segno;
          riga.querySelectorAll('.segno-btn').forEach((b) => b.classList.toggle('active', b === btn));
        });
      });

      const inputCasa = riga.querySelector('.risultato-esatto-input[data-lato="golCasa"]');
      const inputTrasferta = riga.querySelector('.risultato-esatto-input[data-lato="golTrasferta"]');
      const aggiornaEsatto = () => {
        const gc = inputCasa.value, gt = inputTrasferta.value;
        if (gc === '' || gt === '') {
          delete _pron.risultatiEsatti[matchId];
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
      };
      inputCasa.addEventListener('input', aggiornaEsatto);
      inputTrasferta.addEventListener('input', aggiornaEsatto);
    });
  }
}

function _renderClassificaPrevista() {
  const el = document.getElementById('classifica-prevista-list');
  if (!el) return;
  _draw(el);
}

function _draw(el) {
  el.innerHTML = _pron.classificaFinale.map((sqId, i) => {
    const zona = i < 8 ? 'top8' : (i < 24 ? 'playoff' : 'eliminate');
    const zonaLabel = { top8: 'Ottavi diretti', playoff: 'Spareggio', eliminate: 'Eliminata' }[zona];
    return `
      <div class="cf-riga cf-riga--${zona}" data-idx="${i}">
        <span class="cf-pos">${i + 1}</span>
        <span class="cf-nome">${_esc(_nomiSquadra[sqId] || sqId)}</span>
        <span class="cf-zona">${zonaLabel}</span>
        <span class="cf-arrows">
          <button class="btn-icon cf-up" ${!_aperti || i === 0 ? 'disabled' : ''} title="Sposta su">↑</button>
          <button class="btn-icon cf-down" ${!_aperti || i === _pron.classificaFinale.length - 1 ? 'disabled' : ''} title="Sposta giù">↓</button>
        </span>
      </div>`;
  }).join('');

  if (!_aperti) return;
  el.querySelectorAll('.cf-riga').forEach((riga) => {
    const i = Number(riga.dataset.idx);
    const up = riga.querySelector('.cf-up');
    const down = riga.querySelector('.cf-down');
    if (up) up.addEventListener('click', () => { _sposta(i, i - 1); _draw(el); });
    if (down) down.addEventListener('click', () => { _sposta(i, i + 1); _draw(el); });
  });
}

function _sposta(da, a) {
  if (a < 0 || a >= _pron.classificaFinale.length) return;
  const arr = _pron.classificaFinale;
  [arr[da], arr[a]] = [arr[a], arr[da]];
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

function _aggiornaBannerChiusura() {
  const banner = document.getElementById('pron-banner-chiuso');
  if (banner) banner.style.display = _aperti ? 'none' : '';
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

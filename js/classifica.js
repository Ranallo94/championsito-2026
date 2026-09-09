/**
 * CHAMPIONSITO — classifica.js
 * Render della classifica utenti (classifica/snapshot, calcolata dalla Cloud
 * Function ricalcolaClassifica) con ricerca e breakdown per categoria.
 */

import { onClassificaSnapshot } from './db.js';
import { showEmpty, debounce } from './ui.js';
import { apriProfilo } from './profilo.js';
import { getCurrentUser } from './auth.js';

let _unsub = null;
let _ultimaLista = [];

export async function initClassifica() {
  _unsub = onClassificaSnapshot((lista, meta) => {
    _ultimaLista = lista || [];
    _render(_ultimaLista);
    const upd = document.getElementById('classifica-updated');
    if (upd) {
      const quando = meta && meta.updatedAt
        ? meta.updatedAt.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const chi = meta && meta.calcolataDa === 'admin-browser' ? 'admin' : 'Cloud Function';
      upd.textContent = `Calcolata il ${quando} (${chi})`;
      upd.title = 'Chi ha scritto l\'ultima classifica: "admin" = ricalcolo dal pannello admin; "Cloud Function" = trigger automatico sul server';
    }
  });

  const search = document.getElementById('classifica-search');
  if (search) {
    search.addEventListener('input', debounce(() => {
      const q = search.value.trim().toLowerCase();
      const filtrata = q ? _ultimaLista.filter((p) => p.nome.toLowerCase().includes(q)) : _ultimaLista;
      _render(filtrata);
    }, 200));
  }
}

export function cleanupClassifica() {
  if (_unsub) { _unsub(); _unsub = null; }
}

function _render(lista) {
  const container = document.getElementById('classifica-container');
  if (!container) return;

  if (!lista.length) {
    showEmpty('classifica-container', 'Classifica non ancora disponibile — si aggiorna appena vengono inseriti i primi risultati.', '🏆');
    return;
  }

  const me = getCurrentUser();
  const mioIdx = me ? lista.findIndex((p) => p.id === me.id) : -1;
  const mio = mioIdx >= 0 ? lista[mioIdx] : null;

  const righe = lista.map((p, i) => {
    const pos = i + 1;
    const medaglia = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    const b = p.breakdown || {};
    const isMe = me && p.id === me.id;
    return `
      <div class="classifica-riga classifica-riga--click ${pos <= 3 ? 'classifica-riga--podio' : ''} ${isMe ? 'classifica-riga--me' : ''}" data-uid="${_esc(p.id)}" ${isMe ? 'id="classifica-riga-me"' : ''} role="button" tabindex="0" title="Apri la scheda di ${_esc(p.nome)}">
        <div class="classifica-pos">${medaglia}</div>
        <div class="classifica-nome">${_esc(p.nome)}${isMe ? ' <span class="classifica-tu">tu</span>' : ''} <span class="classifica-apri">›</span></div>
        <div class="classifica-totale">${p.totale} pt</div>
        <div class="classifica-breakdown">
          <span title="Segno">⚽ ${b.segno || 0}</span>
          <span title="Risultato esatto">🎯 ${b.risultatoEsatto || 0}</span>
          <span title="Bonus fine-fase">🌟 ${b.bonus || 0}</span>
          <span title="Fascia indovinata">🏁 ${b.fascia || 0}</span>
          <span title="Posizione esatta">📍 ${b.posizione || 0}</span>
        </div>
      </div>`;
  }).join('');

  // Banner "la tua posizione" in cima, con salto alla propria riga.
  const bannerMe = mio ? `
    <button class="classifica-me-banner" id="classifica-me-banner" type="button" title="Vai alla tua riga">
      <span class="classifica-me-pos">${mioIdx + 1}º</span>
      <span class="classifica-me-testo">La tua posizione · <strong>${mio.totale} pt</strong>${mioIdx > 0 ? ` · ${lista[mioIdx - 1].totale - mio.totale} pt dal ${mioIdx}º` : ' · sei in testa 🏆'}</span>
      <span class="classifica-apri">↓</span>
    </button>` : '';

  container.innerHTML = `${bannerMe}<div class="classifica-list">${righe}</div>`;

  container.querySelector('#classifica-me-banner')?.addEventListener('click', () => {
    const riga = document.getElementById('classifica-riga-me');
    if (!riga) return;
    riga.scrollIntoView({ behavior: 'smooth', block: 'center' });
    riga.classList.add('classifica-riga--flash');
    setTimeout(() => riga.classList.remove('classifica-riga--flash'), 1600);
  });

  container.querySelectorAll('.classifica-riga--click').forEach((riga) => {
    const apri = () => apriProfilo(riga.dataset.uid, 'classifica');
    riga.addEventListener('click', apri);
    riga.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); } });
  });
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

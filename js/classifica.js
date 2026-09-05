/**
 * CHAMPIONSITO — classifica.js
 * Render della classifica utenti (classifica/snapshot, calcolata dalla Cloud
 * Function ricalcolaClassifica) con ricerca e breakdown per categoria.
 */

import { onClassificaSnapshot } from './db.js';
import { showEmpty, debounce } from './ui.js';

let _unsub = null;
let _ultimaLista = [];

export async function initClassifica() {
  _unsub = onClassificaSnapshot((lista) => {
    _ultimaLista = lista || [];
    _render(_ultimaLista);
    const upd = document.getElementById('classifica-updated');
    if (upd) upd.textContent = `Aggiornata alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
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

  const righe = lista.map((p, i) => {
    const pos = i + 1;
    const medaglia = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    const b = p.breakdown || {};
    return `
      <div class="classifica-riga ${pos <= 3 ? 'classifica-riga--podio' : ''}">
        <div class="classifica-pos">${medaglia}</div>
        <div class="classifica-nome">${_esc(p.nome)}</div>
        <div class="classifica-totale">${p.totale} pt</div>
        <div class="classifica-breakdown">
          <span title="Segno">⚽ ${b.segno || 0}</span>
          <span title="Bonus fine-fase">🌟 ${b.bonus || 0}</span>
          <span title="Fascia indovinata">🎯 ${b.fascia || 0}</span>
          <span title="Posizione esatta">📍 ${b.posizione || 0}</span>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="classifica-list">${righe}</div>`;
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

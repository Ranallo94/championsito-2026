/**
 * CHAMPIONSITO — giocatori.js
 * Select dei giocatori per i bonus (capocannoniere, assistman), condivisa fra
 * la scheda utente (pronostici.js) e il pannello admin (admin.js, bonus
 * reali). Valore salvato: "sqXX|Nome Cognome" — identico da entrambe le
 * parti, così il confronto in functions/punteggi.js resta un'uguaglianza di
 * stringhe. Dati in rose.js (ESPN, 2026-09-05).
 */

import { ROSE } from './rose.js';

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/**
 * @param {string} id          id dell'elemento select
 * @param {string} valore      valore attuale ("sqXX|Nome")
 * @param {Array}  squadre     risultati.squadre (ordine degli optgroup)
 * @param {Array}  ruoli       ruoli da includere, es. ['D','M','F'] (niente portieri)
 * @param {boolean} disabled
 */
export function selectGiocatori(id, valore, squadre, ruoli, disabled) {
  const gruppi = (squadre || []).map((s) => {
    const rosa = (ROSE[s.id] || []).filter((g) => ruoli.includes(g.p));
    if (!rosa.length) return '';
    return `<optgroup label="${_esc(s.nome)}">${rosa.map((g) => {
      const v = `${s.id}|${g.n}`;
      return `<option value="${_esc(v)}" ${v === valore ? 'selected' : ''}>${_esc(g.n)} (${g.p})</option>`;
    }).join('')}</optgroup>`;
  }).join('');
  return `<select id="${id}" class="field-input" ${disabled ? 'disabled' : ''}>
    <option value="">— scegli un giocatore —</option>${gruppi}</select>`;
}

/** "sqXX|Nome" -> "Nome (Squadra)" per la visualizzazione. */
export function etichettaGiocatore(valore, squadre) {
  if (!valore || !valore.includes('|')) return valore || '—';
  const [sqId, nome] = valore.split('|');
  const sq = (squadre || []).find((s) => s.id === sqId);
  return sq ? `${nome} (${sq.nome})` : nome;
}

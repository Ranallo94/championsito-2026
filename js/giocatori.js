/**
 * CHAMPIONSITO — giocatori.js
 * Selettore dei giocatori per i bonus (capocannoniere, assistman) e per le
 * classifiche bonus dell'admin, condiviso fra scheda utente (pronostici.js),
 * pannello admin (admin.js) e anteprime.
 *
 * Valore salvato: "sqXX|Nome Cognome" — identico da entrambe le parti, così
 * il confronto in functions/punteggi.js resta un'uguaglianza di stringhe.
 * Dati in rose.js (ESPN, 2026-09-05): 1.072 giocatori.
 *
 * Dal 2026-09-12 non è più una <select>: con oltre mille opzioni trovare un
 * giocatore voleva dire scorrere all'infinito, soprattutto da telefono. Ora è
 * un campo di ricerca con lista filtrata (nome o squadra, accenti ignorati,
 * navigabile da tastiera). Il valore resta in un <input type="hidden"> con
 * l'id richiesto, così chi legge `document.getElementById(id).value` continua
 * a funzionare, e ogni scelta emette un evento 'change' su quell'input.
 */

import { ROSE } from './rose.js';

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/** Minuscolo senza accenti: "Hernández" e "hernandez" devono coincidere. */
function _norm(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

const RUOLO_LABEL = { G: 'Portiere', D: 'Difensore', M: 'Centrocampista', F: 'Attaccante' };

/** Quante voci mostrare al massimo nella tendina (la ricerca restringe). */
const MAX_RISULTATI = 40;

/**
 * Indice piatto dei giocatori: [{ v, nome, squadra, ruolo, hay }].
 * Ricostruito solo se cambiano squadre o ruoli richiesti (cache per chiave).
 */
const _indici = new Map();
function _indice(squadre, ruoli) {
  const chiave = (squadre || []).map((s) => s.id).join(',') + '#' + ruoli.join('');
  if (_indici.has(chiave)) return _indici.get(chiave);
  const lista = [];
  (squadre || []).forEach((s) => {
    (ROSE[s.id] || []).forEach((g) => {
      if (!ruoli.includes(g.p)) return;
      lista.push({
        v: `${s.id}|${g.n}`,
        nome: g.n,
        squadra: s.nome,
        ruolo: g.p,
        hay: `${_norm(g.n)} ${_norm(s.nome)}`,
      });
    });
  });
  _indici.set(chiave, lista);
  return lista;
}

/** "sqXX|Nome" -> "Nome (Squadra)" per la visualizzazione. */
export function etichettaGiocatore(valore, squadre) {
  if (!valore || !valore.includes('|')) return valore || '—';
  const [sqId, nome] = valore.split('|');
  const sq = (squadre || []).find((s) => s.id === sqId);
  return sq ? `${nome} (${sq.nome})` : nome;
}

/**
 * HTML del selettore con ricerca. Va poi attivato con bindPickerGiocatori()
 * sul contenitore, dopo aver inserito l'HTML nel documento.
 *
 * @param {string}  id        id dell'input che contiene il valore
 * @param {string}  valore    valore attuale ("sqXX|Nome")
 * @param {Array}   squadre   risultati.squadre
 * @param {Array}   ruoli     ruoli ammessi, es. ['D','M','F'] (niente portieri)
 * @param {boolean} disabled  sola lettura (es. bonus chiusi con la G1)
 */
export function pickerGiocatore(id, valore, squadre, ruoli, disabled) {
  const etichetta = valore ? etichettaGiocatore(valore, squadre) : '';
  return `
    <div class="gp${disabled ? ' gp--disabled' : ''}" data-picker="${_esc(id)}" data-ruoli="${_esc(ruoli.join(''))}">
      <input type="hidden" id="${_esc(id)}" value="${_esc(valore || '')}">
      <div class="gp-box">
        <input type="text" class="gp-input" autocomplete="off" spellcheck="false"
               role="combobox" aria-expanded="false" aria-autocomplete="list"
               placeholder="${disabled ? '— nessuna scelta —' : 'Cerca per nome o squadra…'}"
               value="${_esc(etichetta)}" ${disabled ? 'disabled' : ''}>
        ${disabled ? '' : `<button type="button" class="gp-clear" title="Cancella la scelta" ${valore ? '' : 'hidden'}>✕</button>`}
      </div>
      ${disabled ? '' : '<div class="gp-dropdown" hidden></div>'}
    </div>`;
}

/**
 * Attiva tutti i selettori presenti dentro `root` (idempotente: un picker già
 * attivato viene saltato, così si può richiamare dopo un re-render parziale).
 */
export function bindPickerGiocatori(root, squadre) {
  if (!root) return;
  root.querySelectorAll('.gp[data-picker]').forEach((gp) => {
    if (gp.dataset.bound === '1') return;
    gp.dataset.bound = '1';
    _attiva(gp, squadre);
  });
}

function _attiva(gp, squadre) {
  const hidden = gp.querySelector('input[type="hidden"]');
  const input = gp.querySelector('.gp-input');
  const dropdown = gp.querySelector('.gp-dropdown');
  const clear = gp.querySelector('.gp-clear');
  if (!hidden || !input || !dropdown) return; // disabilitato: niente da fare

  const ruoli = (gp.dataset.ruoli || 'DMF').split('');
  const lista = _indice(squadre, ruoli);
  let filtrati = [];
  let attivo = -1;

  const etichettaCorrente = () => (hidden.value ? etichettaGiocatore(hidden.value, squadre) : '');

  function filtra(query) {
    const tokens = _norm(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return lista.slice(0, MAX_RISULTATI);
    return lista.filter((g) => tokens.every((t) => g.hay.includes(t))).slice(0, MAX_RISULTATI);
  }

  function apri(query) {
    filtrati = filtra(query);
    attivo = filtrati.length ? 0 : -1;
    disegna();
    dropdown.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function chiudi() {
    dropdown.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    attivo = -1;
  }

  function disegna() {
    if (!filtrati.length) {
      dropdown.innerHTML = '<div class="gp-vuoto">Nessun giocatore trovato. Prova con il cognome o con la squadra.</div>';
      return;
    }
    const troncato = filtrati.length === MAX_RISULTATI;
    dropdown.innerHTML = filtrati.map((g, i) => `
      <div class="gp-item${i === attivo ? ' gp-item--attivo' : ''}" data-i="${i}" role="option" aria-selected="${i === attivo}">
        <span class="gp-item-nome">${_esc(g.nome)}</span>
        <span class="gp-item-sq">${_esc(g.squadra)}</span>
        <span class="gp-item-ruolo" title="${RUOLO_LABEL[g.ruolo] || ''}">${_esc(g.ruolo)}</span>
      </div>`).join('')
      + (troncato ? `<div class="gp-vuoto">Mostrati i primi ${MAX_RISULTATI} — scrivi ancora per restringere.</div>` : '');
    const el = dropdown.querySelector('.gp-item--attivo');
    el?.scrollIntoView?.({ block: 'nearest' });
  }

  function scegli(i) {
    const g = filtrati[i];
    if (!g) return;
    hidden.value = g.v;
    input.value = etichettaGiocatore(g.v, squadre);
    if (clear) clear.hidden = false;
    chiudi();
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  input.addEventListener('focus', () => { input.select(); apri(''); });
  input.addEventListener('input', () => apri(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (dropdown.hidden) { apri(input.value); return; }
      if (!filtrati.length) return;
      attivo = (attivo + (e.key === 'ArrowDown' ? 1 : -1) + filtrati.length) % filtrati.length;
      disegna();
    } else if (e.key === 'Enter') {
      if (!dropdown.hidden && attivo >= 0) { e.preventDefault(); scegli(attivo); }
    } else if (e.key === 'Escape') {
      chiudi();
      input.value = etichettaCorrente();
      input.blur();
    }
  });

  // mousedown, non click: il click arriverebbe dopo il blur dell'input, che
  // chiude la tendina e rimetterebbe l'etichetta precedente.
  dropdown.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.gp-item');
    if (!item) return;
    e.preventDefault();
    scegli(Number(item.dataset.i));
  });

  input.addEventListener('blur', () => {
    // Fuori fuoco senza aver scelto: si ripristina l'etichetta del valore
    // salvato, così non resta scritta una ricerca a metà che non corrisponde
    // a nessun giocatore.
    setTimeout(() => {
      chiudi();
      input.value = etichettaCorrente();
    }, 120);
  });

  clear?.addEventListener('click', () => {
    hidden.value = '';
    input.value = '';
    clear.hidden = true;
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  });
}

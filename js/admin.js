/**
 * CHAMPIONSITO — admin.js
 * Pannello admin: approvazione utenti, apertura/chiusura pronostici, gestione
 * squadre + generazione calendario, inserimento risultati partita per
 * partita, bonus reali di fase, congelamento classifica finale.
 */

import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {
  getPartecipanti, updatePartecipante, deletePartecipante,
  getRisultati, setRisultati, patchRisultati,
} from './db.js';
import { generaGiornate } from './calendario.js';
import { SQUADRE_UFFICIALI, GIORNATE_UFFICIALI } from './calendario-ufficiale.js';
import { showToast, openModal, closeModal } from './ui.js';

let _risultati = null;
let _giornataAttiva = 1;
let _tabAttiva = 'tab-admin-utenti';

export async function initAdmin() {
  await _render();
}

async function _render() {
  const page = document.getElementById('page-admin');
  if (!page) return;

  // Ricordiamo la sotto-scheda aperta PRIMA di ricostruire l'HTML: ogni
  // azione admin (approva, salva, toggle...) richiama _render(), che prima
  // riscriveva tutto con "Utenti" attiva hardcoded — risultato: qualunque
  // click ti riportava alla prima scheda. Il cambio di scheda è gestito da
  // app.js con un listener globale sui .tab, quindi lo leggiamo dal DOM.
  const tabCorrente = page.querySelector('#admin-inner-tabs .tab.active');
  if (tabCorrente && tabCorrente.dataset.tab) _tabAttiva = tabCorrente.dataset.tab;

  const partecipanti = await getPartecipanti();
  _risultati = await getRisultati();

  const inAttesa = partecipanti.filter((p) => !p.approvato && !p.disabilitato);
  const approvati = partecipanti.filter((p) => p.approvato);

  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">⚙️ Admin</h2>
    </div>

    <div class="inner-tabs" id="admin-inner-tabs">
      <button class="tab ${_tabAttiva === 'tab-admin-utenti' ? 'active' : ''}" data-tab="tab-admin-utenti">Utenti</button>
      <button class="tab ${_tabAttiva === 'tab-admin-squadre' ? 'active' : ''}" data-tab="tab-admin-squadre">Squadre &amp; calendario</button>
      <button class="tab ${_tabAttiva === 'tab-admin-risultati' ? 'active' : ''}" data-tab="tab-admin-risultati">Risultati</button>
      <button class="tab ${_tabAttiva === 'tab-admin-config' ? 'active' : ''}" data-tab="tab-admin-config">Configurazione</button>
    </div>

    <div id="tab-admin-utenti" class="tab-content ${_tabAttiva === 'tab-admin-utenti' ? 'active' : ''}">
      <h3 class="reg-section-title">In attesa di approvazione (${inAttesa.length})</h3>
      <div id="admin-attesa-list">${_renderUtentiAttesa(inAttesa)}</div>
      <h3 class="reg-section-title" style="margin-top:24px">Partecipanti (${approvati.length})</h3>
      <div id="admin-approvati-list">${_renderApprovati(approvati)}</div>
    </div>

    <div id="tab-admin-squadre" class="tab-content ${_tabAttiva === 'tab-admin-squadre' ? 'active' : ''}">
      <div class="info-banner info-banner--green">
        <span>🏆</span>
        <span>Carica in un colpo solo le 36 squadre e le 8 giornate ufficiali della fase a campionato Champions League 2026/27 (sorteggio di Monaco, 27 agosto 2026 — squadre, abbinamenti e date reali). Se esiste già un calendario, verrà sovrascritto.</span>
      </div>
      <button class="btn btn-primary" id="btn-carica-ufficiale">🏆 Carica calendario ufficiale UCL 2026/27</button>
      <p class="field-hint" style="margin-top:8px">
        ${(_risultati.giornate || []).length ? `Calendario presente: ${_risultati.giornate.length} giornate${_risultati.giornate[0]?.dataLabel ? ' (calendario ufficiale)' : ' (calendario generato casualmente)'}.` : 'Nessun calendario caricato.'}
      </p>

      <h3 class="reg-section-title" style="margin-top:24px">Modalità manuale (torneo di prova / altre competizioni)</h3>
      <div class="info-banner info-banner--blue">
        <span>📌</span>
        <span>Incolla i nomi delle squadre (una per riga) e genera un calendario casuale (round-robin) — usa questa modalità solo per test, non per la competizione reale.</span>
      </div>
      <div class="field-group">
        <label class="field-label">Squadre (una per riga)</label>
        <textarea id="admin-squadre-textarea" class="field-input" rows="10" placeholder="Squadra 1&#10;Squadra 2&#10;...">${(_risultati.squadre || []).map((s) => s.nome).join('\n')}</textarea>
      </div>
      <button class="btn btn-secondary" id="btn-salva-squadre">Salva squadre</button>
      <button class="btn btn-secondary" id="btn-genera-calendario" style="margin-left:8px">🗓️ Genera calendario casuale (8 giornate)</button>
    </div>

    <div id="tab-admin-risultati" class="tab-content ${_tabAttiva === 'tab-admin-risultati' ? 'active' : ''}">
      <div class="giornata-selector" id="admin-giornata-selector"></div>
      <div id="admin-partite-risultati"></div>

      <h3 class="reg-section-title" style="margin-top:24px">Bonus reali di fase</h3>
      <div class="field-group">
        <label class="field-label">Capocannoniere</label>
        <input id="admin-bonus-capocannoniere" type="text" class="field-input" value="${_esc(_risultati.bonus?.capocannoniere)}">
      </div>
      <div class="field-group">
        <label class="field-label">Assistman</label>
        <input id="admin-bonus-assistman" type="text" class="field-input" value="${_esc(_risultati.bonus?.assistman)}">
      </div>
      <div class="field-group">
        <label class="field-label">Squadra più ammonita</label>
        <select id="admin-bonus-cartellini" class="field-input">
          <option value="">— scegli una squadra —</option>
          ${(_risultati.squadre || []).map((s) => `<option value="${s.id}" ${_risultati.bonus?.cartellini === s.id ? 'selected' : ''}>${_esc(s.nome)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" id="btn-salva-bonus-reali">Salva bonus reali</button>

      <h3 class="reg-section-title" style="margin-top:24px">Classifica finale</h3>
      <div class="info-banner ${_risultati.congelata ? 'info-banner--green' : 'info-banner--yellow'}">
        <span>${_risultati.congelata ? '✅' : '🔓'}</span>
        <span>${_risultati.congelata
          ? 'Classifica congelata: il punteggio fascia/posizione esatta è attivo per tutti.'
          : 'Classifica NON congelata: fascia e posizione esatta valgono ancora 0 punti per tutti. Congela solo a fase a gironi davvero conclusa.'}</span>
      </div>
      <button class="btn ${_risultati.congelata ? 'btn-secondary' : 'btn-primary'}" id="btn-toggle-congelata">
        ${_risultati.congelata ? 'Scongela (correzioni)' : 'Congela classifica finale'}
      </button>
      <button class="btn btn-secondary" id="btn-ricalcola" style="margin-left:8px">🔄 Ricalcola classifica ora</button>
    </div>

    <div id="tab-admin-config" class="tab-content ${_tabAttiva === 'tab-admin-config' ? 'active' : ''}">
      <h3 class="reg-section-title">Pronostici per giornata</h3>
      <p class="field-hint" style="margin-bottom:10px">Chiudi una giornata quando iniziano le sue partite: gli utenti non potranno più modificare segni e risultati di quella giornata, le altre restano aperte.</p>
      <div id="admin-giornate-apertura">
        ${(_risultati.giornate || []).length ? (_risultati.giornate || []).map((g) => {
          const chiusa = g.aperta === false;
          return `
            <div class="admin-riga" data-giornata="${g.numero}">
              <span class="admin-riga-nome">${chiusa ? '🔒' : '🔓'} <strong>G${g.numero}</strong>${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''} — ${chiusa ? 'chiusa' : 'aperta'}</span>
              <span class="admin-riga-azioni">
                <button class="btn btn-sm ${chiusa ? 'btn-primary' : 'btn-secondary'} btn-toggle-giornata">${chiusa ? 'Riapri' : 'Chiudi'}</button>
              </span>
            </div>`;
        }).join('') : '<p class="field-hint">Nessun calendario caricato — caricalo dal tab "Squadre &amp; calendario".</p>'}
      </div>
    </div>
  `;

  _bindEventiUtenti(page);
  _bindEventiSquadre(page);
  _bindEventiRisultati(page);
  _bindEventiConfig(page);
}

// ── UTENTI ──────────────────────────────────────────────

// Link WhatsApp "click to chat": wa.me vuole solo cifre con prefisso
// internazionale, senza + né 00. Se il numero è italiano senza prefisso
// (10 cifre che iniziano per 3, o rete fissa che inizia per 0) si aggiunge 39.
function _linkWhatsApp(telefono) {
  let cifre = String(telefono || '').replace(/\D/g, '');
  if (!cifre) return null;
  if (cifre.startsWith('00')) cifre = cifre.slice(2);
  else if (!String(telefono).trim().startsWith('+') && (cifre.startsWith('3') || cifre.startsWith('0')) && cifre.length <= 11) {
    cifre = '39' + cifre;
  }
  return `https://wa.me/${cifre}`;
}

function _schedaContatto(p) {
  const wa = _linkWhatsApp(p.telefono);
  return `
    <div class="admin-utente-info">
      <div class="admin-utente-nome">${_esc(p.nome)} ${_esc(p.cognome)}${p.nickname && p.nickname !== p.nome ? ` <small>“${_esc(p.nickname)}”</small>` : ''} ${p.isAdmin ? '⭐' : ''} ${p.disabilitato ? '🚫' : ''}</div>
      <div class="admin-utente-dettagli">
        <a href="mailto:${_esc(p.email)}">${_esc(p.email)}</a>
        <span>·</span>
        <a href="tel:${_esc(p.telefono)}">${_esc(p.telefono || '—')}</a>
        ${wa ? `<a class="btn-whatsapp" href="${wa}" target="_blank" rel="noopener" title="Scrivi su WhatsApp">💬 WhatsApp</a>` : ''}
      </div>
    </div>`;
}

function _renderUtentiAttesa(lista) {
  if (!lista.length) return '<p class="field-hint">Nessuna richiesta in attesa.</p>';
  return lista.map((p) => `
    <div class="admin-riga" data-uid="${p.id}">
      ${_schedaContatto(p)}
      <span class="admin-riga-azioni">
        <button class="btn btn-primary btn-sm btn-approva">Approva</button>
        <button class="btn btn-secondary btn-sm btn-rifiuta">Rifiuta</button>
      </span>
    </div>`).join('');
}

function _renderApprovati(lista) {
  if (!lista.length) return '<p class="field-hint">Nessun partecipante approvato.</p>';
  return lista.map((p) => `
    <div class="admin-riga" data-uid="${p.id}">
      ${_schedaContatto(p)}
      <span class="admin-riga-azioni">
        <button class="btn btn-secondary btn-sm btn-toggle-disabilita">${p.disabilitato ? 'Riabilita' : 'Disabilita'}</button>
      </span>
    </div>`).join('');
}

function _bindEventiUtenti(page) {
  page.querySelectorAll('#admin-attesa-list .admin-riga').forEach((riga) => {
    const uid = riga.dataset.uid;
    riga.querySelector('.btn-approva')?.addEventListener('click', async () => {
      await updatePartecipante(uid, { approvato: true });
      showToast('Utente approvato', 'success');
      await _render();
    });
    riga.querySelector('.btn-rifiuta')?.addEventListener('click', async () => {
      openModal({
        title: 'Rifiutare la richiesta?',
        body: '<p>L\'utente verrà rimosso e dovrà registrarsi di nuovo per riprovare.</p>',
        buttons: [
          { label: 'Annulla', cls: 'btn btn-secondary', onClick: closeModal },
          {
            label: 'Rifiuta', cls: 'btn btn-danger', onClick: async () => {
              closeModal();
              try {
                const elimina = httpsCallable(window._firebase.functions, 'eliminaUtente');
                await elimina({ uid });
              } catch (e) { /* l'account Auth potrebbe già non esistere: proseguiamo comunque */ }
              await deletePartecipante(uid);
              showToast('Richiesta rifiutata', 'success');
              await _render();
            },
          },
        ],
      });
    });
  });

  page.querySelectorAll('#admin-approvati-list .admin-riga').forEach((riga) => {
    const uid = riga.dataset.uid;
    riga.querySelector('.btn-toggle-disabilita')?.addEventListener('click', async () => {
      const partecipanti = await getPartecipanti();
      const p = partecipanti.find((x) => x.id === uid);
      await updatePartecipante(uid, { disabilitato: !p.disabilitato });
      await _render();
    });
  });
}

// ── SQUADRE & CALENDARIO ─────────────────────────────────

function _bindEventiSquadre(page) {
  page.querySelector('#btn-carica-ufficiale')?.addEventListener('click', () => {
    const giaPresente = (_risultati.giornate || []).length > 0;
    const conferma = async () => {
      closeModal();
      await setRisultati({ squadre: SQUADRE_UFFICIALI, giornate: GIORNATE_UFFICIALI });
      showToast('Calendario ufficiale UCL 2026/27 caricato: 36 squadre, 8 giornate.', 'success');
      await _render();
    };
    if (!giaPresente) { conferma(); return; }
    openModal({
      title: 'Sovrascrivere il calendario esistente?',
      body: '<p>C\'è già un calendario salvato (con eventuali risultati inseriti). Caricando quello ufficiale, squadre e giornate verranno sostituite. I pronostici già inviati dagli utenti restano invariati, ma faranno riferimento ai nuovi id squadra/partita solo se coincidono.</p>',
      buttons: [
        { label: 'Annulla', cls: 'btn btn-secondary', onClick: closeModal },
        { label: 'Sovrascrivi', cls: 'btn btn-danger', onClick: conferma },
      ],
    });
  });

  page.querySelector('#btn-salva-squadre')?.addEventListener('click', async () => {
    const righe = page.querySelector('#admin-squadre-textarea').value
      .split('\n').map((r) => r.trim()).filter(Boolean);
    if (righe.length < 2 || righe.length % 2 !== 0) {
      showToast('Serve un numero pari di squadre (2 o più).', 'error');
      return;
    }
    const squadre = righe.map((nome, i) => ({ id: `sq${String(i + 1).padStart(2, '0')}`, nome }));
    await setRisultati({ squadre });
    showToast(`${squadre.length} squadre salvate. Ora genera il calendario.`, 'success');
    await _render();
  });

  page.querySelector('#btn-genera-calendario')?.addEventListener('click', async () => {
    const squadre = _risultati.squadre || [];
    if (squadre.length < 2) { showToast('Salva prima le squadre.', 'error'); return; }
    try {
      const giornate = generaGiornate(squadre.map((s) => s.id), 8);
      await setRisultati({ giornate });
      showToast('Calendario generato!', 'success');
      await _render();
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  });
}

// ── RISULTATI ─────────────────────────────────────────────

function _bindEventiRisultati(page) {
  const giornate = _risultati.giornate || [];
  const selector = page.querySelector('#admin-giornata-selector');
  if (selector) {
    selector.innerHTML = giornate.map((g) => `
      <button class="giornata-btn ${g.numero === _giornataAttiva ? 'active' : ''}" data-giornata="${g.numero}" title="${_esc(g.dataLabel || '')}">${g.aperta === false ? '🔒 ' : ''}G${g.numero}${g.dataLabel ? ` <small>${_esc(g.dataLabel)}</small>` : ''}</button>
    `).join('');
    selector.querySelectorAll('.giornata-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        _giornataAttiva = Number(btn.dataset.giornata);
        _render();
      });
    });
  }
  _renderPartiteRisultati(page, giornate);

  page.querySelector('#btn-salva-bonus-reali')?.addEventListener('click', async () => {
    const bonus = {
      capocannoniere: page.querySelector('#admin-bonus-capocannoniere').value.trim(),
      assistman: page.querySelector('#admin-bonus-assistman').value.trim(),
      cartellini: page.querySelector('#admin-bonus-cartellini').value,
    };
    await setRisultati({ bonus });
    showToast('Bonus reali salvati', 'success');
  });

  page.querySelector('#btn-toggle-congelata')?.addEventListener('click', async () => {
    await setRisultati({ congelata: !_risultati.congelata });
    showToast(_risultati.congelata ? 'Classifica scongelata' : 'Classifica congelata!', 'success');
    await _render();
  });

  page.querySelector('#btn-ricalcola')?.addEventListener('click', async () => {
    try {
      const fn = httpsCallable(window._firebase.functions, 'ricongelaClassifica');
      await fn();
      showToast('Classifica ricalcolata', 'success');
    } catch (e) {
      showToast('Errore: ' + e.message, 'error');
    }
  });
}

function _renderPartiteRisultati(page, giornate) {
  const el = page.querySelector('#admin-partite-risultati');
  if (!el) return;
  const giornata = giornate.find((g) => g.numero === _giornataAttiva);
  if (!giornata) { el.innerHTML = '<p class="field-hint">Nessun calendario — generalo dal tab "Squadre &amp; calendario".</p>'; return; }

  const nomiSquadra = {};
  (_risultati.squadre || []).forEach((s) => { nomiSquadra[s.id] = s.nome; });

  el.innerHTML = giornata.partite.map((p) => `
    <div class="partita-riga-admin" data-match="${p.id}">
      <span class="partita-squadra">${_esc(nomiSquadra[p.casa])}</span>
      <input type="number" min="0" class="gol-input" id="gc-${p.id}" value="${p.golCasa ?? ''}" placeholder="—">
      <span>-</span>
      <input type="number" min="0" class="gol-input" id="gt-${p.id}" value="${p.golTrasferta ?? ''}" placeholder="—">
      <span class="partita-squadra">${_esc(nomiSquadra[p.trasferta])}</span>
      <button class="btn btn-secondary btn-sm btn-salva-risultato">Salva</button>
    </div>`).join('');

  el.querySelectorAll('.partita-riga-admin').forEach((riga) => {
    const matchId = riga.dataset.match;
    riga.querySelector('.btn-salva-risultato').addEventListener('click', async () => {
      const gc = riga.querySelector(`#gc-${matchId}`).value;
      const gt = riga.querySelector(`#gt-${matchId}`).value;
      const nuoveGiornate = (_risultati.giornate || []).map((g) => ({
        ...g,
        partite: g.partite.map((p) => (p.id === matchId
          ? { ...p, golCasa: gc === '' ? null : Number(gc), golTrasferta: gt === '' ? null : Number(gt) }
          : p)),
      }));
      await patchRisultati({ giornate: nuoveGiornate });
      _risultati.giornate = nuoveGiornate;
      showToast('Risultato salvato', 'success');
    });
  });
}

// ── CONFIG ────────────────────────────────────────────────

function _bindEventiConfig(page) {
  page.querySelectorAll('#admin-giornate-apertura .admin-riga').forEach((riga) => {
    const numero = Number(riga.dataset.giornata);
    riga.querySelector('.btn-toggle-giornata')?.addEventListener('click', async () => {
      const giornata = (_risultati.giornate || []).find((g) => g.numero === numero);
      if (!giornata) return;
      const chiusa = giornata.aperta === false;
      const nuoveGiornate = (_risultati.giornate || []).map((g) => (
        g.numero === numero ? { ...g, aperta: chiusa } : g
      ));
      try {
        await patchRisultati({ giornate: nuoveGiornate });
        _risultati.giornate = nuoveGiornate;
        showToast(chiusa ? `Pronostici G${numero} riaperti` : `Pronostici G${numero} chiusi`, 'success');
        await _render();
      } catch (e) {
        showToast('Errore: ' + e.message, 'error');
      }
    });
  });
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

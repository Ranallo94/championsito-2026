/**
 * CHAMPIONSITO — app.js
 * Router principale e gestione stato globale
 */

import { initAuth, registra, getCurrentUser, onAuthChange, logout } from './auth.js';
import { initClassifica, cleanupClassifica } from './classifica.js';
import { initPronostici, cleanupPronostici } from './pronostici.js';
import { initAdmin } from './admin.js';

export const STATE = {
  utente: null,
  pagina: 'classifica',
  db: null,
  _appInizializzata: false,
};

export async function initApp() {
  STATE.db = window._firebase.db;

  onAuthChange(async (utente) => {
    if (!utente) {
      cleanupPronostici();
      cleanupClassifica();
      STATE._appInizializzata = false;
      STATE.utente = null;
      mostraLogin();
      return;
    }
    STATE.utente = utente;
    if (utente.disabilitato) {
      mostraDisabilitato(utente);
    } else if (!utente.approvato) {
      mostraAttesa(utente);
    } else {
      await mostraApp();
    }
  });

  document.getElementById('tab-accedi').addEventListener('click', () => {
    document.getElementById('tab-accedi').classList.add('active');
    document.getElementById('tab-registrati').classList.remove('active');
    document.getElementById('form-login').style.display = '';
    document.getElementById('form-registrazione').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('reg-error').style.display = 'none';
  });

  document.getElementById('tab-registrati').addEventListener('click', () => {
    document.getElementById('tab-registrati').classList.add('active');
    document.getElementById('tab-accedi').classList.remove('active');
    document.getElementById('form-registrazione').style.display = '';
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('reg-error').style.display = 'none';
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('login-error').style.display = 'none';
    const emailInput = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!emailInput) { showLoginError('Inserisci la tua email.'); return; }
    try {
      await initAuth(emailInput, password);
    } catch (err) {
      showLoginError(_traduciErroreAuth(err.code) || 'Credenziali errate. Riprova.');
    }
  });

  document.getElementById('form-registrazione').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('reg-error').style.display = 'none';

    const nome = document.getElementById('reg-nome').value.trim();
    const cognome = document.getElementById('reg-cognome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const pw1 = document.getElementById('reg-password').value;
    const pw2 = document.getElementById('reg-password2').value;

    if (!nome || !cognome || !email || !telefono || !nickname) { showRegError('Compila tutti i campi.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showRegError('Inserisci un indirizzo email valido.'); return; }
    if (nickname.length < 2) { showRegError('Il nickname deve avere almeno 2 caratteri.'); return; }
    if (pw1 !== pw2) { showRegError('Le password non coincidono.'); return; }
    if (pw1.length < 6) { showRegError('La password deve avere almeno 6 caratteri.'); return; }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '⏳ Invio in corso…';

    try {
      await registra(nome, cognome, email, telefono, pw1, nickname);
    } catch (err) {
      showRegError(_traduciErroreAuth(err.code) || 'Errore nella registrazione. Riprova.');
      btn.disabled = false;
      btn.textContent = 'Invia richiesta di accesso';
    }
  });
}

function mostraLogin() {
  _nascondiTutto();
  document.getElementById('screen-login').style.display = '';
  document.getElementById('tab-accedi').classList.add('active');
  document.getElementById('tab-registrati').classList.remove('active');
  document.getElementById('form-login').style.display = '';
  document.getElementById('form-registrazione').style.display = 'none';
}

function mostraDisabilitato(utente) {
  _nascondiTutto();
  document.getElementById('screen-disabilitato').style.display = '';
  document.getElementById('disab-nome').textContent = `${utente.nome} ${utente.cognome || ''}`.trim();
  document.getElementById('btn-logout-disab').onclick = async () => { await logout(); };
}

function mostraAttesa(utente) {
  _nascondiTutto();
  document.getElementById('screen-attesa').style.display = '';
  document.getElementById('attesa-nome').textContent = `${utente.nome} ${utente.cognome || ''}`.trim();
  document.getElementById('attesa-telefono').textContent = utente.telefono || '—';
  document.getElementById('btn-logout-attesa').onclick = async () => { await logout(); };
}

async function mostraApp() {
  _nascondiTutto();
  document.getElementById('screen-app').style.display = '';

  const displayName = STATE.utente.nickname || STATE.utente.nome || '';
  document.getElementById('header-username').textContent = displayName;

  if (STATE.utente.isAdmin) {
    document.getElementById('nav-admin').style.display = '';
  }

  document.getElementById('btn-logout').addEventListener('click', async () => { await logout(); });

  document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigaA(btn.dataset.page));
  });

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const tabBar = tab.closest('.inner-tabs');
    if (!tabBar) return;
    tabBar.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const targetId = tab.dataset.tab;
    if (!targetId) return;
    const parent = tabBar.parentElement;
    parent.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    const target = document.getElementById(targetId);
    if (target) target.classList.add('active');
  });

  if (!STATE._appInizializzata) {
    STATE._appInizializzata = true;
    await initClassifica();
    await initPronostici();
    if (STATE.utente.isAdmin) await initAdmin();
  }

  navigaA('classifica');
}

function _nascondiTutto() {
  ['screen-login', 'screen-attesa', 'screen-disabilitato', 'screen-app'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

export function navigaA(pagina) {
  STATE.pagina = pagina;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === pagina);
  });
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const target = document.getElementById('page-' + pagina);
  if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
  if (pagina === 'admin' && STATE.utente?.isAdmin) {
    import('./admin.js').then((m) => m.initAdmin());
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = '';
}

function showRegError(msg) {
  const el = document.getElementById('reg-error');
  el.textContent = msg;
  el.style.display = '';
}

function _traduciErroreAuth(code) {
  const map = {
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/invalid-email': 'Email non valida.',
    'auth/email-already-in-use': 'Esiste già un account con questa email. Prova ad accedere.',
    'auth/weak-password': 'Password troppo corta. Minimo 6 caratteri.',
    'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
    'auth/invalid-credential': 'Credenziali errate. Controlla email e password.',
  };
  return map[code] || null;
}

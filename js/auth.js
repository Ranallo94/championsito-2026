/**
 * CHAMPIONSITO — auth.js
 * Autenticazione con Firebase (email reale + password), stesso flusso di
 * Wimbledino/Medusino/Formulito: registrazione -> approvato:false -> attesa
 * -> approvazione admin -> accesso.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const auth = () => window._firebase.auth;
const db = () => window._firebase.db;

let _utente = null;

export async function initAuth(email, password) {
  await signInWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
}

export async function registra(nome, cognome, email, telefono, password, nickname = '') {
  const emailClean = email.trim().toLowerCase();

  const cred = await createUserWithEmailAndPassword(auth(), emailClean, password);
  const uid = cred.user.uid;

  await setDoc(doc(db(), 'partecipanti', uid), {
    nome: nome.trim(),
    cognome: cognome.trim(),
    nickname: nickname.trim() || nome.trim(),
    telefono: telefono.trim(),
    email: emailClean,
    isAdmin: false,
    isOwner: false,
    approvato: false,
    disabilitato: false,
    richiestaAt: serverTimestamp(),
  });

  return { email: emailClean };
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth(), async (firebaseUser) => {
    if (!firebaseUser) {
      _utente = null;
      callback(null);
      return;
    }

    const uid = firebaseUser.uid;
    const snap = await getDoc(doc(db(), 'partecipanti', uid));

    if (!snap.exists()) {
      _utente = null;
      callback(null);
      return;
    }

    const data = snap.data();
    _utente = {
      id: uid,
      nome: data.nome,
      cognome: data.cognome || '',
      nickname: data.nickname || data.nome || '',
      telefono: data.telefono || '',
      email: data.email || '',
      isAdmin: data.isAdmin === true,
      isOwner: data.isOwner === true,
      approvato: data.approvato === true,
      disabilitato: data.disabilitato === true,
    };

    callback(_utente);
  });
}

export function getCurrentUser() {
  return _utente;
}

export async function logout() {
  await signOut(auth());
}

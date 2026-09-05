/**
 * CHAMPIONSITO — db.js
 * Astrazione Firestore: tutte le operazioni di lettura/scrittura passano da
 * qui. Collezioni: partecipanti, pronostici, risultati (singleton "ufficiali"),
 * classifica (singleton "snapshot", calcolata dalla Cloud Function), sistema
 * (singleton "config").
 */

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const db = () => window._firebase.db;

// ── PRONOSTICI ────────────────────────────────────────
// { segni: {matchId: '1'|'X'|'2'}, classificaFinale: [squadraId,...36],
//   bonus: {capocannoniere, assistman, cartellini}, updatedAt }

export async function getPronostici(uid) {
  const snap = await getDoc(doc(db(), 'pronostici', uid));
  return snap.exists() ? snap.data() : null;
}

export async function getTuttiPronostici() {
  const snap = await getDocs(collection(db(), 'pronostici'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function savePronostici(uid, dati) {
  await setDoc(doc(db(), 'pronostici', uid), {
    ...dati,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── RISULTATI ─────────────────────────────────────────
// { squadre: [{id,nome}], giornate: [{numero, partite:[{id,casa,trasferta,golCasa,golTrasferta}]}],
//   bonus: {capocannoniere, assistman, cartellini}, congelata: bool }

export async function getRisultati() {
  const snap = await getDoc(doc(db(), 'risultati', 'ufficiali'));
  return snap.exists() ? snap.data() : {};
}

export function onRisultatiSnapshot(callback) {
  return onSnapshot(doc(db(), 'risultati', 'ufficiali'), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export async function patchRisultati(patch) {
  await updateDoc(doc(db(), 'risultati', 'ufficiali'), patch);
}

export async function setRisultati(dati) {
  await setDoc(doc(db(), 'risultati', 'ufficiali'), {
    ...dati,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── CLASSIFICA (calcolata) ────────────────────────────

export async function getClassifica() {
  const snap = await getDoc(doc(db(), 'classifica', 'snapshot'));
  return snap.exists() ? (snap.data().partecipanti || []) : [];
}

export function onClassificaSnapshot(callback) {
  return onSnapshot(doc(db(), 'classifica', 'snapshot'), (snap) => {
    callback(snap.exists() ? (snap.data().partecipanti || []) : []);
  });
}

// ── PARTECIPANTI ──────────────────────────────────────

export async function getPartecipanti() {
  const snap = await getDocs(collection(db(), 'partecipanti'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updatePartecipante(uid, patch) {
  await updateDoc(doc(db(), 'partecipanti', uid), patch);
}

export async function deletePartecipante(uid) {
  await deleteDoc(doc(db(), 'partecipanti', uid));
}

// ── SISTEMA ───────────────────────────────────────────
// { pronostici_aperti: bool, ... }

export async function getSistema() {
  const snap = await getDoc(doc(db(), 'sistema', 'config'));
  return snap.exists() ? snap.data() : {};
}

export async function updateSistema(patch) {
  await setDoc(doc(db(), 'sistema', 'config'), patch, { merge: true });
}

export function onSistemaSnapshot(callback) {
  return onSnapshot(doc(db(), 'sistema', 'config'), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

/**
 * CHAMPIONSITO — functions/index.js
 * Cloud Functions per la Fase 1 (fase a campionato Champions League).
 *
 * Funzioni esportate:
 *   ricalcolaClassifica — trigger su risultati/ufficiali: ricalcola classifica/snapshot
 *   ricongelaClassifica — callable (solo admin): forza il ricalcolo (es. dopo una correzione)
 *   eliminaUtente       — callable (solo admin)
 */
'use strict';

const { onCall, HttpsError }       = require('firebase-functions/v2/https');
const { onDocumentWritten }        = require('firebase-functions/v2/firestore');
const { initializeApp }            = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth }                  = require('firebase-admin/auth');

const { calcolaPunteggio } = require('./punteggi.js');

initializeApp();
const db = getFirestore();
const REGION = 'europe-west1';

// ════════════════════════════════════════════════════════
// FUNZIONI ESPORTATE
// ════════════════════════════════════════════════════════

// 1. Ricalcolo classifica — su ogni scrittura di risultati/ufficiali
//    (inserimento manuale admin o, in futuro, sync automatica).
exports.ricalcolaClassifica = onDocumentWritten(
  { document: 'risultati/ufficiali', region: REGION },
  async (event) => {
    try {
      const data = event.data.after && event.data.after.data();
      if (!data) return;
      await _aggiornaClassifica(data);
    } catch (e) { console.error('[ricalcolaClassifica]', e.message); }
  }
);

// 2. Ricalcolo manuale (callable, solo admin) — utile subito dopo aver
//    corretto un pronostico o aggiunto/tolto un partecipante.
exports.ricongelaClassifica = onCall({ region: REGION }, async (request) => {
  await _assertAdmin(request);
  const snap = await db.doc('risultati/ufficiali').get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'risultati/ufficiali non esiste ancora.');
  await _aggiornaClassifica(snap.data());
  return { ok: true };
});

// 3. Elimina utente (callable, solo admin).
exports.eliminaUtente = onCall({ region: REGION }, async (request) => {
  await _assertAdmin(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid mancante.');
  await getAuth().deleteUser(uid);
  return { ok: true };
});

// ════════════════════════════════════════════════════════
// RICALCOLO CLASSIFICA
// ════════════════════════════════════════════════════════

async function _aggiornaClassifica(risultati) {
  const [pronSnap, partSnap] = await Promise.all([
    db.collection('pronostici').get(),
    db.collection('partecipanti').get(),
  ]);

  const nomi = {};
  const disabilitati = new Set();
  partSnap.docs.forEach((d) => {
    const { nome, cognome, nickname, disabilitato } = d.data();
    if (disabilitato) { disabilitati.add(d.id); return; }
    nomi[d.id] = nickname || [nome, cognome].filter(Boolean).join(' ') || d.id;
  });

  const partecipanti = pronSnap.docs
    .filter((d) => !disabilitati.has(d.id) && !!nomi[d.id])
    .map((d) => {
      const pr = d.data();
      const { totale, breakdown, spareggio, meta } = calcolaPunteggio(pr, risultati);
      return { id: d.id, nome: nomi[d.id] || d.id, totale, breakdown, spareggio, meta };
    });

  partecipanti.sort((a, b) => {
    if (b.totale !== a.totale) return b.totale - a.totale;
    const sa = a.spareggio || [], sb = b.spareggio || [];
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      if ((sb[i] || 0) !== (sa[i] || 0)) return (sb[i] || 0) - (sa[i] || 0);
    }
    return 0;
  });

  await db.doc('classifica/snapshot').set({
    partecipanti,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`[classifica] aggiornata — ${partecipanti.length} partecipanti`);
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

async function _assertAdmin(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Autenticazione richiesta.');
  const snap = await db.doc(`partecipanti/${uid}`).get();
  if (!snap.exists || !snap.data().isAdmin) {
    throw new HttpsError('permission-denied', 'Operazione riservata agli admin.');
  }
}

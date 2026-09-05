/**
 * CHAMPIONSITO — set-owner.js
 *
 * ⚠️ Non eseguire questo file dalla console del browser: firestore.rules
 * richiede isAdmin()==true per aggiornare QUALSIASI documento partecipanti
 * (te compreso) — quindi il primissimo admin non può auto-promuoversi
 * tramite l'app stessa, per costruzione (è la stessa protezione che poi
 * impedisce a un admin qualsiasi di rubare i privilegi di un altro).
 *
 * Il modo corretto per il primo bootstrap è uno dei due:
 *
 * OPZIONE A — Console Firebase (consigliata, zero setup aggiuntivo)
 *   1. Registrati nell'app con il tuo account (resti "in attesa di approvazione").
 *   2. Firebase Console → Firestore Database → collezione "partecipanti" →
 *      apri il documento con il tuo uid (lo trovi anche in Authentication →
 *      Users, colonna "User UID").
 *   3. Modifica i campi: approvato: true, isAdmin: true, isOwner: true.
 *   4. Salva. Ricarica l'app: sei admin.
 *
 * OPZIONE B — questo script, eseguito con Node e le credenziali admin
 * (utile se preferisci farlo da riga di comando invece che dalla Console):
 *   1. Firebase Console → ⚙️ Impostazioni progetto → Account di servizio →
 *      Genera nuova chiave privata → salva il JSON come
 *      ./service-account.json (NON committarlo — è già in .gitignore).
 *   2. npm install firebase-admin --no-save   (nella cartella CHAMPIONSITO)
 *   3. node set-owner.js tuaemail@esempio.com
 */
'use strict';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node set-owner.js <email>');
  process.exit(1);
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'service-account.json');
initializeApp({ credential: cert(require(serviceAccountPath)) });

(async () => {
  const user = await getAuth().getUserByEmail(email);
  await getFirestore().doc(`partecipanti/${user.uid}`).update({
    isAdmin: true,
    isOwner: true,
    approvato: true,
  });
  console.log(`✅ ${email} (${user.uid}) è ora admin protetto (isOwner).`);
})().catch((e) => { console.error(e.message); process.exit(1); });

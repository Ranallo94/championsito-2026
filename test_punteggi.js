/**
 * CHAMPIONSITO — test_punteggi.js
 * Script standalone (Node, nessuna dipendenza) che verifica functions/ranking.js
 * e functions/punteggi.js con un set di risultati fittizio ma interamente
 * deterministico (nessun pareggio in differenza reti, quindi zero ambiguità
 * di ordinamento), calcolando a mano il punteggio atteso.
 *
 * Uso: node test_punteggi.js   (dalla cartella CHAMPIONSITO)
 */
'use strict';

const path = require('path');
const assert = require('assert');
const { classificaSquadre, fasceDaOrdine } = require(path.join(__dirname, 'functions', 'ranking.js'));
const { calcolaPunteggio, TABELLA_PUNTI } = require(path.join(__dirname, 'functions', 'punteggi.js'));

// ── 36 squadre fittizie ────────────────────────────────
const N = 36;
const id = (i) => `sq${String(i).padStart(2, '0')}`;
const squadre = Array.from({ length: N }, (_, i) => ({ id: id(i + 1), nome: `Squadra ${i + 1}` }));

// ── Un'unica giornata, 18 partite: sqI (casa) vs sq(37-I) (trasferta),
//    vittoria casalinga con margine = I. Scelto apposta per rendere la
//    differenza reti di tutte le 36 squadre univoca (zero pareggi in dr),
//    così l'ordine finale è prevedibile al 100% e verificabile a mano.
const partite = [];
for (let i = 1; i <= 18; i++) {
  partite.push({ id: `g1_p${i}`, casa: id(i), trasferta: id(37 - i), golCasa: i, golTrasferta: 0 });
}
const giornate = [{ numero: 1, partite }];

// Ordine reale atteso (calcolato a mano, vedi commento nel PR/commit):
// 1-8:   sq18..sq11   (i vincitori con dr più alto, decrescente)
// 9-24:  sq10..sq01, sq36..sq31  (vincitori con dr più basso, poi perdenti con dr più alto)
// 25-36: sq30..sq19  (i perdenti con dr più basso)
const attesoOrdine = [
  ...[18, 17, 16, 15, 14, 13, 12, 11].map(id),
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(id),
  ...[36, 35, 34, 33, 32, 31].map(id),
  ...[30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19].map(id),
];
assert.strictEqual(attesoOrdine.length, 36);

const ordineReale = classificaSquadre(squadre, giornate);
const ordineRealeIds = ordineReale.map((s) => s.squadraId);
assert.deepStrictEqual(ordineRealeIds, attesoOrdine, 'classificaSquadre non produce l\'ordine atteso');
console.log('✅ classificaSquadre: ordine a 36 squadre corretto (zero ambiguità dr)');

const { top8, playoff, eliminate } = fasceDaOrdine(ordineRealeIds);
assert.strictEqual(top8.size, 8);
assert.strictEqual(playoff.size, 16);
assert.strictEqual(eliminate.size, 12);
console.log('✅ fasceDaOrdine: dimensioni 8 / 16 / 12 corrette');

// ── Risultati ufficiali completi (fase gironi "conclusa e congelata") ──
const risultati = {
  squadre,
  giornate,
  bonus: { capocannoniere: 'Mario Rossi', assistman: 'Luigi Bianchi', cartellini: id(5) },
  congelata: true,
};

// ── Pronostico: segni ──────────────────────────────────
// Indovina il segno delle prime 12 partite (tutte '1', casa vince — esatto
// per come sono costruiti i risultati), sbaglia le ultime 6 (segno 'X').
const segni = {};
partite.forEach((p, i) => { segni[p.id] = i < 12 ? '1' : 'X'; });

// ── Pronostico: classifica finale ──────────────────────
// Copia esatta dell'ordine reale, poi si scambiano due coppie per testare
// il punteggio parziale:
//  - scambio nel top8 (posizioni 0/1): stessa fascia, posizione sbagliata
//    per ENTRAMBE le squadre coinvolte -> fascia doppia, posizione zero per loro due.
//  - scambio fra ultimo del playoff (indice 23) e primo dell'eliminate (indice 24):
//    zona sbagliata per entrambe.
const classificaFinale = [...ordineRealeIds];
[classificaFinale[0], classificaFinale[1]] = [classificaFinale[1], classificaFinale[0]];
[classificaFinale[23], classificaFinale[24]] = [classificaFinale[24], classificaFinale[23]];

// ── Pronostico: bonus ───────────────────────────────────
// 2 indovinati su 3 (cartellini sbagliato).
const bonus = { capocannoniere: 'Mario Rossi', assistman: 'Luigi Bianchi', cartellini: id(9) };

const pron = { segni, classificaFinale, bonus };

const risultato = calcolaPunteggio(pron, risultati);

// ── Verifica attesi, a mano ────────────────────────────
const attesoSegno = 12 * TABELLA_PUNTI.segno; // 12 * 3 = 36
const attesoBonus = 2 * TABELLA_PUNTI.bonusFineFase; // 2 * 60 = 120

// Fascia/posizione: 34 squadre su 36 restano nella zona e posizione corrette
// (34 posizioni esatte, tutte nella propria fascia originale), le 4 coinvolte
// nei due scambi (indici 0,1,23,24) sbagliano la posizione esatta ma:
//  - indici 0/1 restano comunque nella zona top8 corretta (scambio interno)
//  - indici 23/24 finiscono nella zona sbagliata (scambio fra fasce diverse)
// Quindi: fascia indovinata per 34 (esatte) + 2 (0/1, zona giusta) = 36 su 36;
// posizione esatta per 32 (36 - 4 coinvolte nei due scambi).
let attesoFascia = 0, attesoPosizione = 0;
ordineRealeIds.forEach((sqId, i) => {
  const zona = i < 8 ? 'top8' : (i < 24 ? 'playoff' : 'eliminate');
  const scambiato01 = (i === 0 || i === 1);
  const scambiato2324 = (i === 23 || i === 24);
  if (scambiato2324) {
    // zona sbagliata -> niente fascia, niente posizione
    return;
  }
  attesoFascia += TABELLA_PUNTI.fascia[zona];
  if (!scambiato01) attesoPosizione += TABELLA_PUNTI.posizioneEsatta[zona];
});

assert.strictEqual(risultato.breakdown.segno, attesoSegno, `segno atteso ${attesoSegno}, ottenuto ${risultato.breakdown.segno}`);
assert.strictEqual(risultato.breakdown.bonus, attesoBonus, `bonus atteso ${attesoBonus}, ottenuto ${risultato.breakdown.bonus}`);
assert.strictEqual(risultato.breakdown.fascia, attesoFascia, `fascia attesa ${attesoFascia}, ottenuta ${risultato.breakdown.fascia}`);
assert.strictEqual(risultato.breakdown.posizione, attesoPosizione, `posizione attesa ${attesoPosizione}, ottenuta ${risultato.breakdown.posizione}`);

const attesoTotale = attesoSegno + attesoBonus + attesoFascia + attesoPosizione;
assert.strictEqual(risultato.totale, attesoTotale, `totale atteso ${attesoTotale}, ottenuto ${risultato.totale}`);

console.log('✅ calcolaPunteggio: segno, bonus, fascia, posizione e totale tutti corretti');
console.log('   breakdown:', risultato.breakdown, '→ totale', risultato.totale);

// ── Verifica gate "congelata" ───────────────────────────
const risultatiNonCongelati = { ...risultati, congelata: false };
const risultatoNonCongelato = calcolaPunteggio(pron, risultatiNonCongelati);
assert.strictEqual(risultatoNonCongelato.breakdown.fascia, 0, 'senza congelamento la fascia deve valere 0');
assert.strictEqual(risultatoNonCongelato.breakdown.posizione, 0, 'senza congelamento la posizione deve valere 0');
assert.strictEqual(risultatoNonCongelato.breakdown.segno, attesoSegno, 'il segno deve contare comunque, congelata o no');
console.log('✅ gate "congelata": fascia/posizione a 0 se la classifica non è ancora congelata');

console.log('\nTutti i test sono passati.');

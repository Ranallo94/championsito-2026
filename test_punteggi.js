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

// ── Pronostico: risultati esatti -> classifica prevista DERIVATA ────
// Dal 2026-09-05 la classifica prevista non è più ordinata a mano: viene
// ricavata dai risultati pronosticati (functions/ranking.js, classificaPrevista).
// Qui si pronosticano esattamente i risultati reali per tutte le partite,
// TRANNE le ultime due, dove si scambiano i margini:
//   p17 reale sq17 17-0 sq20  -> pronosticato 18-0
//   p18 reale sq18 18-0 sq19  -> pronosticato 17-0
// Effetto sulla classifica prevista rispetto a quella reale:
//   - sq17 e sq18 si scambiano le posizioni 1ª/2ª (entrambe top8: fascia
//     giusta, posizione sbagliata per entrambe)
//   - sq19 e sq20 si scambiano le posizioni 35ª/36ª (entrambe eliminate:
//     fascia giusta, posizione sbagliata per entrambe)
// Le altre 32 squadre restano identiche -> fascia 36/36, posizione 32/36.
// Nota: il segno di p17/p18 resta '1' sia pronosticato (segni sopra: solo le
// prime 12 sono '1') -> per queste due il segno pronosticato è 'X' (sbagliato)
// ma il risultato esatto sovrascrive la convenzione da segno, quindi la
// classifica prevista le vede comunque come vittorie casalinghe.
const risultatiEsatti = {};
partite.forEach((p, i) => {
  if (i === 16) risultatiEsatti[p.id] = { golCasa: 18, golTrasferta: 0 }; // p17
  else if (i === 17) risultatiEsatti[p.id] = { golCasa: 17, golTrasferta: 0 }; // p18
  else risultatiEsatti[p.id] = { golCasa: p.golCasa, golTrasferta: p.golTrasferta };
});

// ── Pronostico: bonus ───────────────────────────────────
// 2 indovinati su 3 (cartellini sbagliato).
const bonus = { capocannoniere: 'Mario Rossi', assistman: 'Luigi Bianchi', cartellini: id(9) };

const pron = { segni, risultatiEsatti, bonus };

// Verifica diretta della classifica prevista derivata
const { classificaPrevista } = require(path.join(__dirname, 'functions', 'ranking.js'));
const ordinePrevistoIds = classificaPrevista(pron, squadre, giornate).map((s) => s.squadraId);
const attesoPrevisto = [...ordineRealeIds];
[attesoPrevisto[0], attesoPrevisto[1]] = [attesoPrevisto[1], attesoPrevisto[0]];
[attesoPrevisto[34], attesoPrevisto[35]] = [attesoPrevisto[35], attesoPrevisto[34]];
assert.deepStrictEqual(ordinePrevistoIds, attesoPrevisto, 'classificaPrevista non deriva l\'ordine atteso dai risultati pronosticati');
console.log('✅ classificaPrevista: derivata dai risultati pronosticati, con gli scambi 1ª/2ª e 35ª/36ª attesi');

const risultato = calcolaPunteggio(pron, risultati);

// ── Verifica attesi, a mano ────────────────────────────
const attesoSegno = 12 * TABELLA_PUNTI.segno; // 12 * 3 = 36
const attesoBonus = 2 * TABELLA_PUNTI.bonusFineFase; // 2 * 60 = 120

// Fascia: tutte e 36 nella zona giusta. Posizione esatta: 32 su 36 (le 4
// squadre scambiate — indici 0,1,34,35 — sbagliano la posizione).
let attesoFascia = 0, attesoPosizione = 0;
ordineRealeIds.forEach((sqId, i) => {
  const zona = i < 8 ? 'top8' : (i < 24 ? 'playoff' : 'eliminate');
  const scambiata = (i === 0 || i === 1 || i === 34 || i === 35);
  attesoFascia += TABELLA_PUNTI.fascia[zona];
  if (!scambiata) attesoPosizione += TABELLA_PUNTI.posizioneEsatta[zona];
});

assert.strictEqual(risultato.breakdown.segno, attesoSegno, `segno atteso ${attesoSegno}, ottenuto ${risultato.breakdown.segno}`);
assert.strictEqual(risultato.breakdown.bonus, attesoBonus, `bonus atteso ${attesoBonus}, ottenuto ${risultato.breakdown.bonus}`);
assert.strictEqual(risultato.breakdown.fascia, attesoFascia, `fascia attesa ${attesoFascia}, ottenuta ${risultato.breakdown.fascia}`);
assert.strictEqual(risultato.breakdown.posizione, attesoPosizione, `posizione attesa ${attesoPosizione}, ottenuta ${risultato.breakdown.posizione}`);

const attesoEsatto = 16 * TABELLA_PUNTI.risultatoEsatto; // 16 risultati esatti giusti su 18 (vedi sotto)
const attesoTotale = attesoSegno + attesoEsatto + attesoBonus + attesoFascia + attesoPosizione;
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

// ── Verifica "risultato esatto" (nuova categoria, 2026-09-05) ──
// Nel pron sopra i risultati esatti coincidono con quelli reali per 16 partite
// su 18 (p17 e p18 hanno i margini scambiati). Il conteggio non deve
// dipendere dal segno (per p17/p18 il segno pronosticato è 'X', sbagliato).
assert.strictEqual(risultato.meta.risultatiEsattiIndovinati, 16, `attesi 16 risultati esatti indovinati, ottenuti ${risultato.meta.risultatiEsattiIndovinati}`);
assert.strictEqual(risultato.breakdown.risultatoEsatto, 16 * TABELLA_PUNTI.risultatoEsatto, 'breakdown.risultatoEsatto non coerente con TABELLA_PUNTI.risultatoEsatto');
console.log(`✅ risultato esatto: ${risultato.meta.risultatiEsattiIndovinati} indovinati su 18 → ${risultato.breakdown.risultatoEsatto} punti, calcolato indipendentemente dal segno`);

// ── Convenzione "solo segno" nella classifica prevista ──
// Pronostico con soli segni (niente risultato esatto): '1' -> 1-0, 'X' -> 1-1,
// '2' -> 0-1. Le partite senza alcun pronostico non contano.
const pronSoloSegni = { segni: { g1_p1: '1', g1_p2: 'X', g1_p3: '2' } };
const ordSoloSegni = classificaPrevista(pronSoloSegni, squadre, giornate);
const st = {}; ordSoloSegni.forEach((s) => { st[s.squadraId] = s; });
assert.deepStrictEqual([st[id(1)].punti, st[id(1)].gf, st[id(1)].gs, st[id(1)].giocate], [3, 1, 0, 1], "segno '1' deve valere 1-0");
assert.deepStrictEqual([st[id(2)].punti, st[id(2)].gf, st[id(2)].gs], [1, 1, 1], "segno 'X' deve valere 1-1");
assert.deepStrictEqual([st[id(3)].punti, st[id(34)].punti, st[id(34)].gf], [0, 3, 1], "segno '2' deve valere 0-1");
assert.strictEqual(st[id(4)].giocate, 0, 'partita non pronosticata non deve contare');
console.log('✅ classificaPrevista: convenzione da solo segno (1-0 / 1-1 / 0-1) e partite non pronosticate ignorate');

// ── Convenzione "solo segno" anche per i PUNTI del risultato esatto ──
// g1_p1 reale: sq01 1-0 sq36. Chi dà solo '1' vale 1-0 -> segno + esatto.
// g1_p2 reale: sq02 2-0 sq35. Chi dà solo '1' vale 1-0 -> solo segno.
const risSoloSegno = calcolaPunteggio({ segni: { g1_p1: '1', g1_p2: '1' } }, risultati);
assert.strictEqual(risSoloSegno.meta.segniIndovinati, 2);
assert.strictEqual(risSoloSegno.meta.risultatiEsattiIndovinati, 1, "solo segno '1' con reale 1-0 deve valere come risultato esatto");
assert.strictEqual(risSoloSegno.breakdown.risultatoEsatto, TABELLA_PUNTI.risultatoEsatto);
console.log('✅ risultato esatto: la convenzione da solo segno (1-0 / 1-1 / 0-1) vale anche per i +10');

// ── Sincronia fra functions/ranking.js (CJS) e js/ranking.js (ESM) ──
(async () => {
  const { pathToFileURL } = require('url');
  const esm = await import(pathToFileURL(path.join(__dirname, 'js', 'ranking.js')).href);
  const a = classificaPrevista(pron, squadre, giornate);
  const b = esm.classificaPrevista(pron, squadre, giornate);
  assert.deepStrictEqual(b, a, 'js/ranking.js e functions/ranking.js producono classifiche previste diverse');
  const ra = classificaSquadre(squadre, giornate);
  const rb = esm.classificaSquadre(squadre, giornate);
  assert.deepStrictEqual(rb, ra, 'js/ranking.js e functions/ranking.js producono classifiche reali diverse');
  assert.deepStrictEqual(esm.TABELLA_PUNTI, TABELLA_PUNTI, 'js/ranking.js TABELLA_PUNTI diversa da functions/punteggi.js');
  console.log('✅ js/ranking.js (browser) e functions/ranking.js (Cloud Functions) sono allineati, tabella punti inclusa');

  const esmP = await import(pathToFileURL(path.join(__dirname, 'js', 'punteggi.js')).href);
  for (const [pr, ris] of [[pron, risultati], [pron, risultatiNonCongelati], [pronSoloSegni, risultati]]) {
    assert.deepStrictEqual(esmP.calcolaPunteggio(pr, ris), calcolaPunteggio(pr, ris), 'js/punteggi.js e functions/punteggi.js danno punteggi diversi');
  }
  console.log('✅ js/punteggi.js (browser, ricalcolo admin) e functions/punteggi.js (Cloud Functions) danno gli stessi punteggi');
  console.log('\nTutti i test sono passati.');
})().catch((e) => { console.error(e); process.exit(1); });

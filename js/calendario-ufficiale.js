/**
 * CHAMPIONSITO — calendario-ufficiale.js
 * Squadre e calendario REALI della fase a campionato UEFA Champions League
 * 2026/27 (36 squadre, 8 giornate, sorteggio di Monaco del 27 agosto 2026),
 * pubblicati da UEFA.com il 3 settembre 2026.
 *
 * A differenza di calendario.js (generatore casuale "amichevole" usato finché
 * non avevamo il draw reale — vedi la sua intestazione), questi sono dati
 * FISSI: nessun algoritmo, solo il copia-incolla strutturato del calendario
 * ufficiale. Uso: admin.js li carica in un colpo solo con un bottone dedicato,
 * al posto di "incolla squadre" + "genera calendario".
 *
 * Se una squadra reale dovesse essere sostituita da un ripescaggio o un
 * problema di iscrizione UEFA prima dell'inizio, aggiorna qui nome/id e i
 * riferimenti nelle partite (cerca l'id sqXX in tutte le giornate).
 *
 * Fonti: UEFA.com "2026/27 Champions League: All the league phase fixtures"
 * (pubblicato 3 set 2026) e "League phase draw pots confirmed".
 */

export const SQUADRE_UFFICIALI = [
  { id: 'sq01', nome: 'Paris Saint-Germain' },
  { id: 'sq02', nome: 'Bayern Munich' },
  { id: 'sq03', nome: 'Real Madrid' },
  { id: 'sq04', nome: 'Liverpool' },
  { id: 'sq05', nome: 'Inter Milan' },
  { id: 'sq06', nome: 'Manchester City' },
  { id: 'sq07', nome: 'Arsenal' },
  { id: 'sq08', nome: 'Barcelona' },
  { id: 'sq09', nome: 'Atlético Madrid' },
  { id: 'sq10', nome: 'Borussia Dortmund' },
  { id: 'sq11', nome: 'Roma' },
  { id: 'sq12', nome: 'Sporting CP' },
  { id: 'sq13', nome: 'Aston Villa' },
  { id: 'sq14', nome: 'Porto' },
  { id: 'sq15', nome: 'Manchester United' },
  { id: 'sq16', nome: 'Club Brugge' },
  { id: 'sq17', nome: 'Real Betis' },
  { id: 'sq18', nome: 'PSV Eindhoven' },
  { id: 'sq19', nome: 'Feyenoord' },
  { id: 'sq20', nome: 'Lille' },
  { id: 'sq21', nome: 'Bodø/Glimt' },
  { id: 'sq22', nome: 'Napoli' },
  { id: 'sq23', nome: 'RB Leipzig' },
  { id: 'sq24', nome: 'Villarreal' },
  { id: 'sq25', nome: 'Fenerbahçe' },
  { id: 'sq26', nome: 'Shakhtar Donetsk' },
  { id: 'sq27', nome: 'Galatasaray' },
  { id: 'sq28', nome: 'Slavia Praha' },
  { id: 'sq29', nome: 'Slovan Bratislava' },
  { id: 'sq30', nome: 'VfB Stuttgart' },
  { id: 'sq31', nome: 'AEK Athens' },
  { id: 'sq32', nome: 'LASK' },
  { id: 'sq33', nome: 'Como' },
  { id: 'sq34', nome: 'Lens' },
  { id: 'sq35', nome: 'Viking' },
  { id: 'sq36', nome: 'Sabah' },
];

// [casaId, trasfertaId] per ciascuna delle 8 giornate, ordine e date come
// pubblicate da UEFA.com.
const _GIORNATE_RAW = [
  {
    numero: 1,
    dataLabel: '8–10 set 2026',
    coppie: [
      ['sq31', 'sq32'], ['sq16', 'sq13'], ['sq10', 'sq24'], ['sq14', 'sq06'],
      ['sq20', 'sq17'], ['sq03', 'sq05'], ['sq08', 'sq19'], ['sq30', 'sq35'],
      ['sq04', 'sq09'], ['sq01', 'sq29'], ['sq12', 'sq27'], ['sq22', 'sq07'],
      ['sq25', 'sq11'], ['sq18', 'sq26'], ['sq33', 'sq23'], ['sq02', 'sq21'],
      ['sq15', 'sq36'], ['sq28', 'sq34'],
    ],
  },
  {
    numero: 2,
    dataLabel: '13–14 ott 2026',
    coppie: [
      ['sq34', 'sq12'], ['sq36', 'sq28'], ['sq07', 'sq20'], ['sq09', 'sq15'],
      ['sq05', 'sq16'], ['sq27', 'sq08'], ['sq23', 'sq18'], ['sq35', 'sq02'],
      ['sq24', 'sq22'], ['sq19', 'sq33'], ['sq32', 'sq04'], ['sq11', 'sq03'],
      ['sq13', 'sq25'], ['sq26', 'sq31'], ['sq21', 'sq10'], ['sq06', 'sq01'],
      ['sq17', 'sq14'], ['sq29', 'sq30'],
    ],
  },
  {
    numero: 3,
    dataLabel: '20–21 ott 2026',
    coppie: [
      ['sq25', 'sq28'], ['sq36', 'sq10'], ['sq11', 'sq29'], ['sq14', 'sq18'],
      ['sq04', 'sq24'], ['sq06', 'sq31'], ['sq01', 'sq08'], ['sq22', 'sq21'],
      ['sq30', 'sq09'], ['sq33', 'sq15'], ['sq20', 'sq27'], ['sq13', 'sq35'],
      ['sq16', 'sq34'], ['sq02', 'sq07'], ['sq05', 'sq26'], ['sq03', 'sq23'],
      ['sq17', 'sq19'], ['sq12', 'sq32'],
    ],
  },
  {
    numero: 4,
    dataLabel: '3–4 nov 2026',
    coppie: [
      ['sq26', 'sq12'], ['sq27', 'sq30'], ['sq09', 'sq02'], ['sq08', 'sq13'],
      ['sq19', 'sq05'], ['sq21', 'sq20'], ['sq32', 'sq29'], ['sq15', 'sq11'],
      ['sq24', 'sq01'], ['sq31', 'sq03'], ['sq25', 'sq04'], ['sq10', 'sq17'],
      ['sq14', 'sq22'], ['sq18', 'sq16'], ['sq23', 'sq06'], ['sq34', 'sq33'],
      ['sq28', 'sq07'], ['sq35', 'sq36'],
    ],
  },
  {
    numero: 5,
    dataLabel: '24–25 nov 2026',
    coppie: [
      ['sq21', 'sq32'], ['sq27', 'sq13'], ['sq07', 'sq10'], ['sq33', 'sq31'],
      ['sq19', 'sq14'], ['sq06', 'sq22'], ['sq23', 'sq34'], ['sq03', 'sq18'],
      ['sq29', 'sq17'], ['sq36', 'sq08'], ['sq28', 'sq24'], ['sq09', 'sq35'],
      ['sq16', 'sq04'], ['sq05', 'sq30'], ['sq26', 'sq25'], ['sq20', 'sq02'],
      ['sq01', 'sq11'], ['sq12', 'sq15'],
    ],
  },
  {
    numero: 6,
    dataLabel: '8–9 dic 2026',
    coppie: [
      ['sq35', 'sq19'], ['sq24', 'sq36'], ['sq31', 'sq27'], ['sq11', 'sq12'],
      ['sq13', 'sq01'], ['sq08', 'sq06'], ['sq02', 'sq28'], ['sq15', 'sq23'],
      ['sq22', 'sq16'], ['sq17', 'sq33'], ['sq29', 'sq26'], ['sq07', 'sq03'],
      ['sq10', 'sq05'], ['sq32', 'sq25'], ['sq04', 'sq14'], ['sq18', 'sq09'],
      ['sq34', 'sq21'], ['sq30', 'sq20'],
    ],
  },
  {
    numero: 7,
    dataLabel: '19–20 gen 2027',
    coppie: [
      ['sq21', 'sq09'], ['sq27', 'sq19'], ['sq31', 'sq11'], ['sq13', 'sq10'],
      ['sq05', 'sq04'], ['sq14', 'sq28'], ['sq20', 'sq29'], ['sq03', 'sq32'],
      ['sq30', 'sq16'], ['sq25', 'sq24'], ['sq36', 'sq22'], ['sq33', 'sq01'],
      ['sq15', 'sq02'], ['sq23', 'sq26'], ['sq34', 'sq06'], ['sq17', 'sq07'],
      ['sq12', 'sq08'], ['sq35', 'sq18'],
    ],
  },
  {
    numero: 8,
    dataLabel: '27 gen 2027',
    coppie: [
      ['sq07', 'sq36'], ['sq11', 'sq20'], ['sq09', 'sq25'], ['sq10', 'sq31'],
      ['sq16', 'sq21'], ['sq02', 'sq17'], ['sq08', 'sq33'], ['sq26', 'sq03'],
      ['sq19', 'sq23'], ['sq32', 'sq14'], ['sq04', 'sq34'], ['sq06', 'sq12'],
      ['sq01', 'sq27'], ['sq18', 'sq30'], ['sq28', 'sq13'], ['sq22', 'sq35'],
      ['sq24', 'sq15'], ['sq29', 'sq05'],
    ],
  },
];

export const GIORNATE_UFFICIALI = _GIORNATE_RAW.map((g) => ({
  numero: g.numero,
  dataLabel: g.dataLabel,
  partite: g.coppie.map(([casa, trasferta], pi) => ({
    id: `g${g.numero}_p${pi + 1}`,
    casa,
    trasferta,
    golCasa: null,
    golTrasferta: null,
  })),
}));

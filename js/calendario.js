/**
 * CHAMPIONSITO — calendario.js
 * Generatore del calendario Fase 1: 36 squadre, 8 giornate, ogni squadra
 * incontra 8 avversarie diverse (mai due volte la stessa).
 *
 * Metodo: "circle method" per il round-robin completo (algoritmo classico,
 * n-1 turni con n=36 -> 35 turni, ciascuno un abbinamento perfetto delle 36
 * squadre, ogni coppia di squadre si incontra esattamente una volta in tutto
 * il round-robin). Si estraggono a caso 8 di questi 35 turni come le nostre
 * "giornate": essendo un sottoinsieme di un round-robin completo, ogni
 * squadra ha automaticamente 8 avversarie tutte diverse fra loro, per
 * costruzione — a differenza di un tentativo di generare un grafo 8-regolare
 * casuale e poi colorarlo in 8 turni (approccio scartato: la colorazione
 * greedy fallisce quasi sempre quando non c'è margine, cioè quando i colori
 * disponibili sono esattamente pari al grado del grafo).
 *
 * NON rispetta le fasce/pot ufficiali UEFA (nessuna Cloud Function o dato
 * ESPN qui codifica ancora il draw reale — vedi CLAUDE.md, domanda aperta
 * #3): è un calendario "amichevole" pensato per far partire la competizione
 * subito. Se in futuro si vuole il calendario reale, va sostituito qui il
 * corpo di generaGiornate mantenendo la stessa struttura di ritorno.
 */

const N_GIORNATE = 8;

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Round-robin completo col circle method.
 * @param {number} n  numero di squadre (indici 0..n-1), deve essere pari
 * @returns {Array} n-1 turni, ciascuno un array di coppie [a,b] (indici)
 */
function _roundRobinCompleto(n) {
  const turni = [];
  const fissa = 0;
  let ruota = Array.from({ length: n - 1 }, (_, i) => i + 1); // 1..n-1

  for (let r = 0; r < n - 1; r++) {
    const coppie = [[fissa, ruota[0]]];
    for (let i = 1; i < n / 2; i++) {
      coppie.push([ruota[i], ruota[n - 1 - i]]);
    }
    turni.push(coppie);
    // ruota di una posizione (il primo elemento va in fondo)
    ruota = [...ruota.slice(1), ruota[0]];
  }
  return turni;
}

function _assegnaCasaTrasferta(turni, n) {
  const homeCount = new Array(n).fill(0);
  return turni.map((coppie) => {
    const shuffled = [...coppie];
    _shuffle(shuffled);
    return shuffled.map(([a, b]) => {
      const [casa, trasferta] = homeCount[a] <= homeCount[b] ? [a, b] : [b, a];
      homeCount[casa]++;
      return { casaIdx: casa, trasfertaIdx: trasferta };
    });
  });
}

/**
 * Genera la struttura giornate pronta per risultati/ufficiali.giornate.
 * @param {Array} squadreIds  36 id squadra
 * @returns {Array} [{ numero, partite: [{ id, casa, trasferta, golCasa: null, golTrasferta: null }] }]
 */
export function generaGiornate(squadreIds, nGiornate = N_GIORNATE) {
  const n = squadreIds.length;
  if (n < 2 || n % 2 !== 0) throw new Error('Serve un numero pari di squadre.');
  if (nGiornate > n - 1) throw new Error(`Con ${n} squadre si possono generare al massimo ${n - 1} giornate.`);

  const tuttiITurni = _roundRobinCompleto(n);
  _shuffle(tuttiITurni);
  const turniScelti = tuttiITurni.slice(0, nGiornate);
  const conCasaTrasferta = _assegnaCasaTrasferta(turniScelti, n);

  return conCasaTrasferta.map((partite, gi) => ({
    numero: gi + 1,
    partite: partite.map((p, pi) => ({
      id: `g${gi + 1}_p${pi + 1}`,
      casa: squadreIds[p.casaIdx],
      trasferta: squadreIds[p.trasfertaIdx],
      golCasa: null,
      golTrasferta: null,
    })),
  }));
}

// Validatore completo del dataset MVP: 9 CSV + 2 file di configurazione JSON.
// Aggiunge validazione di:
//   - config.json: presenza dei parametri obbligatori da §0.3
//   - sinergie.json: presenza dei tag, soglia raggiungibile (densità >=3)

const fs = require('fs');
const { parse } = require('csv-parse/sync');

function parseCSV(path, fieldConfig) {
  const text = fs.readFileSync(path, 'utf-8');
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  return records.map((row, idx) => {
    const out = {};
    for (const [field, type] of Object.entries(fieldConfig)) {
      const raw = row[field];
      if (raw === undefined) throw new Error(`[${path}] riga ${idx + 2}: campo "${field}" mancante`);
      try { out[field] = convert(raw, type); }
      catch (e) { throw new Error(`[${path}] riga ${idx + 2}, campo "${field}": ${e.message}`); }
    }
    return out;
  });
}

function convert(raw, type) {
  if (type === 'string') return raw;
  if (type === 'string|null') return raw === '' ? null : raw;
  if (type === 'integer') {
    const n = parseInt(raw, 10);
    if (isNaN(n)) throw new Error(`non è un intero: "${raw}"`);
    return n;
  }
  if (type === 'integer|null') {
    if (raw === '') return null;
    const n = parseInt(raw, 10);
    if (isNaN(n)) throw new Error(`non è un intero: "${raw}"`);
    return n;
  }
  if (type === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`non è un booleano: "${raw}"`);
  }
  if (type === 'array<string>') {
    if (raw === '') return [];
    return raw.split('|');
  }
  if (type === 'json') {
    try { return JSON.parse(raw); }
    catch (e) { throw new Error(`JSON malformato: ${e.message}`); }
  }
  throw new Error(`tipo sconosciuto: ${type}`);
}

function estraiCarteReferenziate(payload) {
  const ids = [];
  if (!payload) return ids;
  if (payload.modifiche) {
    payload.modifiche.forEach(m => {
      if (m.operazione === 'aggiungi_carta' || m.operazione === 'rimuovi_carta') {
        if (typeof m.valore === 'string') ids.push(m.valore);
      }
    });
  }
  if (payload.rischio && payload.rischio.fallback) {
    ids.push(...estraiCarteReferenziate(payload.rischio.fallback));
  }
  return ids;
}

const errors = [];
const warnings = [];

// ====== CARICAMENTO CSV ======

const mondi = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/mondi.csv', {
  id: 'string', nome: 'string', elemento: 'string',
  descrizione_narrativa: 'string', regola_mondo: 'string',
  tag_luoghi: 'array<string>', tag_eventi: 'array<string>'
});
const luoghi = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/luoghi.csv', {
  id: 'string', nome: 'string', tag_mondo: 'string|null',
  tipo_nodo: 'string', descrizione_narrativa: 'string',
  effetto_meccanico: 'string', nemici_associati: 'array<string>',
  universale: 'boolean'
});
const eventi = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/eventi.csv', {
  id: 'string', nome: 'string', tag_mondo: 'string|null',
  trigger: 'string', testo_narrativo: 'string',
  scelta_A: 'json', scelta_B: 'json', universale: 'boolean'
});
const nemici = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/nemici.csv', {
  id: 'string', nome: 'string', tag_mondo: 'string|null',
  categoria: 'string', pv: 'integer', difesa: 'integer',
  danno_base: 'integer', comportamento: 'string',
  abilita_speciale: 'string|null', trigger_abilita: 'string|null',
  ricompensa_narrativa: 'string', tag_luogo: 'array<string>'
});
const oggetti = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/oggetti.csv', {
  id: 'string', nome: 'string', classe_preferita: 'string',
  costo_energia: 'integer', descrizione_narrativa: 'string',
  effetto_meccanico: 'string', tipo_oggetto: 'string',
  slot: 'string', valore_numerico: 'integer|null',
  tag_sinergia: 'array<string>', durata: 'string'
});
const twist = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/twist.csv', {
  id: 'string', nome: 'string', descrizione_narrativa: 'string',
  effetto_meccanico: 'string', timing: 'string', intensita: 'string'
});
const png = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/png.csv', {
  id: 'string', nome: 'string', tag_mondo: 'string|null',
  ruolo: 'string', descrizione_narrativa: 'string',
  effetto_passivo: 'string', effetto_attivo: 'string',
  mondo_preferito: 'string'
});
const attacchi = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/attacchi.csv', {
  id: 'string', nome: 'string', classe_preferita: 'string',
  costo_energia: 'integer', descrizione_narrativa: 'string',
  effetto_meccanico: 'string', target: 'string',
  valore_numerico: 'integer', tag_sinergia: 'array<string>',
  durata: 'string'
});
const abilita = parseCSV('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/abilita.csv', {
  id: 'string', nome: 'string', classe_preferita: 'string',
  costo_energia: 'integer', descrizione_narrativa: 'string',
  effetto_meccanico: 'string', target: 'string',
  valore_numerico: 'integer|null', tag_sinergia: 'array<string>',
  durata: 'string'
});

console.log("=== CARICAMENTO CSV ===");
console.log(`mondi:${mondi.length}, luoghi:${luoghi.length}, eventi:${eventi.length}, nemici:${nemici.length}`);
console.log(`oggetti:${oggetti.length}, twist:${twist.length}, png:${png.length}, attacchi:${attacchi.length}, abilita:${abilita.length}`);

// ====== NUOVO: config.json ======
console.log("\n=== config.json ===");
let config;
try {
  config = JSON.parse(fs.readFileSync('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/config.json', 'utf-8'));
  console.log("OK: caricato");
} catch (e) {
  errors.push(`config.json non parsabile: ${e.message}`);
  config = null;
}

if (config) {
  // Campi obbligatori da §0.3
  const requiredPaths = [
    'giocatori.min', 'giocatori.max',
    'pg.pv_iniziali', 'pg.pv_massimi', 'pg.energia_per_turno', 'pg.dimensione_mano', 'pg.dimensione_pila_iniziale',
    'run.nodi_totali', 'run.nodi_prima_di_boss', 'run.twist_min_nodi',
    'mappa.scelte_per_nodo', 'mappa.ramificazione'
  ];
  requiredPaths.forEach(path => {
    const parts = path.split('.');
    let v = config;
    for (const p of parts) {
      v = v ? v[p] : undefined;
    }
    if (v === undefined) errors.push(`config.json: manca il parametro "${path}"`);
    else console.log(`  ${path} = ${v}`);
  });

  // Coerenza interna
  if (config.giocatori && config.giocatori.min > config.giocatori.max) {
    errors.push(`config.json: giocatori.min (${config.giocatori.min}) > giocatori.max`);
  }
  if (config.pg && config.pg.pv_iniziali > config.pg.pv_massimi) {
    errors.push(`config.json: pg.pv_iniziali > pg.pv_massimi`);
  }
  if (config.run && config.run.nodi_prima_di_boss >= config.run.nodi_totali) {
    errors.push(`config.json: nodi_prima_di_boss deve essere < nodi_totali`);
  }
}

// ====== NUOVO: sinergie.json ======
console.log("\n=== sinergie.json ===");
let sinergie;
try {
  sinergie = JSON.parse(fs.readFileSync('/home/alexnaro/Scrivania/GliErrantiDelDestino/data/sinergie.json', 'utf-8'));
  console.log("OK: caricato");
} catch (e) {
  errors.push(`sinergie.json non parsabile: ${e.message}`);
  sinergie = null;
}

if (sinergie && sinergie.sinergie) {
  // Calcolo densità di ogni tag nel pool Erranti+Oggetti
  const tagCount = {};
  [...attacchi, ...abilita, ...oggetti].forEach(c => {
    (c.tag_sinergia || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; });
  });

  console.log("Sinergie definite e densità del tag corrispondente:");
  Object.entries(sinergie.sinergie).forEach(([tag, s]) => {
    const densita = tagCount[tag] || 0;
    const soglia = s.soglia || 3;
    const stato = densita >= soglia
      ? `OK (${densita} carte >= soglia ${soglia})`
      : `RAGGIUNGIBILE A FATICA (${densita} carte < soglia ${soglia})`;
    console.log(`  ${tag}: ${stato}`);
    console.log(`    bonus: ${s.bonus_descrizione}`);
    console.log(`    trigger: ${s.trigger_mode}`);
    if (densita < soglia) {
      warnings.push(`Sinergia "${tag}": solo ${densita} carte nel pool, soglia ${soglia} difficilmente raggiungibile`);
    }
  });

  // Schema check
  Object.entries(sinergie.sinergie).forEach(([tag, s]) => {
    if (typeof s.soglia !== 'number') errors.push(`Sinergia ${tag}: soglia mancante o non numerica`);
    if (!['una_volta_per_run', 'persistente'].includes(s.trigger_mode)) {
      errors.push(`Sinergia ${tag}: trigger_mode "${s.trigger_mode}" non valido`);
    }
    if (!s.bonus_descrizione) errors.push(`Sinergia ${tag}: bonus_descrizione mancante`);
    if (!s.effetto) errors.push(`Sinergia ${tag}: effetto mancante`);
  });
}

// ====== VALIDAZIONI CSV (come prima, sintetiche) ======

const luoghiIds = new Set(luoghi.map(l => l.id));
mondi.forEach(m => {
  m.tag_luoghi.forEach(id => { if (!luoghiIds.has(id)) errors.push(`Mondo ${m.id} -> luogo ${id} inesistente`); });
});
const eventiIds = new Set(eventi.map(e => e.id));
mondi.forEach(m => {
  m.tag_eventi.forEach(id => { if (!eventiIds.has(id)) errors.push(`Mondo ${m.id} -> evento ${id} inesistente`); });
});
const nemiciIds = new Set(nemici.map(n => n.id));
luoghi.forEach(l => {
  l.nemici_associati.forEach(id => { if (!nemiciIds.has(id)) errors.push(`Luogo ${l.id} -> nemico ${id} inesistente`); });
});
const oggettiIds = new Set(oggetti.map(o => o.id));
const attacchiIds = new Set(attacchi.map(a => a.id));
const abilitaIds = new Set(abilita.map(a => a.id));
const tutteCarteIds = new Set([...oggettiIds, ...attacchiIds, ...abilitaIds]);
eventi.forEach(e => {
  const refs = [...estraiCarteReferenziate(e.scelta_A), ...estraiCarteReferenziate(e.scelta_B)];
  refs.forEach(id => { if (!tutteCarteIds.has(id)) errors.push(`Evento ${e.id} -> carta ${id} inesistente`); });
});

// Validazioni enum minimali
const validClassi = ['guerriero', 'mago', 'ladro', 'guaritore', 'universale'];
[...attacchi, ...abilita, ...oggetti].forEach(c => {
  if (!validClassi.includes(c.classe_preferita)) errors.push(`Carta ${c.id}: classe_preferita non valida`);
});

// ====== ESITO ======
console.log("\n=== ESITO ===");
if (errors.length === 0) {
  console.log("OK: Nessun errore critico");
} else {
  console.log(`ERRORI: ${errors.length}`);
  errors.forEach(e => console.log(`  - ${e}`));
}
if (warnings.length > 0) {
  console.log(`WARNING: ${warnings.length}`);
  warnings.forEach(w => console.log(`  - ${w}`));
}

// ====== INVENTARIO FINALE ======
console.log("\n=== INVENTARIO FINALE DATASET MVP ===");
console.log(`CSV:`);
console.log(`  Mondi:    ${mondi.length}`);
console.log(`  Luoghi:   ${luoghi.length}`);
console.log(`  Eventi:   ${eventi.length}`);
console.log(`  Nemici:   ${nemici.length}`);
console.log(`  Oggetti:  ${oggetti.length}`);
console.log(`  Twist:    ${twist.length}`);
console.log(`  PNG:      ${png.length}`);
console.log(`  Attacchi: ${attacchi.length}`);
console.log(`  Abilità:  ${abilita.length}`);
const totale = mondi.length + luoghi.length + eventi.length + nemici.length +
  oggetti.length + twist.length + png.length + attacchi.length + abilita.length;
console.log(`  TOTALE:   ${totale} carte`);
console.log(`File di config:`);
console.log(`  config.json:    ${config ? 'OK' : 'MANCANTE'}`);
console.log(`  sinergie.json:  ${sinergie ? `OK (${Object.keys(sinergie.sinergie || {}).length} sinergie definite)` : 'MANCANTE'}`);

if (errors.length === 0) {
  console.log("\nDATASET MVP COMPLETO E COERENTE.");
  console.log("Il motore può essere costruito su questa base.");
}

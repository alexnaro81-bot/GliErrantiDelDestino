// =============================================================================
// Gli Erranti del Destino — strumenti/build_browser.js
// Step UI: genera web/motore_bundle.js da motore/*.js per uso nel browser.
//
// Cosa fa, per non-tecnici:
//   - Prende i 5 file del motore (setup, combattimento, esplorazione, ai_nemici,
//     eventi_mondo) e li unisce in un unico file che il browser puo' caricare
//     con un singolo <script>.
//   - Rimuove le parti specifiche di Node (require, module.exports, main block,
//     uso di fs/path) e le sostituisce con un sistema "modulo virtuale" che
//     funziona nel browser.
//   - Inserisce una versione browser di carica_dati() che usa fetch() al posto
//     di leggere file da disco.
//
// USO:
//   node strumenti/build_browser.js
//
// OUTPUT:
//   web/motore_bundle.js  (il file unico per il browser)
//
// Ogni volta che modifichi un file in motore/, rilancia questo script per
// rigenerare il bundle.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOTORE_DIR = path.join(ROOT, 'motore');
const WEB_DIR = path.join(ROOT, 'web');
const OUTPUT_FILE = path.join(WEB_DIR, 'motore_bundle.js');

// Ordine di concatenazione: prima i moduli senza dipendenze, poi quelli che
// dipendono da altri. Il primo (setup) esporta rng/rng_int/mescola usati ovunque.
const MODULI = [
    { file: 'setup.js',         nome: 'Setup' },
    { file: 'ai_nemici.js',     nome: 'AiNemici' },
    { file: 'eventi_mondo.js',  nome: 'EventiMondo' },
    { file: 'combattimento.js', nome: 'Combattimento' },
    { file: 'esplorazione.js',  nome: 'Esplorazione' },
];

function pulisci_modulo(testo) {
    // Rimuove "'use strict';" iniziale (lo metteremo a livello bundle).
    testo = testo.replace(/^\s*['"]use strict['"];?\s*\n/, '');

    // I require di top-level vengono TRASFORMATI in alias dal namespace GED,
    // non rimossi. Cosi le dipendenze tra moduli (es. rng da setup, usato in
    // esplorazione) continuano a funzionare nel browser dove tutto vive nello
    // stesso namespace globale.
    // Esempio: const { rng, mescola } = require('./setup')
    //   ->     const { rng, mescola } = GED
    testo = testo.replace(
        /^(\s*const\s*\{[^}]+\}\s*=\s*)require\(['"][^'"]+['"]\)(;?\s*)$/gm,
        '$1GED$2'
    );
    testo = testo.replace(
        /^(\s*const\s+\w+\s*=\s*)require\(['"][^'"]+['"]\)(;?\s*)$/gm,
        '$1GED$2'
    );

    // Require inline dentro le funzioni: stessa trasformazione.
    // Esempio: const { trigger_X } = require('./eventi_mondo');
    //   ->     const { trigger_X } = GED;
    testo = testo.replace(/require\(['"]\.\/[^'"]+['"]\)/g, 'GED');

    // Rimuove il blocco "if (require.main === module) { ... }" che e' il main
    // Node, inutile nel browser. Trovo il blocco da `if (require.main === module) {`
    // fino alla chiusura della graffa corrispondente, contando le aperture.
    const start_marker = 'if (require.main === module) {';
    const idx = testo.indexOf(start_marker);
    if (idx !== -1) {
        let depth = 1;
        let i = idx + start_marker.length;
        while (i < testo.length && depth > 0) {
            if (testo[i] === '{') depth++;
            else if (testo[i] === '}') depth--;
            i++;
        }
        testo = testo.substring(0, idx) + testo.substring(i);
    }

    // Sostituisce `module.exports = { ... };` con `GED_EXPORTS = { ... };`
    // per esporre i nomi a livello bundle.
    testo = testo.replace(/module\.exports\s*=\s*/, 'var GED_EXPORTS = ');

    return testo.trim();
}

function genera_bundle() {
    if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });

    let out = '';
    out += '// =============================================================================\n';
    out += '// Gli Erranti del Destino — motore_bundle.js\n';
    out += '// AUTOGENERATO da strumenti/build_browser.js. Non modificare a mano.\n';
    out += '// Per rigenerarlo: node strumenti/build_browser.js\n';
    out += '// =============================================================================\n';
    out += '\n"use strict";\n\n';
    out += '// Namespace globale unico. Tutte le funzioni del motore sono qui dentro.\n';
    out += 'window.GED = window.GED || {};\n';
    out += 'var GED = window.GED;\n\n';

    for (const m of MODULI) {
        const filepath = path.join(MOTORE_DIR, m.file);
        if (!fs.existsSync(filepath)) {
            throw new Error(`File mancante: ${filepath}`);
        }
        const contenuto = fs.readFileSync(filepath, 'utf8');
        const pulito = pulisci_modulo(contenuto);

        out += '// =============================================================================\n';
        out += `// MODULO: ${m.file}\n`;
        out += '// =============================================================================\n';
        out += '(function() {\n';
        out += '  var GED_EXPORTS = {};\n';
        out += pulito + '\n';
        out += '  // Copia tutti gli export nel namespace globale GED.\n';
        out += '  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }\n';
        out += '})();\n\n';
    }

    // Override di carica_dati per il browser: usa fetch invece di fs.
    out += `// =============================================================================
// carica_dati BROWSER: sostituisce la versione Node basata su fs/path con una
// versione che usa fetch() per leggere i CSV/JSON dalla cartella ../data/.
// =============================================================================
(function() {
  function _parse_csv(testo) {
    // Mini parser CSV che gestisce campi tra virgolette ed escape di virgolette
    // raddoppiate (es. "lui disse ""ciao"""). Adeguato per i nostri dati.
    var righe = [];
    var i = 0;
    var campo = '';
    var riga = [];
    var in_quote = false;
    while (i < testo.length) {
      var c = testo[i];
      if (in_quote) {
        if (c === '"' && testo[i+1] === '"') { campo += '"'; i += 2; continue; }
        if (c === '"') { in_quote = false; i++; continue; }
        campo += c; i++;
      } else {
        if (c === '"') { in_quote = true; i++; continue; }
        if (c === ',') { riga.push(campo); campo = ''; i++; continue; }
        if (c === '\\n' || c === '\\r') {
          if (campo !== '' || riga.length > 0) { riga.push(campo); righe.push(riga); }
          campo = ''; riga = [];
          if (c === '\\r' && testo[i+1] === '\\n') i++;
          i++; continue;
        }
        campo += c; i++;
      }
    }
    if (campo !== '' || riga.length > 0) { riga.push(campo); righe.push(riga); }
    if (righe.length === 0) return [];
    var header = righe[0].map(function(h) { return h.trim(); });
    var risultato = [];
    for (var r = 1; r < righe.length; r++) {
      var obj = {};
      for (var j = 0; j < header.length; j++) {
        obj[header[j]] = (righe[r][j] !== undefined ? righe[r][j] : '').trim();
      }
      risultato.push(obj);
    }
    return risultato;
  }

  // carica_dati_browser(base_url) -> Promise<DatabaseCarte>.
  // base_url = url relativo alla cartella data (es. "../data" o "data").
  GED.carica_dati_browser = async function(base_url) {
    async function fetch_csv(nome) {
      var resp = await fetch(base_url + '/' + nome);
      if (!resp.ok) throw new Error('Impossibile caricare ' + nome + ': ' + resp.status);
      var testo = await resp.text();
      return _parse_csv(testo);
    }
    async function fetch_json(nome) {
      var resp = await fetch(base_url + '/' + nome);
      if (!resp.ok) throw new Error('Impossibile caricare ' + nome + ': ' + resp.status);
      return await resp.json();
    }

    // Riuso i parser interni del motore caricati nei moduli sopra. Pero' i
    // parser interni non sono esposti in module.exports: per il browser e'
    // piu' semplice riusare la logica direttamente. Per minimizzare la
    // duplicazione, uso una versione "duck-typed" dei record letti dal CSV
    // (senza validazione enum stretta: validero' a posteriori se serve).
    var mondi    = await fetch_csv('mondi.csv');
    var luoghi   = await fetch_csv('luoghi.csv');
    var eventi   = await fetch_csv('eventi.csv');
    var twist    = await fetch_csv('twist.csv');
    var png      = await fetch_csv('png.csv');
    var attacchi = await fetch_csv('attacchi.csv');
    var abilita  = await fetch_csv('abilita.csv');
    var equipaggiamenti = await fetch_csv('equipaggiamenti.csv');
    var consumabili     = await fetch_csv('consumabili.csv');
    var nemici   = await fetch_csv('nemici.csv');
    var config   = await fetch_json('config.json');
    var sinergie = await fetch_json('sinergie.json');

    // Conversioni di tipo: array<string> via pipe, integer via parseInt, etc.
    function arr(v) { return (v === '' || v == null) ? [] : v.split('|').map(s => s.trim()).filter(Boolean); }
    function intg(v) { return parseInt(v, 10); }
    function intg_null(v) { var n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }
    function nul(v) { return (v === '' || v == null) ? null : v; }
    function bool(v) { return v === 'true'; }

    mondi = mondi.map(r => ({
      id: r.id, nome: r.nome, elemento: r.elemento,
      descrizione_narrativa: r.descrizione_narrativa, regola_mondo: r.regola_mondo,
      tag_luoghi: arr(r.tag_luoghi), tag_eventi: arr(r.tag_eventi),
    }));
    luoghi = luoghi.map(r => ({
      id: r.id, nome: r.nome, tag_mondo: r.tag_mondo, tipo_nodo: r.tipo_nodo,
      descrizione_narrativa: r.descrizione_narrativa, effetto_meccanico: r.effetto_meccanico,
      nemici_associati: arr(r.nemici_associati), universale: bool(r.universale),
      // §1.3 v0.6: vuln/res del luogo, usati da pipeline_danno step 4.
      vulnerabilita_luogo: arr(r.vulnerabilita_luogo), resistenza_luogo: arr(r.resistenza_luogo),
    }));
    eventi = eventi.map(r => ({
      id: r.id, nome: r.nome, tag_mondo: r.tag_mondo, trigger: r.trigger,
      testo_narrativo: r.testo_narrativo,
      scelta_A: JSON.parse(r.scelta_A), scelta_B: JSON.parse(r.scelta_B),
      universale: bool(r.universale),
    }));
    twist = twist.map(r => ({
      id: r.id, nome: r.nome, descrizione_narrativa: r.descrizione_narrativa,
      effetto_meccanico: r.effetto_meccanico, timing: r.timing, intensita: r.intensita,
    }));
    png = png.map(r => ({
      id: r.id, nome: r.nome, tag_mondo: r.tag_mondo, ruolo: r.ruolo,
      descrizione_narrativa: r.descrizione_narrativa,
      effetto_passivo: r.effetto_passivo, effetto_attivo: r.effetto_attivo,
      mondo_preferito: r.mondo_preferito,
    }));
    attacchi = attacchi.map(r => ({
      id: r.id, nome: r.nome, classe_preferita: r.classe_preferita,
      costo_energia: intg(r.costo_energia), descrizione_narrativa: r.descrizione_narrativa,
      effetto_meccanico: r.effetto_meccanico, target: r.target,
      valore_numerico: intg(r.valore_numerico),
      // §1.7 v0.6: tag usato da pipeline_danno step 4 per match vuln/res.
      tag: arr(r.tag), tag_sinergia: arr(r.tag_sinergia),
      // §5.7 step 9: applica_status (JSON inline o null).
      applica_status: (r.applica_status && r.applica_status.trim() !== '') ? JSON.parse(r.applica_status) : null,
      ignora_difesa: bool(r.ignora_difesa), ignora_scudo: bool(r.ignora_scudo),
      salta_step_tag: bool(r.salta_step_tag),
      durata: r.durata, _tipo_carta: 'attacco',
    }));
    abilita = abilita.map(r => ({
      id: r.id, nome: r.nome, classe_preferita: r.classe_preferita,
      costo_energia: intg(r.costo_energia), descrizione_narrativa: r.descrizione_narrativa,
      effetto_meccanico: r.effetto_meccanico, target: r.target,
      valore_numerico: intg_null(r.valore_numerico),
      // §1.8 v0.6: tag (array), salta_step_tag, effetto_strutturato.
      tag: arr(r.tag), tag_sinergia: arr(r.tag_sinergia),
      salta_step_tag: bool(r.salta_step_tag),
      effetto_strutturato: (r.effetto_strutturato && r.effetto_strutturato !== '') ? JSON.parse(r.effetto_strutturato) : null,
      durata: r.durata, _tipo_carta: 'abilita',
    }));
    // §1.9 v0.6: equipaggiamenti (slot arma/armatura/talismano, livelli, forme finali).
    equipaggiamenti = equipaggiamenti.map(r => ({
      id: r.id, nome: r.nome, slot: r.slot,
      tag: arr(r.tag), livello: intg(r.livello) || 1,
      livello_max: intg(r.livello_max) || 3,
      stats_per_livello: JSON.parse(r.stats_per_livello),
      forme_finali: JSON.parse(r.forme_finali),
      classe_preferita: r.classe_preferita,
      descrizione_narrativa: r.descrizione_narrativa,
      tag_sinergia: arr(r.tag_sinergia),
      _tipo_carta: 'equipaggiamento',
    }));
    // §1.9bis v0.6: consumabili (carta a uso singolo, entra in pila).
    consumabili = consumabili.map(r => ({
      id: r.id, nome: r.nome, classe_preferita: r.classe_preferita,
      costo_energia: intg(r.costo_energia),
      descrizione_narrativa: r.descrizione_narrativa,
      effetto: JSON.parse(r.effetto), target: r.target,
      tag: arr(r.tag), tag_sinergia: arr(r.tag_sinergia),
      _tipo_carta: 'consumabile',
    }));
    nemici = nemici.map(r => ({
      id: r.id, nome: r.nome, tag_mondo: arr(r.tag_mondo), categoria: r.categoria,
      pv: intg(r.pv), difesa: intg(r.difesa), danno_base: intg(r.danno_base),
      comportamento: r.comportamento, abilita_speciale: nul(r.abilita_speciale),
      trigger_abilita: nul(r.trigger_abilita), ricompensa_narrativa: r.ricompensa_narrativa,
      tag_luogo: arr(r.tag_luogo),
      // §1.10 v0.6: vuln/res usati dalla pipeline_danno step 4 (§5.7).
      vulnerabilita: arr(r.vulnerabilita), resistenza: arr(r.resistenza),
      essenza_drop: arr(r.essenza_drop),
    }));

    return { mondi, luoghi, eventi, twist, png, attacchi, abilita, equipaggiamenti, consumabili, nemici, config, sinergie };
  };
})();
`;

    fs.writeFileSync(OUTPUT_FILE, out, 'utf8');
    console.log(`Bundle generato: ${OUTPUT_FILE}`);
    console.log(`Dimensione: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
}

genera_bundle();

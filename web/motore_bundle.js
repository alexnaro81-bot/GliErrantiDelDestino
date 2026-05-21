// =============================================================================
// Gli Erranti del Destino — motore_bundle.js
// AUTOGENERATO da strumenti/build_browser.js. Non modificare a mano.
// Per rigenerarlo: node strumenti/build_browser.js
// =============================================================================

"use strict";

// Namespace globale unico. Tutte le funzioni del motore sono qui dentro.
window.GED = window.GED || {};
var GED = window.GED;

// =============================================================================
// MODULO: setup.js
// =============================================================================
(function() {
  var GED_EXPORTS = {};
// =============================================================================
// Gli Erranti del Destino — motore/setup.js
// Step 2 della roadmap (§12 del regolamento v0.3): carica_dati + setup_partita.
// Niente combattimento, niente UI, niente eventi: solo bootstrap del GameState.
// Esecuzione: `node motore/setup.js` dalla root del progetto.
// =============================================================================

'use strict';

const fs = GED;
const path = GED;
const { parse } = GED;

// -----------------------------------------------------------------------------
// §9.1 — PRNG centralizzato (mulberry32). Tutta la casualita passa da qui.
// Lo stato del PRNG e un singolo intero a 32 bit e viene aggiornato a ogni call.
// Forma funzionale pura: (rng_state) -> { rng_state, valore in [0,1) }.
// -----------------------------------------------------------------------------
function rng(rng_state) {
    // Mulberry32: piccolo, deterministico, raccomandato dal regolamento §9.1.
    let t = (rng_state + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const valore = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // Nuovo stato = avanzamento di 1 step nel ciclo del PRNG.
    const rng_state_nuovo = (rng_state + 0x6D2B79F5) | 0;
    return { rng_state: rng_state_nuovo, valore };
}

// rng_int(rng_state, min, max_esclusivo) -> { rng_state, valore_intero }
function rng_int(rng_state, min, max_esclusivo) {
    const r = rng(rng_state);
    const valore = Math.floor(r.valore * (max_esclusivo - min)) + min;
    return { rng_state: r.rng_state, valore };
}

// -----------------------------------------------------------------------------
// Utilita: mescola e pesca_dal_pool. Entrambe pure: ritornano nuovo array
// + nuovo rng_state, senza mutare gli input.
// -----------------------------------------------------------------------------

// Fisher-Yates deterministico.
function mescola(array, rng_state) {
    const out = array.slice();
    let stato = rng_state;
    for (let i = out.length - 1; i > 0; i--) {
        const r = rng_int(stato, 0, i + 1);
        stato = r.rng_state;
        const j = r.valore;
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return { array: out, rng_state: stato };
}

// Pesca n elementi senza reinserimento (consuma il pool).
// Se n > pool.length, ritorna tutto cio che c'e (caller deve controllare).
function pesca_dal_pool(pool, n, rng_state) {
    const mix = mescola(pool, rng_state);
    const presi = mix.array.slice(0, Math.min(n, mix.array.length));
    return { presi, rng_state: mix.rng_state };
}

// Pesca n elementi CON reinserimento (duplicati ammessi).
// Usata in §3.3 per la pila iniziale: il pool per-classe del MVP e piccolo
// (4-5 carte), quindi servono ripetizioni per raggiungere le quote 60/30/10.
function pesca_con_reinserimento(pool, n, rng_state) {
    if (pool.length === 0) {
        return { presi: [], rng_state };
    }
    const presi = [];
    let stato = rng_state;
    for (let i = 0; i < n; i++) {
        const r = rng_int(stato, 0, pool.length);
        stato = r.rng_state;
        presi.push(pool[r.valore]);
    }
    return { presi, rng_state: stato };
}

// -----------------------------------------------------------------------------
// §1.11.1 — Convertitori di campo CSV -> tipo JSON.
// -----------------------------------------------------------------------------

function to_int(s, contesto) {
    if (s === '' || s === null || s === undefined) {
        throw new Error(`Campo intero mancante in ${contesto}`);
    }
    const n = parseInt(s, 10);
    if (Number.isNaN(n)) {
        throw new Error(`Campo intero non valido in ${contesto}: "${s}"`);
    }
    return n;
}

function to_int_nullable(s) {
    if (s === '' || s === null || s === undefined) return null;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
}

function to_bool(s, contesto) {
    if (s === 'true') return true;
    if (s === 'false') return false;
    throw new Error(`Campo boolean non valido in ${contesto}: "${s}" (atteso "true"/"false")`);
}

function to_array_pipe(s) {
    if (s === '' || s === null || s === undefined) return [];
    return s.split('|').map(x => x.trim()).filter(x => x.length > 0);
}

function to_string_nullable(s) {
    if (s === '' || s === null || s === undefined) return null;
    return s;
}

// Per le scelte degli eventi, che sono JSON inline tra virgolette nel CSV.
function to_json_inline(s, contesto) {
    if (s === '' || s === null || s === undefined) {
        throw new Error(`Campo JSON inline mancante in ${contesto}`);
    }
    try {
        return JSON.parse(s);
    } catch (e) {
        throw new Error(`Campo JSON inline non parsabile in ${contesto}: ${e.message}`);
    }
}

// -----------------------------------------------------------------------------
// Validatori per ogni schema (§1.2 - §1.10). Validano:
//   - presenza dei campi obbligatori,
//   - tipo elementare corretto,
//   - enum nei valori ammessi,
//   - unicita degli ID nel database.
// -----------------------------------------------------------------------------

const ENUM_ELEMENTO  = ['terra', 'aria', 'acqua', 'fuoco', 'oscurità'];
const ENUM_TIPO_NODO = ['combattimento', 'evento', 'riposo', 'tesoro', 'speciale'];
const ENUM_TRIGGER_EVT = ['esplorazione', 'combattimento', 'sempre'];
const ENUM_INTENSITA = ['bassa', 'media', 'alta'];
const ENUM_RUOLO_PNG = ['alleato', 'mercante', 'traditore', 'guida', 'boss_minore'];
const ENUM_CLASSE    = ['guerriero', 'mago', 'ladro', 'guaritore', 'universale'];
const ENUM_TARGET_ATK = ['nemico', 'tutti_nemici', 'nemico_casuale'];
const ENUM_TARGET_ABL = ['se', 'alleato', 'nemico', 'tutti', 'gruppo'];
const ENUM_DURATA_ABL = ['immediato', 'inizio_turno', 'fine_turno', 'permanente'];
const ENUM_TIPO_OBJ  = ['equipaggiamento', 'consumabile'];
const ENUM_SLOT_OBJ  = ['arma', 'armatura', 'accessorio', 'nessuno'];
const ENUM_DURATA_OBJ = ['permanente', 'immediato'];
const ENUM_CATEGORIA_NEM = ['comune', 'elite', 'boss'];
const ENUM_MONDO_PREF = ['terra', 'aria', 'acqua', 'fuoco', 'oscurità', 'tutti'];

function controlla_enum(valore, ammessi, contesto) {
    if (!ammessi.includes(valore)) {
        throw new Error(`Enum non valido in ${contesto}: "${valore}" (ammessi: ${ammessi.join(', ')})`);
    }
}

function controlla_id_unico(set_ids, id, contesto) {
    if (set_ids.has(id)) {
        throw new Error(`ID duplicato in ${contesto}: ${id}`);
    }
    set_ids.add(id);
}

// -----------------------------------------------------------------------------
// Parser specifici per ciascun CSV. Ognuno ritorna array<RecordTipato>.
// -----------------------------------------------------------------------------

function leggi_csv(filepath) {
    if (!fs.existsSync(filepath)) {
        throw new Error(`File CSV mancante: ${filepath}`);
    }
    const testo = fs.readFileSync(filepath, 'utf8');
    return parse(testo, {
        columns: true,        // prima riga = header
        skip_empty_lines: true,
        trim: true,
        bom: true,            // robusto a BOM UTF-8
    });
}

function parse_mondi(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `mondi.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^MONDO_[A-Z]{3,}$/.test(r.id)) {
            throw new Error(`ID mondo non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'mondi.csv');
        controlla_enum(r.elemento, ENUM_ELEMENTO, ctx + ' campo elemento');
        return {
            id: r.id,
            nome: r.nome,
            elemento: r.elemento,
            descrizione_narrativa: r.descrizione_narrativa,
            regola_mondo: r.regola_mondo,
            tag_luoghi: to_array_pipe(r.tag_luoghi),
            tag_eventi: to_array_pipe(r.tag_eventi),
        };
    });
}

function parse_luoghi(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `luoghi.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id) throw new Error(`ID luogo mancante in ${ctx}`);
        controlla_id_unico(ids, r.id, 'luoghi.csv');
        controlla_enum(r.tipo_nodo, ENUM_TIPO_NODO, ctx + ' campo tipo_nodo');
        return {
            id: r.id,
            nome: r.nome,
            tag_mondo: r.tag_mondo || '',
            tipo_nodo: r.tipo_nodo,
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            nemici_associati: to_array_pipe(r.nemici_associati),
            universale: to_bool(r.universale, ctx + ' campo universale'),
        };
    });
}

function parse_eventi(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `eventi.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id) throw new Error(`ID evento mancante in ${ctx}`);
        controlla_id_unico(ids, r.id, 'eventi.csv');
        controlla_enum(r.trigger, ENUM_TRIGGER_EVT, ctx + ' campo trigger');
        return {
            id: r.id,
            nome: r.nome,
            tag_mondo: r.tag_mondo || '',
            trigger: r.trigger,
            testo_narrativo: r.testo_narrativo,
            scelta_A: to_json_inline(r.scelta_A, ctx + ' campo scelta_A'),
            scelta_B: to_json_inline(r.scelta_B, ctx + ' campo scelta_B'),
            universale: to_bool(r.universale, ctx + ' campo universale'),
        };
    });
}

function parse_twist(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `twist.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id) throw new Error(`ID twist mancante in ${ctx}`);
        controlla_id_unico(ids, r.id, 'twist.csv');
        controlla_enum(r.intensita, ENUM_INTENSITA, ctx + ' campo intensita');
        return {
            id: r.id,
            nome: r.nome,
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            timing: r.timing,
            intensita: r.intensita,
        };
    });
}

function parse_png(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `png.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id) throw new Error(`ID PNG mancante in ${ctx}`);
        controlla_id_unico(ids, r.id, 'png.csv');
        controlla_enum(r.ruolo, ENUM_RUOLO_PNG, ctx + ' campo ruolo');
        controlla_enum(r.mondo_preferito, ENUM_MONDO_PREF, ctx + ' campo mondo_preferito');
        return {
            id: r.id,
            nome: r.nome,
            tag_mondo: r.tag_mondo || '',
            ruolo: r.ruolo,
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_passivo: r.effetto_passivo,
            effetto_attivo: r.effetto_attivo,
            mondo_preferito: r.mondo_preferito,
        };
    });
}

function parse_attacchi(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `attacchi.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^ATK_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID attacco non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'attacchi.csv');
        controlla_enum(r.classe_preferita, ENUM_CLASSE, ctx + ' campo classe_preferita');
        controlla_enum(r.target, ENUM_TARGET_ATK, ctx + ' campo target');
        if (r.durata !== 'immediato') {
            throw new Error(`CardAttacco con durata != immediato in ${ctx}`);
        }
        return {
            id: r.id,
            nome: r.nome,
            classe_preferita: r.classe_preferita,
            costo_energia: to_int(r.costo_energia, ctx + ' campo costo_energia'),
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            target: r.target,
            valore_numerico: to_int(r.valore_numerico, ctx + ' campo valore_numerico'),
            tag_sinergia: to_array_pipe(r.tag_sinergia),
            durata: 'immediato',
            _tipo_carta: 'attacco',  // helper per gioca_carta in step successivi
        };
    });
}

function parse_abilita(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `abilita.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^ABL_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID abilita non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'abilita.csv');
        controlla_enum(r.classe_preferita, ENUM_CLASSE, ctx + ' campo classe_preferita');
        controlla_enum(r.target, ENUM_TARGET_ABL, ctx + ' campo target');
        controlla_enum(r.durata, ENUM_DURATA_ABL, ctx + ' campo durata');
        return {
            id: r.id,
            nome: r.nome,
            classe_preferita: r.classe_preferita,
            costo_energia: to_int(r.costo_energia, ctx + ' campo costo_energia'),
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            target: r.target,
            valore_numerico: to_int_nullable(r.valore_numerico),
            tag_sinergia: to_array_pipe(r.tag_sinergia),
            durata: r.durata,
            _tipo_carta: 'abilita',
        };
    });
}

function parse_oggetti(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `oggetti.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^OBJ_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID oggetto non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'oggetti.csv');
        controlla_enum(r.classe_preferita, ENUM_CLASSE, ctx + ' campo classe_preferita');
        controlla_enum(r.tipo_oggetto, ENUM_TIPO_OBJ, ctx + ' campo tipo_oggetto');
        controlla_enum(r.slot, ENUM_SLOT_OBJ, ctx + ' campo slot');
        controlla_enum(r.durata, ENUM_DURATA_OBJ, ctx + ' campo durata');
        return {
            id: r.id,
            nome: r.nome,
            classe_preferita: r.classe_preferita,
            costo_energia: to_int(r.costo_energia, ctx + ' campo costo_energia'),
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            tipo_oggetto: r.tipo_oggetto,
            slot: r.slot,
            valore_numerico: to_int_nullable(r.valore_numerico),
            tag_sinergia: to_array_pipe(r.tag_sinergia),
            durata: r.durata,
            _tipo_carta: 'oggetto',
        };
    });
}

function parse_nemici(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `nemici.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^NEM_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID nemico non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'nemici.csv');
        controlla_enum(r.categoria, ENUM_CATEGORIA_NEM, ctx + ' campo categoria');
        const pv = to_int(r.pv, ctx + ' campo pv');
        if (pv < 1) throw new Error(`PV < 1 in ${ctx}`);
        return {
            id: r.id,
            nome: r.nome,
            tag_mondo: to_array_pipe(r.tag_mondo),
            categoria: r.categoria,
            pv,
            difesa: to_int(r.difesa, ctx + ' campo difesa'),
            danno_base: to_int(r.danno_base, ctx + ' campo danno_base'),
            comportamento: r.comportamento,
            abilita_speciale: to_string_nullable(r.abilita_speciale),
            trigger_abilita: to_string_nullable(r.trigger_abilita),
            ricompensa_narrativa: r.ricompensa_narrativa,
            tag_luogo: to_array_pipe(r.tag_luogo),
        };
    });
}

// -----------------------------------------------------------------------------
// §1.11.3 — carica_dati(): legge tutti i CSV + i due JSON, valida e ritorna
// l'oggetto DatabaseCarte. Errori = fatali (manca un file o un campo critico).
// -----------------------------------------------------------------------------
function carica_dati(dir_dati) {
    const base = path.resolve(dir_dati);
    if (!fs.existsSync(base)) {
        throw new Error(`Cartella dati non trovata: ${base}`);
    }
    console.log(`[carica_dati] Cartella dati: ${base}`);

    const files = {
        mondi:    path.join(base, 'mondi.csv'),
        luoghi:   path.join(base, 'luoghi.csv'),
        eventi:   path.join(base, 'eventi.csv'),
        twist:    path.join(base, 'twist.csv'),
        png:      path.join(base, 'png.csv'),
        attacchi: path.join(base, 'attacchi.csv'),
        abilita:  path.join(base, 'abilita.csv'),
        oggetti:  path.join(base, 'oggetti.csv'),
        nemici:   path.join(base, 'nemici.csv'),
        config:   path.join(base, 'config.json'),
        sinergie: path.join(base, 'sinergie.json'),
    };

    // Controllo presenza file in anticipo (errore singolo cumulativo).
    const mancanti = Object.entries(files).filter(([_, p]) => !fs.existsSync(p));
    if (mancanti.length > 0) {
        throw new Error('File dati mancanti: ' + mancanti.map(([k]) => k).join(', '));
    }

    const mondi    = parse_mondi(leggi_csv(files.mondi));
    console.log(`[carica_dati] mondi.csv: ${mondi.length} record OK`);
    const luoghi   = parse_luoghi(leggi_csv(files.luoghi));
    console.log(`[carica_dati] luoghi.csv: ${luoghi.length} record OK`);
    const eventi   = parse_eventi(leggi_csv(files.eventi));
    console.log(`[carica_dati] eventi.csv: ${eventi.length} record OK`);
    const twist    = parse_twist(leggi_csv(files.twist));
    console.log(`[carica_dati] twist.csv: ${twist.length} record OK`);
    const png      = parse_png(leggi_csv(files.png));
    console.log(`[carica_dati] png.csv: ${png.length} record OK`);
    const attacchi = parse_attacchi(leggi_csv(files.attacchi));
    console.log(`[carica_dati] attacchi.csv: ${attacchi.length} record OK`);
    const abilita  = parse_abilita(leggi_csv(files.abilita));
    console.log(`[carica_dati] abilita.csv: ${abilita.length} record OK`);
    const oggetti  = parse_oggetti(leggi_csv(files.oggetti));
    console.log(`[carica_dati] oggetti.csv: ${oggetti.length} record OK`);
    const nemici   = parse_nemici(leggi_csv(files.nemici));
    console.log(`[carica_dati] nemici.csv: ${nemici.length} record OK`);

    const config   = JSON.parse(fs.readFileSync(files.config, 'utf8'));
    console.log(`[carica_dati] config.json: versione regolamento ${config._versione_regolamento}`);
    const sinergie = JSON.parse(fs.readFileSync(files.sinergie, 'utf8'));
    console.log(`[carica_dati] sinergie.json: ${Object.keys(sinergie.sinergie || {}).length} sinergie definite`);

    // Validazione incrociata leggera: tutti i nemici_associati nei luoghi
    // devono esistere nel db nemici (warning, non fatal, perche il MVP
    // potrebbe avere placeholder).
    const ids_nemici = new Set(nemici.map(n => n.id));
    for (const l of luoghi) {
        for (const nid of l.nemici_associati) {
            if (!ids_nemici.has(nid)) {
                console.warn(`[carica_dati] WARN: luogo ${l.id} referenzia nemico inesistente ${nid}`);
            }
        }
    }

    return {
        mondi, luoghi, eventi, twist, png,
        attacchi, abilita, oggetti, nemici,
        config, sinergie,
    };
}

// -----------------------------------------------------------------------------
// §3.2 — costruisci_mappa(mondo, db, rng_state)
// Template fisso a 12 nodi. Distribuzione:
//   nodi 1..3 : combattimento | evento
//   nodo 4    : riposo
//   nodi 5..7 : combattimento | evento | tesoro
//   nodo 8    : riposo
//   nodi 9..11: combattimento (elite) | speciale
//   nodo 12   : boss (combattimento con nemico di categoria=boss)
//
// Nota MVP: il pool di luoghi e piccolo (6 per il mondo Foresta). Per
// rispettare il template, pesca CON reinserimento quando il pool per tipo
// si svuota. Documentato come scelta esplicita per il MVP.
// -----------------------------------------------------------------------------
function _scegli_luogo_per_tipo(luoghi_disponibili, tipi_ammessi, rng_state) {
    // Filtra per tipo_nodo ammesso.
    let candidati = luoghi_disponibili.filter(l => tipi_ammessi.includes(l.tipo_nodo));
    if (candidati.length === 0) {
        // Fallback: nessun luogo del tipo richiesto -> usa tutto il pool.
        candidati = luoghi_disponibili;
    }
    const r = rng_int(rng_state, 0, candidati.length);
    return { luogo: candidati[r.valore], rng_state: r.rng_state };
}

function _scegli_nemici_per_combattimento(luogo, db, categoria_richiesta, rng_state) {
    // Se il luogo ha nemici_associati, usali; altrimenti pesca dal pool nemici
    // filtrato per categoria + tag_mondo del luogo.
    let pool = [];
    if (luogo.nemici_associati.length > 0) {
        pool = luogo.nemici_associati
            .map(nid => db.nemici.find(n => n.id === nid))
            .filter(Boolean);
        if (categoria_richiesta) {
            const filtrato = pool.filter(n => n.categoria === categoria_richiesta);
            if (filtrato.length > 0) pool = filtrato;
        }
        // Per i combattimenti elite/boss, se il pool del luogo non contiene la
        // categoria richiesta, ricadi sul db globale.
        if (categoria_richiesta && pool.every(n => n.categoria !== categoria_richiesta)) {
            pool = db.nemici.filter(n => n.categoria === categoria_richiesta);
        }
    } else if (categoria_richiesta) {
        pool = db.nemici.filter(n => n.categoria === categoria_richiesta);
    } else {
        pool = db.nemici.slice();
    }
    if (pool.length === 0) {
        return { incontro: [], rng_state };
    }
    // Numero di nemici nel gruppo: 1-2 per comuni, 1 per elite/boss.
    let n_nemici = 1;
    if (!categoria_richiesta || categoria_richiesta === 'comune') {
        const r = rng_int(rng_state, 1, 3); // 1 o 2
        rng_state = r.rng_state;
        n_nemici = r.valore;
    }
    const incontro = [];
    for (let i = 0; i < n_nemici; i++) {
        const r = rng_int(rng_state, 0, pool.length);
        rng_state = r.rng_state;
        // Riferimento solo all'ID; istanziazione (PV correnti, istanza_id, ecc.)
        // avviene in fase di combattimento, non in setup.
        incontro.push(pool[r.valore].id);
    }
    return { incontro, rng_state };
}

function costruisci_mappa(mondo, db, rng_state) {
    const nodi_totali = db.config.run.nodi_totali;
    if (nodi_totali !== 12) {
        // Template attuale e hardcoded per 12; segnalo se config diverge.
        console.warn(`[costruisci_mappa] config.run.nodi_totali=${nodi_totali} ma template e per 12.`);
    }

    // §3.2 punto 1: pool luoghi = quelli del mondo + universali.
    const luoghi_pool = db.luoghi.filter(l => l.tag_mondo === mondo.id || l.universale);
    if (luoghi_pool.length === 0) {
        throw new Error(`Nessun luogo disponibile per il mondo ${mondo.id}`);
    }

    // Template per posizione (1-indexed nel commento, 0-indexed nell'array).
    const template = [
        { pos: 1,  tipi: ['combattimento', 'evento'], categoria: 'comune'  },
        { pos: 2,  tipi: ['combattimento', 'evento'], categoria: 'comune'  },
        { pos: 3,  tipi: ['combattimento', 'evento'], categoria: 'comune'  },
        { pos: 4,  tipi: ['riposo'],                  categoria: null      },
        { pos: 5,  tipi: ['combattimento', 'evento', 'tesoro'], categoria: 'comune' },
        { pos: 6,  tipi: ['combattimento', 'evento', 'tesoro'], categoria: 'comune' },
        { pos: 7,  tipi: ['combattimento', 'evento', 'tesoro'], categoria: 'comune' },
        { pos: 8,  tipi: ['riposo'],                  categoria: null      },
        { pos: 9,  tipi: ['combattimento', 'speciale'], categoria: 'elite' },
        { pos: 10, tipi: ['combattimento', 'speciale'], categoria: 'elite' },
        { pos: 11, tipi: ['combattimento', 'speciale'], categoria: 'elite' },
        { pos: 12, tipi: ['combattimento'],           categoria: 'boss'    },
    ];

    const nodi = [];
    let stato = rng_state;
    for (const slot of template) {
        const sel = _scegli_luogo_per_tipo(luoghi_pool, slot.tipi, stato);
        stato = sel.rng_state;
        const luogo = sel.luogo;

        // Per nodi di combattimento, scegli l'incontro nemico.
        let incontro = null;
        let evento_associato = null;
        if (luogo.tipo_nodo === 'combattimento' ||
            (luogo.tipo_nodo === 'speciale' && slot.categoria === 'boss')) {
            const sel_nem = _scegli_nemici_per_combattimento(luogo, db, slot.categoria, stato);
            stato = sel_nem.rng_state;
            incontro = sel_nem.incontro;
        } else if (slot.pos === 12) {
            // Nodo finale: garantisco boss anche se il luogo non e combattimento.
            const sel_nem = _scegli_nemici_per_combattimento(luogo, db, 'boss', stato);
            stato = sel_nem.rng_state;
            incontro = sel_nem.incontro;
        }

        // Per nodi evento, associo un evento dal pool del mondo + universali.
        if (luogo.tipo_nodo === 'evento') {
            const pool_evt = db.eventi.filter(e => e.tag_mondo === mondo.id || e.universale);
            if (pool_evt.length > 0) {
                const r = rng_int(stato, 0, pool_evt.length);
                stato = r.rng_state;
                evento_associato = pool_evt[r.valore].id;
            }
        }

        nodi.push({
            posizione: slot.pos,
            carta_luogo_id: luogo.id,
            tipo_nodo: luogo.tipo_nodo,
            stato: 'non_visitato',
            incontro,
            evento_associato,
            categoria_attesa: slot.categoria,  // utile per il boss check
        });
    }

    return { nodi, rng_state: stato };
}

// -----------------------------------------------------------------------------
// §3.3 — costruisci_pila_iniziale(classe, db, rng_state)
//
// REGOLA: 15 carte totali (config.pg.dimensione_pila_iniziale) cosi composte:
//   60% classe del PG     -> 9 carte
//   30% universale        -> 5 carte (arrotondo a 5; 30% di 15 = 4.5)
//   10% altra classe      -> 1 carta
//   Totale: 15
//
// Distribuzione consigliata per tipo (sul totale 15):
//   8 CardAttacco
//   5 CardAbilita
//   2 CardOggetto
//
// Combino le due dimensioni applicando la quota classe sulla quota tipo con
// arrotondamento sensato. Il pool MVP per-classe e piccolo: uso pesca CON
// reinserimento (duplicati ammessi) cosi il deck-building MVP funziona anche
// con 1 sola abilita per classe.
// -----------------------------------------------------------------------------
function costruisci_pila_iniziale(classe, db, rng_state) {
    if (!ENUM_CLASSE.includes(classe) || classe === 'universale') {
        throw new Error(`Classe non valida per pila iniziale: ${classe}`);
    }

    const totale = db.config.pg.dimensione_pila_iniziale; // 15

    // Quote per classe (60/30/10) e per tipo (8/5/2). Pre-calcolo:
    // - 8 attacchi totali -> 60% classe ~5, 30% universale ~2, 10% altra ~1
    // - 5 abilita totali  -> 60% classe ~3, 30% universale ~2, 10% altra ~0
    // - 2 oggetti totali  -> 60% classe ~1, 30% universale ~1, 10% altra ~0
    // Somme: classe = 9, universale = 5, altra = 1.
    const piano = [
        { tipo: 'attacco',  classe_pref: 5, universale: 2, altra: 1 },
        { tipo: 'abilita',  classe_pref: 3, universale: 2, altra: 0 },
        { tipo: 'oggetto',  classe_pref: 1, universale: 1, altra: 0 },
    ];

    // Verifica somma == totale (sanity check sul piano hardcoded).
    const somma = piano.reduce((s, p) => s + p.classe_pref + p.universale + p.altra, 0);
    if (somma !== totale) {
        throw new Error(`Piano pila iniziale somma ${somma} ma totale atteso ${totale}`);
    }

    const altre_classi = ENUM_CLASSE.filter(c => c !== classe && c !== 'universale');
    let stato = rng_state;

    function pool_per_tipo_e_classe(tipo, filtro_classe) {
        let pool = [];
        if (tipo === 'attacco')      pool = db.attacchi;
        else if (tipo === 'abilita') pool = db.abilita;
        else if (tipo === 'oggetto') pool = db.oggetti;
        if (filtro_classe === 'classe_pref') {
            return pool.filter(c => c.classe_preferita === classe);
        }
        if (filtro_classe === 'universale') {
            return pool.filter(c => c.classe_preferita === 'universale');
        }
        // altra: una qualunque classe diversa da `classe` e da universale.
        return pool.filter(c => altre_classi.includes(c.classe_preferita));
    }

    function pesca_quota(tipo, fascia, n) {
        if (n === 0) return [];
        let pool = pool_per_tipo_e_classe(tipo, fascia);
        if (pool.length === 0) {
            // Fallback: se manca la fascia richiesta, ricado sul pool del tipo
            // senza filtro di classe per non bloccare il setup.
            pool = pool_per_tipo_e_classe(tipo, 'universale');
            if (pool.length === 0) pool = pool_per_tipo_e_classe(tipo, 'classe_pref');
            if (pool.length === 0) {
                console.warn(`[costruisci_pila_iniziale] Pool vuoto per ${tipo}/${fascia}, skip ${n} carte`);
                return [];
            }
        }
        const r = pesca_con_reinserimento(pool.map(c => c.id), n, stato);
        stato = r.rng_state;
        return r.presi;
    }

    const carte_ids = [];
    for (const p of piano) {
        carte_ids.push(...pesca_quota(p.tipo, 'classe_pref', p.classe_pref));
        carte_ids.push(...pesca_quota(p.tipo, 'universale',  p.universale));
        carte_ids.push(...pesca_quota(p.tipo, 'altra',       p.altra));
    }

    return { pila: carte_ids, rng_state: stato };
}

// -----------------------------------------------------------------------------
// Costruzione di un singolo PGState (§2.2).
// -----------------------------------------------------------------------------
function _crea_pg(id, nome, classe, db, rng_state) {
    // §3.3
    const r_pila = costruisci_pila_iniziale(classe, db, rng_state);
    let stato = r_pila.rng_state;
    // §3.1 punto 5c: mescola.
    const r_mix = mescola(r_pila.pila, stato);
    stato = r_mix.rng_state;
    const pila_mescolata = r_mix.array;
    // §3.1 punto 5d: pesca la mano iniziale.
    const dim_mano = db.config.pg.dimensione_mano;
    const mano = pila_mescolata.slice(0, dim_mano);
    const pila = pila_mescolata.slice(dim_mano);

    const pv_max = db.config.pg.pv_massimi;
    const pv_iniziali = db.config.pg.pv_iniziali;

    return {
        pg: {
            id,
            nome,
            classe,
            pv: pv_iniziali,
            pv_max,
            energia: 0, // §3.1 punto 5e: energia=0 (il reset a inizio_turno e' in §5.2)
            mano,
            pila,
            scarti: [],
            campo: [],
            status: [],
            equipaggiamento: {
                arma: null,
                armatura: null,
                accessorio: null,
            },
            ko: false,
        },
        rng_state: stato,
    };
}

// -----------------------------------------------------------------------------
// §3.1 — setup_partita(numero_giocatori, seed?)
// Restituisce un GameState §2.1 completo (senza nemici_in_campo: il
// combattimento del primo nodo viene istanziato altrove allo step successivo).
// -----------------------------------------------------------------------------
function setup_partita(numero_giocatori, seed, dir_dati, opts) {
    // §3.1 precondizioni.
    if (typeof numero_giocatori !== 'number' || !Number.isInteger(numero_giocatori)) {
        throw new Error('numero_giocatori deve essere un intero');
    }

    // §3.1 punto 2: carica_dati() prima di tutto, cosi config e disponibile.
    const db = carica_dati(dir_dati);

    const min = db.config.giocatori.min;
    const max = db.config.giocatori.max;
    if (numero_giocatori < min || numero_giocatori > max) {
        throw new Error(`numero_giocatori=${numero_giocatori} fuori range [${min},${max}]`);
    }

    // §3.1 punto 1: meta + rng_state.
    let seed_effettivo = seed;
    if (seed_effettivo === null || seed_effettivo === undefined) {
        // Seed auto-generato dal clock solo se non passato.
        seed_effettivo = Date.now() & 0x7FFFFFFF;
    }
    let rng_state = seed_effettivo | 0;

    // I metadati temporali sono iniettabili via `opts` per garantire output
    // 100% deterministico nei test (stesso seed -> stesso GameState identico,
    // byte per byte). Se non forniti, fallback su clock reale per uso in produzione.
    const ora_iso = (opts && opts.now_iso) || new Date().toISOString();
    const meta = {
        run_id: (opts && opts.run_id) || `run_${seed_effettivo}`,
        seed: seed_effettivo,
        versione_regole: '0.3',
        timestamp_inizio: ora_iso,
    };

    // §3.1 punto 3: pesca 1 carta Mondo.
    const r_mondo = pesca_dal_pool(db.mondi, 1, rng_state);
    rng_state = r_mondo.rng_state;
    if (r_mondo.presi.length === 0) {
        throw new Error('Nessun mondo disponibile nel database');
    }
    const mondo = r_mondo.presi[0];
    console.log(`[setup_partita] Mondo scelto: ${mondo.nome} (${mondo.id}, elemento=${mondo.elemento})`);

    // §3.1 punto 4: costruisci mappa.
    const r_mappa = costruisci_mappa(mondo, db, rng_state);
    rng_state = r_mappa.rng_state;
    const mappa = {
        nodi: r_mappa.nodi,
        nodo_corrente: 0,
        nodi_visitati: [],
    };

    console.log('[setup_partita] Mappa generata:');
    for (const n of mappa.nodi) {
        const luogo = db.luoghi.find(l => l.id === n.carta_luogo_id);
        const incontro_txt = n.incontro && n.incontro.length > 0
            ? ` [nemici: ${n.incontro.join(', ')}]`
            : '';
        const evento_txt = n.evento_associato ? ` [evento: ${n.evento_associato}]` : '';
        console.log(`  Nodo ${String(n.posizione).padStart(2, ' ')}: ${n.tipo_nodo.padEnd(13, ' ')} - ${luogo ? luogo.nome : n.carta_luogo_id}${incontro_txt}${evento_txt}`);
    }

    // §3.1 punto 5: per ogni giocatore crea PGState.
    // MVP hardcoded: PG1 = guerriero, PG2 = mago, PG3 = ladro, PG4 = guaritore.
    const classi_mvp = ['guerriero', 'mago', 'ladro', 'guaritore'];
    const giocatori = [];
    for (let i = 0; i < numero_giocatori; i++) {
        const classe = classi_mvp[i % classi_mvp.length];
        const id_pg = `pg_${i + 1}`;
        const nome = `Errante ${i + 1}`;
        const r_pg = _crea_pg(id_pg, nome, classe, db, rng_state);
        rng_state = r_pg.rng_state;
        giocatori.push(r_pg.pg);
        console.log(`[setup_partita] ${id_pg}: classe=${classe} pv=${r_pg.pg.pv}/${r_pg.pg.pv_max} energia=${r_pg.pg.energia} mano=${r_pg.pg.mano.length} pila=${r_pg.pg.pila.length}`);
    }

    // §3.1 punto 6: log "partita_iniziata".
    const log_iniziale = [{
        id: 0,
        timestamp: meta.timestamp_inizio,
        tipo: 'fase_cambiata',
        attore: null,
        bersaglio: null,
        payload: { evento: 'partita_iniziata', seed: seed_effettivo, numero_giocatori },
        testo_narrativo: `La partita ha inizio nel mondo "${mondo.nome}". ${numero_giocatori} Erranti si incamminano verso il destino.`,
    }];

    // §3.1 punto 7-8: fase iniziale, turno_di, round.
    const state = {
        meta,
        config: db.config,
        mondo,
        mappa,
        giocatori,
        nemici_in_campo: [],
        png_in_gioco: [],
        twist_giocati: [],
        fase_corrente: 'esplorazione',
        turno_di: 0,
        round_numero: 1,
        log: log_iniziale,
        rng_state,
    };

    return state;
}

// =============================================================================
// MAIN — esegue setup_partita(2, 42) e stampa il GameState completo.
// Criterio di accettazione: stesso seed -> stesso output, byte per byte.
// =============================================================================


// Esporto le funzioni principali per uso da altri moduli/test futuri.
var GED_EXPORTS = {
    rng,
    rng_int,
    mescola,
    pesca_dal_pool,
    pesca_con_reinserimento,
    carica_dati,
    costruisci_mappa,
    costruisci_pila_iniziale,
    setup_partita,
};
  // Copia tutti gli export nel namespace globale GED.
  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }
})();

// =============================================================================
// MODULO: ai_nemici.js
// =============================================================================
(function() {
  var GED_EXPORTS = {};
// =============================================================================
// Gli Erranti del Destino — motore/ai_nemici.js
// Step 6 (§5.9 della roadmap §12, regolamento v0.3): pattern di comportamento
// dei nemici.
//
// Cosa fa questo file, in breve (per non-tecnici):
//   - Per ogni nemico in campo, decide CHI attaccare e COME attaccare.
//   - Ogni "pattern" e' una piccola funzione pura: prende il nemico + lo
//     stato del gioco + il database, e ritorna un'Azione con bersaglio,
//     danno e modificatori.
//   - I pattern singoli sono 6: Aggro, Tank, Support, Random, Vendicativo,
//     Esecutore. Il campo "comportamento" di una CardNemico puo' anche
//     contenere una combinazione tipo "Tank->Esecutore" (switch a meta' PV).
//
// L'azione ritornata viene poi eseguita da combattimento.js (§5.8).
// Questo file NON modifica lo state: si limita a SUGGERIRE l'azione. Cosi
// e' facile testarlo isolato e cambiarlo senza toccare il combattimento.
//
// PARKING LOT (non in questo step):
//   - abilita_speciale + trigger_abilita dei nemici (§5.8 punto 2c).
//     Esempio: Ladro della Foresta sotto 60% PV "sparisce nell'ombra".
//     Sara' un sistema separato: questa AI gestisce solo l'azione standard.
//   - Status applicati dai nemici come effetto secondario di un attacco
//     (non emergono dal regolamento §5.9 per i pattern base; sono nelle
//     abilita_speciale, vedi punto sopra).
// =============================================================================

'use strict';

const { rng_int } = GED;

// -----------------------------------------------------------------------------
// Struttura "Azione" ritornata da ogni pattern.
//   bersaglio_id : id del PG da colpire (string)
//   danno        : danno effettivo da infliggere (gia' modificato dal pattern)
//   ignora_difesa: true = la difesa del PG non riduce il danno (se PG ha difesa,
//                  non usato nel MVP ma documentato per coerenza con §5.9)
//   ignora_scudo : true = consuma il danno bypassando lo status scudo
//   azione_tipo  : "attacco" | "cura_alleato" | "buff_alleato" | "difesa"
//                  (i tipi non-attacco usano "bersaglio_id" come istanza_id
//                   di un nemico alleato o del nemico stesso)
//   note         : stringa narrativa che spiega cosa sta facendo il nemico
//   modificatori : oggetto opzionale con flag interni (es. difesa_x2)
//   rng_state    : stato del PRNG aggiornato (per Random e tie-break casuali)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Helper: bersagli validi = tutti i PG non KO.
// -----------------------------------------------------------------------------
function _pg_validi(state) {
    return state.giocatori.filter(p => !p.ko);
}

// Helper: tie-break deterministico via rng quando piu' PG hanno la stessa
// metrica. Ritorna { scelto, rng_state }.
function _tie_break(candidati, rng_state) {
    if (candidati.length === 0) return { scelto: null, rng_state };
    if (candidati.length === 1) return { scelto: candidati[0], rng_state };
    const r = rng_int(rng_state, 0, candidati.length);
    return { scelto: candidati[r.valore], rng_state: r.rng_state };
}

// Helper: danno standard del nemico. Per il MVP = nemico.carta.danno_base.
// Il dato vive nella CardNemico, non sull'istanza, quindi serve il db.
function _danno_base(nemico, db) {
    const carta = db.nemici.find(n => n.id === nemico.carta_id);
    if (!carta) throw new Error(`Carta nemico non trovata: ${nemico.carta_id}`);
    return carta.danno_base;
}

// Helper: pv_max effettivo del nemico (la sua istanza ha pv_max settato).
function _percentuale_pv(nemico) {
    return nemico.pv_max > 0 ? nemico.pv / nemico.pv_max : 0;
}

// =============================================================================
// PATTERN AGGRO (§5.9 riga 1)
//   Bersaglio: PG con PV minimi non KO.
//   Azione: attacco standard.
// =============================================================================
function _pattern_aggro(nemico, state, db, rng_state) {
    const validi = _pg_validi(state);
    if (validi.length === 0) return null;

    // Trova il minimo PV.
    const min_pv = Math.min(...validi.map(p => p.pv));
    const candidati = validi.filter(p => p.pv === min_pv);
    const t = _tie_break(candidati, rng_state);

    return {
        azione_tipo: 'attacco',
        bersaglio_id: t.scelto.id,
        danno: _danno_base(nemico, db),
        ignora_difesa: false,
        ignora_scudo: false,
        note: `${nemico.istanza_id} (Aggro) sceglie ${t.scelto.nome}, il PG più debole.`,
        modificatori: {},
        rng_state: t.rng_state,
    };
}

// =============================================================================
// PATTERN TANK (§5.9 riga 2)
//   Bersaglio: PG che ha colpito di piu' questo nemico (danno cumulativo).
//   Azione:
//     - se nemico.pv < 50% pv_max: difesa*2 e attacco ridotto (danno/2 arr. giu')
//     - altrimenti: attacco standard.
//   Nota: il dato "chi ha colpito di piu'" non esiste in §2.3. Per Tank serve
//   leggere nemico.danni_per_pg (mappa pg_id -> totale danni subiti). Lo
//   manteniamo aggiornato in combattimento.js (modifica minimale a §2.3
//   documentata come EXT_TRACK_DAMAGE; ricade dentro #EXT della §11).
// =============================================================================
function _pattern_tank(nemico, state, db, rng_state) {
    const validi = _pg_validi(state);
    if (validi.length === 0) return null;

    // Bersaglio = PG che ha inflitto piu' danno cumulativo a questo nemico.
    const danni = nemico.danni_per_pg || {};
    let pg_top = null;
    let max_danni = -1;
    for (const pg of validi) {
        const d = danni[pg.id] || 0;
        if (d > max_danni) { max_danni = d; pg_top = pg; }
    }
    // Se nessuno l'ha mai colpito (max_danni == 0), fallback su Aggro.
    if (!pg_top || max_danni === 0) {
        const fallback = _pattern_aggro(nemico, state, db, rng_state);
        if (fallback) fallback.note = `${nemico.istanza_id} (Tank, fallback Aggro) ${fallback.note.split(') ')[1] || ''}`;
        return fallback;
    }

    const pct = _percentuale_pv(nemico);
    if (pct < 0.5) {
        // Modalita' difensiva: difesa raddoppiata per questo turno, attacco
        // dimezzato (arrotondato giu').
        return {
            azione_tipo: 'attacco',
            bersaglio_id: pg_top.id,
            danno: Math.floor(_danno_base(nemico, db) / 2),
            ignora_difesa: false,
            ignora_scudo: false,
            note: `${nemico.istanza_id} (Tank, ferito) si protegge: difesa raddoppiata, attacco ridotto contro ${pg_top.nome}.`,
            modificatori: { difesa_x2_questo_turno: true },
            rng_state,
        };
    }
    return {
        azione_tipo: 'attacco',
        bersaglio_id: pg_top.id,
        danno: _danno_base(nemico, db),
        ignora_difesa: false,
        ignora_scudo: false,
        note: `${nemico.istanza_id} (Tank) attacca ${pg_top.nome}, chi gli ha fatto piu' male.`,
        modificatori: {},
        rng_state,
    };
}

// =============================================================================
// PATTERN SUPPORT (§5.9 riga 3)
//   Se ci sono altri nemici in campo: cura/buff il nemico alleato con PV piu'
//   bassi (compreso se stesso? Per coerenza con "alleato nemico", escludo se
//   stesso).
//   Altrimenti: attacco standard (Aggro).
// =============================================================================
function _pattern_support(nemico, state, db, rng_state) {
    const alleati = state.nemici_in_campo.filter(
        n => n.istanza_id !== nemico.istanza_id && n.pv > 0
    );
    if (alleati.length === 0) {
        const fallback = _pattern_aggro(nemico, state, db, rng_state);
        if (fallback) fallback.note = `${nemico.istanza_id} (Support, nessun alleato) ${fallback.note.split(') ')[1] || ''}`;
        return fallback;
    }

    // Trova alleato con PV piu' bassi.
    alleati.sort((a, b) => a.pv - b.pv);
    const target = alleati[0];

    // Cura: per il MVP la quantita' = danno_base del nemico (un buon proxy
    // della "potenza" del support). Si potra' parametrizzare in CSV.
    const cura = _danno_base(nemico, db);
    return {
        azione_tipo: 'cura_alleato',
        bersaglio_id: target.istanza_id,
        danno: cura,        // riusato come "valore" (cura)
        ignora_difesa: false,
        ignora_scudo: false,
        note: `${nemico.istanza_id} (Support) cura ${target.istanza_id} per ${cura} PV.`,
        modificatori: {},
        rng_state,
    };
}

// =============================================================================
// PATTERN RANDOM (§5.9 riga 4)
//   Bersaglio: PG casuale non KO.
//   Azione: attacco standard.
// =============================================================================
function _pattern_random(nemico, state, db, rng_state) {
    const validi = _pg_validi(state);
    if (validi.length === 0) return null;
    const r = rng_int(rng_state, 0, validi.length);
    const scelto = validi[r.valore];
    return {
        azione_tipo: 'attacco',
        bersaglio_id: scelto.id,
        danno: _danno_base(nemico, db),
        ignora_difesa: false,
        ignora_scudo: false,
        note: `${nemico.istanza_id} (Random) sceglie ${scelto.nome} a caso.`,
        modificatori: {},
        rng_state: r.rng_state,
    };
}

// =============================================================================
// PATTERN VENDICATIVO (§5.9 riga 5)
//   Bersaglio: ultimo PG che lo ha colpito (nemico.ultimo_colpito_da), oppure
//   casuale se non e' stato ancora colpito.
//   Azione: attacco standard + ignora_difesa se ha subito >50% pv_max
//   cumulativi.
// =============================================================================
function _pattern_vendicativo(nemico, state, db, rng_state) {
    const validi = _pg_validi(state);
    if (validi.length === 0) return null;

    let scelto = null;
    let nuovo_rng = rng_state;
    if (nemico.ultimo_colpito_da) {
        scelto = validi.find(p => p.id === nemico.ultimo_colpito_da) || null;
    }
    if (!scelto) {
        // Nessun ricordo (es. primo turno): fallback random.
        const r = rng_int(rng_state, 0, validi.length);
        scelto = validi[r.valore];
        nuovo_rng = r.rng_state;
    }

    // Soglia furia: ha subito piu' del 50% dei suoi pv_max?
    const danno_subito = nemico.pv_max - nemico.pv;
    const furia = danno_subito > (nemico.pv_max * 0.5);

    return {
        azione_tipo: 'attacco',
        bersaglio_id: scelto.id,
        danno: _danno_base(nemico, db),
        ignora_difesa: furia,    // §5.9: ignora_difesa se ferito >50%
        ignora_scudo: false,
        note: `${nemico.istanza_id} (Vendicativo${furia ? ', infuriato' : ''}) attacca ${scelto.nome}.`,
        modificatori: { furia },
        rng_state: nuovo_rng,
    };
}

// =============================================================================
// PATTERN ESECUTORE (§5.9 riga 6)
//   Bersaglio: PG con PV minimi non KO.
//   Azione: attacco standard. Se bersaglio.pv < 3: ignora la difesa del PG
//   (il PG non ha "difesa" come stat, ma se ha status scudo, lo bypassa).
// =============================================================================
function _pattern_esecutore(nemico, state, db, rng_state) {
    const validi = _pg_validi(state);
    if (validi.length === 0) return null;
    const min_pv = Math.min(...validi.map(p => p.pv));
    const candidati = validi.filter(p => p.pv === min_pv);
    const t = _tie_break(candidati, rng_state);
    const esecuzione = t.scelto.pv < 3;

    return {
        azione_tipo: 'attacco',
        bersaglio_id: t.scelto.id,
        danno: _danno_base(nemico, db),
        ignora_difesa: esecuzione,
        ignora_scudo: esecuzione,   // §5.9 dice "ignora difesa": estendo
                                     // anche allo scudo, coerente con "colpo
                                     // di grazia". Modificare qui se la
                                     // regola va interpretata in senso stretto.
        note: `${nemico.istanza_id} (Esecutore${esecuzione ? ', colpo di grazia' : ''}) attacca ${t.scelto.nome}.`,
        modificatori: { esecuzione },
        rng_state: t.rng_state,
    };
}

// =============================================================================
// DISPATCHER dei pattern.
// Mappa il nome del pattern alla funzione, gestendo "case-insensitive".
// =============================================================================
const PATTERN_FN = {
    'aggro':       _pattern_aggro,
    'tank':        _pattern_tank,
    'support':     _pattern_support,
    'random':      _pattern_random,
    'vendicativo': _pattern_vendicativo,
    'esecutore':   _pattern_esecutore,
};

function _risolvi_pattern_singolo(nome_pattern, nemico, state, db, rng_state) {
    const fn = PATTERN_FN[nome_pattern.toLowerCase()];
    if (!fn) {
        // Pattern sconosciuto: fallback su Aggro per sicurezza, ma logga warning.
        console.warn(`[ai_nemici] Pattern sconosciuto "${nome_pattern}", fallback Aggro.`);
        return _pattern_aggro(nemico, state, db, rng_state);
    }
    return fn(nemico, state, db, rng_state);
}

// =============================================================================
// COMBINAZIONI "PatternA->PatternB" (§5.9 ultima riga della tabella).
// "Lo schema e' data-driven, la logica e' uno switch":
//   - sopra 50% pv_max -> usa PatternA
//   - sotto 50% pv_max -> usa PatternB
// Il separatore puo' essere "->" oppure "→" (caso CSV).
// =============================================================================
function _split_comportamento(comportamento) {
    const norm = (comportamento || '').replace(/→/g, '->');
    if (norm.includes('->')) {
        const [a, b] = norm.split('->').map(s => s.trim());
        return { tipo: 'combo', a, b };
    }
    return { tipo: 'singolo', pattern: norm.trim() };
}

// =============================================================================
// API PUBBLICA
// =============================================================================

// esegui_comportamento(nemico, state, db) -> Azione | null
// L'azione e' un oggetto che combattimento.js usa per eseguire il danno o
// la cura. rng_state nell'azione e' quello aggiornato (importante: chi chiama
// DEVE assegnarlo a state.rng_state).
function esegui_comportamento(nemico, state, db) {
    if (!nemico || nemico.pv <= 0) return null;
    const parsed = _split_comportamento(nemico.comportamento || 'Aggro');
    if (parsed.tipo === 'singolo') {
        return _risolvi_pattern_singolo(parsed.pattern, nemico, state, db, state.rng_state);
    }
    // Combinazione: scegli A o B in base al PV.
    const pct = _percentuale_pv(nemico);
    const pattern_attivo = pct >= 0.5 ? parsed.a : parsed.b;
    return _risolvi_pattern_singolo(pattern_attivo, nemico, state, db, state.rng_state);
}

var GED_EXPORTS = {
    esegui_comportamento,
    // Esporto i singoli pattern per consentire test isolati e fallback custom.
    _pattern_aggro,
    _pattern_tank,
    _pattern_support,
    _pattern_random,
    _pattern_vendicativo,
    _pattern_esecutore,
    _split_comportamento,
};
  // Copia tutti gli export nel namespace globale GED.
  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }
})();

// =============================================================================
// MODULO: eventi_mondo.js
// =============================================================================
(function() {
  var GED_EXPORTS = {};
// =============================================================================
// Gli Erranti del Destino — motore/eventi_mondo.js
// Step 8 della roadmap §12, regolamento v0.3:
//   - §4.3 sistema Twist (imprevisti pescati durante l'esplorazione)
//   - §4.4 sistema PNG (personaggi non giocanti con effetti passivi/attivi)
//
// Cosa fa questo file, in breve (per non-tecnici):
//   - Quando il gruppo avanza a un nuovo nodo, c'e' una probabilita' che un
//     TWIST si manifesti (un imprevisto narrativo che cambia le carte in
//     tavola) e/o che un PNG (alleato, mercante, traditore) entri in scena.
//   - Twist e PNG vengono pescati una volta sola per run (no duplicati).
//   - Gli effetti vengono applicati come narrativa + flag meccanici sui PG.
//   - I trigger degli effetti attivi (es. Mercante che apre il commercio al
//     riposo, Alleato che salva un PG morente) sono integrati nei punti
//     giusti del motore (combattimento, esplorazione).
//
// PARKING LOT (volutamente fuori da questo step):
//   - Parsing strutturato degli effetti dei Twist: come per le carte, il
//     testo libero italiano non e' parsabile. Per ora applico solo i pochi
//     casi riconosciuti via regex (es. "PG perdono 1 EN") e logo il resto.
//     Si attivera' pienamente quando i twist avranno regola_strutturata
//     (§7.2). Marcato come PARKING_LOT_TWIST_AVANZATI.
//   - PNG con effetto_attivo non ancora coperti: si attiveranno quando
//     verranno aggiunti nuovi PNG al pool. Per ora gestisco i 3 del MVP.
// =============================================================================

'use strict';

const { rng, rng_int } = GED;

// -----------------------------------------------------------------------------
// Convenzione di mutabilita' (come in esplorazione.js):
//   - Lo state viene clonato UNA SOLA VOLTA all'inizio di ogni funzione esposta.
//   - _log_append modifica in place e ritorna lo stesso oggetto.
//   - Le funzioni interne lavorano in place.
// -----------------------------------------------------------------------------
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function _next_log_id(state) {
    return state.log.length > 0 ? state.log[state.log.length - 1].id + 1 : 0;
}

function _log_append(state, tipo, attore, bersaglio, payload, testo_narrativo) {
    state.log.push({
        id: _next_log_id(state),
        timestamp: state.meta.timestamp_inizio,
        tipo,
        attore: attore || null,
        bersaglio: bersaglio || null,
        payload: payload || {},
        testo_narrativo: testo_narrativo || '',
    });
    return state;
}

// =============================================================================
// §4.3 — Sistema Twist
//   valuta_twist(state, db): chiamata da avanza_nodo. Decide se pescare un
//   twist e lo applica come narrativa + flag meccanici.
// =============================================================================

// Mappa "timing" del CSV -> numero minimo di nodi.
// Esempi reali dai dati: "dopo_nodo_3", "dopo_nodo_4", "dopo_nodo_6".
function _twist_min_posizione(timing) {
    if (!timing) return 0;
    const m = timing.match(/dopo_nodo_(\d+)/);
    if (m) return parseInt(m[1], 10) + 1;  // "dopo_nodo_3" = attivabile dal nodo 4
    return 0;
}

// Mappa intensita' -> peso (i twist "bassi" sono piu' frequenti all'inizio).
function _peso_per_nodo(intensita, nodo_pos, totale_nodi) {
    // Prima meta' della run: privilegia bassa/media; seconda meta': alta.
    const meta = totale_nodi / 2;
    if (nodo_pos <= meta) {
        if (intensita === 'bassa') return 3;
        if (intensita === 'media') return 2;
        return 1;  // alta: rara nella prima meta'
    }
    if (intensita === 'alta')  return 3;
    if (intensita === 'media') return 2;
    return 1;
}

// Pesca pesata deterministica. peso_totale = somma dei pesi. Tira rng,
// scorri i candidati finche' non raggiungi la soglia.
function _pesca_pesata(candidati, pesi, rng_state) {
    if (candidati.length === 0) return { scelto: null, rng_state };
    const peso_tot = pesi.reduce((s, w) => s + w, 0);
    const r = rng(rng_state);
    let soglia = r.valore * peso_tot;
    for (let i = 0; i < candidati.length; i++) {
        soglia -= pesi[i];
        if (soglia <= 0) return { scelto: candidati[i], rng_state: r.rng_state };
    }
    return { scelto: candidati[candidati.length - 1], rng_state: r.rng_state };
}

// Applica i pochi effetti meccanici riconoscibili da regex sul testo del twist.
// Tutti gli altri restano come narrativa nel log.
// PARKING_LOT_TWIST_AVANZATI: quando i twist avranno regola_strutturata,
// rimpiazzare tutto questo blocco con valutazione del DSL.
function _applica_effetto_twist(state, twist) {
    const desc = (twist.effetto_meccanico || '').toLowerCase();

    // Pattern 1: "I PG perdono N EN al prossimo turno"
    let m = desc.match(/pg\s+perdono\s+(\d+)\s+en/);
    if (m) {
        const n = parseInt(m[1], 10);
        for (const pg of state.giocatori) {
            if (pg.ko) continue;
            pg._twist_malus_en_prossimo_turno = (pg._twist_malus_en_prossimo_turno || 0) + n;
        }
        return `Tutti i PG perderanno ${n} EN al prossimo turno.`;
    }

    // Pattern 2: "tutti i nemici dei prossimi N nodi guadagnano +M PV"
    m = desc.match(/nemici.+prossimi?\s+(\d+)\s+nod[io].+\+(\d+)\s+pv/);
    if (m) {
        const nodi = parseInt(m[1], 10);
        const bonus = parseInt(m[2], 10);
        state._twist_bonus_pv_nemici = { nodi_residui: nodi, bonus };
        return `Per i prossimi ${nodi} combattimenti, i nemici avranno +${bonus} PV.`;
    }

    // Pattern 3: "PG corrente scarta N carte casuali"
    m = desc.match(/pg\s+corrente\s+scarta\s+(\d+)\s+cart/);
    if (m) {
        const n = parseInt(m[1], 10);
        const pg = state.giocatori.find(p => !p.ko);
        if (pg) {
            let scartate = 0;
            for (let k = 0; k < n && pg.mano.length > 0; k++) {
                const r = rng_int(state.rng_state, 0, pg.mano.length);
                state.rng_state = r.rng_state;
                pg.scarti.push(pg.mano.splice(r.valore, 1)[0]);
                scartate++;
            }
            return `${pg.nome} scarta ${scartate} carte casuali.`;
        }
    }

    // Pattern 4 (curiosamente comune): "I PG curano N PV extra a fine round"
    m = desc.match(/pg\s+curano\s+(\d+)\s+pv\s+extra/);
    if (m) {
        const n = parseInt(m[1], 10);
        state._twist_cura_extra_fine_round = (state._twist_cura_extra_fine_round || 0) + n;
        return `I PG cureranno ${n} PV extra a fine round per i prossimi combattimenti.`;
    }

    // Nessuna corrispondenza: solo narrativa.
    return null;
}

// valuta_twist(state, db) -> state (in place).
// Da chiamare DOPO che state.mappa.nodo_corrente e' avanzato al nuovo nodo.
function valuta_twist(state, db) {
    const config = state.config;
    const nodo_pos = state.mappa.nodo_corrente + 1;  // 1-indexed
    if (nodo_pos < config.run.twist_min_nodi) return state;

    // Pool: twist non ancora usati + timing compatibile col nodo attuale.
    const disponibili = db.twist.filter(t =>
        !state.twist_giocati.includes(t.id) &&
        _twist_min_posizione(t.timing) <= nodo_pos
    );
    if (disponibili.length === 0) return state;

    // Tiro probabilita': 15% base.
    const r1 = rng(state.rng_state);
    state.rng_state = r1.rng_state;
    if (r1.valore >= 0.15) return state;

    // Pesca pesata per intensita'.
    const pesi = disponibili.map(t => _peso_per_nodo(t.intensita, nodo_pos, config.run.nodi_totali));
    const pesca = _pesca_pesata(disponibili, pesi, state.rng_state);
    state.rng_state = pesca.rng_state;
    if (!pesca.scelto) return state;
    const twist = pesca.scelto;

    state.twist_giocati.push(twist.id);
    const effetto_applicato = _applica_effetto_twist(state, twist);

    _log_append(state, 'twist_rivelato', null, null,
        { twist: twist.id, nome: twist.nome, intensita: twist.intensita,
          effetto_riconosciuto: effetto_applicato !== null },
        `TWIST: "${twist.nome}". ${twist.descrizione_narrativa}` +
        (effetto_applicato ? ` [Effetto: ${effetto_applicato}]` : ' [Effetto narrativo: nessun cambio meccanico]'));

    return state;
}

// =============================================================================
// §4.4 — Sistema PNG
//   valuta_apparizione_png(state, db): chiamata da avanza_nodo.
//   Decide se pescare un PNG e attiva il suo effetto passivo.
// =============================================================================

// Pesca pesata PNG: peso doppio se mondo_preferito == mondo attivo o "tutti".
function _pesca_png(state, db) {
    const png_id_in_gioco = new Set(state.png_in_gioco.map(p => p.id));
    const disponibili = db.png.filter(p => !png_id_in_gioco.has(p.id));
    if (disponibili.length === 0) return null;

    const mondo_attivo = state.mondo.elemento;
    const pesi = disponibili.map(p =>
        (p.mondo_preferito === mondo_attivo || p.mondo_preferito === 'tutti') ? 2 : 1
    );
    const pesca = _pesca_pesata(disponibili, pesi, state.rng_state);
    state.rng_state = pesca.rng_state;
    return pesca.scelto;
}

// valuta_apparizione_png(state, db) -> state (in place).
function valuta_apparizione_png(state, db) {
    const nodo = state.mappa.nodi[state.mappa.nodo_corrente];
    if (!nodo) return state;

    // Cuore della Foresta (LUO_FOR_06) = apparizione garantita per regolamento.
    const luogo = db.luoghi.find(l => l.id === nodo.carta_luogo_id);
    const garantito = luogo && luogo.id === 'LUO_FOR_06';

    // Probabilita': 25% normale, 40% per nodi speciali, 100% se garantito.
    let soglia = 0.25;
    if (nodo.tipo_nodo === 'speciale') soglia = 0.40;
    if (garantito) soglia = 1.0;

    const r = rng(state.rng_state);
    state.rng_state = r.rng_state;
    if (r.valore >= soglia) return state;

    const png = _pesca_png(state, db);
    if (!png) return state;

    // Istanzia il PNG con metadati di stato (nodi_da_arrivo per i traditori).
    const istanza = {
        id: png.id,
        nome: png.nome,
        ruolo: png.ruolo,
        mondo_preferito: png.mondo_preferito,
        effetto_passivo: png.effetto_passivo,
        effetto_attivo: png.effetto_attivo,
        nodi_da_arrivo: 0,        // contatore per Traditrice (§4.4)
        salvataggio_usato: false, // flag one-shot per Alleato (§4.4)
        commercio_disponibile: png.ruolo === 'mercante',
    };
    state.png_in_gioco.push(istanza);

    _log_append(state, 'png_apparso', null, null,
        { png: png.id, ruolo: png.ruolo, nome: png.nome },
        `PNG: "${png.nome}" (${png.ruolo}) entra in scena. ${png.descrizione_narrativa}` +
        ` [Effetto passivo: ${png.effetto_passivo}]`);

    return state;
}

// =============================================================================
// EFFETTI ATTIVI DEI PNG (§4.4 punto: "effetto_attivo innescato da trigger")
// Funzioni invocabili dal motore quando il trigger giusto si verifica.
// =============================================================================

// Trigger Alleato: chiamato da _applica_danno PRIMA di marcare KO un PG.
// Se Luna Alleata e' in gioco e non ha ancora usato il salvataggio, il PG
// resta a 1 PV invece di andare a 0. One-shot per run.
// Ritorna true se il salvataggio e' scattato (chi chiama mette PV a 1).
function trigger_salvataggio_alleato(state) {
    const luna = state.png_in_gioco.find(p => p.id === 'PNG_LUNA_ALLEATA' && !p.salvataggio_usato);
    if (!luna) return false;
    luna.salvataggio_usato = true;
    _log_append(state, 'png_apparso', null, null,
        { png: 'PNG_LUNA_ALLEATA', evento: 'salvataggio' },
        `Luna l'Alleata interviene: il PG resta in piedi a 1 PV. (Salvataggio one-shot consumato.)`);
    return true;
}

// Trigger Mercante: chiamato da risolvi_nodo_riposo se Mercante Corvo e' in
// gioco. Apre la fase di commercio (rappresentazione MVP: ogni PG riceve 1
// oggetto universale casuale dal pool, simulando uno "scambio").
// Sara' un vero scambio quando avremo UI (selezione 2 carte da scambiare).
function trigger_commercio_mercante(state, db) {
    const merc = state.png_in_gioco.find(p => p.id === 'PNG_CORVO_MERCANTE' && p.commercio_disponibile);
    if (!merc) return state;
    merc.commercio_disponibile = false;  // una sola volta per apparizione
    const pool = db.oggetti.filter(o => o.classe_preferita === 'universale');
    if (pool.length === 0) return state;
    for (let i = 0; i < state.giocatori.length; i++) {
        const pg = state.giocatori[i];
        if (pg.ko) continue;
        const r = rng_int(state.rng_state, 0, pool.length);
        state.rng_state = r.rng_state;
        const oggetto = pool[r.valore];
        pg.scarti.push(oggetto.id);
        _log_append(state, 'ricompensa', null, pg.id,
            { png: 'PNG_CORVO_MERCANTE', carta: oggetto.id },
            `Commercio col Mercante Corvo: ${pg.nome} acquisisce "${oggetto.nome}".`);
    }
    return state;
}

// Trigger Traditore: chiamato da avanza_nodo. Incrementa nodi_da_arrivo, e
// se raggiunge 3 attiva l'effetto attivo (danno diretto a chi ha pescato di
// piu', poi sparisce).
// MVP: non tracciamo "chi ha pescato di piu' grazie al passivo del PNG",
// quindi il bersaglio e' il PG con piu' carte in mano (proxy). Si raffina
// dopo se serve.
function trigger_tradimento(state, db) {
    const tr = state.png_in_gioco.find(p => p.id === 'PNG_OMBRA_TRADITRICE');
    if (!tr) return state;
    tr.nodi_da_arrivo += 1;
    if (tr.nodi_da_arrivo < 3) return state;

    // Si attiva: 10 danno diretti a un PG (ignora difesa, scudi).
    const candidati = state.giocatori.filter(p => !p.ko);
    if (candidati.length === 0) return state;
    candidati.sort((a, b) => b.mano.length - a.mano.length);
    const vittima = candidati[0];
    vittima.pv = Math.max(0, vittima.pv - 10);
    _log_append(state, 'danno_inflitto', 'PNG_OMBRA_TRADITRICE', vittima.id,
        { danno: 10, ignora_difesa: true, ignora_scudo: true },
        `L'Ombra Traditrice rivela la sua natura: ${vittima.nome} subisce 10 danni diretti. Poi l'Ombra svanisce.`);
    if (vittima.pv === 0) {
        vittima.ko = true;
        _log_append(state, 'ko', null, vittima.id, {}, `${vittima.nome} cade incosciente.`);
    }
    // Rimuovi il PNG dal gioco.
    state.png_in_gioco = state.png_in_gioco.filter(p => p.id !== 'PNG_OMBRA_TRADITRICE');
    return state;
}

// Effetto passivo Traditrice: "+1 carta al turno del PG corrente".
// Da chiamare all'inizio del turno PG (in combattimento.js, inizio_turno_pg).
// Ritorna 0/1: numero di carte bonus da pescare.
function bonus_pesca_da_png(state) {
    const tr = state.png_in_gioco.find(p => p.id === 'PNG_OMBRA_TRADITRICE');
    return tr ? 1 : 0;
}

// Effetto passivo Alleato: "PG curano 2 PV extra a fine combattimento".
// Da chiamare in fine_combattimento (combattimento.js). Ritorna n PV extra.
function bonus_cura_fine_combat_da_png(state) {
    const luna = state.png_in_gioco.find(p => p.id === 'PNG_LUNA_ALLEATA');
    return luna ? 2 : 0;
}

// =============================================================================
// API pubblica del modulo. Per essere coerente con la convenzione di
// mutabilita', valuta_twist e valuta_apparizione_png espongono una versione
// "esterna" che fa il clone una volta, e una "interna" gia' in place.
// =============================================================================

function valuta_twist_e_png(state, db) {
    // Versione comoda che fa entrambe le valutazioni in un colpo solo.
    // Usata da avanza_nodo (vedi esplorazione.js).
    let s = clone(state);
    valuta_twist(s, db);
    valuta_apparizione_png(s, db);
    return s;
}

var GED_EXPORTS = {
    // Twist
    valuta_twist,
    // PNG
    valuta_apparizione_png,
    // Helper combinato
    valuta_twist_e_png,
    // Trigger PNG (chiamati da altri moduli)
    trigger_salvataggio_alleato,
    trigger_commercio_mercante,
    trigger_tradimento,
    bonus_pesca_da_png,
    bonus_cura_fine_combat_da_png,
};
  // Copia tutti gli export nel namespace globale GED.
  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }
})();

// =============================================================================
// MODULO: combattimento.js
// =============================================================================
(function() {
  var GED_EXPORTS = {};
// =============================================================================
// Gli Erranti del Destino — motore/combattimento.js
// Step 4 (§5.1: macchina a stati delle fasi) + Step 5 (§5.5 gioca_carta,
// §5.7 applica_danno, §5.3 status_tick) della roadmap §12 del regolamento v0.3.
//
// Cosa fa questo file, in breve (per non-tecnici):
//   - Definisce le "fasi" di un round di combattimento, come un semaforo che
//     cambia colore: turno_pg -> tick_status -> pesca -> attesa input ->
//     risoluzione_carta -> fine_turno_pg -> turno_nemici -> fine_round.
//   - Implementa le funzioni che modificano lo stato (pure: ricevono uno
//     state, ne ritornano uno nuovo, non mutano il vecchio).
//   - Le sezioni §X.Y nei commenti rimandano al regolamento v0.3 cosi puoi
//     verificare passo passo cosa fa il codice.
//
// PARKING LOT (cose volutamente NON fatte qui, da affrontare in step futuri):
//   - §5.6 Sinergie: non valutate ancora (tabella sinergie.json non letta).
//   - §5.9 AI Nemici completa: per ora tutti i nemici usano "Aggro" (attacco
//     al PG con PV piu' bassi). Pattern Tank/Support/Random/Vendicativo/
//     Esecutore: da implementare in step dedicato.
//   - Effetti meccanici "speciali" delle carte (testo libero italiano nei
//     CSV, es. "se bersaglio ha sanguinamento danno=6"): NON parsati. Per ora
//     applico solo valore_numerico base. Si attiveranno quando i CSV avranno
//     anche il campo regola_strutturata (§7.2). Marcato come
//     PARKING_LOT_EFFETTI_AVANZATI.
//   - §7.1 pipeline modificatori (mondo, luogo, twist, PNG, equipaggiamento):
//     non applicata. Solo status_attaccante/target + difesa, come da §5.7.
// =============================================================================

'use strict';

// Importo le utilita gia scritte in setup.js: rng, rng_int, mescola.
const { rng, rng_int, mescola } = GED;
// Step 6 (§5.9): pattern AI nemici delegati a un modulo separato.
const { esegui_comportamento } = GED;

// -----------------------------------------------------------------------------
// §5.1 — Macchina a stati delle fasi.
// Implementata come costanti + funzione transizione. Le transizioni reali
// avvengono dentro le funzioni di fase (inizio_turno_pg, status_tick, ecc.).
// -----------------------------------------------------------------------------
const FASE = {
    ESPLORAZIONE:        'esplorazione',          // fuori combattimento
    INIZIO_TURNO_PG:     'inizio_turno_pg',
    STATUS_TICK_PG:      'status_tick_pg',
    PESCA_PG:            'pesca_pg',
    ATTESA_AZIONE_PG:    'attesa_azione_pg',      // input umano richiesto
    RISOLUZIONE_CARTA:   'risoluzione_carta',
    FINE_TURNO_PG:       'fine_turno_pg',
    TURNO_NEMICI:        'turno_nemici',
    FINE_ROUND:          'fine_round',
    FINE_COMBATTIMENTO:  'fine_combattimento',    // vittoria, ritorno a esplorazione
    FINE_RUN:            'fine_run',              // sconfitta: tutti KO
};

// -----------------------------------------------------------------------------
// Utility: helper per non mutare lo state. clone() fa deep copy via JSON.
// E' inefficiente ma chiarissimo e adeguato per un MVP single-player locale.
// In futuro si potra' sostituire con immer o con structuredClone.
// -----------------------------------------------------------------------------
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Genera l'ID del prossimo evento di log (progressivo).
function _next_log_id(state) {
    return state.log.length > 0 ? state.log[state.log.length - 1].id + 1 : 0;
}

// Append-only sul log eventi (§2.4).
// IMPORTANTE — convenzione di mutabilita' del file (allineata a esplorazione.js
// ed eventi_mondo.js, da v0.4):
//   - _log_append modifica lo state IN PLACE e ritorna lo stesso oggetto.
//   - Ogni funzione esposta clona lo state UNA VOLTA all'inizio (let s = clone)
//     e poi puo' tenere riferimenti a oggetti dentro s (nodi, pg, nemici)
//     senza che diventino stale. Questo elimina una classe di bug
//     "puntatore stale dopo log_append".
//   - L'immutabilita' verso l'ESTERNO della funzione e' comunque garantita
//     perche' modifichiamo il clone interno.
//   - Le funzioni private (_applica_danno, _applica_status_tick, ecc.) NON
//     clonano: lavorano in place sullo state ricevuto.
function _log_append(state, tipo, attore, bersaglio, payload, testo_narrativo) {
    state.log.push({
        id: _next_log_id(state),
        timestamp: state.meta.timestamp_inizio,  // deterministico (lo step §3.1
                                                  // usa il timestamp di setup).
        tipo,
        attore: attore || null,
        bersaglio: bersaglio || null,
        payload: payload || {},
        testo_narrativo: testo_narrativo || '',
    });
    return state;
}

// Cerca un PG per id; ritorna l'indice o -1.
function _find_pg_idx(state, pg_id) {
    return state.giocatori.findIndex(p => p.id === pg_id);
}

// Cerca un nemico in campo per istanza_id; ritorna l'indice o -1.
function _find_nem_idx(state, istanza_id) {
    return state.nemici_in_campo.findIndex(n => n.istanza_id === istanza_id);
}

// -----------------------------------------------------------------------------
// Istanziazione nemici per un combattimento.
// Quando entriamo in un nodo combattimento, prendiamo gli ID dei nemici dal
// nodo (es. ["NEM_LUPO_OMBRA", "NEM_LUPO_OMBRA"]) e creiamo NemicoIstanziato
// con PV correnti, istanza_id univoco, status vuoto (§2.3).
// -----------------------------------------------------------------------------
function istanzia_nemici_da_nodo(state, db) {
    const nuovo = clone(state);
    const nodo = nuovo.mappa.nodi[nuovo.mappa.nodo_corrente];
    if (!nodo || !nodo.incontro || nodo.incontro.length === 0) {
        return nuovo;  // niente da istanziare
    }
    // §4.3 — Bonus PV nemici da twist attivo. Se c'e' un flag attivo, applica
    // +N PV ai nemici e decrementa il contatore dei nodi residui.
    let bonus_pv = 0;
    if (nuovo._twist_bonus_pv_nemici && nuovo._twist_bonus_pv_nemici.nodi_residui > 0) {
        bonus_pv = nuovo._twist_bonus_pv_nemici.bonus;
        nuovo._twist_bonus_pv_nemici.nodi_residui -= 1;
        if (nuovo._twist_bonus_pv_nemici.nodi_residui === 0) {
            delete nuovo._twist_bonus_pv_nemici;
        }
    }

    nuovo.nemici_in_campo = nodo.incontro.map((card_id, idx) => {
        const carta = db.nemici.find(n => n.id === card_id);
        if (!carta) throw new Error(`Carta nemico non trovata: ${card_id}`);
        // §2.3 — NemicoIstanziato.
        // Aggiungo danni_per_pg (Set di pg_id -> danno cumulativo) per
        // supportare il pattern Tank §5.9 che ha bisogno di sapere "chi ha
        // colpito di piu' questo nemico". E' un'estensione minimale di §2.3
        // documentata come EXT_TRACK_DAMAGE (§11).
        const pv_finali = carta.pv + bonus_pv;
        return {
            istanza_id: `nem_${idx + 1}_${card_id}`,
            carta_id: card_id,
            pv: pv_finali,
            pv_max: pv_finali,
            difesa: carta.difesa,
            comportamento: carta.comportamento,  // copia su istanza per AI
            status: [],
            ultimo_colpito_da: null,
            trigger_attivato: false,
            danni_per_pg: {},
        };
    });
    return _log_append(
        nuovo, 'fase_cambiata', null, null,
        { evento: 'incontro_iniziato', nemici: nuovo.nemici_in_campo.map(n => n.istanza_id) },
        `Inizia il combattimento. Nemici in campo: ${nuovo.nemici_in_campo.length}.`
    );
}

// =============================================================================
// §5.2 — inizio_turno_pg(state)
// Setup del turno del PG corrente: reset energia, scadenza carte "inizio_turno",
// poi transizione a STATUS_TICK_PG.
// =============================================================================
function inizio_turno_pg(state) {
    // Interna al ciclo turno: NON clona (chi la chiama ha gia' clonato).
    let s = state;
    const pg = s.giocatori[s.turno_di];

    // Skip se KO (§5.2 precondizione): avanza al prossimo PG non-KO.
    if (pg.ko) {
        s = _log_append(s, 'fase_cambiata', pg.id, null,
            { motivo: 'pg_ko_skip' },
            `${pg.nome} è KO, salta il turno.`);
        return _avanza_turno_o_nemici(s);
    }

    // §5.2 punto 1: log "turno_iniziato".
    s = _log_append(s, 'fase_cambiata', pg.id, null,
        { evento: 'turno_iniziato', round: s.round_numero },
        `Inizia il turno di ${pg.nome} (round ${s.round_numero}).`);

    // §5.2 punto 2: reset energia.
    s.giocatori[s.turno_di].energia = s.config.pg.energia_per_turno;

    // §4.3 — Malus EN da twist (es. "Il Cielo Si Spezza"): se il PG ha il
    // flag attivo, scala l'energia per questo turno e azzera il flag.
    const pg_t = s.giocatori[s.turno_di];
    if (pg_t._twist_malus_en_prossimo_turno && pg_t._twist_malus_en_prossimo_turno > 0) {
        const malus = pg_t._twist_malus_en_prossimo_turno;
        pg_t.energia = Math.max(0, pg_t.energia - malus);
        pg_t._twist_malus_en_prossimo_turno = 0;
        s = _log_append(s, 'fase_cambiata', pg_t.id, null,
            { evento: 'twist_malus_en', valore: malus },
            `${pg_t.nome} perde ${malus} EN per effetto di un Twist.`);
    }

    // §4.4 — Effetto passivo PNG Traditrice: +1 carta a inizio turno.
    // Lo gestisco settando bonus_carte_prossimo_turno (riutilizzo del flag
    // gia' usato dal nodo riposo: la pesca extra verra' applicata in pesca_pg).
    const { bonus_pesca_da_png } = GED;
    const bonus_png = bonus_pesca_da_png(s);
    if (bonus_png > 0) {
        pg_t.bonus_carte_prossimo_turno = (pg_t.bonus_carte_prossimo_turno || 0) + bonus_png;
    }

    // §5.2 punto 3: applica modificatori inizio_turno.
    // PARKING_LOT: regola_mondo, equipaggiamento -> §7.1 step futuro.

    // §5.2 punto 4: scade carte in campo con scade_su == "inizio_turno".
    const pg_aggiornato = s.giocatori[s.turno_di];
    const carte_rimanenti = [];
    for (const c of pg_aggiornato.campo) {
        if (c.scade_su === 'inizio_turno') {
            pg_aggiornato.scarti.push(c.carta_id);
        } else {
            carte_rimanenti.push(c);
        }
    }
    pg_aggiornato.campo = carte_rimanenti;

    // §5.2 punto 5: transizione a STATUS_TICK_PG.
    s.fase_corrente = FASE.STATUS_TICK_PG;
    return status_tick_pg(s);
}

// =============================================================================
// §5.3 — status_tick(entita)
// Applica gli effetti degli status (veleno, sanguinamento, rigenerazione, ...)
// e decrementa la durata. Definito per PG (qui) e nemici (chiamato da §5.8).
// =============================================================================
function _applica_status_tick(entita, nome_entita) {
    // entita = oggetto PG o nemico (ha .pv, .pv_max, .status).
    const log_messaggi = [];
    const flags = {  // flag temporanei per questo turno (consumati altrove)
        salta_azione: false,
        danno_inflitto_x1_5: false,
        danno_subito_x1_5: false,
        next_attacco_x2: false,
        scudo_temp: 0,
    };

    const nuovi_status = [];
    for (const st of entita.status) {
        // Applica effetto del tipo di status.
        switch (st.tipo) {
            case 'veleno':
                entita.pv = Math.max(0, entita.pv - st.intensita);
                log_messaggi.push(`${nome_entita} subisce ${st.intensita} danno da veleno.`);
                break;
            case 'sanguinamento':
                entita.pv = Math.max(0, entita.pv - st.intensita);
                log_messaggi.push(`${nome_entita} subisce ${st.intensita} danno da sanguinamento.`);
                st.intensita -= 1;  // decay (§5.3)
                break;
            case 'stordimento':
                flags.salta_azione = true;
                log_messaggi.push(`${nome_entita} è stordito: salta l'azione.`);
                break;
            case 'scudo':
                flags.scudo_temp += st.intensita;
                break;
            case 'rigenerazione':
                const cura = Math.min(entita.pv_max - entita.pv, st.intensita);
                entita.pv += cura;
                if (cura > 0) log_messaggi.push(`${nome_entita} recupera ${cura} PV (rigenerazione).`);
                break;
            case 'forza':
                flags.danno_inflitto_x1_5 = true;
                break;
            case 'debolezza':
                flags.danno_subito_x1_5 = true;
                break;
            case 'marchio':
                flags.next_attacco_x2 = true;
                break;
            // PARKING_LOT: gelo, ustione, marchio_inverso ecc. -> EXT_STATUS_NEW.
            default:
                // Tipi non gestiti: lasciati passare senza effetto.
                break;
        }

        // Decremento durata. -1 = permanente, resta.
        if (st.durata_residua > 0) st.durata_residua -= 1;
        // Sanguinamento: rimuovi anche se intensita scende a 0.
        const ancora_valido =
            (st.durata_residua > 0 || st.durata_residua === -1) &&
            !(st.tipo === 'sanguinamento' && st.intensita <= 0);
        if (ancora_valido) nuovi_status.push(st);
    }
    entita.status = nuovi_status;

    return { entita, flags, log_messaggi };
}

function status_tick_pg(state) {
    // Interna al ciclo turno: NON clona.
    let s = state;
    const pg = s.giocatori[s.turno_di];

    if (pg.ko) {
        s.fase_corrente = FASE.FINE_TURNO_PG;
        return fine_turno_pg(s);
    }

    const r = _applica_status_tick(pg, pg.nome);
    s.giocatori[s.turno_di] = r.entita;
    // Salvo i flag temporanei sul PG (consumati in gioca_carta/applica_danno).
    s.giocatori[s.turno_di]._flags_turno = r.flags;

    for (const msg of r.log_messaggi) {
        s = _log_append(s, 'status_applicato', pg.id, null, {}, msg);
    }

    // Se KO per veleno/sanguinamento (PV scesi a 0 durante il tick):
    if (s.giocatori[s.turno_di].pv === 0 && !s.giocatori[s.turno_di].ko) {
        s.giocatori[s.turno_di].ko = true;
        s = _log_append(s, 'ko', pg.id, null, {},
            `${pg.nome} cade incosciente per gli effetti negativi.`);
        // Verifica condizione di sconfitta:
        if (s.giocatori.every(p => p.ko)) {
            s.fase_corrente = FASE.FINE_RUN;
            return s;
        }
        s.fase_corrente = FASE.FINE_TURNO_PG;
        return fine_turno_pg(s);
    }

    // Se stordito: skip a fine turno.
    if (r.flags.salta_azione) {
        s.fase_corrente = FASE.FINE_TURNO_PG;
        return fine_turno_pg(s);
    }

    s.fase_corrente = FASE.PESCA_PG;
    return pesca_pg(s);
}

// =============================================================================
// §5.4 — pesca_carte
// Il PG pesca fino a dimensione_mano. Se la pila e vuota, scarti -> pila +
// mescola.
// =============================================================================
function _pesca_carte(state, pg_idx, quantita) {
    // Privata: NON clona (vedi convenzione di mutabilita' a inizio file).
    let s = state;
    const pg = s.giocatori[pg_idx];

    let presi = 0;
    while (presi < quantita) {
        if (pg.pila.length === 0) {
            // §5.4 punto 1: ricicla gli scarti se la pila è vuota.
            if (pg.scarti.length === 0) break;  // non c'e' piu nulla da pescare
            const mix = mescola(pg.scarti, s.rng_state);
            pg.pila = mix.array;
            pg.scarti = [];
            s.rng_state = mix.rng_state;
            s = _log_append(s, 'fase_cambiata', pg.id, null,
                { evento: 'pila_ricomposta' },
                `${pg.nome} rimette gli scarti nella pila e mescola.`);
        }
        const carta = pg.pila.shift();
        // §5.4 punto 3: rispetta dimensione mano massima.
        if (pg.mano.length >= s.config.pg.dimensione_mano) {
            pg.scarti.push(carta);
            s = _log_append(s, 'fase_cambiata', pg.id, null,
                { evento: 'scarto_per_mano_piena', carta },
                `${pg.nome} ha la mano piena: scarta ${carta}.`);
        } else {
            pg.mano.push(carta);
        }
        presi += 1;
    }
    return s;
}

function pesca_pg(state) {
    // Interna al ciclo turno: NON clona.
    let s = state;
    const pg = s.giocatori[s.turno_di];

    // Pesca fino al limite della mano (mano_max - mano_corrente).
    const da_pescare = Math.max(0, s.config.pg.dimensione_mano - pg.mano.length);
    if (da_pescare > 0) {
        s = _pesca_carte(s, s.turno_di, da_pescare);
        s = _log_append(s, 'fase_cambiata', pg.id, null,
            { evento: 'pesca_completata', carte: da_pescare },
            `${pg.nome} pesca ${da_pescare} carte.`);
    }

    // §4.1 (riposo): se il PG ha bonus carte da nodo riposo, le aggiungo qui.
    // Il bonus va OLTRE il limite mano, ma vincolato a pila/scarti disponibili.
    // Il flag viene azzerato dopo l'uso.
    const pg_now = s.giocatori[s.turno_di];
    if (pg_now.bonus_carte_prossimo_turno && pg_now.bonus_carte_prossimo_turno > 0) {
        const bonus = pg_now.bonus_carte_prossimo_turno;
        // Per il bonus: tollero che la mano superi il limite standard.
        const prima = pg_now.mano.length;
        // Pesca diretta senza limite (semplificazione MVP).
        for (let k = 0; k < bonus; k++) {
            if (pg_now.pila.length === 0) {
                if (pg_now.scarti.length === 0) break;
                const mix = mescola(pg_now.scarti, s.rng_state);
                pg_now.pila = mix.array;
                pg_now.scarti = [];
                s.rng_state = mix.rng_state;
            }
            const carta = pg_now.pila.shift();
            pg_now.mano.push(carta);
        }
        const presi = pg_now.mano.length - prima;
        pg_now.bonus_carte_prossimo_turno = 0;
        s = _log_append(s, 'fase_cambiata', pg.id, null,
            { evento: 'bonus_carta_riposo', carte: presi },
            `${pg.nome} pesca ${presi} carte bonus dal riposo.`);
    }

    s.fase_corrente = FASE.ATTESA_AZIONE_PG;
    return s;
}

// =============================================================================
// §5.5 — gioca_carta(state, pg_id, carta_id, target_id?)
// L'unica funzione che processa l'input dell'utente in combattimento (o quello
// generato dalla CLI, in questo MVP).
// =============================================================================
function gioca_carta(state, pg_id, carta_id, target_id, db) {
    // Precondizioni (§5.5). Se falliscono, ritorno {ok:false, errore} (§8.3).
    if (state.fase_corrente !== FASE.ATTESA_AZIONE_PG) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: `Fase corrente: ${state.fase_corrente}, attesa: ${FASE.ATTESA_AZIONE_PG}` } };
    }
    const pg_idx = _find_pg_idx(state, pg_id);
    if (pg_idx === -1) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_TURNO_NON_TUO', messaggio: `PG ${pg_id} non esiste` } };
    }
    if (pg_idx !== state.turno_di) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_TURNO_NON_TUO', messaggio: `Non è il turno di ${pg_id}` } };
    }
    const pg = state.giocatori[pg_idx];
    if (pg.ko) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_KO', messaggio: `${pg.nome} è KO` } };
    }
    if (!pg.mano.includes(carta_id)) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_CARTA_NON_IN_MANO',
                      messaggio: `${carta_id} non è in mano a ${pg.nome}` } };
    }

    // Recupero la definizione della carta dal database (puo essere attacco,
    // abilita o oggetto: cerco in tutti e tre i pool).
    const carta = db.attacchi.find(c => c.id === carta_id)
              || db.abilita.find(c => c.id === carta_id)
              || db.oggetti.find(c => c.id === carta_id);
    if (!carta) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_CARTA_NON_IN_MANO',
                      messaggio: `${carta_id} non trovata nel database` } };
    }

    if (pg.energia < carta.costo_energia) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_ENERGIA_INSUFFICIENTE',
                      messaggio: `Servono ${carta.costo_energia} EN, ne hai ${pg.energia}` } };
    }

    // Validazione target. Per attacchi mirati (target=nemico), target_id
    // deve corrispondere a un nemico in campo non sconfitto.
    if (carta._tipo_carta === 'attacco' && carta.target === 'nemico') {
        const nem_idx = _find_nem_idx(state, target_id);
        if (nem_idx === -1) {
            return { ok: false, state: null,
                errore: { codice: 'ERR_TARGET_NON_VALIDO',
                          messaggio: `Nemico ${target_id} non in campo` } };
        }
    }

    // OK: applica.
    let s = clone(state);
    s.fase_corrente = FASE.RISOLUZIONE_CARTA;

    // §5.5 punto 1: scala energia.
    s.giocatori[pg_idx].energia -= carta.costo_energia;

    // §5.5 punto 3: switch sul tipo di carta.
    s = _log_append(s, 'carta_giocata', pg_id, target_id || null,
        { carta_id, costo: carta.costo_energia },
        `${pg.nome} gioca "${carta.nome}".`);

    switch (carta._tipo_carta) {
        case 'attacco':
            s = _risolvi_attacco(s, pg_idx, carta, target_id, db);
            break;
        case 'abilita':
            s = _risolvi_abilita(s, pg_idx, carta);
            break;
        case 'oggetto':
            s = _risolvi_oggetto(s, pg_idx, carta);
            break;
    }

    // §5.5 punto 5: sposta carta in scarti (se non equipaggiata).
    // Le carte equipaggiamento gestiscono lo spostamento in _risolvi_oggetto.
    if (carta._tipo_carta !== 'oggetto' || carta.tipo_oggetto !== 'equipaggiamento') {
        const idx_mano = s.giocatori[pg_idx].mano.indexOf(carta_id);
        if (idx_mano !== -1) {
            s.giocatori[pg_idx].mano.splice(idx_mano, 1);
            s.giocatori[pg_idx].scarti.push(carta_id);
        }
    }

    // PARKING_LOT_SINERGIE: §5.6 valuta_sinergie -> step bilanciamento.

    // §5.5 punto 7: torna in attesa azione (a meno di vittoria/sconfitta).
    // Da v0.4: _verifica_condizioni_uscita transita gia' a ESPLORAZIONE se i
    // nemici sono finiti, quindi il check copre anche quel caso (oltre a
    // FINE_RUN per sconfitta, che resta terminale).
    s = _verifica_condizioni_uscita(s);
    if (s.fase_corrente === FASE.ESPLORAZIONE ||
        s.fase_corrente === FASE.FINE_RUN) {
        return { ok: true, state: s, errore: null };
    }
    s.fase_corrente = FASE.ATTESA_AZIONE_PG;
    return { ok: true, state: s, errore: null };
}

// -----------------------------------------------------------------------------
// Sotto-risoluzioni per tipo carta.
// PARKING_LOT_EFFETTI_AVANZATI: gli effetti speciali nei CSV (es. "se bersaglio
// ha sanguinamento, danno=6") sono testo libero italiano. NON parsati qui.
// Per ora: solo valore_numerico base. Quando i CSV avranno regola_strutturata
// (§7.2), aggiungere qui la valutazione del DSL.
// -----------------------------------------------------------------------------

function _risolvi_attacco(state, pg_idx, carta, target_id, db) {
    let s = state;
    // Target singolo (la maggioranza degli attacchi del MVP).
    if (carta.target === 'nemico') {
        const nem_idx = _find_nem_idx(s, target_id);
        s = _applica_danno(s, target_id, carta.valore_numerico, s.giocatori[pg_idx]);
    } else if (carta.target === 'tutti_nemici') {
        // Iterazione su una snapshot degli ID: applica_danno potrebbe rimuoverli.
        const ids = s.nemici_in_campo.map(n => n.istanza_id);
        for (const id of ids) {
            s = _applica_danno(s, id, carta.valore_numerico, s.giocatori[pg_idx]);
        }
    } else if (carta.target === 'nemico_casuale') {
        if (s.nemici_in_campo.length > 0) {
            const r = rng_int(s.rng_state, 0, s.nemici_in_campo.length);
            s.rng_state = r.rng_state;
            const id = s.nemici_in_campo[r.valore].istanza_id;
            s = _applica_danno(s, id, carta.valore_numerico, s.giocatori[pg_idx]);
        }
    }
    return s;
}

function _risolvi_abilita(state, pg_idx, carta) {
    // Privata: NON clona.
    let s = state;
    const pg = s.giocatori[pg_idx];

    // Effetti base riconosciuti dal valore_numerico + descrizione semantica.
    // Casi base: cura (valore_numerico>0, target=se|alleato|tutti), scudo
    // (descrizione contiene "scudo"), pesca (descrizione contiene "pesca N").
    //
    // Per ora gestisco i casi piu' frequenti nel pool MVP. I casi non
    // riconosciuti vengono comunque loggati come "effetto narrativo" senza
    // modifiche meccaniche, cosi il gioco non si blocca.
    const desc = (carta.effetto_meccanico || '').toLowerCase();
    let testo = `${pg.nome} attiva "${carta.nome}".`;

    if (desc.includes('scudo')) {
        // Es. ABL_GUARDIA: "scudo intensita 3 per 1 turno".
        pg.status.push({
            tipo: 'scudo',
            intensita: carta.valore_numerico || 3,
            durata_residua: 1,
            origine: carta.id,
        });
        testo += ` Ottiene scudo ${carta.valore_numerico || 3}.`;
    }
    if (desc.includes('pesca') && desc.match(/pesca\s+(\d+)/)) {
        const n = parseInt(desc.match(/pesca\s+(\d+)/)[1], 10);
        s.giocatori[pg_idx] = pg;  // sincronizza prima di pesca
        s = _pesca_carte(s, pg_idx, n);
        testo += ` Pesca ${n} carte.`;
    }
    if (desc.match(/guadagna\s+(\d+)\s+en/)) {
        const en = parseInt(desc.match(/guadagna\s+(\d+)\s+en/)[1], 10);
        s.giocatori[pg_idx].energia += en;
        testo += ` Guadagna ${en} EN.`;
    }
    if (desc.includes('cura') && carta.valore_numerico) {
        // Cura applicata al PG stesso o al gruppo, a seconda del target.
        if (carta.target === 'se') {
            const cura = Math.min(pg.pv_max - pg.pv, carta.valore_numerico);
            s.giocatori[pg_idx].pv += cura;
            testo += ` Cura ${cura} PV.`;
        } else if (carta.target === 'tutti') {
            for (let i = 0; i < s.giocatori.length; i++) {
                if (s.giocatori[i].ko) continue;
                const cura = Math.min(s.giocatori[i].pv_max - s.giocatori[i].pv,
                                       carta.valore_numerico);
                s.giocatori[i].pv += cura;
            }
            testo += ` Cura tutti i PG di ${carta.valore_numerico} PV.`;
        }
    }
    if (desc.includes('forza')) {
        // Status forza al PG (intensita 1, durata da descrizione o 2 di default).
        s.giocatori[pg_idx].status.push({
            tipo: 'forza',
            intensita: carta.valore_numerico || 1,
            durata_residua: 2,
            origine: carta.id,
        });
        testo += ` Ottiene status forza.`;
    }
    if (desc.includes('rigenerazione')) {
        // ABL_BENEDIZIONE_GUARITORE: tutti i PG non KO.
        for (let i = 0; i < s.giocatori.length; i++) {
            if (s.giocatori[i].ko) continue;
            s.giocatori[i].status.push({
                tipo: 'rigenerazione',
                intensita: carta.valore_numerico || 2,
                durata_residua: 2,
                origine: carta.id,
            });
        }
        testo += ` Tutti i PG ottengono rigenerazione.`;
    }

    s = _log_append(s, 'status_applicato', pg.id, null, { carta: carta.id }, testo);
    return s;
}

function _risolvi_oggetto(state, pg_idx, carta) {
    // Privata: NON clona.
    let s = state;
    const pg = s.giocatori[pg_idx];

    if (carta.tipo_oggetto === 'equipaggiamento') {
        // Equipaggia: occupa lo slot, resta in campo (non va negli scarti).
        const slot = carta.slot;
        if (slot === 'nessuno') return s;  // safety net
        // Se lo slot e' occupato, vecchio equipaggiamento -> scarti.
        const vecchio = pg.equipaggiamento[slot];
        if (vecchio) pg.scarti.push(vecchio);
        pg.equipaggiamento[slot] = carta.id;
        // Rimuovi dalla mano (non passa per gli scarti, e' in slot).
        const idx_mano = pg.mano.indexOf(carta.id);
        if (idx_mano !== -1) pg.mano.splice(idx_mano, 1);
        s = _log_append(s, 'carta_giocata', pg.id, null,
            { carta: carta.id, slot },
            `${pg.nome} equipaggia "${carta.nome}" (${slot}).`);
    } else if (carta.tipo_oggetto === 'consumabile') {
        // Consumabile: applica cura, poi finisce negli scarti (logica in gioca_carta).
        const desc = (carta.effetto_meccanico || '').toLowerCase();
        if (desc.includes('cura')) {
            const n = carta.valore_numerico || 0;
            if (desc.includes('tutti')) {
                for (let i = 0; i < s.giocatori.length; i++) {
                    if (s.giocatori[i].ko) continue;
                    s.giocatori[i].pv = Math.min(s.giocatori[i].pv_max, s.giocatori[i].pv + n);
                }
                s = _log_append(s, 'cura', pg.id, null, { valore: n },
                    `${pg.nome} usa "${carta.nome}": tutti curano ${n} PV.`);
            } else {
                pg.pv = Math.min(pg.pv_max, pg.pv + n);
                s = _log_append(s, 'cura', pg.id, pg.id, { valore: n },
                    `${pg.nome} usa "${carta.nome}": cura ${n} PV.`);
            }
        }
    }
    return s;
}

// =============================================================================
// §5.7 — applica_danno(target_id, danno_base, attaccante, opts?)
// Pipeline minimale: forza/marchio sull'attaccante, debolezza sul target,
// difesa, scudo, applicazione PV, controllo KO.
// opts (Step 6, §5.9):
//   ignora_difesa: salta il punto 4 (es. Vendicativo infuriato, Esecutore)
//   ignora_scudo : salta il punto 5 (es. Esecutore colpo di grazia)
//   difesa_x2_questo_turno: pattern Tank in modalita' difensiva (per nemici
//     bersaglio di un attacco: la loro difesa conta doppia per questo turno)
// =============================================================================
function _applica_danno(state, target_id, danno_base, attaccante, opts) {
    // Privata: NON clona.
    let s = state;
    const nem_idx = _find_nem_idx(s, target_id);
    const pg_idx_t = _find_pg_idx(s, target_id);
    const o = opts || {};

    if (nem_idx === -1 && pg_idx_t === -1) return s;  // target non valido

    const target = nem_idx !== -1 ? s.nemici_in_campo[nem_idx] : s.giocatori[pg_idx_t];
    let danno = danno_base;

    // §5.7 punto 2: modificatori attaccante.
    const flags_att = attaccante._flags_turno || {};
    if (flags_att.danno_inflitto_x1_5) danno = Math.floor(danno * 1.5);
    // Marchio: se l'attaccante ha "marchio" come status, e' un x2 sul prossimo
    // attacco. Cerca e consuma.
    const idx_marchio = (attaccante.status || []).findIndex(st => st.tipo === 'marchio');
    if (idx_marchio !== -1) {
        danno *= 2;
        attaccante.status.splice(idx_marchio, 1);
    }

    // §5.7 punto 3: modificatori target (debolezza).
    const ha_debolezza = (target.status || []).some(st => st.tipo === 'debolezza');
    if (ha_debolezza) danno = Math.floor(danno * 1.5);

    // §5.7 punto 4: difesa (solo per nemici, e solo se non ignorata).
    if (nem_idx !== -1 && !o.ignora_difesa) {
        // Tank difensivo: difesa raddoppiata se il nemico ha attivato il flag
        // in questo turno. Il flag vive sull'istanza nemico, non sull'azione.
        const moltiplicatore = target._difesa_x2_questo_turno ? 2 : 1;
        danno = Math.max(0, danno - (target.difesa * moltiplicatore));
    }

    // §5.7 punto 5: scudo (consumato prima dei PV, se non ignorato).
    if (!o.ignora_scudo) {
        const idx_scudo = (target.status || []).findIndex(st => st.tipo === 'scudo');
        if (idx_scudo !== -1 && danno > 0) {
            const scudo = target.status[idx_scudo];
            const assorbito = Math.min(scudo.intensita, danno);
            danno -= assorbito;
            scudo.intensita -= assorbito;
            if (scudo.intensita <= 0) target.status.splice(idx_scudo, 1);
        }
    }

    // §5.7 punto 6: applica al PV.
    target.pv = Math.max(0, target.pv - danno);

    // §5.7 punto 7: ultimo_colpito_da (solo nemici, per AI Vendicativo).
    if (nem_idx !== -1) {
        target.ultimo_colpito_da = attaccante.id;
        // Tracking cumulativo "chi ha colpito di piu'" per pattern Tank.
        // EXT_TRACK_DAMAGE (§11). Solo se l'attaccante e' un PG (ha id "pg_*").
        if (typeof attaccante.id === 'string' && attaccante.id.startsWith('pg_')) {
            if (!target.danni_per_pg) target.danni_per_pg = {};
            target.danni_per_pg[attaccante.id] = (target.danni_per_pg[attaccante.id] || 0) + danno;
        }
    }

    s = _log_append(s, 'danno_inflitto', attaccante.id, target_id || target.istanza_id,
        { danno, residuo_pv: target.pv, ignora_difesa: !!o.ignora_difesa, ignora_scudo: !!o.ignora_scudo },
        `${attaccante.nome || attaccante.istanza_id} infligge ${danno} danno (PV target: ${target.pv}).`);

    // §5.7 punto 8: KO/sconfitta.
    if (target.pv === 0) {
        if (nem_idx !== -1) {
            const morto = s.nemici_in_campo[nem_idx];
            s = _log_append(s, 'ko', null, morto.istanza_id, { carta: morto.carta_id },
                `${morto.istanza_id} (${morto.carta_id}) è sconfitto!`);
            s.nemici_in_campo.splice(nem_idx, 1);
        } else {
            // §4.4 — Trigger Alleato (Luna): se in gioco e disponibile,
            // salva il PG da KO lasciandolo a 1 PV. One-shot per run.
            const { trigger_salvataggio_alleato } = GED;
            if (trigger_salvataggio_alleato(s)) {
                target.pv = 1;
                // Niente KO: il log del salvataggio e' gia' stato emesso.
            } else {
                target.ko = true;
                s = _log_append(s, 'ko', null, target.id, {},
                    `${target.nome} cade incosciente!`);
            }
        }
    }
    return s;
}

// =============================================================================
// §5.10 — verifica condizioni di uscita combattimento.
// Chiamata dopo ogni azione (carta giocata, attacco nemico).
//
// Da v0.4: la fase fine_combattimento e' transitoria. Dopo aver loggato la
// vittoria, applicato bonus PNG e marcato il nodo come risolto, la fase
// torna automaticamente a "esplorazione" e nemici_in_campo viene svuotato.
// Prima la UI doveva fare questa transizione manualmente (causa di un bug
// che bloccava i pulsanti dopo l'uccisione dell'ultimo nemico).
// =============================================================================
function _verifica_condizioni_uscita(state) {
    // Privata: NON clona.
    let s = state;
    if (s.nemici_in_campo.length === 0 && s.fase_corrente !== FASE.ESPLORAZIONE) {
        // VITTORIA. PARKING_LOT_RICOMPENSE: distribuzione drop, ricompense
        // narrative, pesca extra (§5.10) -> step dedicato.
        s.fase_corrente = FASE.FINE_COMBATTIMENTO;
        _log_append(s, 'fase_cambiata', null, null,
            { evento: 'combattimento_vinto' },
            'Il combattimento è vinto! I nemici sono sconfitti.');
        // §4.4 — Bonus cura fine combat da PNG Alleato (Luna): +2 PV ai PG.
        const { bonus_cura_fine_combat_da_png } = GED;
        const bonus = bonus_cura_fine_combat_da_png(s);
        if (bonus > 0) {
            for (const pg of s.giocatori) {
                if (pg.ko) continue;
                const cura = Math.min(pg.pv_max - pg.pv, bonus);
                if (cura > 0) {
                    pg.pv += cura;
                    _log_append(s, 'cura', null, pg.id, { valore: cura, fonte: 'PNG_LUNA_ALLEATA' },
                        `${pg.nome} riceve ${cura} PV bonus dalla presenza di Luna l'Alleata.`);
                }
            }
        }
        // Marca il nodo come risolto.
        const nodo = s.mappa.nodi[s.mappa.nodo_corrente];
        if (nodo) nodo.stato = 'risolto';
        // §5.10 v0.4: transizione automatica fine_combattimento -> esplorazione.
        // Cosi' i chiamanti (motore + UI) vedono uno stato consistente.
        s.fase_corrente = FASE.ESPLORAZIONE;
        s.nemici_in_campo = [];
    } else if (s.giocatori.every(p => p.ko)) {
        // SCONFITTA: la fase fine_run e' terminale e NON transita.
        s.fase_corrente = FASE.FINE_RUN;
        _log_append(s, 'fase_cambiata', null, null,
            { evento: 'run_terminata' },
            'Tutti gli Erranti sono caduti. La run termina.');
    }
    return s;
}

// =============================================================================
// passa_turno: input volontario del giocatore per finire il proprio turno
// senza giocare altre carte (o quando non puo' permettersi nulla).
// =============================================================================
function passa_turno(state) {
    if (state.fase_corrente !== FASE.ATTESA_AZIONE_PG) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: `Fase corrente: ${state.fase_corrente}` } };
    }
    let s = clone(state);
    s.fase_corrente = FASE.FINE_TURNO_PG;
    s = fine_turno_pg(s);
    return { ok: true, state: s, errore: null };
}

// =============================================================================
// fine_turno_pg: cleanup carte con scade_su == "fine_turno", poi passa al
// prossimo PG o al turno_nemici.
// =============================================================================
function fine_turno_pg(state) {
    // Interna al ciclo turno: NON clona.
    let s = state;
    const pg = s.giocatori[s.turno_di];

    // Scade carte con durata fine_turno.
    const carte_rimanenti = [];
    for (const c of pg.campo) {
        if (c.scade_su === 'fine_turno') {
            pg.scarti.push(c.carta_id);
        } else {
            carte_rimanenti.push(c);
        }
    }
    pg.campo = carte_rimanenti;

    // Pulisco i flag temporanei del turno.
    delete pg._flags_turno;

    return _avanza_turno_o_nemici(s);
}

function _avanza_turno_o_nemici(state) {
    // Privata: NON clona.
    let s = state;
    // Cerca il prossimo PG non-KO. Se nessuno -> turno nemici (poi sconfitta).
    const n_pg = s.giocatori.length;
    let prossimo = (s.turno_di + 1) % n_pg;
    let cicli = 0;
    while (s.giocatori[prossimo].ko && cicli < n_pg) {
        prossimo = (prossimo + 1) % n_pg;
        cicli += 1;
    }
    // Se prossimo == 0 (ricominciamo dal primo PG), e' tempo del turno nemici.
    if (prossimo <= s.turno_di) {
        s.turno_di = prossimo;
        s.fase_corrente = FASE.TURNO_NEMICI;
        return turno_nemici(s);
    }
    s.turno_di = prossimo;
    s.fase_corrente = FASE.INIZIO_TURNO_PG;
    return inizio_turno_pg(s);
}

// =============================================================================
// §5.8 — turno_nemici.
// Per ogni nemico: status_tick, poi azione AI delegata a ai_nemici.js (§5.9).
// I pattern supportati: Aggro, Tank, Support, Random, Vendicativo, Esecutore,
// e combinazioni "PatternA->PatternB" (switch a meta' PV).
//
// DEBITO TECNICO (da rimuovere in v0.5):
// La funzione usa la variabile _DB_REF di modulo, settata da avvia_combattimento.
// Brutta pratica (rende il modulo non thread-safe e difficile da testare). In
// v0.5 si propaghera' `db` esplicitamente lungo la catena del ciclo turno.
// =============================================================================
function turno_nemici(state) {
    // Interna al ciclo turno: NON clona.
    let s = state;

    for (let i = 0; i < s.nemici_in_campo.length; i++) {
        const nem = s.nemici_in_campo[i];

        // §5.8 punto 2a: status_tick.
        const r = _applica_status_tick(nem, nem.istanza_id);
        s.nemici_in_campo[i] = r.entita;
        for (const msg of r.log_messaggi) {
            s = _log_append(s, 'status_applicato', nem.istanza_id, null, {}, msg);
        }
        // Se il nemico è morto per status:
        if (s.nemici_in_campo[i].pv === 0) {
            s = _log_append(s, 'ko', null, nem.istanza_id, { carta: nem.carta_id },
                `${nem.istanza_id} cade per gli effetti negativi.`);
            s.nemici_in_campo.splice(i, 1);
            i -= 1;
            continue;
        }
        // §5.8 punto 2b: stordimento -> skip.
        if (r.flags.salta_azione) continue;

        // §5.9: decide l'azione tramite il pattern di comportamento.
        // L'azione e' un oggetto suggerito da ai_nemici.js; combattimento.js
        // la esegue. Cosi i due strati restano disaccoppiati.
        const azione = esegui_comportamento(s.nemici_in_campo[i], s, _DB_REF);
        if (!azione) continue;
        // Aggiorna lo stato del PRNG (Random, Vendicativo, tie-break possono
        // consumarlo). Modifica unica, qui.
        s.rng_state = azione.rng_state;

        // Log narrativa AI.
        s = _log_append(s, 'nemico_attacca', nem.istanza_id, azione.bersaglio_id,
            { azione_tipo: azione.azione_tipo, danno: azione.danno,
              ignora_difesa: !!azione.ignora_difesa, ignora_scudo: !!azione.ignora_scudo },
            azione.note);

        // Esecuzione per tipo di azione.
        if (azione.azione_tipo === 'attacco') {
            // Costruisco un "attaccante" lite per _applica_danno.
            const attaccante_nem = {
                id: nem.istanza_id,
                nome: nem.istanza_id,
                status: s.nemici_in_campo[i].status,
                _flags_turno: r.flags,
            };
            // Flag Tank: se il pattern lo richiede, segna la difesa raddoppiata
            // sull'istanza nemico per questo turno (verra' pulito a fine round).
            if (azione.modificatori && azione.modificatori.difesa_x2_questo_turno) {
                s.nemici_in_campo[i]._difesa_x2_questo_turno = true;
            }
            s = _applica_danno(s, azione.bersaglio_id, azione.danno, attaccante_nem, {
                ignora_difesa: !!azione.ignora_difesa,
                ignora_scudo: !!azione.ignora_scudo,
            });
            // Riallineo gli status del nemico (marchio potrebbe essere stato consumato).
            if (s.nemici_in_campo[i]) s.nemici_in_campo[i].status = attaccante_nem.status;
        } else if (azione.azione_tipo === 'cura_alleato') {
            // Pattern Support: cura un nemico alleato.
            const idx_all = _find_nem_idx(s, azione.bersaglio_id);
            if (idx_all !== -1) {
                const all = s.nemici_in_campo[idx_all];
                const cura_eff = Math.min(all.pv_max - all.pv, azione.danno);
                all.pv += cura_eff;
                s = _log_append(s, 'cura', nem.istanza_id, all.istanza_id,
                    { valore: cura_eff },
                    `${all.istanza_id} recupera ${cura_eff} PV (curato da ${nem.istanza_id}).`);
            }
        }
        // PARKING_LOT: 'buff_alleato' e 'difesa' non sono usati dai pattern
        // attuali ma sono previsti dall'API. Aggiungere qui se serviranno.

        // Se tutti i PG sono KO, esci subito.
        if (s.giocatori.every(p => p.ko)) break;
    }

    // A fine turno nemici, pulisco i flag temporanei "difesa_x2" del Tank
    // dai nemici sopravvissuti (durano un solo turno).
    for (const n of s.nemici_in_campo) {
        delete n._difesa_x2_questo_turno;
    }

    s.fase_corrente = FASE.FINE_ROUND;
    return fine_round(s);
}

// Helper: cerca la definizione della CardNemico nel db, conservando il db
// dentro lo state non e' previsto, quindi lo passiamo lateralmente. Per il
// MVP usiamo un riferimento globale settato in avvia_combattimento.
let _DB_REF = null;
function _carta_nemico_da_id(_state, carta_id) {
    if (!_DB_REF) return null;
    return _DB_REF.nemici.find(n => n.id === carta_id);
}

// =============================================================================
// fine_round: tick effetti di fine round + verifica esito.
// PARKING_LOT: regola_mondo es. "i PG curano 1 PV a fine round" -> step §7.
// =============================================================================
function fine_round(state) {
    // Interna al ciclo turno: NON clona.
    let s = state;
    s.round_numero += 1;

    s = _verifica_condizioni_uscita(s);
    if (s.fase_corrente === FASE.ESPLORAZIONE ||
        s.fase_corrente === FASE.FINE_RUN) {
        return s;
    }

    // Riprende dal primo PG non-KO.
    let primo = 0;
    while (primo < s.giocatori.length && s.giocatori[primo].ko) primo += 1;
    if (primo >= s.giocatori.length) {
        s.fase_corrente = FASE.FINE_RUN;
        return s;
    }
    s.turno_di = primo;
    s.fase_corrente = FASE.INIZIO_TURNO_PG;
    return inizio_turno_pg(s);
}

// =============================================================================
// Entry point pubblico: avvia il combattimento del nodo corrente.
// Istanzia nemici, setta fase, parte dal primo PG.
// =============================================================================
function avvia_combattimento(state, db) {
    _DB_REF = db;  // riferimento per _carta_nemico_da_id
    let s = istanzia_nemici_da_nodo(state, db);
    if (s.nemici_in_campo.length === 0) {
        return s;  // niente combattimento qui
    }
    s.round_numero = 1;
    // Trova il primo PG non KO.
    let primo = 0;
    while (primo < s.giocatori.length && s.giocatori[primo].ko) primo += 1;
    s.turno_di = primo;
    s.fase_corrente = FASE.INIZIO_TURNO_PG;
    return inizio_turno_pg(s);
}

// =============================================================================
// MAIN — due simulazioni successive per dimostrare AI nemici diversi:
//   1) Nodo 2 (seed 42): due Lupi d'Ombra (pattern Aggro)
//   2) Nodo 10 (seed 42): un Ladro della Foresta (pattern Vendicativo)
// Step 4+5+6: combattimento completo con AI §5.9 (Aggro, Vendicativo, ecc.).
// =============================================================================


var GED_EXPORTS = {
    FASE,
    avvia_combattimento,
    inizio_turno_pg,
    status_tick_pg,
    pesca_pg,
    gioca_carta,
    passa_turno,
    fine_turno_pg,
    turno_nemici,
    fine_round,
    istanzia_nemici_da_nodo,
};
  // Copia tutti gli export nel namespace globale GED.
  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }
})();

// =============================================================================
// MODULO: esplorazione.js
// =============================================================================
(function() {
  var GED_EXPORTS = {};
// =============================================================================
// Gli Erranti del Destino — motore/esplorazione.js
// Step 7 della roadmap §12, regolamento v0.3:
//   - §4.1 risoluzione nodi non-combat (riposo, tesoro, speciale, evento)
//   - §6 risoluzione eventi con scelta A/B + EffettoPayload (§6.2)
//
// Cosa fa questo file, in breve (per non-tecnici):
//   - Quando il gruppo arriva su un nodo NON di combattimento, qui dentro
//     succede quello che il regolamento descrive: si curano al riposo, pescano
//     un oggetto al tesoro, leggono un evento e devono SCEGLIERE A o B,
//     ricevendo conseguenze diverse (anche un rischio nascosto).
//   - Tutti gli effetti delle scelte sono letti dal CSV come oggetti
//     EffettoPayload strutturati (§6.2). Niente parsing di testo libero.
//
// PARKING LOT (non in questo step):
//   - Operazione "rivela_nodo" (§6.2): l'idea richiede UI per mostrare il
//     prossimo nodo. La implementero' allo step UI.
//   - Apparizione PNG (§4.4) durante avanza_nodo: lo gestisco in un piccolo
//     modulo separato successivo, perche' richiede di toccare anche lo state
//     globale (png_in_gioco).
//   - Sistema Twist (§4.3): idem.
// =============================================================================

'use strict';

const { rng, rng_int, mescola } = GED;

// -----------------------------------------------------------------------------
// Helper: clone, log, find. Stessa firma di combattimento.js.
// -----------------------------------------------------------------------------
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function _next_log_id(state) {
    return state.log.length > 0 ? state.log[state.log.length - 1].id + 1 : 0;
}

// IMPORTANTE — convenzione di mutabilita':
//   _log_append modifica lo state IN PLACE e ritorna lo stesso oggetto.
//   Ogni funzione esposta clona lo state UNA VOLTA all'inizio (let s = clone)
//   e poi puo' tenere riferimenti a oggetti dentro s (nodi, pg) senza che
//   diventino stale. Questa scelta semplifica il codice ed elimina una
//   classe di bug "puntatore stale dopo log_append".
//   L'immutabilita' verso l'ESTERNO della funzione e' comunque garantita
//   perche' modifichiamo il clone interno.
function _log_append(state, tipo, attore, bersaglio, payload, testo_narrativo) {
    state.log.push({
        id: _next_log_id(state),
        timestamp: state.meta.timestamp_inizio,
        tipo,
        attore: attore || null,
        bersaglio: bersaglio || null,
        payload: payload || {},
        testo_narrativo: testo_narrativo || '',
    });
    return state;
}

function _find_pg_idx(state, pg_id) {
    return state.giocatori.findIndex(p => p.id === pg_id);
}

// =============================================================================
// §4.1 — risolvi_nodo(state, db). Dispatcher per tipo di nodo.
// Restituisce uno state nuovo con nodo.stato = "risolto" se la risoluzione e'
// stata completata in un singolo passaggio. Per i nodi "evento" lo stato
// passa a "in_attesa_scelta" e la risoluzione si completa con risolvi_evento.
// =============================================================================
function risolvi_nodo(state, db) {
    const nodo = state.mappa.nodi[state.mappa.nodo_corrente];
    if (!nodo) throw new Error('Nessun nodo corrente da risolvere');
    if (nodo.stato === 'risolto') return state;  // gia' chiuso

    switch (nodo.tipo_nodo) {
        case 'combattimento':
            // Questo modulo NON gestisce il combattimento: lo fa
            // combattimento.js tramite avvia_combattimento(). Qui solo guard.
            throw new Error('Nodo combattimento: usa avvia_combattimento() di combattimento.js');
        case 'riposo':
            return risolvi_nodo_riposo(state, db);
        case 'tesoro':
            return risolvi_nodo_tesoro(state, db);
        case 'speciale':
            return risolvi_nodo_speciale(state, db);
        case 'evento':
            return rivela_evento(state, db);
        default:
            throw new Error(`Tipo di nodo non gestito: ${nodo.tipo_nodo}`);
    }
}

// =============================================================================
// §4.1 — Nodo RIPOSO.
// "Ogni PG: cura PV (+30% pv_max) e pesca 1 carta extra al prossimo turno."
//
// Implementazione:
//   - Cura: Math.floor(pv_max * 0.30). Cappata a pv_max, non oltre.
//   - "1 carta extra al prossimo turno": setto un flag bonus_carte_prossimo_turno
//     sul PG. Verra' letto da pesca_pg in combattimento.js e azzerato dopo l'uso.
//
// NOTA SUL FLAG: e' un'estensione minimale dello schema PGState (§2.2),
// non distruttiva. Documentata come EXT_BONUS_CARTE (vedi §11).
// =============================================================================
function risolvi_nodo_riposo(state, db) {
    let s = clone(state);
    const nodo = s.mappa.nodi[s.mappa.nodo_corrente];

    const luogo = db.luoghi.find(l => l.id === nodo.carta_luogo_id);
    s = _log_append(s, 'nodo_risolto', null, null,
        { tipo: 'riposo', luogo: luogo ? luogo.id : null },
        `Il gruppo si ferma a riposare in "${luogo ? luogo.nome : 'un luogo sicuro'}".`);

    for (let i = 0; i < s.giocatori.length; i++) {
        const pg = s.giocatori[i];
        if (pg.ko) continue;
        const cura = Math.floor(pg.pv_max * 0.30);
        const cura_eff = Math.min(pg.pv_max - pg.pv, cura);
        pg.pv += cura_eff;
        pg.bonus_carte_prossimo_turno = (pg.bonus_carte_prossimo_turno || 0) + 1;
        s = _log_append(s, 'cura', null, pg.id, { valore: cura_eff },
            `${pg.nome} recupera ${cura_eff} PV e pescherà 1 carta extra al prossimo turno.`);
    }

    // §4.4 — Trigger Mercante: se il Mercante Corvo e' in gioco, apre la
    // fase di commercio (MVP: regala 1 oggetto universale per ogni PG).
    const { trigger_commercio_mercante } = GED;
    trigger_commercio_mercante(s, db);

    nodo.stato = 'risolto';
    return s;
}

// =============================================================================
// §4.1 — Nodo TESORO.
// "Ogni PG pesca 1 CardOggetto dal pool tesoro, può equipaggiarla."
//
// Pool tesoro = oggetti universali + oggetti della classe del PG. Pescati con
// reinserimento (coerente con setup.js, pool MVP piccolo).
//
// Comportamento default MVP: l'oggetto viene aggiunto alla MANO del PG.
// Sara' poi il giocatore (via UI) a decidere se equipaggiarlo. Per ora il
// motore non auto-equipaggia.
// =============================================================================
function risolvi_nodo_tesoro(state, db) {
    let s = clone(state);
    const nodo = s.mappa.nodi[s.mappa.nodo_corrente];

    const luogo = db.luoghi.find(l => l.id === nodo.carta_luogo_id);
    s = _log_append(s, 'nodo_risolto', null, null,
        { tipo: 'tesoro', luogo: luogo ? luogo.id : null },
        `Il gruppo scopre un tesoro in "${luogo ? luogo.nome : 'un luogo nascosto'}".`);

    for (let i = 0; i < s.giocatori.length; i++) {
        const pg = s.giocatori[i];
        if (pg.ko) continue;
        // Pool: universali + classe del PG.
        const pool = db.oggetti.filter(
            o => o.classe_preferita === 'universale' || o.classe_preferita === pg.classe
        );
        if (pool.length === 0) continue;
        const r = rng_int(s.rng_state, 0, pool.length);
        s.rng_state = r.rng_state;
        const oggetto = pool[r.valore];
        // Capacita' mano: se piena, lo aggiungo agli scarti (carta "gia'
        // ricevuta ma non in mano" - sara' pescabile dopo reshuffle).
        if (pg.mano.length < s.config.pg.dimensione_mano) {
            pg.mano.push(oggetto.id);
            s = _log_append(s, 'ricompensa', null, pg.id, { carta: oggetto.id, dove: 'mano' },
                `${pg.nome} riceve "${oggetto.nome}" (in mano).`);
        } else {
            pg.scarti.push(oggetto.id);
            s = _log_append(s, 'ricompensa', null, pg.id, { carta: oggetto.id, dove: 'scarti' },
                `${pg.nome} riceve "${oggetto.nome}" (mano piena: va negli scarti).`);
        }
    }

    nodo.stato = 'risolto';
    return s;
}

// =============================================================================
// §4.1 — Nodo SPECIALE.
// "Evento scriptato definito da effetto_meccanico della CardLuogo."
//
// MVP: applico l'effetto_meccanico come narrativa nel log. Se il luogo ha
// nemici_associati, marco il nodo come "in_combattimento" e lascio al chiamante
// il compito di lanciare avvia_combattimento() (es. Cuore della Foresta -> Druido).
// =============================================================================
function risolvi_nodo_speciale(state, db) {
    let s = clone(state);
    const nodo = s.mappa.nodi[s.mappa.nodo_corrente];
    const luogo = db.luoghi.find(l => l.id === nodo.carta_luogo_id);

    s = _log_append(s, 'nodo_risolto', null, null,
        { tipo: 'speciale', luogo: luogo ? luogo.id : null,
          effetto: luogo ? luogo.effetto_meccanico : null },
        `Evento speciale: "${luogo ? luogo.nome : 'luogo ignoto'}". ${luogo ? luogo.descrizione_narrativa : ''}`);

    // Se il luogo ha nemici associati, il nodo si trasforma in combattimento.
    if (nodo.incontro && nodo.incontro.length > 0) {
        // Non istanzio nemici qui: lo fa avvia_combattimento() di combattimento.js.
        // Lascio il nodo in_corso e segno il flag per il chiamante.
        nodo._richiede_combattimento = true;
        s = _log_append(s, 'fase_cambiata', null, null,
            { evento: 'speciale_innesca_combattimento' },
            `${luogo ? luogo.nome : 'Il luogo'} risveglia qualcosa di ostile.`);
        return s;
    }

    // PARKING_LOT: parsing strutturato di effetto_meccanico per i luoghi
    // "speciali" senza nemici. Per ora il testo viene solo loggato.
    nodo.stato = 'risolto';
    return s;
}

// =============================================================================
// §4.1 — Nodo EVENTO. Due-fasi:
//   1. rivela_evento(state, db) -> mostra testo e mette il nodo "in_attesa_scelta"
//   2. risolvi_evento(state, db, scelta) -> applica A o B, marca risolto
// =============================================================================
function rivela_evento(state, db) {
    let s = clone(state);
    const nodo_iniziale = s.mappa.nodi[s.mappa.nodo_corrente];
    const luogo = db.luoghi.find(l => l.id === nodo_iniziale.carta_luogo_id);

    if (!nodo_iniziale.evento_associato) {
        // Nodo evento senza evento associato: degrado a narrativa breve.
        s = _log_append(s, 'nodo_risolto', null, null,
            { tipo: 'evento', luogo: luogo ? luogo.id : null },
            `${luogo ? luogo.nome : 'Un luogo'}: nessun evento si manifesta.`);
        // Bug fix: dopo _log_append, lo state e' un NUOVO clone -> rileggo il nodo.
        s.mappa.nodi[s.mappa.nodo_corrente].stato = 'risolto';
        return s;
    }

    const evento = db.eventi.find(e => e.id === nodo_iniziale.evento_associato);
    if (!evento) throw new Error(`Evento non trovato: ${nodo_iniziale.evento_associato}`);

    s = _log_append(s, 'fase_cambiata', null, null,
        { tipo: 'evento_rivelato', evento_id: evento.id, nome: evento.nome,
          testo: evento.testo_narrativo,
          scelta_A: evento.scelta_A.testo_outcome,
          scelta_B: evento.scelta_B.testo_outcome },
        `Evento: "${evento.nome}". ${evento.testo_narrativo}`);

    // Bug fix: il _log_append precedente ha ricreato lo state -> rileggo nodo.
    const nodo_finale = s.mappa.nodi[s.mappa.nodo_corrente];
    nodo_finale.stato = 'in_attesa_scelta';
    nodo_finale._evento_rivelato_id = evento.id;
    return s;
}

// §6.1 — risolvi_evento(state, db, scelta).
function risolvi_evento(state, db, scelta) {
    if (scelta !== 'A' && scelta !== 'B') {
        return { ok: false, state: null,
            errore: { codice: 'ERR_TARGET_NON_VALIDO',
                      messaggio: `Scelta evento non valida: "${scelta}" (atteso A o B)` } };
    }
    let s = clone(state);
    const nodo = s.mappa.nodi[s.mappa.nodo_corrente];
    if (nodo.stato !== 'in_attesa_scelta' || !nodo._evento_rivelato_id) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: 'Nessun evento da risolvere in questo nodo' } };
    }
    const evento = db.eventi.find(e => e.id === nodo._evento_rivelato_id);
    if (!evento) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_TARGET_NON_VALIDO',
                      messaggio: `Evento non trovato: ${nodo._evento_rivelato_id}` } };
    }
    const payload = scelta === 'A' ? evento.scelta_A : evento.scelta_B;

    // Log della scelta + testo outcome.
    s = _log_append(s, 'scelta_evento', null, null,
        { evento: evento.id, scelta, outcome: payload.testo_outcome },
        `Scelta ${scelta}: ${payload.testo_outcome}`);

    // §6.2 punto 4: applica modifiche.
    s = applica_effetto_payload(s, payload, db);

    // §6.2 rischio: se presente, tira un dado. Se la prob scatta, applica
    // ANCHE il fallback (e' una conseguenza nascosta che si aggiunge,
    // come per EVT_FOR_02 "Le pozioni erano avvelenate").
    if (payload.rischio && typeof payload.rischio.probabilita === 'number') {
        const r = rng(s.rng_state);
        s.rng_state = r.rng_state;
        if (r.valore < payload.rischio.probabilita) {
            s = _log_append(s, 'scelta_evento', null, null,
                { evento: evento.id, rischio_scattato: true,
                  outcome: payload.rischio.fallback.testo_outcome },
                `Imprevisto: ${payload.rischio.fallback.testo_outcome}`);
            s = applica_effetto_payload(s, payload.rischio.fallback, db);
        }
    }

    nodo.stato = 'risolto';
    return { ok: true, state: s, errore: null };
}

// =============================================================================
// §6.2 — applica_effetto_payload(state, payload, db)
// Applica TUTTE le modifiche di un EffettoPayload (lista di operazioni).
//
// Operazioni supportate (regolamento §6.2):
//   pv+, pv-, en+, en-, pesca, scarta, status, aggiungi_carta, rimuovi_carta,
//   salta_nodo
// Bersagli supportati:
//   pg_corrente, tutti_pg, png, mazzo, mappa
//
// Note:
//   - "pg_corrente": in esplorazione non c'e' un "turno PG"; uso giocatori[0]
//     come PG di riferimento. Quando avremo voto di gruppo (#EXT_VOTE), il
//     PG che ha fatto la scelta sara' indicato esplicitamente.
//   - "rivela_nodo": PARKING_LOT (richiede UI).
// =============================================================================
function applica_effetto_payload(state, payload, db) {
    // NON clona: lavora in place sullo state ricevuto. Il chiamante ha gia'
    // fatto il clone (convenzione del file, vedi nota su _log_append).
    if (!payload || !Array.isArray(payload.modifiche)) return state;
    for (const m of payload.modifiche) {
        _applica_singola_modifica(state, m, db);
    }
    return state;
}

function _applica_singola_modifica(state, modifica, db) {
    let s = state;
    const { target, operazione, valore } = modifica;

    // Risolvo il "set di entita'" bersaglio in una lista di pg_idx.
    let pg_indices = [];
    if (target === 'pg_corrente') {
        // In esplorazione: il PG di riferimento e' giocatori[0] (vedi nota).
        // Se KO, prendo il primo non-KO. Se tutti KO, niente.
        const idx0 = state.giocatori.findIndex(p => !p.ko);
        if (idx0 !== -1) pg_indices = [idx0];
    } else if (target === 'tutti_pg') {
        pg_indices = state.giocatori.map((p, i) => p.ko ? -1 : i).filter(i => i !== -1);
    }
    // I target "png" e "mazzo" e "mappa" hanno semantica speciale, gestiti sotto.

    switch (operazione) {
        case 'pv+': {
            for (const i of pg_indices) {
                const pg = s.giocatori[i];
                const cura = Math.min(pg.pv_max - pg.pv, valore);
                pg.pv += cura;
                s = _log_append(s, 'cura', null, pg.id, { valore: cura },
                    `${pg.nome} recupera ${cura} PV.`);
            }
            break;
        }
        case 'pv-': {
            for (const i of pg_indices) {
                const pg = s.giocatori[i];
                pg.pv = Math.max(0, pg.pv - valore);
                s = _log_append(s, 'danno_inflitto', null, pg.id, { danno: valore },
                    `${pg.nome} subisce ${valore} danno (effetto evento).`);
                if (pg.pv === 0) {
                    pg.ko = true;
                    s = _log_append(s, 'ko', null, pg.id, {},
                        `${pg.nome} cade incosciente.`);
                }
            }
            break;
        }
        case 'en+': {
            for (const i of pg_indices) {
                s.giocatori[i].energia += valore;
                s = _log_append(s, 'status_applicato', null, s.giocatori[i].id, { valore },
                    `${s.giocatori[i].nome} guadagna ${valore} EN.`);
            }
            break;
        }
        case 'en-': {
            for (const i of pg_indices) {
                s.giocatori[i].energia = Math.max(0, s.giocatori[i].energia - valore);
            }
            break;
        }
        case 'pesca': {
            for (const i of pg_indices) {
                // Implementazione semplice: trasferisce <valore> carte da pila
                // a mano. Se la pila e' vuota, ricicla scarti come §5.4.
                const pg = s.giocatori[i];
                let presi = 0;
                while (presi < valore) {
                    if (pg.pila.length === 0) {
                        if (pg.scarti.length === 0) break;
                        const mix = mescola(pg.scarti, s.rng_state);
                        pg.pila = mix.array;
                        pg.scarti = [];
                        s.rng_state = mix.rng_state;
                    }
                    const carta = pg.pila.shift();
                    if (pg.mano.length >= s.config.pg.dimensione_mano) {
                        pg.scarti.push(carta);
                    } else {
                        pg.mano.push(carta);
                    }
                    presi += 1;
                }
                s = _log_append(s, 'ricompensa', null, pg.id, { carte: presi },
                    `${pg.nome} pesca ${presi} carte (effetto evento).`);
            }
            break;
        }
        case 'scarta': {
            for (const i of pg_indices) {
                const pg = s.giocatori[i];
                const n = Math.min(valore, pg.mano.length);
                for (let k = 0; k < n; k++) {
                    // Scarta una carta casuale (deterministico via rng).
                    if (pg.mano.length === 0) break;
                    const r = rng_int(s.rng_state, 0, pg.mano.length);
                    s.rng_state = r.rng_state;
                    const carta = pg.mano.splice(r.valore, 1)[0];
                    pg.scarti.push(carta);
                }
                s = _log_append(s, 'ricompensa', null, pg.id, { scartate: n },
                    `${pg.nome} scarta ${n} carte (effetto evento).`);
            }
            break;
        }
        case 'status': {
            // valore = { tipo, intensita, durata_residua }
            for (const i of pg_indices) {
                s.giocatori[i].status.push({
                    tipo: valore.tipo,
                    intensita: valore.intensita,
                    durata_residua: valore.durata_residua,
                    origine: 'evento',
                });
                s = _log_append(s, 'status_applicato', null, s.giocatori[i].id,
                    { status: valore },
                    `${s.giocatori[i].nome} riceve status "${valore.tipo}" (intensita' ${valore.intensita}, durata ${valore.durata_residua}).`);
            }
            break;
        }
        case 'aggiungi_carta': {
            // valore = id della carta (string).
            // Se target == "mazzo": aggiungo a tutti i giocatori? No: ai PG
            // bersaglio (pg_corrente o tutti_pg). Per "mazzo" senza pg_indices,
            // default a pg_corrente. La carta va negli SCARTI cosi entra al
            // prossimo reshuffle (coerente con come fanno la maggior parte dei
            // deckbuilder).
            const carta_id = valore;
            let destinatari = pg_indices;
            if (destinatari.length === 0 && target === 'mazzo') {
                const idx0 = s.giocatori.findIndex(p => !p.ko);
                if (idx0 !== -1) destinatari = [idx0];
            }
            for (const i of destinatari) {
                const pg = s.giocatori[i];
                // Cerca la definizione della carta per il nome narrativo.
                const def = db.attacchi.find(c => c.id === carta_id)
                       || db.abilita.find(c => c.id === carta_id)
                       || db.oggetti.find(c => c.id === carta_id);
                pg.scarti.push(carta_id);
                s = _log_append(s, 'ricompensa', null, pg.id,
                    { carta: carta_id, dove: 'scarti' },
                    `${pg.nome} riceve "${def ? def.nome : carta_id}" (entrera' al prossimo reshuffle).`);
            }
            break;
        }
        case 'rimuovi_carta': {
            const carta_id = valore;
            for (const i of pg_indices) {
                const pg = s.giocatori[i];
                // Cerca in mano, pila, scarti, in quest'ordine.
                for (const lista of [pg.mano, pg.pila, pg.scarti]) {
                    const idx = lista.indexOf(carta_id);
                    if (idx !== -1) {
                        lista.splice(idx, 1);
                        s = _log_append(s, 'ricompensa', null, pg.id,
                            { carta: carta_id, rimossa: true },
                            `${pg.nome} perde "${carta_id}".`);
                        break;
                    }
                }
            }
            break;
        }
        case 'salta_nodo': {
            // valore = numero di nodi da saltare (0 = niente, 1 = salta uno).
            // Implementazione: incremento nodo_corrente di valore senza
            // risolvere quelli intermedi. Il chiamante (avanza_nodo) gestisce
            // la transizione effettiva. Qui marco solo il flag.
            s.mappa._salta_prossimi = (s.mappa._salta_prossimi || 0) + valore;
            if (valore > 0) {
                s = _log_append(s, 'fase_cambiata', null, null,
                    { evento: 'salta_nodo', quantita: valore },
                    `Il gruppo aggira ${valore} ${valore === 1 ? 'nodo' : 'nodi'}.`);
            }
            break;
        }
        case 'rivela_nodo': {
            // PARKING_LOT: richiede UI per visualizzare il prossimo nodo.
            s = _log_append(s, 'fase_cambiata', null, null,
                { evento: 'rivela_nodo', quantita: valore },
                `Il gruppo intravede ${valore} ${valore === 1 ? 'nodo' : 'nodi'} avanti.`);
            break;
        }
        default:
            console.warn(`[applica_effetto_payload] Operazione sconosciuta: ${operazione}`);
    }
    return s;
}

// =============================================================================
// §4.2 — avanza_nodo(state, db). Transizione al nodo successivo.
// Verifica pre: nodo corrente risolto, almeno un PG non KO.
// In questo step NON ancora: valuta_twist e valuta_apparizione_png (parking).
// =============================================================================
function avanza_nodo(state, db) {
    let s = clone(state);
    const nodo_corrente = s.mappa.nodi[s.mappa.nodo_corrente];

    if (!nodo_corrente) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: 'Nessun nodo corrente' } };
    }
    if (nodo_corrente.stato !== 'risolto') {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: `Nodo corrente non risolto (stato: ${nodo_corrente.stato})` } };
    }
    if (s.giocatori.every(p => p.ko)) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_KO',
                      messaggio: 'Tutti i PG sono KO: la run è finita' } };
    }

    // Salta nodi se l'evento ha settato il flag.
    let avanzamento = 1;
    if (s.mappa._salta_prossimi && s.mappa._salta_prossimi > 0) {
        avanzamento += s.mappa._salta_prossimi;
        s.mappa._salta_prossimi = 0;
    }

    // Marca il nodo corrente come visitato.
    s.mappa.nodi_visitati.push(s.mappa.nodo_corrente);
    s.mappa.nodo_corrente = Math.min(
        s.mappa.nodo_corrente + avanzamento,
        s.mappa.nodi.length - 1
    );
    const prossimo = s.mappa.nodi[s.mappa.nodo_corrente];
    if (prossimo) prossimo.stato = 'in_corso';

    s = _log_append(s, 'fase_cambiata', null, null,
        { evento: 'nodo_iniziato', posizione: prossimo ? prossimo.posizione : null,
          tipo_nodo: prossimo ? prossimo.tipo_nodo : null,
          luogo: prossimo ? prossimo.carta_luogo_id : null },
        prossimo ? `Il gruppo entra in "${prossimo.carta_luogo_id}" (${prossimo.tipo_nodo}).`
                 : 'Fine della mappa raggiunta.');

    // §4.3 + §4.4 — Sistema Twist e Sistema PNG.
    // Chiamati DOPO il log "nodo_iniziato" cosi la cronaca scorre in ordine
    // narrativo: "entriamo... appare un PNG / si manifesta un Twist".
    const { valuta_twist, valuta_apparizione_png, trigger_tradimento } = GED;
    valuta_twist(s, db);
    valuta_apparizione_png(s, db);
    // Trigger Traditrice: ogni nodo che il PNG e' in gioco, incrementa il
    // contatore. Quando raggiunge 3 nodi, scatta l'effetto attivo.
    trigger_tradimento(s, db);

    return { ok: true, state: s, errore: null };
}

// =============================================================================
// Vittoria finale: il boss del nodo finale e' stato sconfitto.
// =============================================================================
function verifica_vittoria_run(state) {
    const finale = state.mappa.nodi[state.mappa.nodi.length - 1];
    return finale && finale.stato === 'risolto';
}

// =============================================================================
// MAIN — simulazione completa: avanza nodi non-combat, gestisci eventi A/B.
// =============================================================================


var GED_EXPORTS = {
    risolvi_nodo,
    risolvi_nodo_riposo,
    risolvi_nodo_tesoro,
    risolvi_nodo_speciale,
    rivela_evento,
    risolvi_evento,
    applica_effetto_payload,
    avanza_nodo,
    verifica_vittoria_run,
};
  // Copia tutti gli export nel namespace globale GED.
  for (var k in GED_EXPORTS) { GED[k] = GED_EXPORTS[k]; }
})();

// =============================================================================
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
        if (c === '\n' || c === '\r') {
          if (campo !== '' || riga.length > 0) { riga.push(campo); righe.push(riga); }
          campo = ''; riga = [];
          if (c === '\r' && testo[i+1] === '\n') i++;
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
    var oggetti  = await fetch_csv('oggetti.csv');
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
      valore_numerico: intg(r.valore_numerico), tag_sinergia: arr(r.tag_sinergia),
      durata: r.durata, _tipo_carta: 'attacco',
    }));
    abilita = abilita.map(r => ({
      id: r.id, nome: r.nome, classe_preferita: r.classe_preferita,
      costo_energia: intg(r.costo_energia), descrizione_narrativa: r.descrizione_narrativa,
      effetto_meccanico: r.effetto_meccanico, target: r.target,
      valore_numerico: intg_null(r.valore_numerico), tag_sinergia: arr(r.tag_sinergia),
      durata: r.durata, _tipo_carta: 'abilita',
    }));
    oggetti = oggetti.map(r => ({
      id: r.id, nome: r.nome, classe_preferita: r.classe_preferita,
      costo_energia: intg(r.costo_energia), descrizione_narrativa: r.descrizione_narrativa,
      effetto_meccanico: r.effetto_meccanico, tipo_oggetto: r.tipo_oggetto, slot: r.slot,
      valore_numerico: intg_null(r.valore_numerico), tag_sinergia: arr(r.tag_sinergia),
      durata: r.durata, _tipo_carta: 'oggetto',
    }));
    nemici = nemici.map(r => ({
      id: r.id, nome: r.nome, tag_mondo: arr(r.tag_mondo), categoria: r.categoria,
      pv: intg(r.pv), difesa: intg(r.difesa), danno_base: intg(r.danno_base),
      comportamento: r.comportamento, abilita_speciale: nul(r.abilita_speciale),
      trigger_abilita: nul(r.trigger_abilita), ricompensa_narrativa: r.ricompensa_narrativa,
      tag_luogo: arr(r.tag_luogo),
    }));

    return { mondi, luoghi, eventi, twist, png, attacchi, abilita, oggetti, nemici, config, sinergie };
  };
})();

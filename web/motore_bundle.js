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
//
// === Sotto-step 16.1 (regolamento v0.6) - "Fondazioni" ============================
// Aggiornamenti applicati in questo file dal sotto-step 16.1 della ROADMAP:
//   - parse_attacchi: legge i nuovi campi v0.6 `tag` (array), `applica_status`
//     (oggetto|null), `ignora_difesa` (bool), `ignora_scudo` (bool). §1.7.
//   - parse_abilita: legge `salta_step_tag` (bool, default false) e `tag`
//     (array opzionale per il conteggio sinergie σ1). §1.8.
//   - parse_nemici: legge `vulnerabilita`, `resistenza`, `essenza_drop` come
//     array di tag; `tag_mondo` e `tag_luogo` rimangono array. §1.10.
//   - parse_luoghi: legge `vulnerabilita_luogo`, `resistenza_luogo` come
//     array di tag. §1.3.
//   - parse_mondi: legge `vulnerabilita_mondo`, `resistenza_mondo` come array
//     di tag. §1.2.
//   - parse_oggetti viene SOSTITUITO da parse_equipaggiamenti (§1.9) +
//     parse_consumabili (§1.9bis). Il campo stats_per_livello degli equip e
//     forme_finali sono JSON inline (3 livelli per stats, 2-3 rami evolutivi).
//   - _crea_pg costruisce un PGState v0.6: slot `talismano` al posto di
//     `accessorio`; nuovi campi `essenze` (10 categorie), `sinergie_attive: []`,
//     `attacco_base_gratuito_consumato_questo_turno: false`,
//     `carte_giocate_per_tag_turno: {}`. Vedi §2.2.
//   - costruisci_pila_iniziale: il vecchio "oggetto" diventa "consumabile".
//     Gli equipaggiamenti NON entrano in pila (occupano slot, §2.2): per
//     ora i 3 slot restano a null e l'equipaggiamento iniziale-da-classe
//     viene gestito in PARKING_LOT_EQUIP_INIZIALE_CLASSE.
//
// IMPORTANTE: `db.oggetti` non esiste piu': e' stato sdoppiato in
// `db.equipaggiamenti` e `db.consumabili` (step 16.1). Tutti i siti che
// usavano `db.oggetti` sono stati aggiornati (fix C1, step 16.11).
//
// === Sotto-step 16.6 (ROADMAP, regolamento v0.6) - "Sinergie σ1" =============
// Aggiunte applicate in questo file dal sotto-step 16.6 (solo PGState §2.2):
//   - `bonus_prossima_carta_tag: null` — slot per il bonus additivo σ1 sulla
//     prossima carta con quel tag (effetto `bonus_danno_prossima_carta_con_tag`).
//   - `riduzione_costo_prossima_carta_tag: null` — slot per la riduzione di
//     costo EN σ1 sulla prossima carta con quel tag (effetto `riduzione_costo`).
//   - `sigma1_scattate_questo_turno: []` — set degli id σ1 gia' scattate in
//     questo turno, per rispettare `una_tantum_per_turno` (§5.6.3).
// La logica di scrittura/lettura/consumo di questi 3 campi vive interamente
// in combattimento.js (vedi sotto-step 16.6 li').
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

// §M5-fix: wrapper tag-specifico che avverte se un valore contiene caratteri
// accentati. I confronti tag sono stringa-stringa: un accento rotto causa
// match silenziosi falliti (furtivita !== furtività).
function to_tag_array(s, ctx) {
    const arr = to_array_pipe(s);
    arr.forEach(t => {
        if (/[àáâãäåèéêëìíîïòóôõöùúûüýÿ]/i.test(t)) {
            console.warn(`[avviso tag accentato] ${ctx}: "${t}" — normalizzare a forma senza accento.`);
        }
    });
    return arr;
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

const ENUM_ELEMENTO  = ['terra', 'aria', 'acqua', 'fuoco', 'oscurità', 'luce'];
const ENUM_TIPO_NODO = ['combattimento', 'evento', 'riposo', 'tesoro', 'speciale'];
const ENUM_TRIGGER_EVT = ['esplorazione', 'combattimento', 'sempre'];
const ENUM_INTENSITA = ['bassa', 'media', 'alta'];
const ENUM_RUOLO_PNG = ['alleato', 'mercante', 'traditore', 'guida', 'boss_minore'];
const ENUM_CLASSE    = ['guerriero', 'mago', 'ladro', 'guaritore', 'universale'];
const ENUM_TARGET_ATK = ['nemico', 'tutti_nemici', 'nemico_casuale'];
const ENUM_TARGET_ABL = ['se', 'alleato', 'nemico', 'tutti', 'gruppo'];
const ENUM_DURATA_ABL = ['immediato', 'inizio_turno', 'fine_turno', 'permanente'];
// v0.6 (§1.9): slot del PG. "accessorio" rinominato in "talismano" (§2.2).
const ENUM_SLOT_EQUIP = ['arma', 'armatura', 'talismano'];
// v0.6 (§1.9bis): target del consumabile, piu' ampio del target_abl perche'
// include opzioni di area come tutti_nemici, tutti_pg, scena.
const ENUM_TARGET_CNS = ['se', 'alleato', 'nemico', 'tutti_nemici', 'tutti_pg', 'tutti_pg_non_ko', 'scena'];
const ENUM_CATEGORIA_NEM = ['comune', 'elite', 'boss'];
const ENUM_MONDO_PREF = ['terra', 'aria', 'acqua', 'fuoco', 'oscurità', 'luce', 'tutti'];

// v0.6 (§5.11): le 10 categorie di ESSENZE droppate dai nemici e usate per
// salire di livello l'equipaggiamento. 6 elementali + 4 fisiche.
// Nota: il regolamento usa "oscurita" (senza accento) come chiave delle essenze
// per evitare problemi nei contatori; "oscurità" (con accento) e' il valore
// di enum nelle carte Mondo/Elemento. Mantengo la convenzione del regolamento.
const ENUM_ESSENZA_TAG = [
    'fuoco', 'acqua', 'terra', 'aria', 'oscurita', 'luce',
    'taglio', 'impatto', 'perforante', 'energia'
];

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
            // §1.2 v0.6: vuln/res mondo. Opzionali, default array vuoto.
            // Si sommano a quelle dei singoli nemici nello step 4 della
            // pipeline danno (§5.7). Es. MONDO_FUOCO con resistenza_mondo=
            // ["fuoco"] -> TUTTI i nemici del mondo resistono al fuoco.
            vulnerabilita_mondo: to_array_pipe(r.vulnerabilita_mondo),
            resistenza_mondo: to_array_pipe(r.resistenza_mondo),
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
            // §1.3 v0.6: vuln/res del luogo, propagati ai nemici che combattono
            // su quel nodo (somma allo step 4 della pipeline danno, §5.7).
            // Opzionali; default array vuoto se la cella CSV e' vuota.
            vulnerabilita_luogo: to_array_pipe(r.vulnerabilita_luogo),
            resistenza_luogo: to_array_pipe(r.resistenza_luogo),
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
        // §1.7 v0.6: applica_status puo' essere null (cella CSV vuota) o un
        // oggetto JSON inline. Esempio: {"tipo":"sanguinamento","intensita":2,"durata":3}.
        // Lo usa lo step 9 della pipeline danno (§5.7).
        let applica_status = null;
        if (r.applica_status && r.applica_status.trim() !== '') {
            applica_status = to_json_inline(r.applica_status, ctx + ' campo applica_status');
        }
        // §1.7 v0.6: tag (array pipe-separato di tag elementali/fisici).
        // Usato dallo step 4 della pipeline danno per il match vuln/res.
        // L'authoring puo' aver messo un singolo tag senza pipe (es. "taglio");
        // to_tag_array lo gestisce come array di 1 elemento e avverte sugli accenti (§M5-fix).
        const tag = to_tag_array(r.tag, ctx + ' campo tag');
        return {
            id: r.id,
            nome: r.nome,
            classe_preferita: r.classe_preferita,
            costo_energia: to_int(r.costo_energia, ctx + ' campo costo_energia'),
            descrizione_narrativa: r.descrizione_narrativa,
            effetto_meccanico: r.effetto_meccanico,
            target: r.target,
            valore_numerico: to_int(r.valore_numerico, ctx + ' campo valore_numerico'),
            tag,
            applica_status,
            ignora_difesa: r.ignora_difesa === '' || r.ignora_difesa === undefined
                ? false
                : to_bool(r.ignora_difesa, ctx + ' campo ignora_difesa'),
            ignora_scudo: r.ignora_scudo === '' || r.ignora_scudo === undefined
                ? false
                : to_bool(r.ignora_scudo, ctx + ' campo ignora_scudo'),
            // §M3-fix: tag_sinergia = tag tematici secondari, distinti da `tag`
            // (usato dal motore per match vulnerabilita'/resistenza). Parsato e
            // conservato nel DB per un futuro sistema di sinergie tematiche;
            // nessuna funzione del motore lo legge ancora.
            tag_sinergia: to_tag_array(r.tag_sinergia, ctx + ' campo tag_sinergia'),
            durata: 'immediato',
            _tipo_carta: 'attacco',  // helper per gioca_carta (§5.5)
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
            // §1.8 v0.6: tag opzionale dell'abilita'. Anche se l'abilita' non
            // fa danno, e' usato dal conteggio carte_giocate_per_tag_turno per
            // la sinergia σ1 (§5.6). Cella vuota = array vuoto.
            tag: to_tag_array(r.tag, ctx + ' campo tag'),
            // §M3-fix: tag_sinergia = tag tematici secondari (futuro sistema
            // sinergie); non ancora letto dal motore. Vedi nota in parse_attacchi.
            tag_sinergia: to_tag_array(r.tag_sinergia, ctx + ' campo tag_sinergia'),
            durata: r.durata,
            // §1.8 v0.6: salta_step_tag (bool). Se true e l'abilita' infligge
            // danno, la pipeline (§5.7 step 4) salta il match tag vs vuln/res:
            // l'effetto e' "puro", non legato a un'arma.
            salta_step_tag: r.salta_step_tag === '' || r.salta_step_tag === undefined
                ? false
                : to_bool(r.salta_step_tag, ctx + ' campo salta_step_tag'),
            // §S4-fix: effetto_strutturato = array JSON di op meccaniche.
            // Usato da _risolvi_abilita in luogo del parsing regex su effetto_meccanico.
            // Null se la colonna e' assente (retrocompatibilita' con carte di test).
            effetto_strutturato: (r.effetto_strutturato && r.effetto_strutturato !== '')
                ? JSON.parse(r.effetto_strutturato)
                : null,
            _tipo_carta: 'abilita',
        };
    });
}

// -----------------------------------------------------------------------------
// §1.9 v0.6 — parse_equipaggiamenti
// Sostituisce il vecchio parse_oggetti per i record con tipo_oggetto =
// "equipaggiamento". Differenze chiave rispetto a v0.5:
//   - ID con pattern EQP_[A-Z_]+ (non piu' OBJ_).
//   - Slot enum ridotto a {arma, armatura, talismano} (accessorio rinominato).
//   - Nuovi campi v0.6: tag (array), livello (default 1), livello_max
//     (default 3), stats_per_livello (JSON inline, esattamente 3 elementi),
//     forme_finali (JSON inline, 2-3 RamoEvolutivo).
//   - Non c'e' piu' tipo_oggetto (lo schema e' tutto-equipaggiamento qui).
//   - Non c'e' piu' costo_energia ne durata: gli equipaggiamenti non vengono
//     "giocati" come carte, vengono ASSEGNATI a uno slot e producono effetti
//     passivi/attivi via stats_per_livello.
// -----------------------------------------------------------------------------
function parse_equipaggiamenti(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `equipaggiamenti.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^EQP_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID equipaggiamento non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'equipaggiamenti.csv');
        controlla_enum(r.slot, ENUM_SLOT_EQUIP, ctx + ' campo slot');
        controlla_enum(r.classe_preferita, ENUM_CLASSE, ctx + ' campo classe_preferita');

        // §1.9 v0.6: stats_per_livello deve essere un JSON inline con
        // ESATTAMENTE 3 elementi (Lv1, Lv2, Lv3). Lo schema dei singoli
        // elementi dipende dallo slot (vedi §1.9): per ora il parser non
        // valida la struttura interna; lo fara' la pipeline danno e
        // l'auto_evoluzione_equip (§5.11) nei sotto-step 16.3/16.7.
        const stats_per_livello = to_json_inline(
            r.stats_per_livello, ctx + ' campo stats_per_livello'
        );
        if (!Array.isArray(stats_per_livello) || stats_per_livello.length !== 3) {
            throw new Error(
                `${ctx}: stats_per_livello deve essere un array di esattamente 3 elementi ` +
                `(Lv1/Lv2/Lv3), trovato ${Array.isArray(stats_per_livello) ? stats_per_livello.length : 'non-array'}`
            );
        }

        // §1.9 v0.6: forme_finali deve essere un array di 2-3 RamoEvolutivo
        // (oggetti con id, nome, trigger, stats, ecc.). Sblocco al Lv3 (§5.11).
        const forme_finali = to_json_inline(
            r.forme_finali, ctx + ' campo forme_finali'
        );
        if (!Array.isArray(forme_finali) || forme_finali.length < 2 || forme_finali.length > 3) {
            throw new Error(
                `${ctx}: forme_finali deve essere un array di 2-3 RamoEvolutivo, ` +
                `trovato ${Array.isArray(forme_finali) ? forme_finali.length : 'non-array'}`
            );
        }
        // Sanity check sui RamoEvolutivo: campo `id` obbligatorio per il
        // riferimento futuro dalla UI di scelta forma_finale.
        for (let i = 0; i < forme_finali.length; i++) {
            if (!forme_finali[i] || typeof forme_finali[i].id !== 'string') {
                throw new Error(
                    `${ctx}: forme_finali[${i}] manca del campo id (string)`
                );
            }
        }

        // livello: default 1, ma la carta CSV puo' specificarlo (utile per
        // test). livello_max: default 3.
        const livello = r.livello === '' || r.livello === undefined
            ? 1
            : to_int(r.livello, ctx + ' campo livello');
        const livello_max = r.livello_max === '' || r.livello_max === undefined
            ? 3
            : to_int(r.livello_max, ctx + ' campo livello_max');
        if (livello < 1 || livello > livello_max) {
            throw new Error(`${ctx}: livello=${livello} fuori range [1, ${livello_max}]`);
        }

        return {
            id: r.id,
            nome: r.nome,
            slot: r.slot,
            tag: to_tag_array(r.tag, ctx + ' campo tag'),
            livello,
            livello_max,
            stats_per_livello,
            forme_finali,
            classe_preferita: r.classe_preferita,
            descrizione_narrativa: r.descrizione_narrativa,
            // §M3-fix: tag_sinergia = tag tematici secondari (futuro sistema
            // sinergie); non ancora letto dal motore. Vedi nota in parse_attacchi.
            tag_sinergia: to_tag_array(r.tag_sinergia, ctx + ' campo tag_sinergia'),
            _tipo_carta: 'equipaggiamento',
        };
    });
}

// -----------------------------------------------------------------------------
// §1.9bis v0.6 — parse_consumabili
// Carta a uso singolo, va negli scarti dopo l'uso. Non occupa slot, si pesca
// e si gioca dalla mano come una qualunque carta Erranti. Differenze chiave
// rispetto agli equipaggiamenti:
//   - ID con pattern CNS_[A-Z_]+.
//   - Ha costo_energia (si gioca con gioca_carta come una carta normale).
//   - Non ha slot, ne livello, ne forme_finali.
//   - `effetto` e' un EffettoPayload (§6.2) JSON inline (struttura {op, bersaglio, valore, ...}).
//   - target e' piu' ampio dei target_abl per supportare aree (tutti_pg,
//     tutti_nemici, scena).
// -----------------------------------------------------------------------------
function parse_consumabili(righe) {
    const ids = new Set();
    return righe.map((r, idx) => {
        const ctx = `consumabili.csv riga ${idx + 2} (id=${r.id})`;
        if (!r.id || !/^CNS_[A-Z_]+$/.test(r.id)) {
            throw new Error(`ID consumabile non valido in ${ctx}: "${r.id}"`);
        }
        controlla_id_unico(ids, r.id, 'consumabili.csv');
        controlla_enum(r.classe_preferita, ENUM_CLASSE, ctx + ' campo classe_preferita');
        controlla_enum(r.target, ENUM_TARGET_CNS, ctx + ' campo target');

        // §1.9bis v0.6: `effetto` e' un EffettoPayload (oggetto JSON inline).
        // Il parser non valida la forma interna: lo fara' il modulo che
        // applica l'effetto (§6.2) nei sotto-step successivi.
        const effetto = to_json_inline(r.effetto, ctx + ' campo effetto');

        return {
            id: r.id,
            nome: r.nome,
            classe_preferita: r.classe_preferita,
            costo_energia: to_int(r.costo_energia, ctx + ' campo costo_energia'),
            descrizione_narrativa: r.descrizione_narrativa,
            effetto,
            target: r.target,
            tag: to_tag_array(r.tag, ctx + ' campo tag'),
            // §M3-fix: tag_sinergia = tag tematici secondari (futuro sistema
            // sinergie); non ancora letto dal motore. Vedi nota in parse_attacchi.
            tag_sinergia: to_tag_array(r.tag_sinergia, ctx + ' campo tag_sinergia'),
            _tipo_carta: 'consumabile',
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

        // §1.10 v0.6: essenza_drop deve usare tag appartenenti alle 10
        // categorie di essenze (§5.11). Faccio un warning soft, non error
        // fatale: il bilanciamento delle drop e' un PARKING_LOT_ESSENZE_DROP_TABLE.
        const essenza_drop = to_array_pipe(r.essenza_drop);
        for (const tag of essenza_drop) {
            if (!ENUM_ESSENZA_TAG.includes(tag)) {
                console.warn(
                    `[parse_nemici] ${ctx}: essenza_drop "${tag}" non e' tra le 10 categorie ufficiali ` +
                    `(${ENUM_ESSENZA_TAG.join(',')}). Lasciato passare ma occhio al bilanciamento.`
                );
            }
        }

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
            // §1.10 v0.6: vulnerabilita/resistenza sono tag che, nella pipeline
            // danno §5.7 step 4, applicano moltiplicatore x1.5 / x0.5 al danno
            // se la FONTE (carta o arma) include un tag matchante. essenza_drop
            // lista le categorie di essenze rilasciate alla sconfitta (§5.11).
            vulnerabilita: to_tag_array(r.vulnerabilita, ctx + ' campo vulnerabilita'),
            resistenza: to_tag_array(r.resistenza, ctx + ' campo resistenza'),
            essenza_drop,
        };
    });
}

// -----------------------------------------------------------------------------
// §1.11.3 v0.6 — carica_dati(): legge tutti i CSV + i due JSON, valida e
// ritorna l'oggetto DatabaseCarte. Errori = fatali (manca un file o un campo
// critico).
//
// Cambiamenti v0.6:
//   - oggetti.csv RIMOSSO. Sostituito da equipaggiamenti.csv + consumabili.csv.
//   - Restituisce due nuovi pool: db.equipaggiamenti, db.consumabili.
//     `db.oggetti` non esiste piu': tutti i siti aggiornati (fix C1, 16.11).
// -----------------------------------------------------------------------------
function carica_dati(dir_dati) {
    const base = path.resolve(dir_dati);
    if (!fs.existsSync(base)) {
        throw new Error(`Cartella dati non trovata: ${base}`);
    }
    console.log(`[carica_dati] Cartella dati: ${base}`);

    const files = {
        mondi:           path.join(base, 'mondi.csv'),
        luoghi:          path.join(base, 'luoghi.csv'),
        eventi:          path.join(base, 'eventi.csv'),
        twist:           path.join(base, 'twist.csv'),
        png:             path.join(base, 'png.csv'),
        attacchi:        path.join(base, 'attacchi.csv'),
        abilita:         path.join(base, 'abilita.csv'),
        // v0.6: sdoppiati. Vedi §1.9 (equipaggiamenti) e §1.9bis (consumabili).
        equipaggiamenti: path.join(base, 'equipaggiamenti.csv'),
        consumabili:     path.join(base, 'consumabili.csv'),
        nemici:          path.join(base, 'nemici.csv'),
        config:          path.join(base, 'config.json'),
        sinergie:        path.join(base, 'sinergie.json'),
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
    const equipaggiamenti = parse_equipaggiamenti(leggi_csv(files.equipaggiamenti));
    console.log(`[carica_dati] equipaggiamenti.csv: ${equipaggiamenti.length} record OK`);
    const consumabili = parse_consumabili(leggi_csv(files.consumabili));
    console.log(`[carica_dati] consumabili.csv: ${consumabili.length} record OK`);
    const nemici   = parse_nemici(leggi_csv(files.nemici));
    console.log(`[carica_dati] nemici.csv: ${nemici.length} record OK`);

    const config   = JSON.parse(fs.readFileSync(files.config, 'utf8'));
    console.log(`[carica_dati] config.json: versione regolamento ${config._versione_regolamento}`);

    // v0.6: controllo soft di versione. Se _versione_regolamento non e' 0.6,
    // segnalo che il parser si aspetta v0.6. Non lo rendo fatale per consentire
    // test con config piu' vecchi durante la migrazione.
    if (config._versione_regolamento && config._versione_regolamento !== '0.6') {
        console.warn(
            `[carica_dati] WARN: config.json dichiara versione regolamento ` +
            `"${config._versione_regolamento}" ma il parser e' allineato a "0.6".`
        );
    }
    // v0.6: controllo presenza del blocco config.combattimento e dei suoi
    // parametri chiave. Sono richiesti dal sotto-step 16.3 (pipeline_danno).
    if (!config.combattimento) {
        throw new Error(
            `config.json (§0.3): manca il blocco "combattimento" (v0.6). ` +
            `Aggiungere: moltiplicatore_vulnerabilita, moltiplicatore_resistenza, ` +
            `essenze_per_lv2, essenze_per_lv3.`
        );
    }
    for (const k of ['moltiplicatore_vulnerabilita', 'moltiplicatore_resistenza',
                     'essenze_per_lv2', 'essenze_per_lv3']) {
        if (typeof config.combattimento[k] !== 'number') {
            throw new Error(`config.json: combattimento.${k} mancante o non numerico`);
        }
    }

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
        attacchi, abilita,
        // v0.6: due pool distinti, non piu' "oggetti".
        equipaggiamenti, consumabili,
        nemici,
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
//   2 CardConsumabile   <-- v0.6: era "CardOggetto" generica.
//
// Combino le due dimensioni applicando la quota classe sulla quota tipo con
// arrotondamento sensato. Il pool MVP per-classe e piccolo: uso pesca CON
// reinserimento (duplicati ammessi) cosi il deck-building MVP funziona anche
// con 1 sola abilita per classe.
//
// CAMBIO v0.6 (§1.9 vs §1.9bis):
//   - Gli EQUIPAGGIAMENTI non vanno piu' in pila: occupano i 3 slot del PG
//     (arma/armatura/talismano) e sono iniziali per classe (§2.2).
//   - I CONSUMABILI restano carte normali: si pescano, si giocano dalla mano.
//   Quindi la vecchia quota "oggetto" diventa quota "consumabile".
// -----------------------------------------------------------------------------
function costruisci_pila_iniziale(classe, db, rng_state) {
    if (!ENUM_CLASSE.includes(classe) || classe === 'universale') {
        throw new Error(`Classe non valida per pila iniziale: ${classe}`);
    }

    const totale = db.config.pg.dimensione_pila_iniziale; // 15

    // Quote per classe (60/30/10) e per tipo (8/5/2). Pre-calcolo:
    // - 8 attacchi totali     -> 60% classe ~5, 30% universale ~2, 10% altra ~1
    // - 5 abilita totali      -> 60% classe ~3, 30% universale ~2, 10% altra ~0
    // - 2 consumabili totali  -> 60% classe ~1, 30% universale ~1, 10% altra ~0
    // Somme: classe = 9, universale = 5, altra = 1.
    const piano = [
        { tipo: 'attacco',     classe_pref: 5, universale: 2, altra: 1 },
        { tipo: 'abilita',     classe_pref: 3, universale: 2, altra: 0 },
        { tipo: 'consumabile', classe_pref: 1, universale: 1, altra: 0 },
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
        if (tipo === 'attacco')          pool = db.attacchi;
        else if (tipo === 'abilita')     pool = db.abilita;
        else if (tipo === 'consumabile') pool = db.consumabili;
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

    // §2.2 v0.6: essenze del PG, 10 categorie inizializzate a zero.
    // Vengono droppate dai nemici sconfitti (§5.7 step 9 + §1.10
    // essenza_drop) e spese in §5.11 (auto_evoluzione_equip).
    const essenze_iniziali = {};
    for (const tag of ENUM_ESSENZA_TAG) essenze_iniziali[tag] = 0;

    // §C3-fix: equipaggiamento iniziale per classe (§2.2, PARKING_LOT_EQUIP_INIZIALE_CLASSE chiuso).
    // Priorita': slot+classe precisa → slot+universale → null.
    // L'armatura non e' presente nei CSV correnti: slot resta null.
    const pick_equip = (slot) =>
        db.equipaggiamenti.find(e => e.slot === slot && e.classe_preferita === classe)
        || db.equipaggiamenti.find(e => e.slot === slot && e.classe_preferita === 'universale')
        || null;
    const istanza_equip = (equip) => equip
        ? { livello: 1, forma_scelta_id: null, tag_correnti: [...equip.tag] }
        : null;
    const equip_arma      = pick_equip('arma');
    const equip_talismano = pick_equip('talismano');

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
            // §2.2 v0.6: i 3 slot. "accessorio" e' rinominato in "talismano".
            // Slot popolati dall'equipaggiamento iniziale della classe (C3-fix).
            equipaggiamento: {
                arma:      equip_arma      ? equip_arma.id      : null,
                armatura:  null,
                talismano: equip_talismano ? equip_talismano.id : null,
            },

            // === Sotto-step 16.7 (ROADMAP, regolamento v0.6 §5.11) ============
            // `equip_istanze`: stato per-PG di ogni slot equipaggiato. Lo slot
            // `equipaggiamento[slot]` resta un id stringa (riferimento al db,
            // condiviso e read-only); l'ISTANZA per-PG che varia nel tempo
            // (livello salito, forma finale scelta) vive qui accanto.
            //
            // Per ogni slot:
            //   - livello:         intero in [1, equip.livello_max]. Setta a 1
            //                      quando il PG equipaggia il pezzo (o al setup
            //                      per gli equip iniziali, quando saranno
            //                      assegnati — vedi PARKING_LOT_EQUIP_INIZIALE_CLASSE).
            //                      Sale automaticamente via auto_evoluzione_equip
            //                      (§5.11) quando ci sono abbastanza essenze.
            //   - forma_scelta_id: string | null. null = forma_finale non
            //                      ancora scelta (anche se livello == 3:
            //                      §5.11 punto 2 dice "rimane Lv3 base"
            //                      finche' non scatta un trigger). Diventa
            //                      l'id di una delle equip.forme_finali quando
            //                      il PG sceglie via conferma_forma_finale().
            //   - tag_correnti:    array di tag effettivamente attivi sul
            //                      pezzo. All'inizio = equip.tag; quando si
            //                      sceglie una forma_finale, diventa
            //                      equip.tag ∪ forma.tag_aggiuntivi. Letto da
            //                      tutto cio' che fa match tag (pipeline_danno
            //                      step 4, sinergie σ1/σ2). Mantenuto qui
            //                      come materializzazione esplicita per non
            //                      doverlo ricalcolare ogni volta.
            //
            // Istanze create a Lv1 per gli slot equipaggiati al setup (C3-fix).
            equip_istanze: {
                arma:      istanza_equip(equip_arma),
                armatura:  null,
                talismano: istanza_equip(equip_talismano),
            },

            // === Sotto-step 16.7 (ROADMAP, §5.11 Fase 2) ======================
            // `scelta_forma_pendente`: usato quando un trigger forma_finale
            // viene soddisfatto e l'UI deve far scegliere al PG. Valori:
            //   - null: nessuna scelta pendente (caso normale).
            //   - { slot, opzioni: [{forma_id, nome, descrizione_narrativa}] }:
            //       il PG deve scegliere `forma_id` tra le opzioni. La fase
            //       globale del gioco e' transitata a ATTESA_SCELTA_FORMA_FINALE
            //       e resta li' finche' arriva conferma_forma_finale().
            // Vive sul PG (non sul GameState) per non bloccare l'intero
            // gruppo se contemporaneamente piu' PG fossero pronti a evolvere:
            // si valutano in sequenza, un PG alla volta.
            scelta_forma_pendente: null,

            ko: false,

            // === Nuovi campi v0.6 (§2.2) ===

            // Pool di essenze accumulate durante la run. Vedi §5.11 per la
            // spesa al raggiungimento delle soglie di livello dell'equip.
            essenze: essenze_iniziali,

            // Stato turno: il PG ha diritto a 1 attacco base GRATUITO per
            // turno (§5.2bis). Questo flag traccia se l'ha gia' usato nel
            // turno corrente. Viene resettato a `false` da inizio_turno_pg
            // (§5.2). Successivi attacchi base nello stesso turno costano
            // arma.stats_per_livello[livello-1].costo_extra EN.
            attacco_base_gratuito_consumato_questo_turno: false,

            // Cache delle sinergie σ2 attive (sinergie di equipaggiamento,
            // §5.6.3). Ricalcolata da valuta_sinergie_passive() ogni volta
            // che cambia un equip e a inizio combattimento. Array di
            // SinergiaId (stringhe), inizialmente vuoto.
            sinergie_attive: [],

            // Contatore "quante carte con tag X sono state giocate questo
            // turno". Mappa tag -> intero, popolata da gioca_carta (§5.5),
            // letta da valuta_sinergie_attive (§5.6.2 per σ1), resettata
            // a {} da inizio_turno_pg.
            carte_giocate_per_tag_turno: {},

            // === Sotto-step 16.6 (ROADMAP): runtime sinergie σ1 ===========
            // Quando una σ1 con effetto `bonus_danno_prossima_carta_con_tag`
            // scatta, deposita qui {tag, valore}. La pipeline_danno step 2
            // (helper bonus_sinergia_attiva) legge questo campo: se la fonte
            // ha quel tag, applica il bonus e lo CONSUMA (rimettendo a null).
            // §5.6.3: "una_tantum_per_turno" implica consumo immediato dopo
            // l'applicazione. Reset a null anche a inizio turno (difesa in
            // profondita': se per qualche motivo non e' stato consumato, non
            // si trascina al turno successivo).
            bonus_prossima_carta_tag: null,

            // Quando una σ1 con effetto `riduzione_costo` scatta, deposita
            // qui {tag, valore}. gioca_carta lo legge nella precheck energia:
            // se la prossima carta ha quel tag, il costo effettivo viene
            // ridotto del `valore`, e il flag viene CONSUMATO (a null).
            // Stesso ciclo di vita di bonus_prossima_carta_tag.
            riduzione_costo_prossima_carta_tag: null,

            // Array degli id sinergia σ1 gia' scattati questo turno. Serve
            // a rispettare il flag `una_tantum_per_turno` (§5.6.3): se l'id
            // e' qui, la sinergia non scatta di nuovo nello stesso turno
            // anche se la soglia viene riraggiunta dopo il consumo. Reset
            // a [] da inizio_turno_pg.
            sigma1_scattate_questo_turno: [],

            // === Campo da v0.4 (mantenuto in v0.6) ===

            // EXT_BONUS_CARTE_RIPOSO (§4.1): pesca 1 carta extra il prossimo
            // turno. Settato dal nodo riposo, consumato da pesca_pg (§5.4).
            bonus_carte_prossimo_turno: 0,
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
        // v0.6: aggiornata la versione delle regole tracciata nello state.
        // I sotto-step 16.x portano avanti il refactor verso v0.6.
        versione_regole: '0.6',
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

// Trigger Alleato: chiamato da pipeline_danno PRIMA di marcare KO un PG.
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
    // Pool universali del mercante (equipaggiamenti + consumabili; C1-fix).
    const pool = db.equipaggiamenti.concat(db.consumabili).filter(o => o.classe_preferita === 'universale');
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
// === Sotto-step 16.4 (ROADMAP, regolamento v0.6) - "esegui_attacco_base()" ====
// Aggiunte applicate in questo file dal sotto-step 16.4:
//   - inizio_turno_pg (§5.2 punti 3-4): reset dei flag v0.6 a inizio turno
//     del PG corrente: `attacco_base_gratuito_consumato_questo_turno = false`
//     e `carte_giocate_per_tag_turno = {}`.
//   - Nuovo entry point esposto `esegui_attacco_base(state, pg_id, target_id, db)`
//     (§5.2bis). Costruisce uno pseudo-attacco a partire dall'arma del PG e
//     lo passa a pipeline_danno (§5.7). Il primo attacco base del turno e'
//     gratuito; i successivi costano arma.costo_extra EN.
//   - Helper interni: `_risolvi_arma_pg`, `_costruisci_pseudo_attacco_base`.
//   - Nuovo codice di errore: ERR_ARMA_NON_EQUIPAGGIATA (§8.3).
//   - Export del nuovo entry point in module.exports.
// I sotto-step 16.6/16.7 (sinergie σ1, evoluzione) NON sono toccati qui.
//
// === Sotto-step 16.5 (ROADMAP, regolamento v0.6) - "Sinergie σ2 passive" =====
// Aggiunte applicate in questo file dal sotto-step 16.5:
//   - Nuova funzione esposta `valuta_sinergie_passive(state, pg_id, db)` (§5.6.4).
//     Cicla su tutte le sinergie σ2 di `db.sinergie.sinergie`, valuta la
//     condizione (per ora solo `equip_tag_match`) e aggiorna l'array
//     `pg.sinergie_attive` (set di id sinergia, niente duplicati).
//     Log `sinergia_attivata` / `sinergia_disattivata` solo sulle transizioni.
//   - Helper interno `_condizione_equip_tag_match` (§5.6.2): conta quanti slot
//     listati hanno il tag richiesto e confronta con la soglia. Aperto al
//     `# EXT_CONDIZIONI_SINERGIA` (classe_pg, status_attivo, pv_soglia) in
//     futuro: oggi le σ2 del pool usano solo equip_tag_match.
//   - Hook di valutazione (§5.6.4):
//       a) `avvia_combattimento` -> chiama `valuta_sinergie_passive` per
//          ogni PG (cosi' i bonus passivi sono attivi sin dal primo turno).
//       b) `inizio_turno_pg` -> rivaluta SOLO per il PG di turno
//          (transizioni dovute a equip cambiato in nodo riposo o tra combat).
//       c) PARKING: hook equip/unequip/evoluzione arriveranno in 16.7
//          (`auto_evoluzione_equip` + cambio `forma_finale`). Per ora i tre
//          slot del PG iniziano a null e cambiano solo via test manuale.
//   - `bonus_sinergia_attiva` (helper della pipeline_danno step 2) e' ora
//     COMPLETO per la parte σ2: legge `pg.sinergie_attive`, risale alla
//     definizione in `db.sinergie.sinergie`, e applica il bonus quando la
//     fonte e' uno pseudo-attacco base (riconosciuto via flag interno
//     `_tipo_carta === 'attacco_base'`, settato da `_costruisci_pseudo_attacco_base`).
//     La parte σ1 (`bonus_danno_prossima_carta_con_tag`) e' commentata come
//     PARKING e verra' aggiunta in 16.6.
// I sotto-step 16.6/16.7 NON sono toccati qui.
//
// === Sotto-step 16.6 (ROADMAP, regolamento v0.6) - "Sinergie σ1" =============
// Aggiunte applicate in questo file dal sotto-step 16.6:
//   - Nuova funzione esposta `valuta_sinergie_attive(state, pg_id, carta, db)`
//     (§5.6.4). Cicla σ1 di db.sinergie.sinergie, valuta la condizione
//     `n_carte_tag_in_turno` contro `pg.carte_giocate_per_tag_turno`, e se
//     vera applica l'effetto:
//       - `bonus_danno_prossima_carta_con_tag` -> setta `pg.bonus_prossima_carta_tag`
//       - `riduzione_costo` -> setta `pg.riduzione_costo_prossima_carta_tag`
//     L'id della sinergia viene aggiunto a `pg.sigma1_scattate_questo_turno`
//     per il flag `una_tantum_per_turno` (§5.6.3).
//   - `gioca_carta` (§5.5):
//       - punto 1 (precheck/scarico energia): applica eventuale
//         `riduzione_costo_prossima_carta_tag` se la carta ha il tag matchato
//         e consuma il flag.
//       - punto 3 (post-energia, pre-switch): incrementa
//         `pg.carte_giocate_per_tag_turno[tag]` per ogni tag della carta.
//       - punto 5 (post-switch): chiama `valuta_sinergie_attive(s, pg_id,
//         carta, db)`. Coerente con §5.5 punto 5 (preferito a "fine pipeline
//         step 9" perche' σ1 deve scattare anche su abilita' non-danno con tag).
//   - `bonus_sinergia_attiva` (helper pipeline_danno step 2): chiusura del
//     PARKING_LOT_SINERGIE_SIGMA1. Legge `pg.bonus_prossima_carta_tag`, se la
//     fonte ha quel tag applica il bonus e SETTA UN FLAG di consumo
//     differito (vedi commento nella funzione: consumare durante il calcolo
//     creerebbe un side effect dentro un helper "puro"; il consumo vero
//     avviene poco dopo dentro pipeline_danno).
//   - `inizio_turno_pg` (§5.2): reset di `bonus_prossima_carta_tag`,
//     `riduzione_costo_prossima_carta_tag`, `sigma1_scattate_questo_turno`.
//     Difesa in profondita': dopo un turno completo nessuna σ1 deve sopravvivere.
//   - `module.exports`: aggiungo `valuta_sinergie_attive`.
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
//     [PARKING_LOT_ARMA_ISTANZA chiuso in 16.11: struttura equip_istanze creata
//     in 16.7, livello reale letto da _risolvi_arma_pg da M2-fix. S1-fix.]
//   - PARKING_LOT_EQUIP_INIZIALE_CLASSE (setup.js): al setup, gli slot
//     `arma/armatura/talismano` sono `null`. Il regolamento prescrive che
//     siano sempre occupati con l'equip iniziale della classe. Finche' non
//     e' implementato, esegui_attacco_base ritorna ERR_ARMA_NON_EQUIPAGGIATA
//     (gestito esplicitamente, §8.3). I test di 16.4 forniscono l'arma a mano.
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
    // Sotto-step 16.7 (§5.11 Fase 2): un equip ha raggiunto il Lv3, almeno un
    // trigger forma_finale e' soddisfatto, e il motore attende che il PG
    // scelga via conferma_forma_finale(). Fase BLOCCANTE: nessuna altra
    // azione e' valida finche' la scelta non e' confermata. Si esce
    // automaticamente alla fase salvata in `state.fase_prima_di_scelta_forma`.
    ATTESA_SCELTA_FORMA_FINALE: 'attesa_scelta_forma_finale',
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
//   - Le funzioni private (_applica_status_tick, ecc.) NON
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
function inizio_turno_pg(state, db) {
    // Interna al ciclo turno: NON clona (chi la chiama ha gia' clonato).
    // 16.8: db arriva esplicitamente dai chiamanti (avvia_combattimento e
    // fine_round). Chiuso il debito tecnico della globale di modulo. Serve per:
    //   - valuta_sinergie_passive (§5.6.4 punto c, hook inizio turno)
    //   - propagare alla catena status_tick_pg -> ... -> turno_nemici -> pipeline_danno.
    let s = state;
    const pg = s.giocatori[s.turno_di];

    // Skip se KO (§5.2 precondizione): avanza al prossimo PG non-KO.
    if (pg.ko) {
        s = _log_append(s, 'fase_cambiata', pg.id, null,
            { motivo: 'pg_ko_skip' },
            `${pg.nome} è KO, salta il turno.`);
        return _avanza_turno_o_nemici(s, db);
    }

    // §5.2 punto 1: log "turno_iniziato".
    s = _log_append(s, 'fase_cambiata', pg.id, null,
        { evento: 'turno_iniziato', round: s.round_numero },
        `Inizia il turno di ${pg.nome} (round ${s.round_numero}).`);

    // §5.2 punto 2: reset energia.
    s.giocatori[s.turno_di].energia = s.config.pg.energia_per_turno;

    // §5.2 punto 3 (v0.6) — reset del flag "attacco base gratuito gia' usato".
    // Ogni PG ha diritto a 1 attacco base GRATUITO per turno (§5.2bis). Il
    // flag e' per-PG: lo resettiamo qui all'inizio del turno del PG corrente.
    // I PG che NON sono di turno mantengono il loro flag invariato (non e'
    // necessario azzerarli, perche' nessuno legge il flag al di fuori del
    // proprio turno).
    s.giocatori[s.turno_di].attacco_base_gratuito_consumato_questo_turno = false;

    // §5.2 punto 4 (v0.6) — reset del contatore σ1 (multi-carta in turno).
    // Mappa `tag -> intero`: ogni carta giocata col proprio tag incrementa il
    // contatore (logica in gioca_carta dopo 16.6). A inizio turno si riparte
    // da zero. Per ora il contatore non e' ancora popolato (16.6 lo aggancia
    // alla pipeline_danno step 9), ma il reset e' richiesto dal regolamento e
    // non costa nulla averlo gia' qui.
    s.giocatori[s.turno_di].carte_giocate_per_tag_turno = {};

    // §5.2 punto 4bis (v0.6, sotto-step 16.6) — reset dei flag runtime σ1.
    // Per coerenza con il regolamento (una σ1 e' un "buff per la prossima
    // carta di QUESTO turno"): qualunque bonus o riduzione non consumato
    // viene azzerato a inizio turno. Stesso trattamento per il set delle
    // sinergie σ1 gia' scattate (rispetto a `una_tantum_per_turno`).
    s.giocatori[s.turno_di].bonus_prossima_carta_tag = null;
    s.giocatori[s.turno_di].riduzione_costo_prossima_carta_tag = null;
    s.giocatori[s.turno_di].sigma1_scattate_questo_turno = [];

    // §5.6.4 punto (c) — Inizio turno PG: rivaluto le sinergie σ2 SOLO per il
    // PG di turno. Coerente con la spec: σ2 dipendono da equip_tag_match, che
    // potrebbe cambiare tra turni se 16.7 introdurra' auto-evoluzione fuori
    // dal proprio turno. Idempotente: se nulla e' cambiato, niente log.
    // 16.8: db arriva ora esplicitamente dai chiamanti (chiuso il debito
    // tecnico della globale di modulo).
    s = valuta_sinergie_passive(s, s.giocatori[s.turno_di].id, db);

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
    // 16.8: db propagato esplicitamente lungo la catena del ciclo turno.
    s.fase_corrente = FASE.STATUS_TICK_PG;
    return status_tick_pg(s, db);
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

function status_tick_pg(state, db) {
    // Interna al ciclo turno: NON clona.
    // 16.8: db arriva da inizio_turno_pg. Pesca_pg non lo usa (esce in
    // ATTESA_AZIONE_PG, fuori dal ciclo automatico), ma fine_turno_pg si',
    // perche' chiama _avanza_turno_o_nemici -> turno_nemici (che lo passa
    // a esegui_comportamento e pipeline_danno).
    let s = state;
    const pg = s.giocatori[s.turno_di];

    if (pg.ko) {
        s.fase_corrente = FASE.FINE_TURNO_PG;
        return fine_turno_pg(s, db);
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
        return fine_turno_pg(s, db);
    }

    // Se stordito: skip a fine turno.
    if (r.flags.salta_azione) {
        s.fase_corrente = FASE.FINE_TURNO_PG;
        return fine_turno_pg(s, db);
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

    // §4.1 (riposo) + §5.4 M4-fix: se il PG ha bonus carte da nodo riposo, le
    // aggiungo qui. Il limite massimo e' dimensione_mano + bonus (§5.4); le
    // eventuali carte in eccesso vengono scartate con log scarto_per_mano_piena.
    // Il flag viene azzerato dopo la pesca.
    const pg_now = s.giocatori[s.turno_di];
    if (pg_now.bonus_carte_prossimo_turno && pg_now.bonus_carte_prossimo_turno > 0) {
        const bonus = pg_now.bonus_carte_prossimo_turno;
        // §5.4 M4-fix: limite massimo esteso dal bonus.
        const limite_max = s.config.pg.dimensione_mano + bonus;
        const prima = pg_now.mano.length;
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
        // §5.4 M4-fix: scarta l'eccesso oltre limite_max con log scarto_per_mano_piena.
        while (pg_now.mano.length > limite_max) {
            const scartata = pg_now.mano.pop();
            pg_now.scarti.push(scartata);
            s = _log_append(s, 'fase_cambiata', pg.id, null,
                { evento: 'scarto_per_mano_piena', carta: scartata },
                `${pg.nome} ha la mano piena: scarta ${scartata}.`);
        }
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
    // abilita, equipaggiamento o consumabile: cerco in tutti i pool; C1-fix).
    const carta = db.attacchi.find(c => c.id === carta_id)
              || db.abilita.find(c => c.id === carta_id)
              || db.equipaggiamenti.find(c => c.id === carta_id)
              || db.consumabili.find(c => c.id === carta_id);
    if (!carta) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_CARTA_NON_IN_MANO',
                      messaggio: `${carta_id} non trovata nel database` } };
    }

    // Calcolo del costo effettivo, tenendo conto di una eventuale
    // riduzione_costo σ1 attiva (§5.6.3, sotto-step 16.6).
    // Se la prossima carta col tag X aveva diritto a -V EN e questa carta ha
    // quel tag, applico lo sconto e CONSUMO il flag. Floor a 0 (mai negativo).
    let costo_effettivo = carta.costo_energia;
    let riduzione_applicata = null;  // {tag, valore} o null, usato dopo per log/consumo
    if (pg.riduzione_costo_prossima_carta_tag) {
        const rid = pg.riduzione_costo_prossima_carta_tag;
        if (_carta_ha_tag(carta, rid.tag)) {
            costo_effettivo = Math.max(0, costo_effettivo - (rid.valore || 0));
            riduzione_applicata = { tag: rid.tag, valore: rid.valore };
        }
    }

    if (pg.energia < costo_effettivo) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_ENERGIA_INSUFFICIENTE',
                      messaggio: `Servono ${costo_effettivo} EN, ne hai ${pg.energia}` } };
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

    // §5.5 punto 1: scala energia (con eventuale riduzione σ1 gia' calcolata).
    s.giocatori[pg_idx].energia -= costo_effettivo;

    // §5.5 punto 1bis (16.6): consumo del flag riduzione_costo σ1, se usato.
    // Il flag e' "una tantum per turno" (§5.6.3): una volta consumato, sparisce.
    // Logga sia il consumo (nice-to-have per debug), sia mantiene il flusso.
    if (riduzione_applicata) {
        s.giocatori[pg_idx].riduzione_costo_prossima_carta_tag = null;
        s = _log_append(s, 'sinergia_consumata', pg_id, null,
            { tipo: 'riduzione_costo', tag: riduzione_applicata.tag,
              valore: riduzione_applicata.valore, carta_id, costo_originale: carta.costo_energia,
              costo_effettivo },
            `Sinergia σ1 (riduzione costo ${riduzione_applicata.tag}): "${carta.nome}" costa ${costo_effettivo} EN invece di ${carta.costo_energia}.`);
    }

    // §5.5 punto 3 (v0.6, 16.6): aggiorno il contatore σ1 per ogni tag della
    // carta. Le CardAttacco hanno `tag` (array, §1.7), le CardAbilita possono
    // averlo (§1.8). Le carte senza tag non incrementano nulla (degrado elegante).
    const tags_carta = _estrai_tag_carta(carta);
    for (const t of tags_carta) {
        const counter = s.giocatori[pg_idx].carte_giocate_per_tag_turno || {};
        counter[t] = (counter[t] || 0) + 1;
        s.giocatori[pg_idx].carte_giocate_per_tag_turno = counter;
    }

    // §5.5 punto 4: log della giocata + switch sul tipo di carta.
    s = _log_append(s, 'carta_giocata', pg_id, target_id || null,
        { carta_id, costo: costo_effettivo },
        `${pg.nome} gioca "${carta.nome}".`);

    switch (carta._tipo_carta) {
        case 'attacco':
            s = _risolvi_attacco(s, pg_idx, carta, target_id, db);
            break;
        case 'abilita':
            s = _risolvi_abilita(s, pg_idx, carta, db);
            break;
        case 'oggetto':
            s = _risolvi_oggetto(s, pg_idx, carta);
            break;
    }

    // §5.5 punto 6: sposta carta in scarti (se non equipaggiata).
    // Le carte equipaggiamento gestiscono lo spostamento in _risolvi_oggetto.
    if (carta._tipo_carta !== 'oggetto' || carta.tipo_oggetto !== 'equipaggiamento') {
        const idx_mano = s.giocatori[pg_idx].mano.indexOf(carta_id);
        if (idx_mano !== -1) {
            s.giocatori[pg_idx].mano.splice(idx_mano, 1);
            s.giocatori[pg_idx].scarti.push(carta_id);
        }
    }

    // §5.5 punto 5 (regolamento v0.6, sotto-step 16.6): valuta le sinergie σ1
    // appena prima di tornare in attesa azione. Va DOPO lo switch perche':
    //   - la carta appena giocata e' gia' contata nel contatore tag (l'abbiamo
    //     incrementato prima dello switch);
    //   - vogliamo che una σ1 attivata DA questa carta possa essere applicata
    //     a una carta SUCCESSIVA nello stesso turno, non a questa stessa.
    // Nota: §5.6.4 ipotizza "termine step 9 della pipeline_danno"; abbiamo
    // scelto §5.5 punto 5 perche' copre uniformemente attacchi, abilita',
    // consumabili e equipaggiamenti (qualunque carta con tag puo' contare).
    s = valuta_sinergie_attive(s, pg_id, carta, db);

    // §5.5 punto 7: torna in attesa azione (a meno di vittoria/sconfitta).
    // Da v0.4: _verifica_condizioni_uscita transita gia' a ESPLORAZIONE se i
    // nemici sono finiti, quindi il check copre anche quel caso (oltre a
    // FINE_RUN per sconfitta, che resta terminale).
    // 16.8: db ora viaggia esplicitamente (chiuso il debito tecnico DB_REF).
    s = _verifica_condizioni_uscita(s, db);
    if (s.fase_corrente === FASE.ESPLORAZIONE ||
        s.fase_corrente === FASE.FINE_RUN) {
        return { ok: true, state: s, errore: null };
    }
    s.fase_corrente = FASE.ATTESA_AZIONE_PG;
    return { ok: true, state: s, errore: null };
}

// =============================================================================
// §5.2bis — esegui_attacco_base(state, pg_id, target_id, db)
// Entry point ESPOSTO: il PG colpisce un nemico con la propria arma equipaggiata.
//
// Pensalo come "tirare un fendente normale" (al contrario di "giocare una carta
// Attacco" che e' una manovra speciale). In v0.6 il PG ha sempre diritto a UN
// attacco base gratuito per turno; gli attacchi base successivi nello stesso
// turno costano `arma.costo_extra` EN.
//
// Sequenza (§5.2bis):
//   1. Validazioni di precondizione (§8.3): fase, PG di turno, target, arma.
//   2. Calcolo del costo: 0 se il "gratuito" non e' stato ancora consumato,
//      altrimenti arma.stats_per_livello[livello-1].costo_extra.
//   3. Verifica energia sufficiente per il costo extra.
//   4. Clone dello state (entry point esposto, vedi §9.3).
//   5. Aggiornamento flag attacco_base_gratuito_consumato_questo_turno + scala EN.
//   6. Costruzione pseudo_attacco_base (oggetto effimero, non una carta).
//   7. Invocazione di pipeline_danno (stesso entry point usato da gioca_carta).
//   8. Log evento "attacco_base".
//   9. Verifica condizioni di uscita (vittoria/sconfitta).
//  10. Ritorno alla fase ATTESA_AZIONE_PG (a meno di esiti terminali).
// =============================================================================

// Helper: risolve l'arma del PG dal db, applicando il livello reale letto da
// pg.equip_istanze.arma (M2-fix; PARKING_LOT_ARMA_ISTANZA chiuso in 16.11).
// Ritorna { ok: true, arma } se trovata, oppure { ok: false, errore } se assente.
function _risolvi_arma_pg(pg, db) {
    if (!pg.equipaggiamento || !pg.equipaggiamento.arma) {
        return { ok: false, errore: {
            codice: 'ERR_ARMA_NON_EQUIPAGGIATA',
            messaggio: `${pg.nome} non ha un'arma equipaggiata`,
        }};
    }
    const arma_id = pg.equipaggiamento.arma;
    const arma = db.equipaggiamenti.find(e => e.id === arma_id);
    if (!arma) {
        // Difensivo: id presente ma carta non trovata nel db. Non dovrebbe
        // accadere ma proteggiamoci comunque (es. CSV modificato a runtime).
        return { ok: false, errore: {
            codice: 'ERR_ARMA_NON_EQUIPAGGIATA',
            messaggio: `Arma "${arma_id}" di ${pg.nome} non presente nel database`,
        }};
    }
    if (arma.slot !== 'arma') {
        // Difensivo: e' stato infilato nello slot "arma" qualcosa che non e'
        // un'arma. Non dovrebbe succedere se la _risolvi_oggetto e' corretta.
        return { ok: false, errore: {
            codice: 'ERR_ARMA_NON_EQUIPAGGIATA',
            messaggio: `Lo slot arma di ${pg.nome} contiene "${arma_id}", che non e' un'arma (slot=${arma.slot})`,
        }};
    }
    // §5.11 M2-fix: usa il livello reale dell'istanza per-PG, non quello del CSV.
    const istanza = pg.equip_istanze && pg.equip_istanze.arma;
    const livello  = istanza ? istanza.livello : 1;
    return { ok: true, arma: { ...arma, livello } };
}

// Helper: costruisce lo pseudo_attacco_base che verra' passato a pipeline_danno.
// E' un oggetto effimero (non una CardAttacco): non viene mai serializzato, non
// vive nello state, esiste solo per la durata della chiamata. Pero' deve esporre
// gli stessi campi che pipeline_danno legge da una CardAttacco normale (§5.7).
//
// Conformemente a §5.2bis punto 3 del regolamento v0.6:
//   - valore_numerico = arma.stats_per_livello[livello-1].danno_base
//   - tag             = arma.tag_correnti (per ora == arma.tag, vedi PARKING_LOT)
//   - target          = "nemico"
//   - ignora_difesa   = false
//   - ignora_scudo    = false
//   - applica_status  = arma.stats_per_livello[livello-1].effetto_speciale
//                       MA solo se e' un oggetto strutturato; il CSV oggi
//                       contiene testo libero italiano (es. "+1 danno..."),
//                       quindi nella pratica MVP applica_status resta null
//                       per gli attacchi base. Si attivera' quando il CSV
//                       avra' regola_strutturata (§7.2). PARKING_LOT_EFFETTI_AVANZATI.
function _costruisci_pseudo_attacco_base(arma) {
    const livello = arma.livello || 1;
    const stats = arma.stats_per_livello && arma.stats_per_livello[livello - 1];
    if (!stats) {
        // Sanity check: non dovrebbe mai accadere (il parser garantisce 3
        // elementi e livello in [1, livello_max=3]).
        throw new Error(`Arma "${arma.id}" senza stats_per_livello per livello ${livello}`);
    }
    // tag_correnti: oggi == arma.tag. In 16.7, quando il PG scegliera' una
    // forma_finale al Lv3, qui andra' l'unione di arma.tag + forma.tag_aggiuntivi.
    const tag_correnti = Array.isArray(arma.tag) ? arma.tag.slice() : [];

    // applica_status: solo se e' un oggetto (formato strutturato). Se e' una
    // stringa narrativa la lasciamo a null (PARKING_LOT_EFFETTI_AVANZATI).
    const eff = stats.effetto_speciale;
    const applica_status = (eff && typeof eff === 'object') ? eff : null;

    return {
        // Campi letti da pipeline_danno (§5.7):
        id: arma.id,                      // utile nel log per tracciabilita'
        nome: arma.nome,                  // idem
        valore_numerico: stats.danno_base || 0,
        tag: tag_correnti,
        target: 'nemico',
        ignora_difesa: false,             // §5.2bis: l'attacco base standard non bypassa
        ignora_scudo: false,              // §5.2bis: idem
        applica_status,
        salta_step_tag: false,            // l'arma e' fisica/elementale, lo step 4 vale
        // Marcatore interno per distinguere "attacco base" da "carta attacco"
        // (utile a debug e a 16.5: bonus_sinergia_attiva potra' attivarsi solo
        // per gli pseudo-attacchi base con la sinergia σ2 corretta).
        _tipo_carta: 'attacco_base',
    };
}

function esegui_attacco_base(state, pg_id, target_id, db) {
    // ----- §5.2bis precondizioni (§8.3) --------------------------------------
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
            errore: { codice: 'ERR_TURNO_NON_TUO', messaggio: `Non e' il turno di ${pg_id}` } };
    }
    const pg = state.giocatori[pg_idx];
    if (pg.ko) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_KO', messaggio: `${pg.nome} e' KO` } };
    }

    // Target deve esistere ed essere un nemico in campo (§5.2bis precondizione).
    const nem_idx = _find_nem_idx(state, target_id);
    if (nem_idx === -1) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_TARGET_NON_VALIDO',
                      messaggio: `Nemico ${target_id} non in campo` } };
    }

    // Arma equipaggiata (§5.2bis precondizione + §8.3 ERR_ARMA_NON_EQUIPAGGIATA).
    const ris_arma = _risolvi_arma_pg(pg, db);
    if (!ris_arma.ok) {
        return { ok: false, state: null, errore: ris_arma.errore };
    }
    const arma = ris_arma.arma;

    // ----- §5.2bis passo 1: calcola il costo di QUESTO attacco base ----------
    // - Se il PG non ha ancora usato il suo gratuito del turno: costo = 0 e
    //   consumiamo il flag (un attacco base = un consumo del gratuito).
    // - Altrimenti: costo = arma.stats_per_livello[livello-1].costo_extra.
    const livello = arma.livello || 1;
    const stats_lv = arma.stats_per_livello[livello - 1];
    const costo_extra = stats_lv.costo_extra || 0;

    const gia_consumato = pg.attacco_base_gratuito_consumato_questo_turno === true;
    const costo = gia_consumato ? costo_extra : 0;

    if (costo > pg.energia) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_ENERGIA_INSUFFICIENTE',
                      messaggio: `Servono ${costo} EN per un altro attacco base, ne hai ${pg.energia}` } };
    }

    // ----- Tutte le precondizioni OK: applichiamo lo stato ------------------
    // §9.3: entry point esposto -> clone UNA VOLTA, poi lavoriamo in place.
    let s = clone(state);
    s.fase_corrente = FASE.RISOLUZIONE_CARTA;  // riusiamo la fase esistente;
                                                // §5.1 v0.6 la rinomina
                                                // "RISOLUZIONE_AZIONE" ma il
                                                // valore stringa resta
                                                // 'risoluzione_carta' per
                                                // retrocompatibilita'.

    // §5.2bis passo 1: marca il gratuito come consumato (se lo stavamo usando).
    if (!gia_consumato) {
        s.giocatori[pg_idx].attacco_base_gratuito_consumato_questo_turno = true;
    }
    // §5.2bis passo 2: scala l'energia.
    s.giocatori[pg_idx].energia -= costo;

    // Log "azione iniziata": utile per ricostruire la cronaca a posteriori.
    // Distinto da 'carta_giocata' perche' l'attacco base NON e' una carta.
    s = _log_append(s, 'attacco_base', pg_id, target_id,
        { pg_id, target_id, costo, arma_id: arma.id, gratuito: !gia_consumato },
        `${pg.nome} sferra un attacco base con "${arma.nome}"` +
        (costo === 0 ? ' (gratuito).' : ` (costo: ${costo} EN).`));

    // §5.2bis passo 3: costruisci lo pseudo_attacco_base.
    const pseudo = _costruisci_pseudo_attacco_base(arma);

    // §5.2bis passo 4: invoca pipeline_danno (stessa pipeline usata dalle carte
    // Attacco, §5.7). L'attaccante e' il PG (riferimento dentro s).
    // 16.8: db ora viaggia esplicitamente come 5° arg (chiuso il debito
    // tecnico della globale di modulo).
    s = pipeline_danno(s, s.giocatori[pg_idx], pseudo, target_id, db);

    // 16.6 — Decisione di design: l'attacco base NON conta verso le σ1.
    // Motivo: §5.6.2 parla di "carte con tag X giocate", e l'attacco base e'
    // uno pseudo-attacco generato dall'arma, non una CardAttacco pescata dalla
    // mano. Conseguenza pratica: NON incrementiamo carte_giocate_per_tag_turno
    // qui e NON chiamiamo valuta_sinergie_attive. PERO' l'attacco base PUO'
    // CONSUMARE un bonus_prossima_carta_tag gia' settato (lo fa la pipeline
    // step 2 in modo trasparente, perche' lo pseudo-attacco ha l'array `tag`
    // dell'arma): questa e' una conseguenza voluta, l'attacco base puo'
    // raccogliere un buff lasciato da una σ1 precedente.

    // §5.2bis passo 5: verifica vittoria/sconfitta. Stessa logica di gioca_carta.
    // 16.8: anche _verifica_condizioni_uscita ora riceve db (per
    // auto_evoluzione_equip che prima leggeva la globale di modulo).
    s = _verifica_condizioni_uscita(s, db);
    if (s.fase_corrente === FASE.ESPLORAZIONE ||
        s.fase_corrente === FASE.FINE_RUN) {
        return { ok: true, state: s, errore: null };
    }
    // §5.2bis passo 6: torna in ATTESA_AZIONE_PG (il PG puo' fare altre azioni
    // nello stesso turno: altri attacchi base, giocare carte, o passare).
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
    // v0.6: la "fonte" passata a pipeline_danno e' la carta stessa. La pipeline
    // legge da li' valore_numerico, tag (step 4), applica_status (step 9),
    // ignora_difesa, ignora_scudo, salta_step_tag.
    // 16.8: db ora viaggia esplicitamente fino alla pipeline (chiuso il debito
    // tecnico della globale di modulo).
    // Target singolo (la maggioranza degli attacchi del MVP).
    if (carta.target === 'nemico') {
        s = pipeline_danno(s, s.giocatori[pg_idx], carta, target_id, db);
    } else if (carta.target === 'tutti_nemici') {
        // Iterazione su una snapshot degli ID: pipeline_danno potrebbe rimuoverli.
        const ids = s.nemici_in_campo.map(n => n.istanza_id);
        for (const id of ids) {
            s = pipeline_danno(s, s.giocatori[pg_idx], carta, id, db);
        }
    } else if (carta.target === 'nemico_casuale') {
        if (s.nemici_in_campo.length > 0) {
            const r = rng_int(s.rng_state, 0, s.nemici_in_campo.length);
            s.rng_state = r.rng_state;
            const id = s.nemici_in_campo[r.valore].istanza_id;
            s = pipeline_danno(s, s.giocatori[pg_idx], carta, id, db);
        }
    }
    return s;
}

function _risolvi_abilita(state, pg_idx, carta, db) {
    // §S4-fix: effetti letti da carta.effetto_strutturato (array JSON) invece
    // di regex sul testo narrativo. Elimina il rischio di match accidentali su
    // parole chiave nella descrizione (es. "scudo" narrativo != scudo meccanico).
    // Privata: NON clona.
    let s = state;
    const pg = s.giocatori[pg_idx];
    let testo = `${pg.nome} attiva "${carta.nome}".`;

    const effetti = carta.effetto_strutturato;
    if (!Array.isArray(effetti) || effetti.length === 0) {
        // Carta senza struttura (legacy o di test): logga solo il testo narrativo.
        s = _log_append(s, 'status_applicato', pg.id, null, { carta: carta.id }, testo);
        return s;
    }

    // Set degli ID attacchi: serve per la condizione 'ultima_pesca_ha_attacco'.
    const id_attacchi = db ? new Set(db.attacchi.map(a => a.id)) : new Set();
    // Flag locale: aggiornato dall'op 'pesca', letto dalla condizione successiva.
    let ultima_pesca_ha_attacco = false;

    for (const e of effetti) {
        // Valutazione condizione: salta l'op se non soddisfatta.
        if (e.condizione === 'pv_sotto_meta') {
            if (s.giocatori[pg_idx].pv >= s.giocatori[pg_idx].pv_max / 2) continue;
        } else if (e.condizione === 'ultima_pesca_ha_attacco') {
            if (!ultima_pesca_ha_attacco) continue;
        }

        if (e.op === 'applica_status') {
            const status = { ...e.status, origine: carta.id };
            if (e.target === 'se') {
                s.giocatori[pg_idx].status.push(status);
                testo += ` Ottiene ${e.status.tipo} (${e.status.intensita}).`;
            } else if (e.target === 'tutti') {
                for (let i = 0; i < s.giocatori.length; i++) {
                    if (s.giocatori[i].ko) continue;
                    s.giocatori[i].status.push({ ...status });
                }
                testo += ` Tutti i PG ottengono ${e.status.tipo}.`;
            }
        } else if (e.op === 'pesca') {
            const mano_prima = s.giocatori[pg_idx].mano.slice();
            s = _pesca_carte(s, pg_idx, e.n);
            const nuove = s.giocatori[pg_idx].mano.filter(id => !mano_prima.includes(id));
            ultima_pesca_ha_attacco = nuove.some(id => id_attacchi.has(id));
            testo += ` Pesca ${e.n} carte.`;
        } else if (e.op === 'guadagna_en') {
            s.giocatori[pg_idx].energia += e.n;
            testo += ` Guadagna ${e.n} EN.`;
        }
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
// §5.7 v0.6 — pipeline_danno() : pipeline canonica del danno a 9 step.
// [S3-fix: adapter _applica_danno() v0.5 rimosso; tutti i chiamanti usano questa.]
//
// Firma:
//
//   pipeline_danno(state, attaccante, fonte, target_id, db, opts?) -> state
//
//   attaccante : PG o oggetto "lite" del nemico (vedi turno_nemici).
//   fonte      : CardAttacco | pseudo_attacco_base | CardAbilita.
//                Deve esporre {valore_numerico, tag (array), salta_step_tag?,
//                ignora_difesa?, ignora_scudo?, applica_status?}.
//   target_id  : id PG o istanza_id nemico da colpire.
//   db         : database delle carte (sotto-step 16.8). Serve per lo step 4
//                (_tag_vulnerabilita_target legge db.luoghi e la CardNemico
//                via _carta_nemico_da_id) e per lo step 9 (essenza_drop sul
//                kill, lettura della CardNemico). Prima del 16.8 questo era
//                preso da una variabile globale di modulo; ora e' esplicito.
//   opts       : flag opzionali aggiuntivi (es. forzati dall'AI nemico,
//                vedi §5.9): ignora_difesa, ignora_scudo. Si combinano in OR
//                logico con i flag della fonte: se uno dei due e' true, lo
//                step viene saltato.
//
// I 9 step sono APPLICATI IN ORDINE FISSO. Vedi §5.7 del regolamento v0.6.
// Gli helper bonus_* (step 2) sono al momento STUB: ritornano 0 e verranno
// completati nei sotto-step 16.5, 16.6, 16.7 della ROADMAP. La pipeline
// "degrada elegantemente": senza equipaggiamento o sinergie, gli helper
// danno 0 e il calcolo equivale a quello v0.5 + il nuovo step 4 (match tag).
//
// PARKING_LOT_PIPELINE_MODIFICATORI : helper stub bonus_*. Chiusi quando
// 16.5/16.6/16.7 saranno completati.
// =============================================================================

// ----- Helper interni: bonus dello STEP 2 (additivi, attaccante) -------------
// Ognuno ritorna un intero (positivo o negativo) da SOMMARE al danno.
// Tutti questi helper sono pure functions: leggono dallo state, NON mutano.

// bonus_regola_mondo(stato, mondo, tag_fonte) -> int
// PARKING_LOT_PIPELINE_MODIFICATORI: la regola_mondo nel CSV (es. MONDO_FOR =
// "I tag taglio infliggono +1 danno") e' testo libero italiano: non parsato.
// Quando il CSV avra' una regola_strutturata si attivera' qui.
function bonus_regola_mondo(_state, _mondo, _tag_fonte) {
    return 0;  // stub
}

// bonus_effetto_luogo(nodo_corrente, luogo, tag_fonte) -> int
// PARKING_LOT_PIPELINE_MODIFICATORI: come sopra ma per il luogo del nodo.
// I tag vuln/res del luogo NON sono qui, vivono nello step 4.
function bonus_effetto_luogo(_nodo, _luogo, _tag_fonte) {
    return 0;  // stub
}

// bonus_equipaggiamento(equip_pg, tag_fonte) -> int
// PARKING_LOT_PIPELINE_MODIFICATORI: bonus piatti delle armi/armature/talismani
// equipaggiati che matchano il tag della fonte. Si abilita con 16.7
// (evoluzione equipaggiamento) o prima se serve. Per ora i 3 slot del PG
// sono comunque null -> ritorna sempre 0.
function bonus_equipaggiamento(_equip, _tag_fonte) {
    return 0;  // stub
}

// bonus_png_amico(png_in_gioco, tag_fonte) -> int
// PARKING_LOT_PIPELINE_MODIFICATORI: effetto_passivo dei PNG amici in gioco.
// Da implementare quando avremo PNG con effetti meccanici strutturati.
function bonus_png_amico(_png_in_gioco, _tag_fonte) {
    return 0;  // stub
}

// bonus_sinergia_attiva(pg, fonte, db) -> int
//
// §5.6 e §5.7 step 2 — bonus additivo dalle sinergie attive.
// Aggiornato in 16.5: la parte σ2 (passive di equipaggiamento) e' COMPLETA.
// Aggiornato in 16.6: la parte σ1 (bonus_danno_prossima_carta_con_tag) e'
// COMPLETA. PARKING_LOT_SINERGIE_SIGMA1 chiuso.
//
// Come funziona la parte σ2:
//   - L'array pg.sinergie_attive e' popolato da valuta_sinergie_passive
//     (chiamata a inizio combattimento + inizio turno). Contiene gli id delle
//     σ2 le cui condizioni sono soddisfatte adesso.
//   - Per ogni id, si risale alla definizione in db.sinergie.sinergie.
//   - Se l'effetto e' `bonus_danno_attacco_base` E la fonte e' uno pseudo-
//     attacco base (fonte._tipo_carta === 'attacco_base'), si somma il valore.
//
// Come funziona la parte σ1 (16.6):
//   - pg.bonus_prossima_carta_tag e' {tag, valore}|null. Settato da
//     valuta_sinergie_attive quando una σ1 scatta.
//   - Se la fonte ha quel tag, sommiamo `valore` al danno e segnaliamo
//     "consuma" (il consumo vero — azzeramento del flag — avviene nella
//     pipeline_danno dopo l'applicazione del danno).
//   - Questo helper RESTA "puro": non muta pg. Il pattern e':
//       const { bonus, consumato } = _consuma_bonus_prossima_carta(pg, fonte);
//       danno += bonus;
//       if (consumato) pg.bonus_prossima_carta_tag = null;  // in pipeline_danno
//   - Per uniformita' di firma con gli altri helper bonus_* (che ritornano un
//     int), `bonus_sinergia_attiva` continua a ritornare solo l'int. La
//     pipeline_danno chiama ANCHE _consuma_bonus_prossima_carta DIRETTAMENTE
//     per il flag di consumo. Una chiamata in piu', ma side effect chiari.
function bonus_sinergia_attiva(pg, fonte, db) {
    // Guard defensive: se per qualche motivo manca pg/sinergie_attive/db,
    // ritorniamo 0 (degrado elegante: nessuna sinergia, nessun bonus).
    if (!pg) return 0;

    let bonus = 0;

    // === σ1: bonus_danno_prossima_carta_con_tag (16.6) ===============
    // Letto da pg.bonus_prossima_carta_tag. Indipendente dal db: il bonus e'
    // gia' "materializzato" sul PG da valuta_sinergie_attive. Non serve
    // re-iterare le sinergie qui.
    const sigma1 = _consuma_bonus_prossima_carta(pg, fonte);
    bonus += sigma1.bonus;
    // Nota: NON azzeriamo pg.bonus_prossima_carta_tag qui. Il consumo vero e'
    // dentro pipeline_danno (vedi commento in cima alla funzione).

    // === σ2 ===========================================================
    if (!Array.isArray(pg.sinergie_attive) || pg.sinergie_attive.length === 0) {
        return bonus;
    }
    if (!db || !db.sinergie || !db.sinergie.sinergie) {
        return bonus;
    }
    const e_attacco_base = (fonte && fonte._tipo_carta === 'attacco_base');

    for (const sin_id of pg.sinergie_attive) {
        const def = db.sinergie.sinergie[sin_id];
        if (!def || !def.effetto) continue;  // sinergia attiva ma non definita: skip difensivo

        // === σ2: bonus_danno_attacco_base ===========================
        // Si applica SOLO se la fonte e' uno pseudo-attacco base.
        // Carte attacco normali (anche con stesso tag) NON ricevono questo
        // bonus: §5.6.3 dice "tutti gli attacchi base infliggono +N".
        if (def.effetto.tipo === 'bonus_danno_attacco_base' && e_attacco_base) {
            bonus += (def.effetto.valore || 0);
            // PARKING_LOT_EFFETTI_AVANZATI: def.effetto.applica_tag (es. "fuoco")
            // dovrebbe ANCHE iniettare quel tag nell'attacco base per il match
            // vuln/res di step 4. Non lo facciamo qui perche' bonus_* ritornano
            // solo un int. Andra' fatto in un sotto-step di rifinitura: per ora
            // il bonus c'e' ma il tag elementale non si propaga al match.
            // Decisione di scope 16.5: scope = "il bonus si vede nel danno".
        }
    }

    return bonus;
}

// =============================================================================
// §5.6.4 — valuta_sinergie_passive(state, pg_id, db) -> state
//
// Cuore del sotto-step 16.5. Funzione esposta (clone-at-entry). Esegue:
//   1) trova il PG in state.giocatori per id.
//   2) per ogni sinergia σ2 in db.sinergie.sinergie:
//      - valuta la condizione contro l'equipaggiamento corrente del PG.
//      - se vera e l'id NON e' gia' in pg.sinergie_attive -> lo aggiunge +
//        log evento 'sinergia_attivata' (transizione false -> true).
//      - se falsa e l'id E' gia' in pg.sinergie_attive   -> lo rimuove +
//        log evento 'sinergia_disattivata' (transizione true -> false).
//      - se stato invariato: nessun log (evitiamo spam).
//   3) ritorna il nuovo state.
//
// IMPORTANTE: questa funzione e' IDEMPOTENTE.
// Chiamarla due volte di fila senza cambiamenti di equip produce lo stesso
// risultato. Questo permette di richiamarla agli hook (inizio combattimento,
// inizio turno PG) senza paura di duplicare i log.
//
// Le σ1 sono ignorate qui: la loro condizione (n_carte_tag_in_turno) si valuta
// dinamicamente dentro valuta_sinergie_attive (16.6), non popola sinergie_attive.
//
// db e' l'oggetto restituito da carica_dati() di setup.js. Per chi non l'avesse
// presente: db.sinergie e' l'INTERO file sinergie.json (con _commento, ...),
// quindi le sinergie vere stanno in db.sinergie.sinergie.
// =============================================================================
function valuta_sinergie_passive(state, pg_id, db) {
    // Clone-at-entry (convention v0.4+).
    let s = clone(state);

    // Guard: db assente o sinergie non definite -> nulla da fare.
    if (!db || !db.sinergie || !db.sinergie.sinergie) return s;

    const pg_idx = s.giocatori.findIndex(p => p.id === pg_id);
    if (pg_idx === -1) return s;
    const pg = s.giocatori[pg_idx];
    if (!Array.isArray(pg.sinergie_attive)) pg.sinergie_attive = [];

    // Ciclo sulle sinergie definite.
    for (const [sin_id, def] of Object.entries(db.sinergie.sinergie)) {
        // Filtriamo: questa funzione gestisce SOLO σ2.
        if (def.tipo !== 'σ2') continue;

        // Valutazione condizione (§5.6.2). Solo equip_tag_match implementato
        // qui: gli altri tipi rientrano in # EXT_CONDIZIONI_SINERGIA.
        const condizione_vera = _valuta_condizione_sigma2(pg, def.condizione, db);

        const gia_attiva = pg.sinergie_attive.includes(sin_id);

        if (condizione_vera && !gia_attiva) {
            // Transizione false -> true: attiva e logga.
            pg.sinergie_attive.push(sin_id);
            s = _log_append(s, 'sinergia_attivata', pg.id, null,
                { sinergia_id: sin_id, tipo: 'σ2' },
                `${pg.nome}: si attiva la sinergia "${def.nome || sin_id}". ${def.descrizione_narrativa || ''}`.trim());
        } else if (!condizione_vera && gia_attiva) {
            // Transizione true -> false: disattiva e logga.
            pg.sinergie_attive = pg.sinergie_attive.filter(x => x !== sin_id);
            s = _log_append(s, 'sinergia_disattivata', pg.id, null,
                { sinergia_id: sin_id, tipo: 'σ2' },
                `${pg.nome}: si spegne la sinergia "${def.nome || sin_id}".`);
        }
        // Altrimenti: stato invariato, nessun log.
    }

    return s;
}

// -----------------------------------------------------------------------------
// _valuta_condizione_sigma2(pg, condizione, db) -> boolean
//
// Dispatcher delle condizioni per le σ2. Oggi gestisce solo equip_tag_match
// (l'unica usata dal pool MVP). Le altre tornano false e loggano un warn
// in console: cosi' se qualcuno aggiungesse una σ2 con condizione non
// supportata, se ne accorge subito.
// -----------------------------------------------------------------------------
function _valuta_condizione_sigma2(pg, condizione, db) {
    if (!condizione || !condizione.tipo) return false;

    switch (condizione.tipo) {
        case 'equip_tag_match':
            return _condizione_equip_tag_match(pg, condizione, db);

        // # EXT_CONDIZIONI_SINERGIA: classe_pg, status_attivo, pv_soglia.
        // Nessuno di questi e' nel pool σ2 attuale. Si aggiungono qui quando
        // serviranno, mantenendo questa funzione come unico punto di dispatch.
        case 'classe_pg':
        case 'status_attivo':
        case 'pv_soglia':
            console.warn(`[valuta_sinergie_passive] condizione "${condizione.tipo}" non ancora implementata per σ2.`);
            return false;

        // n_carte_tag_in_turno e' una condizione σ1: non dovrebbe finire qui,
        // ma se per errore di authoring una σ2 la usasse, ritorniamo false.
        case 'n_carte_tag_in_turno':
            console.warn(`[valuta_sinergie_passive] una σ2 usa la condizione σ1 "n_carte_tag_in_turno": errore di authoring?`);
            return false;

        default:
            console.warn(`[valuta_sinergie_passive] condizione sconosciuta: "${condizione.tipo}".`);
            return false;
    }
}

// -----------------------------------------------------------------------------
// _condizione_equip_tag_match(pg, condizione, db) -> boolean
//
// §5.6.2 — Conta quanti slot tra quelli listati hanno il tag richiesto, e
// verifica se il count >= soglia.
//
// Parametri della condizione:
//   slot    : array di slot da controllare, es. ["arma","talismano"].
//   tag     : tag elementale/fisico da matchare (es. "fuoco","sacro","luce").
//   soglia  : numero minimo di slot che devono matchare.
//
// Letture sul PG:
//   pg.equipaggiamento[slot] e' sempre un id stringa (o null/undefined se vuoto).
//   L'istanza per-PG (livello, tag_correnti) e' in pg.equip_istanze[slot] (16.7).
//   _estrai_tag_oggetto astrae i due formati: oggi legge db.equipaggiamenti[id].tag;
//   supporta anche il caso oggetto con tag_correnti per compatibilita' futura.
//   [PARKING_LOT_ARMA_ISTANZA chiuso; S1-fix.]
//
// Nota: se un PG ha equipaggiamento=null o tutto vuoto, la funzione ritorna
// false. E' la situazione del MVP attuale (vedi PARKING_LOT_EQUIP_INIZIALE_CLASSE
// in setup.js): i PG iniziano senza equipaggiamento, quindi le σ2 oggi non
// scatteranno mai nel run-of-the-mill, ma SI ATTIVERANNO appena un test o un
// flusso futuro popola gli slot. Questo e' il "degrado elegante" voluto da §5.6.
// -----------------------------------------------------------------------------
function _condizione_equip_tag_match(pg, condizione, db) {
    const slot_da_controllare = Array.isArray(condizione.slot) ? condizione.slot : [];
    const tag_target = condizione.tag;
    const soglia = condizione.soglia || 0;

    if (slot_da_controllare.length === 0 || !tag_target || soglia <= 0) return false;
    if (!pg.equipaggiamento) return false;

    let count = 0;
    for (const slot of slot_da_controllare) {
        const e = pg.equipaggiamento[slot];
        if (!e) continue;  // slot vuoto

        const tag_oggetto = _estrai_tag_oggetto(e, db);
        if (tag_oggetto.includes(tag_target)) {
            count += 1;
        }
    }
    return count >= soglia;
}

// -----------------------------------------------------------------------------
// _estrai_tag_oggetto(e, db) -> array di tag
//
// pg.equipaggiamento[slot] e' sempre un id stringa (o null). L'istanza per-PG
// (16.7) vive in pg.equip_istanze[slot], non in pg.equipaggiamento[slot].
// I casi "object" sotto sono difensivi: coprono test che iniettano direttamente
// un oggetto al posto dello slot stringa. [S1-fix: linguaggio futuro rimosso.]
// -----------------------------------------------------------------------------
function _estrai_tag_oggetto(e, db) {
    // Caso difensivo: oggetto con tag_correnti (es. test che iniettano istanze).
    if (e && typeof e === 'object' && Array.isArray(e.tag_correnti)) {
        return e.tag_correnti;
    }
    // Caso difensivo: oggetto con campo tag.
    if (e && typeof e === 'object' && Array.isArray(e.tag)) {
        return e.tag;
    }
    // Caso corrente: id stringa → risale al db degli equipaggiamenti.
    if (typeof e === 'string' && db && Array.isArray(db.equipaggiamenti)) {
        const def = db.equipaggiamenti.find(x => x.id === e);
        if (def && Array.isArray(def.tag)) return def.tag;
    }
    return [];
}

// -----------------------------------------------------------------------------
// === Sotto-step 16.6: helper e funzione esposta per le sinergie σ1 ==========
// -----------------------------------------------------------------------------

// _estrai_tag_carta(carta) -> array di tag (in minuscolo, mai null).
// CardAttacco (§1.7) ha sempre `tag: []`. CardAbilita (§1.8) puo' avere
// `tag: []` (opzionale, per il conteggio σ1). Tutto il resto -> array vuoto.
// Helper puro, nessun effetto collaterale.
function _estrai_tag_carta(carta) {
    if (!carta) return [];
    if (Array.isArray(carta.tag)) return carta.tag;
    return [];
}

// _carta_ha_tag(carta, tag) -> bool.
// Confronto stringa-stringa, niente normalizzazione (i CSV sono gia' tutti
// in minuscolo, vedi convenzione §1.6). Helper puro.
function _carta_ha_tag(carta, tag) {
    const tags = _estrai_tag_carta(carta);
    return tags.indexOf(tag) !== -1;
}

// =============================================================================
// §5.6.4 — valuta_sinergie_attive(state, pg_id, carta, db) -> state
//
// Cuore del sotto-step 16.6. Funzione esposta (clone-at-entry). Chiamata da
// gioca_carta DOPO lo switch del tipo carta (§5.5 punto 5). Esegue:
//   1) trova il PG e legge i tag della carta appena giocata.
//   2) per ogni sinergia σ1 in db.sinergie.sinergie:
//      - filtro: tipo == 'σ1' e condizione.tipo == 'n_carte_tag_in_turno'.
//      - filtro: la carta appena giocata DEVE avere il tag richiesto
//        (cosi' una sinergia "taglio" non scatta su una carta sacro anche se
//        nel turno ho gia' giocato 2 taglio: il regolamento §5.6.4 e' chiaro
//        "se carta.tag include il tag della condizione").
//      - filtro: la soglia `pg.carte_giocate_per_tag_turno[tag] >= soglia`.
//      - filtro: rispetto `una_tantum_per_turno` via
//        `pg.sigma1_scattate_questo_turno`.
//      - se tutti i filtri passano: applica l'effetto, marca scattata,
//        logga 'sinergia_attivata'.
//   3) ritorna lo state aggiornato.
//
// La funzione NON popola `pg.sinergie_attive` (che e' solo per σ2). Le σ1
// depositano un effetto pending (es. `bonus_prossima_carta_tag`) e poi quel
// flag viene consumato dalla prossima carta col tag.
//
// Effetti supportati (tassonomia §5.6.3):
//   - `bonus_danno_prossima_carta_con_tag` -> pg.bonus_prossima_carta_tag
//   - `riduzione_costo`                    -> pg.riduzione_costo_prossima_carta_tag
// Altri tipi (applica_status_a_se, draw_extra) sono nel pool teorico ma non
// nel pool MVP corrente: skip con warning soft. # EXT_EFFETTI_SINERGIA.
//
// Idempotenza: questa funzione e' SAFE su una carta senza tag (skip pulito)
// e su un PG senza i flag (li tratta come array/null e li inizializza).
// =============================================================================
function valuta_sinergie_attive(state, pg_id, carta, db) {
    // Clone-at-entry (convention v0.4+).
    let s = clone(state);

    // Guard: db assente o sinergie non definite -> nulla da fare.
    if (!db || !db.sinergie || !db.sinergie.sinergie) return s;

    const pg_idx = s.giocatori.findIndex(p => p.id === pg_id);
    if (pg_idx === -1) return s;
    const pg = s.giocatori[pg_idx];

    // Init difensivo dei campi 16.6: se uno stato vecchio non li ha (es. una
    // partita salvata pre-16.6), li creiamo coi default corretti.
    if (!Array.isArray(pg.sigma1_scattate_questo_turno)) pg.sigma1_scattate_questo_turno = [];
    if (pg.bonus_prossima_carta_tag === undefined) pg.bonus_prossima_carta_tag = null;
    if (pg.riduzione_costo_prossima_carta_tag === undefined) pg.riduzione_costo_prossima_carta_tag = null;

    // Tag della carta appena giocata: se non ce ne sono, nessuna σ1
    // n_carte_tag_in_turno puo' scattare (la condizione richiede match).
    const tags_carta = _estrai_tag_carta(carta);
    if (tags_carta.length === 0) return s;

    // Ciclo sulle sinergie definite.
    for (const [sin_id, def] of Object.entries(db.sinergie.sinergie)) {
        if (def.tipo !== 'σ1') continue;  // questa funzione gestisce SOLO σ1
        if (!def.condizione || def.condizione.tipo !== 'n_carte_tag_in_turno') continue;
        if (!def.effetto) continue;

        const tag = def.condizione.tag;
        const soglia = def.condizione.soglia || 0;

        // Filtro 1 (§5.6.4): la carta appena giocata deve avere il tag della
        // condizione. Cosi' una σ1 "impatto" non scatta giocando una carta
        // sacro pur avendo gia' 2 impatto nel turno (la spec e' chiara su questo).
        if (!tags_carta.includes(tag)) continue;

        // Filtro 2: soglia raggiunta. Il contatore e' gia' stato incrementato
        // da gioca_carta PRIMA dello switch, quindi questa carta e' inclusa.
        const count = (pg.carte_giocate_per_tag_turno || {})[tag] || 0;
        if (count < soglia) continue;

        // Filtro 3: una_tantum_per_turno (§5.6.3). Se la sinergia ha questo
        // flag e l'id e' gia' tra le scattate questo turno -> skip.
        const una_tantum = !!(def.effetto.una_tantum_per_turno);
        if (una_tantum && pg.sigma1_scattate_questo_turno.includes(sin_id)) continue;

        // Tutti i filtri passati: applica l'effetto.
        let applicata = false;
        let testo_effetto = '';

        if (def.effetto.tipo === 'bonus_danno_prossima_carta_con_tag') {
            // Setto il flag "bonus alla prossima carta con questo tag".
            // Sovrascrive un eventuale flag preesistente: §5.6.3 non parla di
            // stacking esplicito, e fare l'ultimo arrivato vince e' coerente
            // con "una_tantum_per_turno" (ogni σ1 scatta al massimo una volta).
            const t_eff = def.effetto.tag || tag;  // fallback al tag della condizione
            const v_eff = def.effetto.valore || 0;
            pg.bonus_prossima_carta_tag = { tag: t_eff, valore: v_eff };
            applicata = true;
            testo_effetto = `+${v_eff} danno alla prossima carta con tag "${t_eff}"`;

        } else if (def.effetto.tipo === 'riduzione_costo') {
            const t_eff = def.effetto.tag || tag;
            const v_eff = def.effetto.valore || 0;
            pg.riduzione_costo_prossima_carta_tag = { tag: t_eff, valore: v_eff };
            applicata = true;
            testo_effetto = `prossima carta "${t_eff}" costa -${v_eff} EN`;

        } else {
            // # EXT_EFFETTI_SINERGIA: applica_status_a_se, draw_extra, ecc.
            // Non nel pool MVP (sinergie.json v0.6 ne ha 0). Skip pulito.
            // Log soft a console solo in modalita' debug, non nello state.
            // PARKING_LOT_SINERGIE_EFFETTI_AVANZATI: completare con i tipi sopra.
            continue;
        }

        if (applicata) {
            if (una_tantum) pg.sigma1_scattate_questo_turno.push(sin_id);
            s = _log_append(s, 'sinergia_attivata', pg_id, null,
                { sinergia_id: sin_id, tipo: 'σ1', effetto: def.effetto.tipo,
                  tag_condizione: tag, conteggio: count, soglia },
                `Sinergia σ1 "${def.nome}": ${testo_effetto}.`);
        }
    }

    return s;
}

// -----------------------------------------------------------------------------
// _consuma_bonus_prossima_carta(pg, fonte) -> { bonus: int, consumato: bool }
//
// Helper per la pipeline_danno step 2. Estraibile per testabilita'.
// Logica: se pg.bonus_prossima_carta_tag e' settato E la fonte ha quel tag
//         -> ritorna {bonus: valore, consumato: true} (chi chiama deve poi
//            azzerare il flag su pg). Altrimenti {bonus: 0, consumato: false}.
//
// NOTA: questo helper NON muta `pg`. Il consumo vero (azzeramento del flag)
// e' responsabilita' di pipeline_danno, perche' la pipeline lavora gia' sul
// clone "interno" dello state. Mantenere `pg` come read-only in tutti gli
// helper bonus_* (vedi convenzione §5.7) ci evita side effects nascosti.
// -----------------------------------------------------------------------------
function _consuma_bonus_prossima_carta(pg, fonte) {
    if (!pg || !pg.bonus_prossima_carta_tag) return { bonus: 0, consumato: false };
    const flag = pg.bonus_prossima_carta_tag;
    if (!_carta_ha_tag(fonte, flag.tag)) return { bonus: 0, consumato: false };
    return { bonus: flag.valore || 0, consumato: true };
}

// ----- Helper: unione tag vuln/res del target = nemico + mondo + luogo -------
// §5.7 step 4 v0.6. Solo per i NEMICI (i PG non hanno vuln/res nel MVP).
// db serve per risalire al CardLuogo del nodo corrente; mondo e' su state.mondo.
function _tag_vulnerabilita_target(state, target_nemico_o_pg, db) {
    // Solo nemici hanno vuln/res nel MVP. Per i PG -> array vuoti.
    if (!target_nemico_o_pg || !target_nemico_o_pg.carta_id) {
        return { vuln: [], res: [] };
    }
    const carta_nem = _carta_nemico_da_id(target_nemico_o_pg.carta_id, db);
    const vuln_nem = (carta_nem && carta_nem.vulnerabilita) || [];
    const res_nem  = (carta_nem && carta_nem.resistenza)   || [];

    const vuln_mondo = (state.mondo && state.mondo.vulnerabilita_mondo) || [];
    const res_mondo  = (state.mondo && state.mondo.resistenza_mondo)   || [];

    // Luogo del nodo corrente (puo' essere null se siamo fuori combat o se il
    // nodo non ha luogo associato: in quel caso array vuoti).
    let vuln_luogo = [];
    let res_luogo  = [];
    if (db && state.mappa && state.mappa.nodo_corrente !== undefined) {
        const nodo = state.mappa.nodi[state.mappa.nodo_corrente];
        if (nodo && nodo.carta_luogo_id) {
            const luogo = db.luoghi.find(l => l.id === nodo.carta_luogo_id);
            if (luogo) {
                vuln_luogo = luogo.vulnerabilita_luogo || [];
                res_luogo  = luogo.resistenza_luogo   || [];
            }
        }
    }
    // Unione (set-like): mantengo duplicati irrilevanti; "some" basta.
    return {
        vuln: [...vuln_nem, ...vuln_mondo, ...vuln_luogo],
        res:  [...res_nem,  ...res_mondo,  ...res_luogo],
    };
}

// =============================================================================
// pipeline_danno(state, attaccante, fonte, target_id, db, opts?) -> state
// =============================================================================
function pipeline_danno(state, attaccante, fonte, target_id, db, opts) {
    // Privata-di-modulo: NON clona (i chiamanti sono gia' dentro un clone).
    let s = state;
    const o = opts || {};

    // Risolvo il target. Esce subito se sparito (es. KO da effetto precedente).
    const nem_idx = _find_nem_idx(s, target_id);
    const pg_idx_t = _find_pg_idx(s, target_id);
    if (nem_idx === -1 && pg_idx_t === -1) return s;
    const target = nem_idx !== -1 ? s.nemici_in_campo[nem_idx] : s.giocatori[pg_idx_t];

    // Tag della fonte: array, sempre presente in v0.6. Se per qualunque
    // motivo manca, lo trattiamo come array vuoto (= nessun match tag).
    const tag_fonte = Array.isArray(fonte.tag) ? fonte.tag : [];

    // Flag della fonte: ignora_difesa/scudo. Combinati in OR con quelli di opts.
    // I flag della fonte arrivano dal CSV (es. ATK con ignora_difesa=true);
    // i flag di opts arrivano dall'AI nemico (es. pattern Esecutore).
    const ignora_difesa = !!(fonte.ignora_difesa || o.ignora_difesa);
    const ignora_scudo  = !!(fonte.ignora_scudo  || o.ignora_scudo);

    // ===== STEP 1 — Danno base =====
    let danno = fonte.valore_numerico || 0;

    // ===== STEP 2 — Modificatori attaccante (ADDITIVI) =====
    // Tutti gli helper sono stub in 16.3 (ritornano 0). Le firme sono gia'
    // quelle definitive: chi popolera' gli helper in 16.5/16.6/16.7 non
    // dovra' ritoccare la pipeline.
    danno += bonus_regola_mondo(s, s.mondo, tag_fonte);
    danno += bonus_effetto_luogo(s.mappa ? s.mappa.nodi[s.mappa.nodo_corrente] : null,
                                  null, tag_fonte);
    danno += bonus_equipaggiamento(attaccante.equipaggiamento, tag_fonte);
    danno += bonus_png_amico(s.png_in_gioco, tag_fonte);
    danno += bonus_sinergia_attiva(attaccante, fonte, db);

    // §5.6.3 + 16.6 — Consumo σ1 bonus_prossima_carta_tag.
    // Sopra (in bonus_sinergia_attiva) il bonus e' gia' stato sommato. Qui
    // controlliamo se il consumo doveva avvenire e azzeriamo il flag. Lo
    // facciamo qui perche':
    //   1) bonus_sinergia_attiva e' "puro" per convenzione (non muta pg);
    //   2) `attaccante` qui e' un riferimento a s.giocatori[i] o a un wrapper
    //      lato nemico (i nemici non hanno bonus_prossima_carta_tag, sono
    //      degradati a no-op);
    //   3) e' coerente con `step 9 - consumo marchio` (gia' presente nella
    //      pipeline come pattern: helper read-only + mutazione esplicita).
    if (attaccante && attaccante.bonus_prossima_carta_tag) {
        const consumo = _consuma_bonus_prossima_carta(attaccante, fonte);
        if (consumo.consumato) {
            const tag_consumato = attaccante.bonus_prossima_carta_tag.tag;
            const val_consumato = attaccante.bonus_prossima_carta_tag.valore;
            attaccante.bonus_prossima_carta_tag = null;
            s = _log_append(s, 'sinergia_consumata', attaccante.id || null,
                target_id || null,
                { tipo: 'bonus_danno_prossima_carta_con_tag', tag: tag_consumato,
                  valore: val_consumato },
                `Sinergia σ1 (+${val_consumato} ${tag_consumato}) consumata da "${fonte.nome || fonte._tipo_carta}".`);
        }
    }

    // ===== STEP 3 — Status attaccante (MOLTIPLICATIVI) =====
    // Forza: x1.5; Marchio: x2 e CONSUMATO.
    // Le condizioni leggono lo status dell'attaccante. Per i PG: l'array
    // attaccante.status e' lo stesso oggetto presente in s.giocatori[i].status,
    // perche' attaccante e' un riferimento (i chiamanti passano s.giocatori[pg_idx]
    // o un wrapper che punta a s.nemici_in_campo[i].status).
    const ha_forza = (attaccante.status || []).some(st => st.tipo === 'forza');
    if (ha_forza) danno = Math.floor(danno * 1.5);
    // Marchio: nel modello v0.4 era uno status SULL'ATTACCANTE che potenziava
    // il suo prossimo colpo. Mantengo questa semantica per non rompere i test.
    // (Il regolamento v0.6 non specifica diversamente: "marchio" e' un buff
    // monouso). Se in futuro la semantica cambia in "marchio = debuff sul
    // bersaglio" basta spostare la lettura sul target.
    const idx_marchio = (attaccante.status || []).findIndex(st => st.tipo === 'marchio');
    if (idx_marchio !== -1) {
        danno *= 2;
        attaccante.status.splice(idx_marchio, 1);
    }
    // PARKING_LOT_EFFETTI_AVANZATI : altri buff moltiplicativi (# EXT_BUFF).

    // ===== STEP 4 — Match tag fonte vs vulnerabilita/resistenza target =====
    // Saltato se la fonte ha salta_step_tag=true (abilita pure, §1.8).
    if (!fonte.salta_step_tag) {
        const { vuln, res } = _tag_vulnerabilita_target(s, target, db);
        const match_vuln = tag_fonte.some(t => vuln.includes(t));
        const match_res  = tag_fonte.some(t => res.includes(t));
        const mult_v = (s.config && s.config.combattimento && s.config.combattimento.moltiplicatore_vulnerabilita) || 1.5;
        const mult_r = (s.config && s.config.combattimento && s.config.combattimento.moltiplicatore_resistenza)   || 0.5;
        if (match_vuln && !match_res) {
            danno = Math.floor(danno * mult_v);
        } else if (match_res && !match_vuln) {
            danno = Math.floor(danno * mult_r);
        }
        // Caso match_vuln && match_res: si annullano, danno invariato (§5.7 step 4).
    }

    // ===== STEP 5 — Status target (MOLTIPLICATIVI) =====
    // Debolezza: il target prende danno x1.5.
    const ha_debolezza = (target.status || []).some(st => st.tipo === 'debolezza');
    if (ha_debolezza) danno = Math.floor(danno * 1.5);

    // ===== STEP 6 — Difesa del target (SOTTRATTIVA) =====
    // Saltato se ignora_difesa = true. Solo i NEMICI hanno difesa nel MVP.
    if (nem_idx !== -1 && !ignora_difesa) {
        // Tank difensivo: difesa raddoppiata se attivo il flag turno.
        const moltiplicatore = target._difesa_x2_questo_turno ? 2 : 1;
        danno = Math.max(0, danno - (target.difesa * moltiplicatore));
    }

    // ===== STEP 7 — Scudo del target (ASSORBIMENTO) =====
    // Saltato se ignora_scudo = true. Lo scudo e' uno status del target.
    if (!ignora_scudo) {
        const idx_scudo = (target.status || []).findIndex(st => st.tipo === 'scudo');
        if (idx_scudo !== -1 && danno > 0) {
            const scudo = target.status[idx_scudo];
            const assorbito = Math.min(scudo.intensita, danno);
            danno -= assorbito;
            scudo.intensita -= assorbito;
            if (scudo.intensita <= 0) target.status.splice(idx_scudo, 1);
        }
    }

    // ===== STEP 8 — Applicazione ai PV =====
    target.pv = Math.max(0, target.pv - danno);

    s = _log_append(s, 'danno_inflitto', attaccante.id, target_id || target.istanza_id,
        { danno, residuo_pv: target.pv,
          tag_fonte, ignora_difesa, ignora_scudo,
          fonte_id: fonte.id || null },
        `${attaccante.nome || attaccante.istanza_id} infligge ${danno} danno (PV target: ${target.pv}).`);

    // ===== STEP 9 — Side effects post-danno =====
    // Solo se il target e' un nemico ancora identificabile: aggiorno tracking
    // per AI Tank/Vendicativo.
    if (nem_idx !== -1) {
        target.ultimo_colpito_da = attaccante.id;
        // Tracking cumulativo "chi ha colpito di piu'" per pattern Tank.
        // EXT_TRACK_DAMAGE (§11). Solo se l'attaccante e' un PG.
        if (typeof attaccante.id === 'string' && attaccante.id.startsWith('pg_')) {
            if (!target.danni_per_pg) target.danni_per_pg = {};
            target.danni_per_pg[attaccante.id] = (target.danni_per_pg[attaccante.id] || 0) + danno;
        }
    }

    // §5.7 step 9: applica eventuali status secondari della fonte SOLO se il
    // target e' ancora vivo (un target a 0 PV non riceve sanguinamento &c.).
    if (target.pv > 0 && fonte.applica_status && typeof fonte.applica_status === 'object') {
        const st = clone(fonte.applica_status);  // copia, per non condividere riferimenti col DB
        target.status = target.status || [];
        target.status.push(st);
        s = _log_append(s, 'status_applicato', attaccante.id, target_id || target.istanza_id,
            { status: st },
            `${attaccante.nome || attaccante.istanza_id} applica ${st.tipo} a ${target.nome || target.istanza_id}.`);
    }

    // 16.6 — Nota: §5.6.4 ipotizzava di chiamare valuta_sinergie_attive() qui,
    // al termine dello step 9 della pipeline_danno. In 16.6 abbiamo SCELTO di
    // chiamarla invece in gioca_carta dopo lo switch (§5.5 punto 5), perche':
    //   - copre uniformemente attacchi, abilita', consumabili (qualunque carta
    //     con tag puo' contribuire al conteggio σ1);
    //   - le abilita' non-danno (cure, buff) con tag non passano dalla
    //     pipeline_danno, ma DEVONO contare per σ1.
    // Qui nella pipeline non c'e' piu' nulla da fare per le σ1.

    // Trigger KO + drop essenze (se target nemico e ucciso).
    if (target.pv === 0) {
        if (nem_idx !== -1) {
            const morto = s.nemici_in_campo[nem_idx];
            // §5.7 step 9 v0.6: drop essenze.
            // L'attaccante deve essere un PG per ricevere il drop.
            if (typeof attaccante.id === 'string' && attaccante.id.startsWith('pg_')) {
                const pg_idx_att = _find_pg_idx(s, attaccante.id);
                if (pg_idx_att !== -1) {
                    const pg_attaccante = s.giocatori[pg_idx_att];
                    const carta_nem = _carta_nemico_da_id(morto.carta_id, db);
                    const drop = (carta_nem && carta_nem.essenza_drop) || [];
                    if (drop.length > 0 && pg_attaccante.essenze) {
                        for (const tag of drop) {
                            if (pg_attaccante.essenze[tag] !== undefined) {
                                pg_attaccante.essenze[tag] += 1;
                            }
                            // Se il tag non e' tra le 10 categorie ufficiali,
                            // lo IGNORO (gia' loggato come warning al parsing).
                        }
                        s = _log_append(s, 'essenze_droppate', morto.istanza_id, attaccante.id,
                            { tags: drop },
                            `${pg_attaccante.nome} raccoglie le essenze del nemico: ${drop.join(', ')}.`);
                    }
                }
            }
            // §5.11: payload ko include categoria per trigger kill_categoria (M1-fix).
            const _def_morto = _carta_nemico_da_id(morto.carta_id, db);
            s = _log_append(s, 'ko', null, morto.istanza_id,
                { carta: morto.carta_id, categoria: _def_morto ? _def_morto.categoria : null },
                `${morto.istanza_id} (${morto.carta_id}) è sconfitto!`);
            s.nemici_in_campo.splice(nem_idx, 1);
        } else {
            // §4.4 — Trigger Alleato (Luna): salva il PG da KO lasciandolo a 1 PV.
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
function _verifica_condizioni_uscita(state, db) {
    // Privata: NON clona.
    // 16.8: db arriva ora esplicitamente dai chiamanti (chiuso il debito
    // tecnico della globale di modulo). Tutti i chiamanti (gioca_carta,
    // esegui_attacco_base, fine_round) hanno ricevuto db nella propria firma
    // e lo passano qui.
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

        // === Sotto-step 16.7 (§5.10 step 5, §5.11 Fase 1) =====================
        // Auto-evoluzione di livello degli equipaggiamenti per OGNI PG vivo.
        // Le essenze sono gia' state distribuite al kill di ciascun nemico
        // (vedi pipeline_danno step 9, log 'essenze_droppate'); qui controlliamo
        // se qualcuno ha accumulato abbastanza essenze da salire di livello.
        // E' una salita AUTOMATICA: non interrompe il flusso, non richiede
        // input dell'utente. Se un equip arriva al Lv3 in questo passaggio,
        // resta "Lv3 base" (forma_scelta_id=null): la scelta della forma
        // finale e' confinata ai nodi di riposo (vedi risolvi_nodo_riposo
        // in esplorazione.js). Cosi' non sovraccarichiamo l'UI di fine
        // combattimento con bivi narrativi.
        //
        // 16.8: prima leggevamo la globale di modulo qui; ora db arriva come
        // parametro esplicito dai chiamanti.
        if (db) {
            for (const pg of s.giocatori) {
                if (pg.ko) continue;
                // auto_evoluzione_equip e' "exposed" -> clone-at-entry.
                // Riassegnamo s al ritorno; _verifica_condizioni_uscita e'
                // privata e mutava in place, ma a partire da qui in poi
                // lavoriamo con s riassegnato (le mutazioni successive
                // continuano a funzionare in place sul nuovo clone).
                s = auto_evoluzione_equip(s, pg.id, db);
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
//
// 16.8 (chiusura del debito tecnico DB_REF): la signature pubblica passa da
// `passa_turno(state)` a `passa_turno(state, db)`. Il chiamante (app.js,
// motore CLI) deve ora passare il db: serve a propagarlo lungo la catena
// fine_turno_pg -> turno_nemici -> pipeline_danno.
// =============================================================================
function passa_turno(state, db) {
    if (state.fase_corrente !== FASE.ATTESA_AZIONE_PG) {
        return { ok: false, state: null,
            errore: { codice: 'ERR_FASE_NON_VALIDA',
                      messaggio: `Fase corrente: ${state.fase_corrente}` } };
    }
    let s = clone(state);
    s.fase_corrente = FASE.FINE_TURNO_PG;
    s = fine_turno_pg(s, db);
    return { ok: true, state: s, errore: null };
}

// =============================================================================
// fine_turno_pg: cleanup carte con scade_su == "fine_turno", poi passa al
// prossimo PG o al turno_nemici.
// 16.8: db ora propagato esplicitamente (chiuso il debito tecnico DB_REF).
// =============================================================================
function fine_turno_pg(state, db) {
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

    return _avanza_turno_o_nemici(s, db);
}

function _avanza_turno_o_nemici(state, db) {
    // Privata: NON clona.
    // 16.8: db serve per propagare a turno_nemici e a inizio_turno_pg.
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
        return turno_nemici(s, db);
    }
    s.turno_di = prossimo;
    s.fase_corrente = FASE.INIZIO_TURNO_PG;
    return inizio_turno_pg(s, db);
}

// =============================================================================
// §5.8 — turno_nemici.
// Per ogni nemico: status_tick, poi azione AI delegata a ai_nemici.js (§5.9).
// I pattern supportati: Aggro, Tank, Support, Random, Vendicativo, Esecutore,
// e combinazioni "PatternA->PatternB" (switch a meta' PV).
//
// 16.8 (chiusura del debito tecnico DB_REF): db arriva ora esplicitamente dai
// chiamanti (_avanza_turno_o_nemici), e viene propagato a esegui_comportamento
// (per i pattern che hanno bisogno di consultare le definizioni delle carte
// nemico/PG/equip) e a pipeline_danno (step 4 vuln/res, step 9 essenza_drop).
// Prima del refactor questo db era preso da una variabile globale di modulo
// settata in avvia_combattimento: brutta pratica (modulo non thread-safe,
// difficile da testare in isolamento). Ora il modulo e' pulito.
// =============================================================================
function turno_nemici(state, db) {
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
        // 16.8: db passato esplicitamente (era preso dalla globale di modulo in v0.5).
        const azione = esegui_comportamento(s.nemici_in_campo[i], s, db);
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
            // Costruisco un "attaccante" lite per pipeline_danno.
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
            // v0.6: costruisco uno pseudo-attacco da passare alla pipeline come
            // "fonte". I nemici non hanno carte: la fonte e' il loro danno_base
            // (gia' adattato dal pattern AI in azione.danno) + il tag elementale
            // del mondo (es. MONDO_FOR -> "natura" o "oscurita"). Per ora i
            // nemici NON hanno tag elementale esplicito: lascio array vuoto, e
            // la pipeline non triggerera' lo step 4 (nessun match possibile).
            // PARKING_LOT_AI_TAG_NEMICI : aggiungere tag elementale ai nemici
            // (campo nuovo CSV o derivato dal mondo) quando si vuole che gli
            // attacchi nemici matchino vuln/res dei PG (oggi i PG non hanno
            // vuln/res, quindi sarebbe a vuoto comunque).
            const fonte_nem = {
                id: nem.carta_id,
                valore_numerico: azione.danno,
                tag: [],
                salta_step_tag: false,
                ignora_difesa: !!azione.ignora_difesa,
                ignora_scudo: !!azione.ignora_scudo,
                applica_status: null,
            };
            // 16.8: db come 5° arg di pipeline_danno (era preso dalla globale).
            s = pipeline_danno(s, attaccante_nem, fonte_nem, azione.bersaglio_id, db);
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
    return fine_round(s, db);
}

// =============================================================================
// Helper: cerca la definizione della CardNemico nel db a partire dal carta_id.
//
// === Sotto-step 16.8 (ROADMAP) — chiusura del debito tecnico DB_REF ==========
// In v0.5 questa funzione leggeva una variabile globale di modulo che veniva
// settata in `avvia_combattimento`. Era un debito tecnico: rendeva il modulo
// non thread-safe e difficile da testare in isolamento. In 16.8 il db viene
// passato esplicitamente lungo tutta la catena del ciclo turno (vedi commento
// al sotto-step 16.8 in cima a ogni funzione modificata). Comportamento
// invariato; refactor puro.
// =============================================================================
function _carta_nemico_da_id(carta_id, db) {
    // Difensivo: se db non e' stato passato (chiamante out-of-spec), ritorna
    // null. Stesso comportamento di prima quando la globale non era settata.
    if (!db) return null;
    return db.nemici.find(n => n.id === carta_id);
}

// =============================================================================
// fine_round: tick effetti di fine round + verifica esito.
// PARKING_LOT: regola_mondo es. "i PG curano 1 PV a fine round" -> step §7.
// 16.8: db propagato esplicitamente (chiuso il debito tecnico DB_REF). Viene
// passato a _verifica_condizioni_uscita (per auto_evoluzione_equip §5.10 step 5)
// e a inizio_turno_pg (che lo ripropaga per il round successivo).
// =============================================================================
function fine_round(state, db) {
    // Interna al ciclo turno: NON clona.
    let s = state;
    s.round_numero += 1;

    s = _verifica_condizioni_uscita(s, db);
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
    return inizio_turno_pg(s, db);
}

// =============================================================================
// Entry point pubblico: avvia il combattimento del nodo corrente.
// Istanzia nemici, setta fase, parte dal primo PG.
//
// 16.8 (chiusura del debito tecnico DB_REF): in v0.5 questa funzione SETTAVA
// una variabile globale di modulo che veniva poi letta da turno_nemici,
// pipeline_danno e _verifica_condizioni_uscita. Pessima pratica (modulo non
// thread-safe, non testabile in isolamento, side effect nascosto). Ora db
// scorre esplicitamente lungo la catena: avvia_combattimento -> inizio_turno_pg
// -> status_tick_pg -> fine_turno_pg -> _avanza_turno_o_nemici -> turno_nemici
// -> fine_round -> ... e arriva alla pipeline_danno e a
// _verifica_condizioni_uscita come parametro. Comportamento invariato;
// refactor puro.
// =============================================================================
function avvia_combattimento(state, db) {
    let s = istanzia_nemici_da_nodo(state, db);
    if (s.nemici_in_campo.length === 0) {
        return s;  // niente combattimento qui
    }
    s.round_numero = 1;

    // §5.6.4 punto (b) — Inizio combattimento: rivaluto le sinergie σ2 per
    // OGNI PG. Cosi' se durante un nodo riposo o tra combattimenti qualcuno
    // ha cambiato equipaggiamento (oggi non succede, in 16.7 succedera'), i
    // bonus passivi sono attivi prima che parta il primo round.
    // Idempotente: se sinergie_attive era gia' corretto, nessun log.
    for (const pg of s.giocatori) {
        s = valuta_sinergie_passive(s, pg.id, db);
    }

    // Trova il primo PG non KO.
    let primo = 0;
    while (primo < s.giocatori.length && s.giocatori[primo].ko) primo += 1;
    s.turno_di = primo;
    s.fase_corrente = FASE.INIZIO_TURNO_PG;
    return inizio_turno_pg(s, db);
}

// =============================================================================
// MAIN — due simulazioni successive per dimostrare AI nemici diversi:
//   1) Nodo 2 (seed 42): due Lupi d'Ombra (pattern Aggro)
//   2) Nodo 10 (seed 42): un Ladro della Foresta (pattern Vendicativo)
// Step 4+5+6: combattimento completo con AI §5.9 (Aggro, Vendicativo, ecc.).
// =============================================================================


// =============================================================================
// SOTTO-STEP 16.7 (ROADMAP, regolamento v0.6 §5.11) — Evoluzione equipaggiamento
// =============================================================================
// Tre entry point esposti:
//
//   1. auto_evoluzione_equip(state, pg_id, db) -> state
//      Cicla i 3 slot di un PG. Per ogni equip non null che non sia gia' al
//      livello_max, prova a spendere essenze per salire. La salita di livello
//      e' AUTOMATICA non appena ci sono abbastanza essenze di un tag dell'equip
//      (§5.11 Fase 1). Loop: continua a tentare salite finche' qualcuno sale,
//      cosi' se un equip ha le essenze per Lv1->Lv2 e poi anche per Lv2->Lv3,
//      in una sola chiamata arriva fino al cap. Dopo OGNI salita, le sinergie
//      σ2 vengono rivalutate (i tag/stat potrebbero abilitare nuove combo).
//
//   2. valuta_trigger_forme_finali(state, pg_id, db) -> state
//      Per ogni slot al Lv3 con forma_scelta_id == null, valuta i trigger
//      delle equip.forme_finali. Se almeno uno e' soddisfatto, transita a
//      FASE.ATTESA_SCELTA_FORMA_FINALE e popola pg.scelta_forma_pendente con
//      le opzioni disponibili. Il flusso resta bloccato finche' non arriva
//      conferma_forma_finale(). Se nessun trigger e' soddisfatto, lo state
//      esce invariato (l'equip resta "Lv3 base" come prescritto da §5.11).
//
//   3. conferma_forma_finale(state, pg_id, slot, forma_id, db) -> state
//      Applica la scelta: setta equip_istanze[slot].forma_scelta_id, ricalcola
//      tag_correnti = equip.tag ∪ forma.tag_aggiuntivi, rivaluta σ2, logga
//      l'evento "forma_finale_scelta", e ripristina state.fase_corrente alla
//      fase precedente (salvata in state.fase_prima_di_scelta_forma).
//
// HOOK del passo B (prossima sessione): fine_combattimento chiamera' (1) per
// ogni PG; risolvi_nodo_riposo (esplorazione.js) chiamera' (1) + (2) per
// ogni PG. Per ora le 3 funzioni esistono ma non sono ancora cablate ai punti
// di uscita combattimento / ingresso nodo riposo: cosi' il passo A puo'
// essere verificato in isolamento.
//
// CHIUDE: PARKING_LOT_ARMA_ISTANZA — struttura istanza creata qui (16.7) e
// livello reale letto da _risolvi_arma_pg (M2-fix, 16.11).
// =============================================================================

// -----------------------------------------------------------------------------
// Helper interno: legge l'istanza per-PG di uno slot. Se l'istanza non esiste
// ancora ma lo slot e' equipaggiato (legacy state, o test che equipaggia a mano
// settando solo equipaggiamento[slot]), la materializza al volo a Lv1.
// NON clona: opera sullo state in input. E' usata solo dal codice di 16.7
// che gia' lavora su un clone fatto a monte dalla funzione esposta.
// -----------------------------------------------------------------------------
function _materializza_istanza_se_serve(pg, slot, db) {
    const equip_id = pg.equipaggiamento[slot];
    if (!equip_id) return null; // slot vuoto, niente istanza
    if (!pg.equip_istanze) pg.equip_istanze = { arma: null, armatura: null, talismano: null };
    if (pg.equip_istanze[slot]) return pg.equip_istanze[slot];

    // Cerco la definizione nel db.
    const equip_def = db.equipaggiamenti.find(e => e.id === equip_id);
    if (!equip_def) {
        // Difensivo: id non trovato. Non posso materializzare un'istanza
        // sensata; ritorno null. Il chiamante salta lo slot.
        return null;
    }

    // Istanza fresca: livello 1, nessuna forma scelta, tag = copia dell'equip.
    pg.equip_istanze[slot] = {
        livello: equip_def.livello || 1,
        forma_scelta_id: null,
        tag_correnti: Array.isArray(equip_def.tag) ? equip_def.tag.slice() : [],
    };
    return pg.equip_istanze[slot];
}

// -----------------------------------------------------------------------------
// Helper: dato un equip e l'elenco essenze del PG, trova il PRIMO tag dell'equip
// per cui il PG ha abbastanza essenze per pagare il costo. Ritorna il nome del
// tag (string) o null se nessuno dei tag dell'equip e' coperto.
// §5.11 Fase 1: "L'essenza spesa deve matchare almeno uno dei tag
// dell'equipaggiamento". L'ordine dei tag nel CSV definisce la priorita' di
// spesa: deterministico, riproducibile, autorabile.
// -----------------------------------------------------------------------------
function _trova_tag_pagabile(equip, essenze_pg, costo) {
    if (!Array.isArray(equip.tag)) return null;
    for (let i = 0; i < equip.tag.length; i++) {
        const tag = equip.tag[i];
        // Se l'essenza non e' tra le 10 categorie ufficiali, semplicemente
        // non c'e' nel pool del PG (essenze_pg[tag] undefined) -> skippo.
        if (essenze_pg[tag] !== undefined && essenze_pg[tag] >= costo) {
            return tag;
        }
    }
    return null;
}

// -----------------------------------------------------------------------------
// Entry point #1 — auto_evoluzione_equip
// §5.11 Fase 1. Pseudo-codice del regolamento (sezione §5.11):
//
//   PER ogni slot in [arma, armatura, talismano]:
//     equip = pg.equipaggiamento[slot]
//     SE equip == null: continue
//     SE equip.livello == 3: continue
//     livello_target = equip.livello + 1
//     costo_essenze  = (livello_target == 2) ? essenze_per_lv2 : essenze_per_lv3
//     tag_utilizzabile = trova_tag(equip.tag, pg.essenze, costo_essenze)
//     SE tag_utilizzabile != null:
//       pg.essenze[tag_utilizzabile] -= costo_essenze
//       equip.livello = livello_target
//       valuta_sinergie_passive(state, pg_id)
//       log "evoluzione_livello"
//
// La nostra implementazione fa due cose extra rispetto al pseudo-codice:
//   - cicla finche' ALMENO UN equip sale: cosi' un PG con tante essenze
//     puo' incassare Lv1->Lv2 + Lv2->Lv3 in una singola chiamata. Stop loop
//     quando un giro completo non produce salite (fixed-point).
//   - logga `equip_evoluto` (nome canonico richiesto dalla ROADMAP 16.10)
//     invece di `evoluzione_livello`. L'evento contiene pg_id, slot, livello
//     nuovo, tag spese, costo, per essere replay-friendly.
// -----------------------------------------------------------------------------
function auto_evoluzione_equip(state, pg_id, db) {
    // Funzione esposta: clone-at-entry (convenzione del progetto).
    let s = clone(state);

    const idx = s.giocatori.findIndex(p => p.id === pg_id);
    if (idx === -1) {
        return s; // PG non trovato: no-op silenzioso (difensivo).
    }

    // Le due soglie sono in config.combattimento (§0.3). Fallback hard-coded
    // ai default del regolamento se config dovesse essere monco (difensivo).
    const cfg = (s.config && s.config.combattimento) || {};
    const costo_lv2 = cfg.essenze_per_lv2 !== undefined ? cfg.essenze_per_lv2 : 3;
    const costo_lv3 = cfg.essenze_per_lv3 !== undefined ? cfg.essenze_per_lv3 : 5;

    const slots = ['arma', 'armatura', 'talismano'];

    // Loop fixed-point: ad ogni giro provo tutti gli slot; se nessuno sale,
    // esco. Cap difensivo a 6 iterazioni (max teorico: 3 slot × 2 livelli),
    // protegge da bug futuri che ciclerebbero all'infinito.
    //
    // NOTA SULLE STALE-REFERENCE: NON salviamo `pg` fuori dal loop perche'
    // poco sotto chiamiamo valuta_sinergie_passive(s, ...) che fa clone-at-entry
    // e ritorna un NUOVO oggetto state. La nostra reference locale a `pg`
    // diventerebbe orfana (punterebbe al vecchio oggetto). Quindi: ad ogni
    // iterazione del for risaliamo da `s.giocatori[idx]` -> `pg_locale`.
    let qualcuno_e_salito;
    let safety = 0;
    let salite_totali = 0;
    do {
        qualcuno_e_salito = false;
        safety += 1;
        if (safety > 6) break;

        for (const slot of slots) {
            // RIFERIMENTO FRESCO ad ogni giro (dopo eventuale clone di
            // valuta_sinergie_passive nel giro precedente).
            const pg_corr = s.giocatori[idx];
            const equip_id = pg_corr.equipaggiamento[slot];
            if (!equip_id) continue;

            const equip_def = db.equipaggiamenti.find(e => e.id === equip_id);
            if (!equip_def) continue;

            // Materializza istanza se serve (es. legacy state senza equip_istanze).
            const istanza = _materializza_istanza_se_serve(pg_corr, slot, db);
            if (!istanza) continue;

            // Cap su livello_max (default 3 per tutti gli equip v0.6, ma se
            // un futuro CSV avesse livello_max=2 lo rispettiamo).
            const livello_max = equip_def.livello_max || 3;
            if (istanza.livello >= livello_max) continue;

            const livello_target = istanza.livello + 1;
            const costo = (livello_target === 2) ? costo_lv2 : costo_lv3;

            const tag_speso = _trova_tag_pagabile(equip_def, pg_corr.essenze, costo);
            if (tag_speso === null) continue; // non si puo' pagare ora

            // Pagamento + salita. Operiamo IN PLACE su pg_corr (che e' un
            // riferimento dentro a `s`, gia' clonato a inizio funzione).
            pg_corr.essenze[tag_speso] -= costo;
            istanza.livello = livello_target;
            qualcuno_e_salito = true;
            salite_totali += 1;

            s = _log_append(s, 'equip_evoluto', pg_corr.id, null,
                {
                    slot,
                    equip_id: equip_def.id,
                    nuovo_livello: livello_target,
                    tag_speso,
                    costo_essenze: costo,
                },
                `${pg_corr.nome}: ${equip_def.nome} sale a Lv${livello_target} ` +
                `(spese ${costo} essenze di ${tag_speso}).`);

            // §5.11: dopo ogni salita rivaluterei le σ2 del PG (le stat sono
            // cambiate, e con esse l'attivazione di certe sinergie). PERO'
            // valuta_sinergie_passive fa clone-at-entry; chiamarla qui DENTRO
            // il for invalida la reference `pg_corr` per le iterazioni
            // successive di QUESTO giro. Soluzione: NON chiamare qui;
            // chiamare UNA VOLTA dopo che il for ha finito tutti gli slot
            // del giro corrente. E' una semplificazione semantica accettabile
            // (vedi sotto): la σ2 finale e' la stessa, e il log eventi
            // continua a mostrare le salite ordinate.
        }

        // Rivalutazione σ2 a fine giro, se qualcosa e' salito.
        // Lo facciamo qui fuori dal for cosi' qualunque clone-at-entry interno
        // non disturba la reference che useremo al prossimo giro del do/while
        // (rileggeremo s.giocatori[idx] daccapo).
        if (qualcuno_e_salito) {
            s = valuta_sinergie_passive(s, pg_id, db);
        }
    } while (qualcuno_e_salito);

    return s;
}

// -----------------------------------------------------------------------------
// Helper interno: valuta un singolo trigger di forma_finale contro lo state
// corrente. §1.9 RamoEvolutivo.trigger.tipo ammette: "nodo_tipo", "mondo",
// "png_amico", "kill_categoria", "libero". Ognuno ha semantica diversa:
//
//   - "libero":     sempre soddisfatto (l'equip "vibra" senza prerequisiti).
//   - "mondo":      soddisfatto se state.mondo.id === parametro.
//   - "nodo_tipo":  soddisfatto se il nodo corrente ha quel tipo (es. "speciale").
//   - "png_amico":  soddisfatto se un PNG con id == parametro e' in
//                   state.png_in_gioco con ruolo amico/alleato.
//   - "kill_categoria": soddisfatto se il pg ha mai ucciso un nemico di quella
//                   categoria (boss / elite / normale). Letto dal log eventi:
//                   ogni "ko_nemico" ha payload.categoria_nemico settata in
//                   pipeline_danno step 9 (se la voce non c'e' nei log piu'
//                   vecchi, fallback: false, e l'evoluzione semplicemente
//                   non scatta).
//
// Ritorna true/false. Se il tipo di trigger non e' riconosciuto, false (cosi'
// nessun rischio di scattare per errore con dati malformati).
// -----------------------------------------------------------------------------
function _trigger_forma_soddisfatto(state, pg, trigger) {
    if (!trigger || typeof trigger.tipo !== 'string') return false;
    const param = trigger.parametro;
    switch (trigger.tipo) {
        case 'libero':
            return true;

        case 'mondo':
            return state.mondo && state.mondo.id === param;

        case 'nodo_tipo': {
            // §5.11: il campo corretto e' tipo_nodo (non tipo, che non esiste); C2-fix.
            const nodo = state.mappa && state.mappa.nodi[state.mappa.nodo_corrente];
            return nodo ? nodo.tipo_nodo === param : false;
        }

        case 'png_amico': {
            if (!Array.isArray(state.png_in_gioco)) return false;
            return state.png_in_gioco.some(p =>
                p.id === param && (p.ruolo === 'amico' || p.ruolo === 'alleato')
            );
        }

        case 'kill_categoria': {
            // Cerca nel log un evento di kill con quella categoria, attribuito
            // a questo PG. Convenzione: pipeline_danno step 9 logga
            // 'nemico_sconfitto' (verifica nei log esistenti) con payload
            // che include la categoria. Se il payload non ha la categoria,
            // l'evento non conta (fallback safe).
            if (!Array.isArray(state.log)) return false;
            return state.log.some(ev =>
                (ev.tipo === 'nemico_sconfitto' || ev.tipo === 'ko_nemico') &&
                ev.attore === pg.id &&
                ev.payload && ev.payload.categoria === param
            );
        }

        default:
            // PARKING_LOT_TRIGGER_FORME_AVANZATI: tipi futuri (es. "danno_inflitto_> N",
            // "carte_giocate_>=N_di_tag", "boss_specifico"). Per ora unknown -> false.
            return false;
    }
}

// -----------------------------------------------------------------------------
// Entry point #2 — valuta_trigger_forme_finali
// §5.11 Fase 2. Per il PG indicato, per ogni slot al Lv3 con forma non scelta,
// guarda le forme_finali nel db: se ALMENO UNA ha trigger soddisfatto, popola
// pg.scelta_forma_pendente con la lista delle opzioni DISPONIBILI (quelle con
// trigger soddisfatto: il regolamento dice "se piu' trigger sono soddisfatti
// per lo stesso pezzo, il PG sceglie"). Transita la fase a
// ATTESA_SCELTA_FORMA_FINALE e salva la fase precedente in
// state.fase_prima_di_scelta_forma per il ripristino.
//
// IMPORTANTE: se il PG ha gia' una scelta_forma_pendente non null, questa
// funzione e' no-op (non sovrascrivere una scelta gia' in attesa).
// Se piu' slot diventano "pronti" nello stesso momento, la funzione gestisce
// SOLO IL PRIMO che trova nell'ordine slot fisso [arma, armatura, talismano];
// le restanti scelte saranno raccolte al prossimo passaggio in nodo riposo.
// Questa scelta semplifica l'UI (un bivio alla volta) e mantiene la fase
// FSM-friendly.
// -----------------------------------------------------------------------------
function valuta_trigger_forme_finali(state, pg_id, db) {
    let s = clone(state);
    const idx = s.giocatori.findIndex(p => p.id === pg_id);
    if (idx === -1) return s;
    const pg = s.giocatori[idx];

    // Se gia' c'e' una scelta pendente, non aggiungere niente.
    if (pg.scelta_forma_pendente) return s;

    const slots = ['arma', 'armatura', 'talismano'];
    for (const slot of slots) {
        const equip_id = pg.equipaggiamento[slot];
        if (!equip_id) continue;

        const equip_def = db.equipaggiamenti.find(e => e.id === equip_id);
        if (!equip_def) continue;

        const istanza = _materializza_istanza_se_serve(pg, slot, db);
        if (!istanza) continue;

        // Solo equip al Lv3 senza forma scelta.
        if (istanza.livello < 3) continue;
        if (istanza.forma_scelta_id) continue;

        // Forme con trigger soddisfatto.
        const opzioni = [];
        if (Array.isArray(equip_def.forme_finali)) {
            for (const forma of equip_def.forme_finali) {
                if (_trigger_forma_soddisfatto(s, pg, forma.trigger)) {
                    opzioni.push({
                        forma_id: forma.id,
                        nome: forma.nome,
                        descrizione_narrativa: forma.descrizione_narrativa,
                        // tag_aggiuntivi per UI/anteprima della scelta.
                        tag_aggiuntivi: forma.tag_aggiuntivi || [],
                    });
                }
            }
        }

        if (opzioni.length === 0) continue;

        // Popola scelta_forma_pendente e transita la fase.
        pg.scelta_forma_pendente = {
            slot,
            equip_id: equip_def.id,
            equip_nome: equip_def.nome,
            opzioni,
        };
        // Salvo la fase precedente per poterla ripristinare dopo la conferma.
        // Se siamo gia' in ESPLORAZIONE (nodo riposo), torneremo li'.
        if (!s.fase_prima_di_scelta_forma) {
            s.fase_prima_di_scelta_forma = s.fase_corrente;
        }
        s.fase_corrente = FASE.ATTESA_SCELTA_FORMA_FINALE;

        s = _log_append(s, 'forma_finale_disponibile', pg.id, null,
            {
                slot,
                equip_id: equip_def.id,
                n_opzioni: opzioni.length,
                opzioni: opzioni.map(o => o.forma_id),
            },
            `${pg.nome}: ${equip_def.nome} ha raggiunto la sua forma finale. ` +
            `${opzioni.length === 1 ? 'Un' : opzioni.length} cammino${opzioni.length === 1 ? '' : 'i'} possibile${opzioni.length === 1 ? '' : 'i'}.`);

        // Un solo bivio alla volta: appena ne ho aperto uno, esco.
        return s;
    }

    return s;
}

// -----------------------------------------------------------------------------
// Entry point #3 — conferma_forma_finale
// Applica la scelta del PG. Validazioni:
//   - state.fase_corrente deve essere ATTESA_SCELTA_FORMA_FINALE
//   - pg.scelta_forma_pendente deve esistere
//   - slot deve coincidere con quello della scelta pendente
//   - forma_id deve essere tra le opzioni elencate (no scelte fuori menu)
// Effetti:
//   - equip_istanze[slot].forma_scelta_id = forma_id
//   - equip_istanze[slot].tag_correnti = unione(equip.tag, forma.tag_aggiuntivi)
//   - pg.scelta_forma_pendente = null
//   - state.fase_corrente = state.fase_prima_di_scelta_forma (ESPLORAZIONE)
//   - state.fase_prima_di_scelta_forma = undefined (pulizia)
//   - valuta_sinergie_passive: i nuovi tag possono abilitare sinergie σ2
//   - log "forma_finale_scelta"
//
// Ritorna { ok: true, state } in caso di successo, { ok: false, errore }
// altrimenti (coerente con la convenzione di gioca_carta / passa_turno).
// -----------------------------------------------------------------------------
function conferma_forma_finale(state, pg_id, slot, forma_id, db) {
    if (state.fase_corrente !== FASE.ATTESA_SCELTA_FORMA_FINALE) {
        return { ok: false, state: null, errore: {
            codice: 'ERR_FASE_NON_VALIDA',
            messaggio: `conferma_forma_finale richiede fase ATTESA_SCELTA_FORMA_FINALE, trovata ${state.fase_corrente}`,
        }};
    }
    let s = clone(state);
    const idx = s.giocatori.findIndex(p => p.id === pg_id);
    if (idx === -1) {
        return { ok: false, state: null, errore: {
            codice: 'ERR_PG_NON_TROVATO',
            messaggio: `PG ${pg_id} non trovato`,
        }};
    }
    const pg = s.giocatori[idx];
    const pendente = pg.scelta_forma_pendente;
    if (!pendente) {
        return { ok: false, state: null, errore: {
            codice: 'ERR_NESSUNA_SCELTA_PENDENTE',
            messaggio: `${pg.nome} non ha scelte forma_finale pendenti`,
        }};
    }
    if (pendente.slot !== slot) {
        return { ok: false, state: null, errore: {
            codice: 'ERR_SLOT_NON_COINCIDE',
            messaggio: `Scelta pendente per slot=${pendente.slot}, richiesto ${slot}`,
        }};
    }
    if (!pendente.opzioni.some(o => o.forma_id === forma_id)) {
        return { ok: false, state: null, errore: {
            codice: 'ERR_FORMA_NON_TRA_OPZIONI',
            messaggio: `Forma "${forma_id}" non e' tra le opzioni disponibili: ` +
                       pendente.opzioni.map(o => o.forma_id).join(', '),
        }};
    }

    // Recupero la definizione della forma scelta dal db (per i tag_aggiuntivi).
    const equip_def = db.equipaggiamenti.find(e => e.id === pendente.equip_id);
    const forma_def = equip_def && Array.isArray(equip_def.forme_finali)
        ? equip_def.forme_finali.find(f => f.id === forma_id)
        : null;
    if (!forma_def) {
        // Difensivo: il db ha perso la forma. Non dovrebbe succedere.
        return { ok: false, state: null, errore: {
            codice: 'ERR_FORMA_NON_TROVATA_IN_DB',
            messaggio: `Forma "${forma_id}" non presente nel db per equip ${pendente.equip_id}`,
        }};
    }

    // Applica la scelta sull'istanza per-PG.
    const istanza = _materializza_istanza_se_serve(pg, slot, db);
    istanza.forma_scelta_id = forma_id;

    // tag_correnti = unione tag base + tag_aggiuntivi (no duplicati).
    const set_tag = new Set(istanza.tag_correnti || []);
    if (Array.isArray(forma_def.tag_aggiuntivi)) {
        for (const t of forma_def.tag_aggiuntivi) set_tag.add(t);
    }
    istanza.tag_correnti = Array.from(set_tag);

    // Log.
    s = _log_append(s, 'forma_finale_scelta', pg.id, null,
        {
            slot,
            equip_id: pendente.equip_id,
            forma_id,
            forma_nome: forma_def.nome,
            tag_correnti_nuovi: istanza.tag_correnti,
        },
        `${pg.nome} sceglie: "${forma_def.nome}" — ${equip_def.nome} si trasforma.`);

    // Pulisco la scelta pendente.
    pg.scelta_forma_pendente = null;

    // Ripristino la fase precedente. Se per qualche motivo non era stata
    // salvata (paranoia), fallback su ESPLORAZIONE che e' la fase tipica
    // del nodo riposo dove la scelta avviene.
    s.fase_corrente = s.fase_prima_di_scelta_forma || FASE.ESPLORAZIONE;
    delete s.fase_prima_di_scelta_forma;

    // §5.11: dopo la scelta, le sinergie σ2 vengono rivalutate (i nuovi tag
    // possono abilitare combo prima inattive). Sinergie σ1 NON vanno toccate:
    // non riguardano lo Stato Persistente del PG ma le carte giocate nel turno.
    s = valuta_sinergie_passive(s, pg.id, db);

    return { ok: true, state: s, errore: null };
}

// =============================================================================
// FINE BLOCCO 16.7
// =============================================================================

var GED_EXPORTS = {
    FASE,
    avvia_combattimento,
    inizio_turno_pg,
    status_tick_pg,
    pesca_pg,
    gioca_carta,
    esegui_attacco_base,     // §5.2bis (v0.6) — nuovo entry point del 16.4
    valuta_sinergie_passive, // §5.6.4 (v0.6) — sotto-step 16.5 (sinergie σ2)
    valuta_sinergie_attive,  // §5.6.4 (v0.6) — sotto-step 16.6 (sinergie σ1)
    passa_turno,
    fine_turno_pg,
    turno_nemici,
    fine_round,
    istanzia_nemici_da_nodo,
    // Sotto-step 16.7 (v0.6 §5.11) — evoluzione equipaggiamento.
    auto_evoluzione_equip,
    valuta_trigger_forme_finali,
    conferma_forma_finale,
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
// §S2-fix: dipendenza circolare esplorazione → combattimento. Node.js risolve i
// require circolari via cache-modulo: al momento dell'esecuzione delle funzioni
// entrambi i moduli sono gia' completamente caricati, quindi e' sicuro. Spostato
// qui (invece che dentro ogni funzione) per rendere esplicita la dipendenza e
// ridurre il rischio in ambienti non-standard (es. worker thread, bundler).
const { auto_evoluzione_equip, valuta_trigger_forme_finali, FASE } =
    GED;

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

    // === Sotto-step 16.7: guardia di idempotenza =============================
    // Se il riposo e' stato gia' parzialmente applicato (cura+pesca fatte ma
    // siamo usciti perche' c'era un bivio forma_finale aperto), e poi la UI
    // ci richiama dopo conferma_forma_finale, NON ripetere cura e pesca:
    // salta direttamente alla rivalutazione trigger forme finali rimaste.
    // Vedi nota a fine funzione per dove si setta il flag.
    if (nodo.parte_riposo_applicata) {
        for (let i = 0; i < s.giocatori.length; i++) {
            if (s.giocatori[i].ko) continue;
            // Auto-evoluzione: gli equip che hanno raggiunto il Lv3 nel passo
            // precedente potrebbero ora avere essenze residue per altri slot.
            s = auto_evoluzione_equip(s, s.giocatori[i].id, db);
        }
        for (let i = 0; i < s.giocatori.length; i++) {
            if (s.giocatori[i].ko) continue;
            s = valuta_trigger_forme_finali(s, s.giocatori[i].id, db);
            if (s.fase_corrente === FASE.ATTESA_SCELTA_FORMA_FINALE) {
                // Altro bivio: usciamo di nuovo, il flag e' gia' settato.
                return s;
            }
        }
        // Nessun bivio residuo: chiudi il nodo.
        // ATTENZIONE: rileggo nodo da s.mappa per evitare lo stale-reference
        // dovuto ai clone-at-entry di auto_evoluzione_equip/valuta_trigger.
        const nodo_corrente = s.mappa.nodi[s.mappa.nodo_corrente];
        nodo_corrente.stato = 'risolto';
        return s;
    }

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

    // === Sotto-step 16.7 (§5.11) ============================================
    // Nei nodi di riposo facciamo DUE cose oltre cura+pesca:
    //
    //   1. auto_evoluzione_equip: i PG hanno avuto modo di accumulare essenze
    //      durante i nodi combat precedenti; al riposo le spendiamo. La salita
    //      di livello e' automatica e non interrompe il flusso. Per simmetria
    //      con fine_combattimento (§5.10) chiamiamo anche qui: il riposo e'
    //      un "secondo controllo" che recupera eventuali salite che non si
    //      sono potute fare in combattimento (es. equip evoluto QUI dopo che
    //      il PG ha cambiato slot in un nodo intermedio).
    //
    //   2. valuta_trigger_forme_finali: il riposo e' il SOLO momento del gioco
    //      in cui si valuta se un equip al Lv3 puo' rivelare la sua forma
    //      finale. Se almeno un trigger e' soddisfatto, transitiamo a
    //      ATTESA_SCELTA_FORMA_FINALE e usciamo dalla funzione: il nodo
    //      NON viene marcato 'risolto', cosi' la UI sa che dopo la scelta
    //      del PG si deve tornare qui per concludere il riposo. Quando arriva
    //      conferma_forma_finale, ripristina la fase ESPLORAZIONE; sara'
    //      compito della UI/launcher rifare la transizione al nodo successivo
    //      (avanza_nodo) leggendo lo stato del nodo corrente.
    //
    //   ORDINE: prima auto_evoluzione (qualcuno potrebbe arrivare a Lv3
    //   PROPRIO in questo nodo riposo), poi valuta_trigger sul nuovo stato.
    //
    // Iteriamo nell'ordine fisso dei PG: se piu' PG hanno scelte pendenti,
    // viene gestita solo la PRIMA (valuta_trigger_forme_finali e' early-exit
    // sul primo bivio trovato). Le restanti saranno raccolte la prossima
    // volta che il gruppo entrera' in un nodo di riposo (oppure, in 16.9, la
    // UI potra' chiamare valuta_trigger_forme_finali manualmente dopo ogni
    // conferma_forma_finale per concatenare bivi nello stesso riposo: lascio
    // questa scelta al passo UI per non far esplodere l'ambito di 16.7).
    // Fase 1: auto-evoluzione per tutti i PG vivi.
    for (let i = 0; i < s.giocatori.length; i++) {
        if (s.giocatori[i].ko) continue;
        s = auto_evoluzione_equip(s, s.giocatori[i].id, db);
    }

    // Fase 2: valutazione trigger forme_finali. Early-exit sul primo bivio.
    for (let i = 0; i < s.giocatori.length; i++) {
        if (s.giocatori[i].ko) continue;
        s = valuta_trigger_forme_finali(s, s.giocatori[i].id, db);
        if (s.fase_corrente === FASE.ATTESA_SCELTA_FORMA_FINALE) {
            // Bivio aperto. Il nodo NON viene marcato 'risolto'; la UI
            // chiamera' conferma_forma_finale, dopo di che potra' rieseguire
            // risolvi_nodo_riposo (la cura e' gia' avvenuta, ma rivedremo
            // questo dettaglio sotto) oppure procedere ad avanza_nodo.
            //
            // ATTENZIONE STALE-REFERENCE: dopo i clone-at-entry di
            // auto_evoluzione/valuta_trigger, la variabile `nodo` dichiarata
            // a inizio funzione punta a un oggetto orfano. Devo rileggerla
            // da s.mappa per settare il flag sul nodo VERO che torno.
            const nodo_corrente = s.mappa.nodi[s.mappa.nodo_corrente];
            nodo_corrente.parte_riposo_applicata = true;
            return s;
        }
    }

    // Nessun bivio: marca il nodo come risolto e termina normalmente.
    // Stesso problema di stale-reference: rileggo nodo da s.mappa.
    const nodo_corrente = s.mappa.nodi[s.mappa.nodo_corrente];
    nodo_corrente.stato = 'risolto';
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
        // Pool: universali + classe del PG (equipaggiamenti + consumabili; C1-fix).
        const pool = db.equipaggiamenti.concat(db.consumabili).filter(
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
                // Cerca la definizione della carta per il nome narrativo (C1-fix).
                const def = db.attacchi.find(c => c.id === carta_id)
                       || db.abilita.find(c => c.id === carta_id)
                       || db.equipaggiamenti.find(c => c.id === carta_id)
                       || db.consumabili.find(c => c.id === carta_id);
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

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
// IMPORTANTE: con questo sotto-step `db.oggetti` non esiste piu': e' stato
// sdoppiato in `db.equipaggiamenti` e `db.consumabili`. Il modulo
// combattimento.js usa ancora `db.oggetti` in alcuni punti: verra' aggiornato
// nei sotto-step 16.3-16.9 della ROADMAP. Allo step 16.1 e' atteso che il
// motore di combattimento non sia eseguibile end-to-end: l'unico criterio di
// "fatto" e' `node setup.js` che carica tutti i CSV senza errori.
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

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

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
        // to_array_pipe lo gestisce come array di 1 elemento.
        const tag = to_array_pipe(r.tag);
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
            tag_sinergia: to_array_pipe(r.tag_sinergia),
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
            tag: to_array_pipe(r.tag),
            tag_sinergia: to_array_pipe(r.tag_sinergia),
            durata: r.durata,
            // §1.8 v0.6: salta_step_tag (bool). Se true e l'abilita' infligge
            // danno, la pipeline (§5.7 step 4) salta il match tag vs vuln/res:
            // l'effetto e' "puro", non legato a un'arma.
            salta_step_tag: r.salta_step_tag === '' || r.salta_step_tag === undefined
                ? false
                : to_bool(r.salta_step_tag, ctx + ' campo salta_step_tag'),
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
            tag: to_array_pipe(r.tag),
            livello,
            livello_max,
            stats_per_livello,
            forme_finali,
            classe_preferita: r.classe_preferita,
            descrizione_narrativa: r.descrizione_narrativa,
            tag_sinergia: to_array_pipe(r.tag_sinergia),
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
            tag: to_array_pipe(r.tag),
            tag_sinergia: to_array_pipe(r.tag_sinergia),
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
            vulnerabilita: to_array_pipe(r.vulnerabilita),
            resistenza: to_array_pipe(r.resistenza),
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
//     `db.oggetti` non esiste piu': il codice che lo usa va aggiornato nei
//     sotto-step 16.3-16.9 della ROADMAP.
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
            // Il regolamento prescrive che i 3 slot siano sempre OCCUPATI
            // (anche al setup, dall'equipaggiamento iniziale della classe).
            // Per ora restano null: la mappatura "classe -> equip iniziali"
            // richiede classi.csv + un piccolo motore di assegnazione che
            // verra' implementato in PARKING_LOT_EQUIP_INIZIALE_CLASSE
            // (probabilmente come sotto-step del 16.7 o successivo).
            equipaggiamento: {
                arma: null,
                armatura: null,
                talismano: null,
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
            // Tutti e tre gli slot iniziano a null (coerente con
            // equipaggiamento[slot]==null al setup, vedi
            // PARKING_LOT_EQUIP_INIZIALE_CLASSE). Quando in futuro saranno
            // popolati con gli equip iniziali della classe, va costruita anche
            // l'istanza corrispondente con { livello: 1, forma_scelta_id: null,
            // tag_correnti: [...equip.tag] }.
            equip_istanze: {
                arma: null,
                armatura: null,
                talismano: null,
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
if (require.main === module) {
    try {
        // Cartella dati: ../data rispetto a motore/setup.js (struttura repo).
        // In ambiente di test, il main accetta anche un override da argv[2].
        const dir_dati = process.argv[2] || path.join(__dirname, '..', 'data');

        console.log('====================================================');
        console.log('Gli Erranti del Destino - Step 2: setup partita');
        console.log('Seed: 42, numero_giocatori: 2');
        console.log('====================================================\n');

        // opts deterministici: garantisce output identico a parita di seed,
        // byte per byte. In produzione, ometti `opts` per usare il clock reale.
        const state = setup_partita(2, 42, dir_dati, {
            now_iso: '1970-01-01T00:00:00.000Z',
            run_id: 'run_seed42_mvp',
        });

        console.log('\n====================================================');
        console.log('GameState completo:');
        console.log('====================================================');
        console.log(JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('\n[ERRORE FATALE] ' + e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

// Esporto le funzioni principali per uso da altri moduli/test futuri.
module.exports = {
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

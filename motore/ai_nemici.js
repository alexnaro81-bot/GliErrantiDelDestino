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

const { rng_int } = require('./setup');

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

module.exports = {
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

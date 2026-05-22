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

const { rng, rng_int } = require('./setup');

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

module.exports = {
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

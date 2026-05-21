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

const { rng, rng_int, mescola } = require('./setup');

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
        const { auto_evoluzione_equip, valuta_trigger_forme_finali, FASE } =
            require('./combattimento');
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
    const { trigger_commercio_mercante } = require('./eventi_mondo');
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
    const { auto_evoluzione_equip, valuta_trigger_forme_finali, FASE } =
        require('./combattimento');

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
    const { valuta_twist, valuta_apparizione_png, trigger_tradimento } = require('./eventi_mondo');
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
if (require.main === module) {
    const { setup_partita, carica_dati } = require('./setup');
    const path = require('path');

    try {
        const dir_dati = process.argv[2] || path.join(__dirname, '..', 'data');
        console.log('====================================================');
        console.log('Step 7: esplorazione e eventi (seed 42)');
        console.log('====================================================\n');

        const db = carica_dati(dir_dati);
        let state = setup_partita(2, 42, dir_dati, {
            now_iso: '1970-01-01T00:00:00.000Z',
            run_id: 'run_seed42_mvp',
        });

        // Inizializzo il primo nodo come "in_corso".
        state.mappa.nodi[0].stato = 'in_corso';

        // ---- Nodo 1: evento ----
        console.log('\n>>> NODO 1 (evento)');
        state = risolvi_nodo(state, db);
        const nodo1 = state.mappa.nodi[0];
        const evt_rivelato = db.eventi.find(e => e.id === nodo1._evento_rivelato_id);
        console.log(`Evento: ${evt_rivelato.nome}`);
        console.log(`Scelta A: ${evt_rivelato.scelta_A.testo_outcome.substring(0, 80)}...`);
        console.log(`Scelta B: ${evt_rivelato.scelta_B.testo_outcome.substring(0, 80)}...`);
        // Scelgo A.
        const r1 = risolvi_evento(state, db, 'A');
        if (!r1.ok) throw new Error(r1.errore.messaggio);
        state = r1.state;
        console.log(`PG1 PV dopo: ${state.giocatori[0].pv}/${state.giocatori[0].pv_max}`);
        console.log(`PG1 status: ${JSON.stringify(state.giocatori[0].status)}`);

        // ---- Avanzo al nodo 2 (combattimento, lo skippiamo per ora) ----
        const a1 = avanza_nodo(state, db);
        if (!a1.ok) throw new Error(a1.errore.messaggio);
        state = a1.state;

        // Skip nodo 2 (combattimento) manualmente: lo segno risolto.
        state.mappa.nodi[1].stato = 'risolto';
        const a2 = avanza_nodo(state, db);
        state = a2.state;
        state.mappa.nodi[2].stato = 'risolto';  // skip nodo 3 (altro combat)
        const a3 = avanza_nodo(state, db);
        state = a3.state;

        // ---- Nodo 4: riposo ----
        console.log('\n>>> NODO 4 (riposo)');
        const pg1_pv_prima = state.giocatori[0].pv;
        state = risolvi_nodo(state, db);
        console.log(`PG1: PV ${pg1_pv_prima} -> ${state.giocatori[0].pv} (atteso +30% di 30 = +9, cappato a 30)`);
        console.log(`PG1 bonus_carte_prossimo_turno: ${state.giocatori[0].bonus_carte_prossimo_turno}`);

        // ---- Avanzo al nodo 5 (tesoro) ----
        const a4 = avanza_nodo(state, db);
        state = a4.state;

        console.log('\n>>> NODO 5 (tesoro)');
        const mano_pg1_prima = [...state.giocatori[0].mano];
        state = risolvi_nodo(state, db);
        const mano_pg1_dopo = state.giocatori[0].mano;
        const nuove = mano_pg1_dopo.filter(c => !mano_pg1_prima.includes(c));
        console.log(`PG1 oggetto ricevuto: ${nuove.join(', ') || '(nessuno, mano piena -> scarti)'}`);

        // ---- Test diretto: applico una scelta B a un altro evento universale ----
        console.log('\n--- TEST: evento universale "La Voce Senza Volto" (scelta B) ---');
        const evt_voce = db.eventi.find(e => e.id === 'EVT_UNI_02');
        const pv_pre_b = state.giocatori[0].pv;
        const status_pre_b = state.giocatori[0].status.length;
        // Simulo manualmente la rivelazione + scelta B.
        state.mappa.nodi[state.mappa.nodo_corrente]._evento_rivelato_id = evt_voce.id;
        state.mappa.nodi[state.mappa.nodo_corrente].stato = 'in_attesa_scelta';
        const rB = risolvi_evento(state, db, 'B');
        if (rB.ok) {
            state = rB.state;
            console.log(`Atteso: status "forza" applicato.`);
            console.log(`Status dopo: ${JSON.stringify(state.giocatori[0].status.slice(status_pre_b))}`);
        }

        // ---- Riepilogo ----
        console.log('\n====================================================');
        console.log('Riepilogo log eventi (ultimi 15):');
        console.log('====================================================');
        for (const e of state.log.slice(-15)) {
            console.log(`[${e.id}] ${e.tipo}: ${e.testo_narrativo}`);
        }
    } catch (e) {
        console.error('\n[ERRORE FATALE] ' + e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

module.exports = {
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

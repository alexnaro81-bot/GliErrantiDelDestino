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
const { rng, rng_int, mescola } = require('./setup');
// Step 6 (§5.9): pattern AI nemici delegati a un modulo separato.
const { esegui_comportamento } = require('./ai_nemici');

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
    const { bonus_pesca_da_png } = require('./eventi_mondo');
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
            const { trigger_salvataggio_alleato } = require('./eventi_mondo');
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
        const { bonus_cura_fine_combat_da_png } = require('./eventi_mondo');
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
if (require.main === module) {
    const { setup_partita, carica_dati } = require('./setup');
    const path = require('path');

    try {
        const dir_dati = process.argv[2] || path.join(__dirname, '..', 'data');
        console.log('====================================================');
        console.log('Step 4+5+6: simulazione combattimento (seed 42)');
        console.log('====================================================\n');

        // Carico DB e creo partita deterministica.
        const db = carica_dati(dir_dati);
        let state = setup_partita(2, 42, dir_dati, {
            now_iso: '1970-01-01T00:00:00.000Z',
            run_id: 'run_seed42_mvp',
        });

        // Avanzo al primo nodo combattimento (nel seed 42 e' il nodo 2).
        state.mappa.nodo_corrente = 1;  // nodo "Bosco delle Briglie Spezzate"
        const nodo = state.mappa.nodi[state.mappa.nodo_corrente];
        console.log(`\n>>> Nodo corrente: ${nodo.carta_luogo_id} (${nodo.tipo_nodo})`);
        console.log(`>>> Nemici previsti: ${nodo.incontro.join(', ')}\n`);

        state = avvia_combattimento(state, db);
        console.log(`Fase: ${state.fase_corrente}`);
        console.log(`Turno di: ${state.giocatori[state.turno_di].nome} (${state.giocatori[state.turno_di].classe})`);
        console.log(`PG1 PV/EN: ${state.giocatori[0].pv}/${state.config.pg.pv_massimi} EN=${state.giocatori[0].energia} mano: ${state.giocatori[0].mano.join(',')}`);
        console.log(`PG2 PV/EN: ${state.giocatori[1].pv}/${state.config.pg.pv_massimi} EN=${state.giocatori[1].energia} mano: ${state.giocatori[1].mano.join(',')}`);
        console.log(`Nemici: ${state.nemici_in_campo.map(n => `${n.istanza_id}(PV ${n.pv})`).join(', ')}\n`);

        // ROUND 1 — PG1 (guerriero) gioca la prima carta attacco che ha in
        // mano, target il primo nemico.
        function gioca_prima_carta_attacco(s, pg_idx, db) {
            const pg = s.giocatori[pg_idx];
            for (const cid of pg.mano) {
                const c = db.attacchi.find(a => a.id === cid);
                if (c && c.costo_energia <= pg.energia && c.target === 'nemico') {
                    return gioca_carta(s, pg.id, cid,
                        s.nemici_in_campo[0] ? s.nemici_in_campo[0].istanza_id : null, db);
                }
            }
            return passa_turno(s, db);
        }

        let r;
        console.log('--- PG1 turno: gioca un attacco ---');
        r = gioca_prima_carta_attacco(state, 0, db);
        if (!r.ok) { console.log('Errore:', r.errore); }
        else state = r.state;

        console.log(`Fase: ${state.fase_corrente}, turno_di: ${state.turno_di}`);
        console.log('--- PG1: passa il turno ---');
        r = passa_turno(state, db);
        if (r.ok) state = r.state;
        console.log(`Fase: ${state.fase_corrente}, turno_di: ${state.turno_di}`);

        console.log('--- PG2 turno: gioca un attacco ---');
        r = gioca_prima_carta_attacco(state, 1, db);
        if (!r.ok) { console.log('Errore:', r.errore); }
        else state = r.state;

        console.log(`Fase: ${state.fase_corrente}`);
        if (state.fase_corrente === FASE.ATTESA_AZIONE_PG) {
            r = passa_turno(state, db);
            if (r.ok) state = r.state;
        }

        console.log('\n--- Stato dopo turno nemici ---');
        console.log(`PG1: PV ${state.giocatori[0].pv}/${state.giocatori[0].pv_max}`);
        console.log(`PG2: PV ${state.giocatori[1].pv}/${state.giocatori[1].pv_max}`);
        console.log(`Nemici: ${state.nemici_in_campo.map(n => `${n.istanza_id}(PV ${n.pv})`).join(', ') || '(tutti sconfitti)'}`);
        console.log(`Fase: ${state.fase_corrente}, round: ${state.round_numero}`);

        console.log('\n--- LOG eventi del combattimento (ultime 25 righe) ---');
        const log_recente = state.log.slice(-25);
        for (const e of log_recente) {
            console.log(`[${e.id}] ${e.tipo}: ${e.testo_narrativo}`);
        }

        // Da v0.4: il motore transita automaticamente da fine_combattimento
        // a esplorazione. Vittoria = fase esplorazione + nessun nemico in campo.
        if (state.fase_corrente === FASE.ESPLORAZIONE && state.nemici_in_campo.length === 0) {
            console.log('\n>>> VITTORIA <<<');
        } else if (state.fase_corrente === FASE.FINE_RUN) {
            console.log('\n>>> SCONFITTA <<<');
        } else {
            console.log(`\n>>> Combattimento ancora in corso (fase: ${state.fase_corrente}) <<<`);
        }
    } catch (e) {
        console.error('\n[ERRORE FATALE] ' + e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

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

module.exports = {
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

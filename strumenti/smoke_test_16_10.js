// =============================================================================
// Gli Erranti del Destino — strumenti/smoke_test_16_10.js
// Step 16.10: smoke test end-to-end con seed fisso.
//
// Verifica che una run completa produca nel log tutti gli eventi v0.6:
//   ✓ attacco_base       (§5.2bis)
//   ✓ sinergia_attivata  (σ1, §5.6.4)
//   ✓ σ2 attiva          (pg.sinergie_attive non vuoto, §5.6.4)
//   ✓ essenze_droppate   (§5.11 — nota: il log usa "essenze_droppate" al plurale)
//   ✓ equip_evoluto      (§5.11 Fase 1)
//   ✓ forma_finale_scelta (§5.11 Fase 2)
//   ✓ boss sconfitto     (nodo 12, categoria=boss → evento 'ko' del boss)
//
// Uso: node strumenti/smoke_test_16_10.js [dir_dati]
// =============================================================================
'use strict';

const path = require('path');
const { carica_dati, setup_partita } = require('../motore/setup');
const {
    FASE,
    avvia_combattimento,
    gioca_carta,
    esegui_attacco_base,
    passa_turno,
    auto_evoluzione_equip,
    valuta_trigger_forme_finali,
    conferma_forma_finale,
} = require('../motore/combattimento');
const { risolvi_nodo } = require('../motore/esplorazione');

const DIR_DATI = process.argv[2] || path.join(__dirname, '..', 'data');
const SEED = 42;

// --- Utility -----------------------------------------------------------------

// §10.x Convenzione test: trova tutti i log di un dato tipo.
function trova_log(state, tipo) {
    return state.log.filter(ev => ev.tipo === tipo);
}

// Asser semplice: stampa ✓ o ✗ e incrementa contatori.
let n_ok = 0; let n_fail = 0;
function check(cond, msg) {
    if (cond) { console.log(`  ✓ ${msg}`); n_ok++; }
    else       { console.error(`  ✗ FAIL: ${msg}`); n_fail++; }
}

// Loop di combattimento generico: gioca una carta attacco a testa finché il
// combattimento non finisce (o dopo 40 azioni al massimo, difesa anti-loop).
function loop_combatti(state, db) {
    let s = state;
    let guard = 0;
    while (
        s.fase_corrente === FASE.ATTESA_AZIONE_PG &&
        s.nemici_in_campo.length > 0 &&
        guard < 40
    ) {
        guard++;
        const pg = s.giocatori[s.turno_di];
        const target = s.nemici_in_campo[0];
        // Cerca la prima carta attacco giocabile (target singolo).
        let giocata = false;
        for (const cid of pg.mano) {
            const c = db.attacchi.find(a => a.id === cid);
            if (c && c.costo_energia <= pg.energia && c.target === 'nemico') {
                const r = gioca_carta(s, pg.id, cid, target.istanza_id, db);
                if (r.ok) { s = r.state; giocata = true; break; }
            }
        }
        if (!giocata) {
            // Nessuna carta giocabile: passa il turno.
            const r = passa_turno(s, db);
            if (r.ok) s = r.state; else break;
        }
    }
    return s;
}

// =============================================================================
// MAIN
// =============================================================================
console.log('=================================================================');
console.log('SMOKE TEST 16.10 — run end-to-end, seed 42');
console.log('=================================================================\n');

// §12.1 — Carico db e creo lo state iniziale con parametri deterministici.
const db = carica_dati(DIR_DATI);
let state = setup_partita(2, SEED, DIR_DATI, {
    now_iso: '1970-01-01T00:00:00.000Z',
    run_id: 'run_smoke_16_10',
});

// Stampo la mappa per leggibilità del log.
console.log('Mappa generata (seed 42):');
state.mappa.nodi.forEach((n, i) => {
    const cat = n.categoria_attesa ? ` [${n.categoria_attesa}]` : '';
    const inc = (n.incontro && n.incontro.length) ? ` nemici:${n.incontro.join('+')}` : '';
    console.log(`  [${i}] pos=${n.posizione} ${n.tipo_nodo}${cat}${inc}`);
});

// Individuo gli indici utili.
const idx_combat  = state.mappa.nodi.findIndex(n =>
    n.tipo_nodo === 'combattimento' && n.categoria_attesa !== 'boss');
const idx_riposo  = state.mappa.nodi.findIndex(n => n.tipo_nodo === 'riposo');
const idx_boss    = state.mappa.nodi.findIndex(n => n.categoria_attesa === 'boss');

console.log(`\n→ Nodo combattimento: idx=${idx_combat}`);
console.log(`→ Nodo riposo:        idx=${idx_riposo}`);
console.log(`→ Nodo boss:          idx=${idx_boss}\n`);

check(idx_combat >= 0, 'Nodo combattimento trovato nella mappa');
check(idx_riposo >= 0, 'Nodo riposo trovato nella mappa');
check(idx_boss   >= 0, 'Nodo boss trovato nella mappa');

// =============================================================================
// PREPARAZIONE PG1: equipaggiamento + essenze pre-caricate
// §2.2 v0.6 — slot arma + talismano (al posto di accessorio).
// §5.11 — essenze pre-caricate a 8 "taglio" per innescare due salite di livello
//          (Lv1→Lv2 costa 3, Lv2→Lv3 costa 5; 3+5=8) all'auto_evoluzione di
//          fine combattimento.
// =============================================================================
console.log('--- Preparazione PG1 ---');
const pg1 = state.giocatori[0];

// §1.9 / §2.2: equipaggiamento v0.6 (talismano al posto di accessorio).
pg1.equipaggiamento.arma      = 'EQP_SPADONE_VETERANO';  // tag: taglio|impatto
pg1.equipaggiamento.talismano = 'EQP_TALISMANO_LUCE';    // tag: luce|sacro

// §5.11: istanze degli equip (livello iniziale = 1, nessuna forma scelta).
pg1.equip_istanze = {
    arma: {
        equip_id: 'EQP_SPADONE_VETERANO',
        livello: 1,
        forma_scelta_id: null,
        tag_correnti: ['taglio', 'impatto'],
    },
    armatura: null,
    talismano: {
        equip_id: 'EQP_TALISMANO_LUCE',
        livello: 1,
        forma_scelta_id: null,
        tag_correnti: ['luce', 'sacro'],
    },
};

// §5.11: essenze pre-caricate → 8 "taglio" bastano per Lv2 + Lv3.
pg1.essenze['taglio'] = 8;

console.log(`  PG1: arma=EQP_SPADONE_VETERANO, talismano=EQP_TALISMANO_LUCE`);
console.log(`  PG1: essenze.taglio pre-caricate a 8`);

// =============================================================================
// FASE 1 — COMBATTIMENTO (nodo comune, idx_combat)
// =============================================================================
console.log('\n--- FASE 1: Combattimento (nodo comune) ---');
state.mappa.nodo_corrente = idx_combat;
state = avvia_combattimento(state, db);

// §5.6.4 — σ2: avvia_combattimento rivaluta valuta_sinergie_passive per ogni PG.
// SIN_ARMONIA_SOLARE: slot=[arma,talismano], tag=luce, soglia=1.
// EQP_TALISMANO_LUCE ha tag luce → 1 item >= soglia 1 → attiva.
const pg1_sinergie = state.giocatori[0].sinergie_attive;
check(
    Array.isArray(pg1_sinergie) && pg1_sinergie.includes('SIN_ARMONIA_SOLARE'),
    `σ2 SIN_ARMONIA_SOLARE attiva (pg1.sinergie_attive=[${pg1_sinergie.join(',')}])`
);
check(
    state.nemici_in_campo.length > 0,
    `Nemici istanziati: ${state.nemici_in_campo.map(n => `${n.carta_id}(PV${n.pv})`).join(', ')}`
);

// §5.2bis — Attacco base: il primo attacco del turno è gratuito.
const primo_nemico_id = state.nemici_in_campo[0].istanza_id;
const r_ab = esegui_attacco_base(state, 'pg_1', primo_nemico_id, db);
check(r_ab.ok, `esegui_attacco_base ok (${r_ab.errore ? r_ab.errore.messaggio : 'nessun errore'})`);
state = r_ab.state;
check(
    trova_log(state, 'attacco_base').length >= 1,
    `Log "attacco_base" presente (${trova_log(state, 'attacco_base').length} voci)`
);

// §5.6.4 σ1 — SIN_DANZA_LAME: gioca ≥2 carte con tag "taglio" nello stesso turno.
// ATK_FENDENTE: classe=guerriero, tag=taglio, costo=1 EN, danno=4.
// Inietto le 2 carte direttamente in mano dopo inizio_turno_pg (già chiamato
// dentro avvia_combattimento), così non altero il deck base del PG.
state.giocatori[0].mano.unshift('ATK_FENDENTE', 'ATK_FENDENTE');

// Prima carta taglio: conta=1 → sinergia non ancora scattata.
const target_1 = state.nemici_in_campo.length > 0
    ? state.nemici_in_campo[0].istanza_id : primo_nemico_id;
const r_c1 = gioca_carta(state, 'pg_1', 'ATK_FENDENTE', target_1, db);
check(r_c1.ok, `Gioca ATK_FENDENTE x1 (tag taglio) — ${r_c1.ok ? 'ok' : r_c1.errore.messaggio}`);
state = r_c1.state;

// Seconda carta taglio: conta=2 >= soglia 2 → sinergia_attivata.
const target_2 = state.nemici_in_campo.length > 0
    ? state.nemici_in_campo[0].istanza_id : primo_nemico_id;
const r_c2 = gioca_carta(state, 'pg_1', 'ATK_FENDENTE', target_2, db);
check(r_c2.ok, `Gioca ATK_FENDENTE x2 (tag taglio) — ${r_c2.ok ? 'ok' : r_c2.errore.messaggio}`);
state = r_c2.state;
check(
    trova_log(state, 'sinergia_attivata').length >= 1,
    `Log "sinergia_attivata" (σ1 SIN_DANZA_LAME) presente`
);

// Loop: combatti fino a che tutti i nemici sono sconfitti.
// L'auto_evoluzione_equip scatterà in _verifica_condizioni_uscita a fine combat.
state = loop_combatti(state, db);

// Se ancora in combattimento (es. PG ha finito le carte), forziamo passa_turno
// per ogni PG finché il combat non finisce.
let guard_ext = 0;
while (
    state.fase_corrente !== FASE.ESPLORAZIONE &&
    state.fase_corrente !== FASE.FINE_RUN &&
    state.nemici_in_campo.length > 0 &&
    guard_ext < 20
) {
    guard_ext++;
    if (state.fase_corrente === FASE.ATTESA_AZIONE_PG) {
        const r = passa_turno(state, db);
        if (r.ok) state = r.state; else break;
    } else { break; }
}

check(
    state.fase_corrente === FASE.ESPLORAZIONE,
    `Fine combattimento: fase=${state.fase_corrente} (atteso: esplorazione)`
);

// §5.11 — equip_evoluto: l'auto_evoluzione ha bruciato le 8 essenze di taglio
// per portare EQP_SPADONE_VETERANO da Lv1 → Lv2 → Lv3 automaticamente.
const log_evoluto = trova_log(state, 'equip_evoluto');
check(
    log_evoluto.length >= 1,
    `Log "equip_evoluto" presente (${log_evoluto.length} voci: ` +
    log_evoluto.map(e => `Lv${e.payload.nuovo_livello}`).join(',') + ')'
);

// Verifica che essenze_droppate sia nel log (i Lupi droppano oscurita+taglio).
const log_drop = trova_log(state, 'essenze_droppate');
check(
    log_drop.length >= 1,
    `Log "essenze_droppate" presente (${log_drop.length} voci)`
);

// =============================================================================
// FASE 2 — NODO RIPOSO → SCELTA FORMA FINALE
// §5.11 Fase 2: risolvi_nodo_riposo valuta i trigger di forma_finale per gli
// equip al Lv3. EQP_SPADONE_VETERANO al Lv3 ha un trigger "libero" (sempre vero)
// → scatta ATTESA_SCELTA_FORMA_FINALE con scelta SPADONE_VETERANO_SANGUE disponibile.
// =============================================================================
console.log('\n--- FASE 2: Nodo riposo → scelta forma finale ---');
state.mappa.nodo_corrente = idx_riposo;
state = risolvi_nodo(state, db);

check(
    state.fase_corrente === FASE.ATTESA_SCELTA_FORMA_FINALE,
    `Fase ATTESA_SCELTA_FORMA_FINALE attivata al nodo riposo`
);

// Recupera la scelta pendente dal PG con equip al Lv3.
const pg_con_scelta = state.giocatori.find(p => p.scelta_forma_pendente);
check(
    pg_con_scelta !== undefined,
    `Trovato PG con scelta_forma_pendente: ${pg_con_scelta ? pg_con_scelta.id : '—'}`
);

if (pg_con_scelta && pg_con_scelta.scelta_forma_pendente) {
    const scelta = pg_con_scelta.scelta_forma_pendente;
    console.log(`  PG: ${pg_con_scelta.id}, slot: ${scelta.slot}, opzioni: ${scelta.opzioni.map(o => o.forma_id).join(', ')}`);

    // §5.11: conferma la prima forma disponibile (SPADONE_VETERANO_SANGUE ha trigger libero).
    const forma_id = scelta.opzioni[0].forma_id;
    const r_forma = conferma_forma_finale(state, pg_con_scelta.id, scelta.slot, forma_id, db);
    check(r_forma.ok, `conferma_forma_finale(${forma_id}) ok — ${r_forma.ok ? 'ok' : r_forma.errore.messaggio}`);
    state = r_forma.state;

    check(
        trova_log(state, 'forma_finale_scelta').length >= 1,
        `Log "forma_finale_scelta" presente`
    );
} else {
    check(false, 'Skippato: nessun PG con scelta_forma_pendente trovato');
}

// =============================================================================
// FASE 3 — BOSS (nodo 12, categoria=boss)
// §5.9 NEM_DRUIDO_CORROTTO: PV=48, difesa=3, drop=terra|oscurita|energia.
// Per velocizzare il test (è uno smoke test, non di bilanciamento), riduco i PV
// del boss a 3 dopo l'istanziazione così un singolo attacco base lo abbatte.
// =============================================================================
console.log('\n--- FASE 3: Boss (nodo 12) ---');
state.mappa.nodo_corrente = idx_boss;
// Ripristino la fase in ESPLORAZIONE se conferma_forma_finale l'ha cambiata.
if (state.fase_corrente !== FASE.ESPLORAZIONE) {
    state.fase_corrente = FASE.ESPLORAZIONE;
}

// Verifico i PG sono vivi (potrebbe essere FINE_RUN se sono morti).
check(
    state.fase_corrente === FASE.ESPLORAZIONE,
    `Fase esplorazione prima del boss: ${state.fase_corrente}`
);

state = avvia_combattimento(state, db);
check(
    state.nemici_in_campo.length > 0,
    `Boss istanziato: ${state.nemici_in_campo.map(n => `${n.carta_id}(PV${n.pv})`).join(', ')}`
);

// Riduco i PV del boss per accelerare il test (smoke test, non bilanciamento).
for (const nem of state.nemici_in_campo) {
    if (nem.carta_id === 'NEM_DRUIDO_CORROTTO') {
        console.log(`  Boss ${nem.istanza_id}: PV ridotti da ${nem.pv} a 3 (smoke test speed-up).`);
        nem.pv = 3;
    }
}

// Loop: abbatto il boss.
state = loop_combatti(state, db);

// Forzo passa_turno se necessario.
guard_ext = 0;
while (
    state.fase_corrente !== FASE.ESPLORAZIONE &&
    state.fase_corrente !== FASE.FINE_RUN &&
    state.nemici_in_campo.length > 0 &&
    guard_ext < 20
) {
    guard_ext++;
    if (state.fase_corrente === FASE.ATTESA_AZIONE_PG) {
        const r = passa_turno(state, db);
        if (r.ok) state = r.state; else break;
    } else { break; }
}

// Verifica sconfitta del boss nel log.
const log_ko_boss = trova_log(state, 'ko').filter(ev =>
    ev.bersaglio && ev.bersaglio.includes('NEM_DRUIDO_CORROTTO')
);
check(
    log_ko_boss.length >= 1,
    `Boss NEM_DRUIDO_CORROTTO sconfitto (log 'ko' presente: ${log_ko_boss.length} voci)`
);
check(
    state.fase_corrente === FASE.ESPLORAZIONE,
    `Fine combattimento boss: fase=${state.fase_corrente}`
);

// =============================================================================
// RIEPILOGO
// =============================================================================
console.log('\n=================================================================');
console.log(`RIEPILOGO: ${n_ok} check passati, ${n_fail} falliti`);
console.log('=================================================================');

// Stampo i tipi di evento unici nel log finale.
const tipi_log = [...new Set(state.log.map(ev => ev.tipo))].sort();
console.log(`\nTipi di evento nel log: ${tipi_log.join(', ')}\n`);

if (n_fail > 0) {
    process.exit(1);
}

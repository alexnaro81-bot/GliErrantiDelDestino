// =============================================================================
// Gli Erranti del Destino — web/app.js
// Orchestrazione UI (rendering + input). Il motore di gioco vive in
// motore_bundle.js, esposto come window.GED.
//
// Architettura, in breve (per non-tecnici):
//   - Lo stato del gioco vive in una sola variabile: stato_gioco.
//   - Ogni volta che il giocatore fa un'azione (clicca un bottone, sceglie
//     una carta), chiamiamo una funzione del motore che ritorna un nuovo
//     stato, e poi ridisegnamo la UI da quello stato.
//   - Non c'e' "magia": ogni elemento HTML viene aggiornato leggendo i campi
//     dello stato di gioco.
// =============================================================================

(function() {
  'use strict';

  // Stato globale dell'app. Inizializzato da setup_partita.
  let stato_gioco = null;
  let db = null;
  let scelta_giocatori = 2;
  let carta_selezionata = null;  // {id, carta_def} durante la selezione bersaglio

  // Shortcuts ai moduli GED esposti dal bundle.
  const G = window.GED;

  // ---------------------------------------------------------------------------
  // BOOT: setup iniziale degli event listener.
  // ---------------------------------------------------------------------------
  function init() {
    // Setup giocatori.
    document.querySelectorAll('#scelta-giocatori button').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#scelta-giocatori button').forEach(x => x.classList.remove('attivo'));
        b.classList.add('attivo');
        scelta_giocatori = parseInt(b.dataset.n, 10);
      });
    });

    document.getElementById('btn-inizia').addEventListener('click', avvia_partita);
    document.getElementById('btn-passa-turno').addEventListener('click', azione_passa_turno);
    document.getElementById('btn-prossimo-nodo').addEventListener('click', azione_prossimo_nodo);
    document.getElementById('btn-risolvi-nodo').addEventListener('click', azione_risolvi_nodo);
    document.getElementById('btn-avvia-combat').addEventListener('click', azione_avvia_combat);
    document.getElementById('btn-annulla-target').addEventListener('click', chiudi_modale_target);
    document.getElementById('btn-ricomincia').addEventListener('click', () => location.reload());
    document.getElementById('btn-scelta-A').addEventListener('click', () => azione_scelta_evento('A'));
    document.getElementById('btn-scelta-B').addEventListener('click', () => azione_scelta_evento('B'));
  }

  // ---------------------------------------------------------------------------
  // SETUP PARTITA: carica i dati e crea lo stato iniziale.
  // ---------------------------------------------------------------------------
  async function avvia_partita() {
    const err_el = document.getElementById('setup-errore');
    err_el.textContent = '';
    try {
      // Carica il database (CSV+JSON) tramite la versione browser di carica_dati.
      // Il path relativo "../data" funziona se la pagina e' servita da web/.
      db = await G.carica_dati_browser('../data');

      // Seed: se l'utente ne fornisce uno, lo usiamo; altrimenti casuale.
      const seed_input = document.getElementById('input-seed').value.trim();
      const seed = seed_input === '' ? (Date.now() & 0x7FFFFFFF) : parseInt(seed_input, 10);

      // setup_partita del motore richiede una "dir_dati" per chiamare a sua
      // volta carica_dati. Pero' noi abbiamo gia' caricato db da qui (browser).
      // Soluzione: chiamo le funzioni interne di setup direttamente,
      // ricostruendo i passi di §3.1.
      stato_gioco = setup_partita_browser(scelta_giocatori, seed, db);

      // Setta il primo nodo come "in_corso" (in Node lo faceva il main).
      stato_gioco.mappa.nodi[0].stato = 'in_corso';

      passa_a_schermata('gioco');
      render();
    } catch (e) {
      console.error(e);
      err_el.textContent = `Errore: ${e.message}`;
    }
  }

  // Versione browser di setup_partita: usa il db gia' caricato invece di
  // ricaricarlo. Replica i passi di §3.1 chiamando le funzioni esposte.
  function setup_partita_browser(numero_giocatori, seed, db) {
    let rng_state = seed | 0;

    // §3.1 punto 3: pesca mondo.
    const r_mondo = G.pesca_dal_pool(db.mondi, 1, rng_state);
    rng_state = r_mondo.rng_state;
    const mondo = r_mondo.presi[0];

    // §3.1 punto 4: mappa.
    const r_mappa = G.costruisci_mappa(mondo, db, rng_state);
    rng_state = r_mappa.rng_state;

    // §3.1 punto 5: PG.
    const classi = ['guerriero', 'mago', 'ladro', 'guaritore'];
    const giocatori = [];
    for (let i = 0; i < numero_giocatori; i++) {
      const classe = classi[i % classi.length];
      const r_pila = G.costruisci_pila_iniziale(classe, db, rng_state);
      rng_state = r_pila.rng_state;
      const r_mix = G.mescola(r_pila.pila, rng_state);
      rng_state = r_mix.rng_state;
      const dim_mano = db.config.pg.dimensione_mano;
      giocatori.push({
        id: `pg_${i + 1}`,
        nome: `Errante ${i + 1}`,
        classe,
        pv: db.config.pg.pv_iniziali,
        pv_max: db.config.pg.pv_massimi,
        energia: 0,
        mano: r_mix.array.slice(0, dim_mano),
        pila: r_mix.array.slice(dim_mano),
        scarti: [],
        campo: [],
        status: [],
        equipaggiamento: { arma: null, armatura: null, accessorio: null },
        ko: false,
      });
    }

    return {
      meta: { run_id: `run_${seed}`, seed, versione_regole: '0.3',
              timestamp_inizio: new Date().toISOString() },
      config: db.config,
      mondo,
      mappa: { nodi: r_mappa.nodi, nodo_corrente: 0, nodi_visitati: [] },
      giocatori,
      nemici_in_campo: [],
      png_in_gioco: [],
      twist_giocati: [],
      fase_corrente: 'esplorazione',
      turno_di: 0,
      round_numero: 1,
      log: [{
        id: 0,
        timestamp: new Date().toISOString(),
        tipo: 'fase_cambiata',
        attore: null, bersaglio: null,
        payload: { evento: 'partita_iniziata', seed, numero_giocatori },
        testo_narrativo: `La partita ha inizio nel mondo "${mondo.nome}".`,
      }],
      rng_state,
    };
  }

  function passa_a_schermata(quale) {
    document.querySelectorAll('.schermata').forEach(s => s.classList.remove('attiva'));
    document.getElementById(`schermata-${quale}`).classList.add('attiva');
  }

  // ---------------------------------------------------------------------------
  // RENDER: aggiorna tutta la UI dallo stato corrente.
  // ---------------------------------------------------------------------------
  function render() {
    if (!stato_gioco) return;
    render_header();
    render_pg();
    render_nemici();
    render_mappa();
    render_mano();
    render_log();
    render_azioni();
    verifica_fine_partita();
  }

  function render_header() {
    const nodo = stato_gioco.mappa.nodi[stato_gioco.mappa.nodo_corrente];
    document.getElementById('ui-nodo-corrente').textContent =
      `${stato_gioco.mappa.nodo_corrente + 1}/${stato_gioco.mappa.nodi.length}`;
    document.getElementById('ui-tipo-nodo').textContent = nodo ? nodo.tipo_nodo : '—';
    document.getElementById('ui-round').textContent = stato_gioco.round_numero;
    document.getElementById('ui-fase').textContent = stato_gioco.fase_corrente.replace(/_/g, ' ');
    document.getElementById('ui-mondo').textContent = stato_gioco.mondo.nome;
  }

  function render_pg() {
    const cont = document.getElementById('lista-pg');
    cont.innerHTML = '';
    stato_gioco.giocatori.forEach((pg, idx) => {
      const card = document.createElement('div');
      card.className = 'pg-card';
      if (idx === stato_gioco.turno_di && in_combattimento()) card.classList.add('turno-attivo');
      if (pg.ko) card.classList.add('ko');
      const pv_pct = Math.max(0, (pg.pv / pg.pv_max) * 100);
      const status_html = pg.status.map(s =>
        `<span class="status-pill">${s.tipo} ${s.intensita > 1 ? `×${s.intensita}` : ''}</span>`
      ).join('');
      card.innerHTML = `
        <div class="nome-classe">
          <span class="nome">${pg.nome}</span>
          <span class="classe">${pg.classe}</span>
        </div>
        <div class="barra-pv"><div class="barra-pv-riempita" style="width: ${pv_pct}%"></div></div>
        <div class="stats-pg">
          <span class="stat">PV <strong>${pg.pv}/${pg.pv_max}</strong></span>
          <span class="stat">EN <strong>${pg.energia}</strong></span>
          <span class="stat">Mano <strong>${pg.mano.length}</strong></span>
          <span class="stat">Pila <strong>${pg.pila.length}</strong></span>
        </div>
        ${status_html ? `<div class="status-list">${status_html}</div>` : ''}
      `;
      cont.appendChild(card);
    });
  }

  function render_nemici() {
    const cont = document.getElementById('lista-nemici');
    if (stato_gioco.nemici_in_campo.length === 0) {
      cont.className = 'vuoto';
      cont.textContent = 'Nessun nemico in campo';
      return;
    }
    cont.className = '';
    cont.innerHTML = '';
    stato_gioco.nemici_in_campo.forEach(nem => {
      const card = document.createElement('div');
      card.className = 'nemico-card';
      card.dataset.istanzaId = nem.istanza_id;
      const carta = db.nemici.find(n => n.id === nem.carta_id);
      const nome = carta ? carta.nome : nem.carta_id;
      const cat = carta ? carta.categoria : '';
      card.innerHTML = `
        <div>
          <div class="nome">${nome}</div>
          <div class="categoria">${cat}</div>
        </div>
        <div class="pv">${nem.pv}/${nem.pv_max}</div>
      `;
      cont.appendChild(card);
    });
  }

  function render_mappa() {
    const cont = document.getElementById('lista-nodi');
    cont.innerHTML = '';
    stato_gioco.mappa.nodi.forEach((nodo, idx) => {
      const el = document.createElement('div');
      el.className = 'nodo-mappa';
      el.dataset.tipo = nodo.tipo_nodo;
      el.textContent = idx + 1;
      if (idx < stato_gioco.mappa.nodo_corrente || nodo.stato === 'risolto') el.classList.add('visitato');
      if (idx === stato_gioco.mappa.nodo_corrente) el.classList.add('corrente');
      el.title = `Nodo ${idx + 1}: ${nodo.tipo_nodo}`;
      cont.appendChild(el);
    });
  }

  function render_mano() {
    const pg = stato_gioco.giocatori[stato_gioco.turno_di];
    const titolo = document.getElementById('titolo-mano');
    titolo.textContent = `Mano di ${pg.nome} (${pg.classe})`;
    const cont = document.getElementById('lista-mano');
    if (pg.mano.length === 0 || !in_combattimento()) {
      cont.className = 'vuoto';
      cont.textContent = in_combattimento() ? 'Nessuna carta in mano' : 'Le carte si giocano in combattimento';
      return;
    }
    cont.className = '';
    cont.innerHTML = '';
    const giocabile = stato_gioco.fase_corrente === 'attesa_azione_pg';
    pg.mano.forEach(carta_id => {
      const carta_def = trova_carta(carta_id);
      if (!carta_def) return;
      const el = document.createElement('div');
      el.className = 'carta';
      el.dataset.tipo = carta_def._tipo_carta;
      el.dataset.cartaId = carta_id;
      const disabilitata = !giocabile || carta_def.costo_energia > pg.energia;
      if (disabilitata) el.classList.add('disabilitata');
      el.innerHTML = `
        <div class="nome-carta">${carta_def.nome}</div>
        <div class="meta-carta">
          <span class="costo">${carta_def.costo_energia}EN</span>
          <span>${carta_def._tipo_carta}</span>
        </div>
        <div class="descrizione">${carta_def.descrizione_narrativa || carta_def.effetto_meccanico || ''}</div>
      `;
      if (!disabilitata) {
        el.addEventListener('click', () => seleziona_carta(carta_id, carta_def));
      }
      cont.appendChild(el);
    });
  }

  function render_log() {
    const cont = document.getElementById('lista-log');
    cont.innerHTML = '';
    // Mostro gli ultimi 30 eventi, in ordine crescente.
    const ultimi = stato_gioco.log.slice(-30);
    ultimi.forEach(e => {
      const el = document.createElement('div');
      el.className = 'log-evento';
      el.dataset.tipo = e.tipo;
      if (['twist_rivelato', 'png_apparso', 'scelta_evento', 'ko'].includes(e.tipo)) {
        el.classList.add('evidenziato');
      }
      el.textContent = e.testo_narrativo;
      cont.appendChild(el);
    });
    // Scrolla in fondo cosi l'ultimo evento e' sempre visibile.
    cont.scrollTop = cont.scrollHeight;
  }

  function render_azioni() {
    const passa_btn = document.getElementById('btn-passa-turno');
    const nodo_btn = document.getElementById('btn-prossimo-nodo');
    const ris_btn = document.getElementById('btn-risolvi-nodo');
    const combat_btn = document.getElementById('btn-avvia-combat');
    const msg = document.getElementById('messaggio-azione');

    passa_btn.disabled = stato_gioco.fase_corrente !== 'attesa_azione_pg';
    nodo_btn.disabled = true;
    ris_btn.disabled = true;
    combat_btn.disabled = true;
    msg.textContent = '';

    const nodo = stato_gioco.mappa.nodi[stato_gioco.mappa.nodo_corrente];

    if (stato_gioco.fase_corrente === 'esplorazione') {
      if (nodo.stato === 'risolto') {
        if (stato_gioco.mappa.nodo_corrente < stato_gioco.mappa.nodi.length - 1) {
          nodo_btn.disabled = false;
          msg.textContent = 'Avanza al nodo successivo.';
        } else {
          msg.textContent = 'Hai raggiunto la fine della mappa.';
        }
      } else if (nodo.tipo_nodo === 'combattimento' ||
                 (nodo.tipo_nodo === 'speciale' && nodo.incontro && nodo.incontro.length > 0)) {
        combat_btn.disabled = false;
        msg.textContent = 'Avvia il combattimento.';
      } else if (nodo.tipo_nodo === 'speciale' && nodo._richiede_combattimento) {
        combat_btn.disabled = false;
        msg.textContent = 'Il luogo risveglia qualcosa di ostile.';
      } else {
        ris_btn.disabled = false;
        msg.textContent = `Risolvi nodo di tipo "${nodo.tipo_nodo}".`;
      }
    } else if (stato_gioco.fase_corrente === 'attesa_azione_pg') {
      msg.textContent = 'Gioca una carta o passa il turno.';
    }
  }

  function verifica_fine_partita() {
    if (stato_gioco.fase_corrente === 'fine_run') {
      mostra_fine('sconfitta');
    } else {
      // Vittoria se l'ultimo nodo e' stato risolto.
      const ultimo = stato_gioco.mappa.nodi[stato_gioco.mappa.nodi.length - 1];
      if (ultimo.stato === 'risolto' && stato_gioco.mappa.nodo_corrente === stato_gioco.mappa.nodi.length - 1) {
        mostra_fine('vittoria');
      }
    }
  }

  function mostra_fine(esito) {
    const t = document.getElementById('modale-fine-titolo');
    const p = document.getElementById('modale-fine-testo');
    if (esito === 'vittoria') {
      t.textContent = 'Vittoria!';
      p.textContent = 'Gli Erranti hanno superato il loro destino.';
    } else {
      t.textContent = 'Sconfitta';
      p.textContent = 'La foresta reclama i suoi figli. Gli Erranti sono caduti.';
    }
    document.getElementById('modale-fine').classList.add('aperto');
  }

  // ---------------------------------------------------------------------------
  // AZIONI: tradotte in chiamate al motore + render.
  // ---------------------------------------------------------------------------

  function in_combattimento() {
    // Da v0.4: dopo l'ultimo nemico ucciso, il motore transita direttamente
    // a "esplorazione". La fase "fine_combattimento" non e' piu' osservabile
    // dall'UI ma resta nel check per backward compatibility (precaution).
    const f = stato_gioco.fase_corrente;
    return f && f !== 'esplorazione' && f !== 'fine_run' && f !== 'fine_combattimento';
  }

  // Helper: aggiorna lo stato e ridisegna la UI. Da v0.4 del motore, la
  // transizione fine_combattimento -> esplorazione e' gestita automaticamente
  // dentro _verifica_condizioni_uscita: l'UI non deve piu' compensare.
  function applica_nuovo_stato(nuovo) {
    stato_gioco = nuovo;
    render();
  }

  function trova_carta(carta_id) {
    return db.attacchi.find(c => c.id === carta_id)
        || db.abilita.find(c => c.id === carta_id)
        || db.oggetti.find(c => c.id === carta_id);
  }

  function seleziona_carta(carta_id, carta_def) {
    // Se la carta richiede un bersaglio nemico, apri il modale.
    if (carta_def._tipo_carta === 'attacco' && carta_def.target === 'nemico') {
      if (stato_gioco.nemici_in_campo.length === 0) {
        return;
      }
      if (stato_gioco.nemici_in_campo.length === 1) {
        gioca(carta_id, stato_gioco.nemici_in_campo[0].istanza_id);
        return;
      }
      apri_modale_target(carta_id, carta_def);
    } else {
      // Carta senza bersaglio specifico (tutti_nemici, se, alleato, ecc.): gioca direttamente.
      gioca(carta_id, null);
    }
  }

  function gioca(carta_id, target_id) {
    const pg = stato_gioco.giocatori[stato_gioco.turno_di];
    const r = G.gioca_carta(stato_gioco, pg.id, carta_id, target_id, db);
    if (!r.ok) {
      alert(`Impossibile giocare la carta: ${r.errore.messaggio}`);
      return;
    }
    applica_nuovo_stato(r.state);
  }

  function apri_modale_target(carta_id, carta_def) {
    document.getElementById('modale-target-carta').textContent =
      `Gioca "${carta_def.nome}" su quale nemico?`;
    const cont = document.getElementById('lista-target');
    cont.innerHTML = '';
    stato_gioco.nemici_in_campo.forEach(nem => {
      const carta = db.nemici.find(n => n.id === nem.carta_id);
      const el = document.createElement('button');
      el.className = 'target-opzione';
      el.innerHTML = `<span>${carta ? carta.nome : nem.carta_id}</span><span>PV ${nem.pv}/${nem.pv_max}</span>`;
      el.addEventListener('click', () => {
        chiudi_modale_target();
        gioca(carta_id, nem.istanza_id);
      });
      cont.appendChild(el);
    });
    document.getElementById('modale-target').classList.add('aperto');
  }

  function chiudi_modale_target() {
    document.getElementById('modale-target').classList.remove('aperto');
  }

  function azione_passa_turno() {
    // 16.8: la signature di passa_turno e' diventata (state, db). Serve per
    // propagare db lungo la catena fine_turno_pg -> turno_nemici ->
    // pipeline_danno (era preso da una globale di modulo in v0.5).
    const r = G.passa_turno(stato_gioco, db);
    if (!r.ok) return alert(r.errore.messaggio);
    applica_nuovo_stato(r.state);
  }

  function azione_prossimo_nodo() {
    const r = G.avanza_nodo(stato_gioco, db);
    if (!r.ok) return alert(r.errore.messaggio);
    applica_nuovo_stato(r.state);
    // Se il nuovo nodo e' un evento, auto-rivelo (in setup standard la
    // rivelazione fa parte di risolvi_nodo).
    const nodo = stato_gioco.mappa.nodi[stato_gioco.mappa.nodo_corrente];
    if (nodo.tipo_nodo === 'evento' && nodo.stato !== 'risolto') {
      azione_risolvi_nodo();
    }
  }

  function azione_risolvi_nodo() {
    applica_nuovo_stato(G.risolvi_nodo(stato_gioco, db));
    // Se il nodo era evento, apri il modale di scelta.
    const nodo_dopo = stato_gioco.mappa.nodi[stato_gioco.mappa.nodo_corrente];
    if (nodo_dopo.stato === 'in_attesa_scelta' && nodo_dopo._evento_rivelato_id) {
      apri_modale_evento(nodo_dopo._evento_rivelato_id);
    }
  }

  function apri_modale_evento(evento_id) {
    const evt = db.eventi.find(e => e.id === evento_id);
    if (!evt) return;
    document.getElementById('modale-evento-nome').textContent = evt.nome;
    document.getElementById('modale-evento-testo').textContent = evt.testo_narrativo;
    document.getElementById('testo-scelta-A').textContent = evt.scelta_A.testo_outcome;
    document.getElementById('testo-scelta-B').textContent = evt.scelta_B.testo_outcome;
    document.getElementById('modale-evento').classList.add('aperto');
  }

  function azione_scelta_evento(scelta) {
    const r = G.risolvi_evento(stato_gioco, db, scelta);
    if (!r.ok) {
      alert(r.errore.messaggio);
      return;
    }
    document.getElementById('modale-evento').classList.remove('aperto');
    applica_nuovo_stato(r.state);
  }

  function azione_avvia_combat() {
    applica_nuovo_stato(G.avvia_combattimento(stato_gioco, db));
  }

  // Avvio.
  init();
})();

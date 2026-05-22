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
//
// v0.6 (§5.2bis, §5.11, §8):
//   - Pulsante "Attacco base" con indicatore gratuito/costo (§5.2bis).
//   - Indicatore essenze accumulate e sinergie σ2 attive per ogni PG (§5.11).
//   - Modale scelta forma_finale al Lv3 (§5.11).
//   - Etichetta slot "talismano" al posto di "accessorio" (§2.2).
//   - setup_partita_browser aggiornato alla struttura PGState v0.6.
// =============================================================================

(function() {
  'use strict';

  // Stato globale dell'app. Inizializzato da avvia_partita.
  let stato_gioco = null;
  let db = null;
  let scelta_giocatori = 2;
  let carta_selezionata = null;  // {id, carta_def} durante la selezione bersaglio

  // §5.11: tag delle 10 categorie di essenze (spec §2.2 v0.6).
  const ESSENZA_TAG = [
    'fuoco', 'acqua', 'terra', 'aria', 'oscurita', 'luce',
    'taglio', 'impatto', 'perforante', 'energia'
  ];

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

    // §5.2bis: pulsante attacco base.
    document.getElementById('btn-attacco-base').addEventListener('click', azione_attacco_base);
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
  // v0.6: struttura PGState aggiornata (§2.2): slot talismano, essenze,
  // sinergie_attive, attacco_base_gratuito_consumato_questo_turno, ecc.
  function setup_partita_browser(numero_giocatori, seed, db) {
    let rng_state = seed | 0;

    // §3.1 punto 3: pesca mondo.
    const r_mondo = G.pesca_dal_pool(db.mondi, 1, rng_state);
    rng_state = r_mondo.rng_state;
    const mondo = r_mondo.presi[0];

    // §3.1 punto 4: mappa.
    const r_mappa = G.costruisci_mappa(mondo, db, rng_state);
    rng_state = r_mappa.rng_state;

    // §3.1 punto 5: PG con struttura v0.6 (§2.2).
    const classi = ['guerriero', 'mago', 'ladro', 'guaritore'];
    const giocatori = [];
    for (let i = 0; i < numero_giocatori; i++) {
      const classe = classi[i % classi.length];
      const r_pila = G.costruisci_pila_iniziale(classe, db, rng_state);
      rng_state = r_pila.rng_state;
      const r_mix = G.mescola(r_pila.pila, rng_state);
      rng_state = r_mix.rng_state;
      const dim_mano = db.config.pg.dimensione_mano;

      // §2.2 v0.6: 10 categorie di essenze inizializzate a zero.
      const essenze = {};
      for (const tag of ESSENZA_TAG) essenze[tag] = 0;

      // §C3-fix browser: equipaggiamento iniziale per classe (stessa logica di motore/setup.js).
      // Priorità: slot+classe precisa → slot+universale → null.
      const _pick_equip = (slot) =>
        db.equipaggiamenti.find(e => e.slot === slot && e.classe_preferita === classe)
        || db.equipaggiamenti.find(e => e.slot === slot && e.classe_preferita === 'universale')
        || null;
      const _istanza_equip = (equip) => equip
        ? { livello: 1, forma_scelta_id: null, tag_correnti: [...equip.tag] }
        : null;
      const _ea = _pick_equip('arma');
      const _et = _pick_equip('talismano');

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
        // §2.2 v0.6: slot equipaggiamento popolati dall'equip iniziale della classe.
        equipaggiamento: { arma: _ea ? _ea.id : null, armatura: null, talismano: _et ? _et.id : null },
        // §5.11 v0.6: istanze per-PG dell'equipaggiamento (livello, forma).
        equip_istanze: {
          arma:      _istanza_equip(_ea),
          armatura:  null,
          talismano: _istanza_equip(_et),
        },
        // §5.11 v0.6: null se nessuna scelta di forma finale pendente.
        scelta_forma_pendente: null,
        ko: false,
        // §5.11 v0.6: pool essenze per l'evoluzione dell'equipaggiamento.
        essenze,
        // §5.2bis v0.6: flag reset a inizio turno da inizio_turno_pg.
        attacco_base_gratuito_consumato_questo_turno: false,
        // §5.6.4 v0.6: sinergie σ2 attive (calcolate da valuta_sinergie_passive).
        sinergie_attive: [],
        // §5.6.2 v0.6: contatore carte per tag (reset a {} a inizio turno).
        carte_giocate_per_tag_turno: {},
        // §5.6.3 v0.6: bonus prossima carta (consumato da pipeline_danno step 2).
        bonus_prossima_carta_tag: null,
      });
    }

    return {
      meta: { run_id: `run_${seed}`, seed, versione_regole: '0.6',
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
      // §5.11 v0.6: fase salvata prima di ATTESA_SCELTA_FORMA_FINALE (per ripristino).
      fase_prima_di_scelta_forma: null,
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
    // §5.11: controlla se e' il momento di mostrare la scelta forma finale.
    if (stato_gioco.fase_corrente === 'attesa_scelta_forma_finale') {
      apri_modale_forma_finale();
    }
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

  // render_pg: mostra PV, EN, mano, equipaggiamento (§2.2 v0.6: talismano),
  // essenze non-zero (§5.11) e sinergie σ2 attive (§5.6.4).
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

      // §2.2 v0.6: slot equipaggiamento con "talismano" al posto di "accessorio".
      const equip_html = _render_equipaggiamento(pg);

      // §5.11 v0.6: essenze non-zero.
      const essenze_html = _render_essenze(pg);

      // §5.6.4 v0.6: sinergie σ2 attive.
      const sinergie_html = _render_sinergie(pg);

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
        ${equip_html}
        ${essenze_html}
        ${sinergie_html}
      `;
      cont.appendChild(card);
    });
  }

  // §2.2 v0.6: genera l'HTML per i 3 slot equipaggiamento del PG.
  // Mostra arma, armatura e talismano (con livello se istanza presente).
  function _render_equipaggiamento(pg) {
    const slots = [
      { chiave: 'arma', etichetta: 'Arma' },
      { chiave: 'armatura', etichetta: 'Armor' },
      { chiave: 'talismano', etichetta: 'Talis.' },
    ];
    const righe = slots.map(({ chiave, etichetta }) => {
      const id_equip = pg.equipaggiamento[chiave];
      if (!id_equip) return `<div class="equip-slot"><span class="slot-nome">${etichetta}</span><span class="slot-valore" style="color:var(--testo-debole)">—</span></div>`;
      const def = db && db.equipaggiamenti ? db.equipaggiamenti.find(e => e.id === id_equip) : null;
      const nome = def ? def.nome : id_equip;
      const istanza = pg.equip_istanze && pg.equip_istanze[chiave];
      const livello = istanza ? istanza.livello : 1;
      const lv_html = `<span class="slot-livello">Lv${livello}</span>`;
      return `<div class="equip-slot"><span class="slot-nome">${etichetta}</span><span class="slot-valore">${nome}</span>${lv_html}</div>`;
    });
    return `<div class="equip-pg">${righe.join('')}</div>`;
  }

  // §5.11 v0.6: genera l'HTML per le essenze non-zero del PG.
  function _render_essenze(pg) {
    if (!pg.essenze) return '';
    const pills = Object.entries(pg.essenze)
      .filter(([, v]) => v > 0)
      .map(([tag, v]) => `<span class="essenza-pill" data-tag="${tag}">${tag} ×${v}</span>`)
      .join('');
    if (!pills) return '';
    return `<div class="essenze-pg">${pills}</div>`;
  }

  // §5.6.4 v0.6: genera l'HTML per le sinergie σ2 attive del PG.
  function _render_sinergie(pg) {
    if (!pg.sinergie_attive || pg.sinergie_attive.length === 0) return '';
    const pills = pg.sinergie_attive.map(id =>
      `<span class="sinergia-pill">σ2 ${id}</span>`
    ).join('');
    return `<div class="sinergie-pg">${pills}</div>`;
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
      if (['twist_rivelato', 'png_apparso', 'scelta_evento', 'ko',
           'sinergia_attivata', 'equip_evoluto', 'forma_finale_disponibile',
           'forma_finale_scelta'].includes(e.tipo)) {
        el.classList.add('evidenziato');
      }
      el.textContent = e.testo_narrativo;
      cont.appendChild(el);
    });
    // Scrolla in fondo cosi l'ultimo evento e' sempre visibile.
    cont.scrollTop = cont.scrollHeight;
  }

  // render_azioni: gestisce la visibilita' e lo stato dei bottoni azione.
  // v0.6: aggiunge logica per il pulsante attacco base (§5.2bis).
  function render_azioni() {
    const passa_btn   = document.getElementById('btn-passa-turno');
    const nodo_btn    = document.getElementById('btn-prossimo-nodo');
    const ris_btn     = document.getElementById('btn-risolvi-nodo');
    const combat_btn  = document.getElementById('btn-avvia-combat');
    const atk_row     = document.getElementById('riga-attacco-base');
    const atk_btn     = document.getElementById('btn-attacco-base');
    const atk_label   = document.getElementById('label-attacco-base');
    const atk_costo   = document.getElementById('costo-attacco-base');
    const msg         = document.getElementById('messaggio-azione');

    passa_btn.disabled = stato_gioco.fase_corrente !== 'attesa_azione_pg';
    nodo_btn.disabled  = true;
    ris_btn.disabled   = true;
    combat_btn.disabled = true;
    msg.textContent    = '';

    // §5.2bis: mostra il pulsante attacco base solo durante il turno PG.
    const turno_pg = stato_gioco.fase_corrente === 'attesa_azione_pg';
    atk_row.classList.toggle('nascosto', !turno_pg);

    if (turno_pg) {
      _aggiorna_bottone_attacco_base(atk_btn, atk_label, atk_costo);
    }

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
    } else if (turno_pg) {
      msg.textContent = 'Attacca o gioca una carta. Poi passa il turno.';
    }
  }

  // §5.2bis: aggiorna label e stato del bottone attacco base.
  // Mostra "gratuito" se il turno gratuito non e' ancora stato usato,
  // altrimenti mostra il costo in EN ricavato dall'arma equipaggiata.
  function _aggiorna_bottone_attacco_base(btn, label, costo_el) {
    const pg = stato_gioco.giocatori[stato_gioco.turno_di];
    const ha_nemici = stato_gioco.nemici_in_campo.length > 0;

    label.textContent = 'Attacco base';
    costo_el.className = 'costo-attacco';

    if (!ha_nemici) {
      btn.disabled = true;
      costo_el.textContent = 'nessun nemico';
      return;
    }

    const gia_consumato = pg.attacco_base_gratuito_consumato_questo_turno === true;
    if (!gia_consumato) {
      // §5.2bis: primo attacco base del turno — gratuito.
      costo_el.textContent = 'gratuito';
      costo_el.classList.add('gratuito');
      btn.disabled = false;
    } else {
      // §5.2bis: attacchi extra costano arma.stats_per_livello[lv-1].costo_extra EN.
      const costo_extra = _leggi_costo_extra_arma(pg);
      costo_el.textContent = `${costo_extra} EN`;
      btn.disabled = costo_extra > pg.energia;
    }
  }

  // Legge costo_extra dall'arma del PG corrente. Ritorna 0 se arma non equipaggiata.
  function _leggi_costo_extra_arma(pg) {
    const arma_id = pg.equipaggiamento && pg.equipaggiamento.arma;
    if (!arma_id || !db || !db.equipaggiamenti) return 0;
    const def = db.equipaggiamenti.find(e => e.id === arma_id);
    if (!def || !Array.isArray(def.stats_per_livello)) return 0;
    const istanza = pg.equip_istanze && pg.equip_istanze.arma;
    const lv = istanza ? (istanza.livello || 1) : 1;
    const stats = def.stats_per_livello[lv - 1];
    return (stats && stats.costo_extra) ? stats.costo_extra : 0;
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
    // v0.6: includo attesa_scelta_forma_finale (fase bloccante §5.11).
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
    // C1-fix: db.oggetti rimosso in 16.1, cerca in equipaggiamenti + consumabili.
    return db.attacchi.find(c => c.id === carta_id)
        || db.abilita.find(c => c.id === carta_id)
        || db.equipaggiamenti.find(c => c.id === carta_id)
        || db.consumabili.find(c => c.id === carta_id);
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
    // §16.8: la signature di passa_turno e' diventata (state, db). Serve per
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

  // §5.2bis: esegui attacco base del PG corrente.
  // Richiede selezione bersaglio se ci sono piu' nemici in campo.
  function azione_attacco_base() {
    if (stato_gioco.nemici_in_campo.length === 0) return;
    if (stato_gioco.nemici_in_campo.length === 1) {
      esegui_attacco_base_su(stato_gioco.nemici_in_campo[0].istanza_id);
      return;
    }
    apri_modale_target_attacco_base();
  }

  // Esegue effettivamente l'attacco base sul target scelto.
  function esegui_attacco_base_su(target_id) {
    const pg = stato_gioco.giocatori[stato_gioco.turno_di];
    const r = G.esegui_attacco_base(stato_gioco, pg.id, target_id, db);
    if (!r.ok) {
      alert(`Attacco base fallito: ${r.errore.messaggio}`);
      return;
    }
    applica_nuovo_stato(r.state);
  }

  // Riusa il modale target per l'attacco base (stessa UI, diversa azione).
  function apri_modale_target_attacco_base() {
    document.getElementById('modale-target-carta').textContent =
      'Esegui attacco base su quale nemico?';
    const cont = document.getElementById('lista-target');
    cont.innerHTML = '';
    stato_gioco.nemici_in_campo.forEach(nem => {
      const carta = db.nemici.find(n => n.id === nem.carta_id);
      const el = document.createElement('button');
      el.className = 'target-opzione';
      el.innerHTML = `<span>${carta ? carta.nome : nem.carta_id}</span><span>PV ${nem.pv}/${nem.pv_max}</span>`;
      el.addEventListener('click', () => {
        chiudi_modale_target();
        esegui_attacco_base_su(nem.istanza_id);
      });
      cont.appendChild(el);
    });
    document.getElementById('modale-target').classList.add('aperto');
  }

  // §5.11: apri il modale di scelta forma finale.
  // Legge pg.scelta_forma_pendente per determinare quale PG e' in attesa
  // e quali opzioni presentare.
  function apri_modale_forma_finale() {
    // Cerca il PG con scelta_forma_pendente non null.
    const pg = stato_gioco.giocatori.find(p => p.scelta_forma_pendente);
    if (!pg) return;

    const pendente = pg.scelta_forma_pendente;
    document.getElementById('modale-forma-titolo').textContent =
      `${pg.nome}: scegli la forma finale di ${pendente.equip_nome}`;
    document.getElementById('modale-forma-sottotitolo').textContent =
      `L'equipaggiamento ha raggiunto il Livello 3. Scegli il cammino evolutivo.`;

    const cont = document.getElementById('lista-forme-finali');
    cont.innerHTML = '';
    pendente.opzioni.forEach(opzione => {
      const btn = document.createElement('button');
      btn.className = 'bottone-forma';
      const tag_html = (opzione.tag_aggiuntivi || []).map(t =>
        `<span class="tag-pill">${t}</span>`
      ).join('');
      btn.innerHTML = `
        <span class="forma-nome">${opzione.nome}</span>
        <span class="forma-desc">${opzione.descrizione_narrativa || ''}</span>
        ${tag_html ? `<span class="forma-tag">${tag_html}</span>` : ''}
      `;
      btn.addEventListener('click', () => {
        azione_conferma_forma_finale(pg.id, pendente.slot, opzione.forma_id);
      });
      cont.appendChild(btn);
    });

    document.getElementById('modale-forma-finale').classList.add('aperto');
  }

  // §5.11: conferma la scelta della forma finale e aggiorna lo stato.
  function azione_conferma_forma_finale(pg_id, slot, forma_id) {
    document.getElementById('modale-forma-finale').classList.remove('aperto');
    const r = G.conferma_forma_finale(stato_gioco, pg_id, slot, forma_id, db);
    if (!r.ok) {
      alert(`Scelta forma finale fallita: ${r.errore.messaggio}`);
      return;
    }
    applica_nuovo_stato(r.state);
  }

  // Hook di debug: espone stato_gioco e db dalla closure all'oggetto window._t.
  // Usato durante i test manuali per leggere/scrivere lo stato dalla console.
  // Esempio: _t.s (legge stato), _t.s = nuovoStato (scrive + re-render), _t.d (db).
  // _t.render() permette di forzare il re-render dopo mutazioni dirette dello stato.
  window._t = {
    get s()  { return stato_gioco; },
    set s(v) { stato_gioco = v; render(); },
    get d()  { return db; },
    render:  function() { render(); },
  };

  // Avvio.
  init();
})();

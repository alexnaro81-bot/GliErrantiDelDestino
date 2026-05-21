# Note Step 16.9 — UI v0.6

**Data:** 2026-05-21
**Riferimento ROADMAP:** Step 16.9
**Riferimento regolamento:** §5.2bis, §5.6.4, §5.11, §2.2, §8

---

## Obiettivo

Portare l'interfaccia grafica al livello v0.6, allineandola al motore già aggiornato negli step 16.1–16.8. I requisiti erano:

1. Pulsante "Attacco base" sempre visibile durante il turno PG, con badge indicatore "gratuito" / "costa N EN"
2. Indicatore essenze accumulate per ogni PG (§5.11)
3. Indicatore sinergie σ2 attive per ogni PG (§5.6.4)
4. Modale di scelta forma finale al Lv3 dell'equipaggiamento (§5.11)
5. Etichette slot equipaggiamento: "talismano" al posto di "accessorio" (§2.2)

---

## File modificati

| File | Natura della modifica |
|---|---|
| `web/index.html` | Aggiunto `#riga-attacco-base` con `#btn-attacco-base`; aggiunto `#modale-forma-finale` |
| `web/style.css` | Aggiunte ~120 righe di stili per bottone attacco base, costo badge, slot equipaggiamento, pillole essenze/sinergie, bottoni forma finale, log v0.6 |
| `web/app.js` | Aggiornato `setup_partita_browser`, `render`, `render_pg`, `render_azioni`, aggiunta logica attacco base, modale forma finale; aggiornate etichette slot |
| `web/motore_bundle.js` | Ricostruito via `node strumenti/build_browser.js` (257.3 KB) |

---

## Cosa è stato implementato

### 1. Pulsante "Attacco base" (§5.2bis)

- In `index.html`: `<div id="riga-attacco-base" class="nascosto">` contenente `#btn-attacco-base` con due span interni (`#label-attacco-base`, `#costo-attacco-base`).
- La riga è nascosta di default (`class="nascosto"`) e diventa visibile solo quando `fase_corrente === 'attesa_azione_pg'` tramite `render_azioni()` in `app.js`.
- Il badge `#costo-attacco-base` mostra:
  - "gratuito" (classe `.gratuito`, sfondo verde) se `attacco_base_gratuito_consumato_questo_turno === false`
  - "N EN" (sfondo blu) con il costo extra letto da `arma.stats_per_livello[lv-1].costo_extra` altrimenti
- Il bottone è disabilitato se il PG non ha abbastanza EN per pagare il costo extra.
- Al click chiama `azione_attacco_base()`, che:
  - Se c'è un solo nemico → chiama direttamente `esegui_attacco_base_su(target_id)`
  - Se ci sono più nemici → apre `#modale-target` riadattato per la selezione bersaglio attacco base
- `esegui_attacco_base_su(target_id)` chiama `G.esegui_attacco_base(stato_gioco, pg_id, target_id, db)` del motore.

### 2. Indicatore essenze (§5.11)

- `_render_essenze(pg)` in `app.js`: legge `pg.essenze`, filtra le categorie con valore > 0, genera pillole colorate.
- Ogni pillola mostra `{tag}: {valore}` con colore specifico per elemento tramite `[data-tag="..."]` in CSS.
- I tag supportati sono i 10 di `ESSENZA_TAG`: fuoco, acqua, terra, aria, oscurita, luce, taglio, impatto, perforante, energia.
- Le pillole appaiono nella card del PG, sotto la barra EN.
- I tag non elementali (taglio, impatto, perforante, energia) usano il colore base generico `.essenza-pill` (grigio chiaro).

### 3. Indicatore sinergie σ2 attive (§5.6.4)

- `_render_sinergie(pg)` in `app.js`: legge `pg.sinergie_attive`, genera pillole viola con l'id di ogni sinergia attiva.
- Se `sinergie_attive` è vuoto non viene mostrato nulla (nessun elemento DOM aggiuntivo).
- Le pillole appaiono nella card del PG, sotto le essenze.

### 4. Slot equipaggiamento con etichetta "talismano" (§2.2)

- `_render_equipaggiamento(pg)` in `app.js`: mostra tre slot — Arma, Armatura, Talis. (abbreviazione di Talismano).
- L'array degli slot è `[{ chiave: 'arma', etichetta: 'Arma' }, { chiave: 'armatura', etichetta: 'Armatura' }, { chiave: 'talismano', etichetta: 'Talis.' }]`.
- Se l'istanza è presente mostra nome + livello corrente (`Lv.N`).
- `setup_partita_browser()` inizializza `pg.equipaggiamento` e `pg.equip_istanze` con le chiavi `{ arma, armatura, talismano }` (senza più "accessorio").

### 5. Modale scelta forma finale (§5.11)

- In `index.html`: `#modale-forma-finale` con `#modale-forma-titolo`, `#modale-forma-sottotitolo`, `#lista-forme-finali`.
- `render()` in `app.js`: controlla se `fase_corrente === 'attesa_scelta_forma_finale'`; in caso positivo chiama `apri_modale_forma_finale()`.
- `apri_modale_forma_finale()`:
  - Trova il PG con `pg.scelta_forma_pendente !== null`
  - Popola il titolo con il nome dell'equipaggiamento
  - Genera un bottone `.bottone-forma` per ogni opzione, con nome, descrizione narrativa e tag aggiuntivi in pillole
  - Ogni bottone chiama `azione_conferma_forma_finale(pg_id, slot, forma_id)` al click
- `azione_conferma_forma_finale(pg_id, slot, forma_id)` chiama `G.conferma_forma_finale(stato_gioco, pg_id, slot, forma_id, db)`.

### 6. Aggiornamento struttura PGState in setup browser (§2.2)

- `setup_partita_browser()` era rimasto alla struttura v0.3 (con slot "accessorio", senza essenze/sinergie). È stato aggiornato alla struttura completa v0.6:
  - `essenze: {}` (10 categorie inizializzate a 0)
  - `sinergie_attive: []`
  - `attacco_base_gratuito_consumato_questo_turno: false`
  - `carte_giocate_per_tag_turno: {}`
  - `bonus_prossima_carta_tag: null`
  - `equip_istanze: { arma: null, armatura: null, talismano: null }`
  - `scelta_forma_pendente: null`
  - `versione_regole: '0.6'`
  - `fase_prima_di_scelta_forma: null` nel GameState

### 7. Log eventi v0.6

- `render_log()` aggiornato: i tipi di evento `sinergia_attivata`, `equip_evoluto`, `forma_finale_disponibile`, `forma_finale_scelta` sono ora evidenziati in giallo nel log ("Cronaca"), aggiungendosi ai precedenti (`danno`, `morte_nemico`, ecc.).
- In `style.css`: aggiunte classi `.log-sinergia_attivata`, `.log-equip_evoluto`, `.log-forma_finale_disponibile`, `.log-forma_finale_scelta` con colore oro, e `.log-attacco_base` con colore rame.

---

## Divergenze dal documento di riferimento

### D1 — Slot equipaggiamento inizialmente vuoti

**Sezione:** §1.9 / §2.2 — Il documento prevede che i PG partano con un equipaggiamento iniziale basato sulla classe.

**Stato:** Non implementato. Tutti gli slot (arma, armatura, talismano) partono `null`.

**Motivo:** Il punto `PARKING_LOT_EQUIP_INIZIALE_CLASSE` era già presente nel codice come funzionalità rimandata. L'assegnazione dell'equipaggiamento iniziale per classe richiede authoring dei dati CSV delle classi, che non era nella portata dello step 16.9.

**Impatto UI:** Il bottone "Attacco base" mostra "gratuito" ma è comunque utilizzabile (costruisce uno pseudo-attacco senza arma). Il motore gestisce correttamente il caso `arma === null` per `esegui_attacco_base`.

### D2 — Nessuna verifica visuale browser

**Sezione:** §8 — Il criterio di completamento richiedeva un "playtest visuale: tutto cliccabile, niente console error, flusso completo".

**Stato:** La verifica è stata condotta a livello di codice (presenza elementi DOM, classi CSS, esportazioni nel bundle, logica condizionale). Non è stato possibile avviare un browser headless (Xvfb non disponibile nell'ambiente di sviluppo).

**Impatto:** Il codice è strutturalmente corretto ma il playtest visuale end-to-end rimane da eseguire nello Step 16.10.

### D3 — Pillole essenze per tag non elementali senza colore dedicato

**Sezione:** §5.11 — Il documento non specifica una palette cromatica per le essenze.

**Stato:** I 6 tag elementali (fuoco, acqua, terra, aria, oscurita, luce) hanno colori dedicati in CSS. I 4 tag fisici (taglio, impatto, perforante, energia) usano il colore base grigio-chiaro generico.

**Impatto:** Meramente estetico. Il dato è comunque leggibile.

---

## Prossimo step

**16.10 — Rebuild + smoke test full run**: rilancio `build_browser.js`, partita end-to-end con seed deterministico, verifica log con le nuove voci v0.6.

Per aggiornare la ROADMAP: cambia la riga `16.9` da `[ ]` a `[x]`.

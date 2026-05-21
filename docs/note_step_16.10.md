# Note Step 16.10 — Rebuild + Smoke Test Full Run

**Data:** 2026-05-21
**Riferimento ROADMAP:** Step 16.10
**Riferimento regolamento:** tutto §5 (pipeline danno, sinergie, evoluzione, forma finale)

---

## Obiettivo

Rilanciare `build_browser.js`, eseguire una partita end-to-end con seed deterministico e verificare che il log eventi contenga tutte le voci introdotte in v0.6:

| Criterio ROADMAP | Verificato |
|---|---|
| 1 attacco base usato | ✓ |
| 1 sinergia σ1 attivata | ✓ |
| 1 sinergia σ2 attiva | ✓ |
| 1 evoluzione di livello | ✓ (2 evoluzioni: Lv2 + Lv3) |
| 1 scelta forma finale | ✓ |
| 1 boss sconfitto | ✓ |

---

## File prodotti / modificati

| File | Natura |
|---|---|
| `web/motore_bundle.js` | Rigenerato via `node strumenti/build_browser.js` (257.3 KB) |
| `strumenti/smoke_test_16_10.js` | Nuovo script smoke test Node.js (eseguibile con `node strumenti/smoke_test_16_10.js`) |

---

## Struttura dello smoke test

Lo script `strumenti/smoke_test_16_10.js` esegue una run end-to-end con seed=42 e 2 giocatori, divisa in tre fasi:

### Fase 1 — Combattimento nodo comune (idx=1, pos=2)

**Preparazione:**
- PG1 equipaggiato con `EQP_SPADONE_VETERANO` (arma, tag: taglio|impatto) e `EQP_TALISMANO_LUCE` (talismano, tag: luce|sacro)
- Essenze pre-caricate: `taglio = 8` (sufficiente per Lv1→Lv2 con costo 3 + Lv2→Lv3 con costo 5)
- 2x `ATK_FENDENTE` iniettati in mano (carta guerriero, tag: taglio, costo 1 EN) per garantire il test σ1

**Flusso verificato:**
1. `avvia_combattimento` → `valuta_sinergie_passive` chiamata internamente → `SIN_ARMONIA_SOLARE` entra in `pg.sinergie_attive` (**σ2 attiva**)
2. `esegui_attacco_base` sul primo nemico → log `attacco_base` (**criterio attacco base**)
3. `gioca_carta(ATK_FENDENTE)` x1 → `carte_giocate_per_tag_turno.taglio = 1` (soglia 2 non raggiunta)
4. `gioca_carta(ATK_FENDENTE)` x2 → `carte_giocate_per_tag_turno.taglio = 2 >= soglia 2` → log `sinergia_attivata` (**σ1 attivata**)
5. Loop combattimento: nemici abbattuti (2× NEM_LUPO_OMBRA, PV=12, difesa=1)
6. Fine combattimento → `_verifica_condizioni_uscita` chiama `auto_evoluzione_equip`:
   - taglio=8 → paga 3 → Lv2 (restano 5) → log `equip_evoluto` #1
   - taglio=5 → paga 5 → Lv3 (restano 0) → log `equip_evoluto` #2 (**2 evoluzioni**)
7. Kill dei Lupi → log `essenze_droppate` (tag drop: oscurita+taglio per NEM_LUPO_OMBRA)

### Fase 2 — Nodo riposo (idx=3, pos=4)

**Flusso verificato:**
1. `risolvi_nodo(state, db)` su un nodo `tipo_nodo=riposo`
2. Internamente: `auto_evoluzione_equip` (no-op, essenze a 0) → `valuta_trigger_forme_finali`
3. `EQP_SPADONE_VETERANO` è al Lv3 senza `forma_scelta_id` → controlla trigger delle forme finali:
   - `SPADONE_SBILANCIANTE`: trigger `kill_categoria=elite` → non soddisfatto (nessun elite ucciso)
   - `SPADONE_VETERANO_SANGUE`: trigger `libero` → sempre vero ✓
4. `pg.scelta_forma_pendente` popolato → fase → `ATTESA_SCELTA_FORMA_FINALE`
5. `conferma_forma_finale(state, 'pg_1', 'arma', 'SPADONE_VETERANO_SANGUE', db)` → log `forma_finale_scelta` (**criterio scelta forma finale**)

### Fase 3 — Boss (idx=11, pos=12)

**Flusso verificato:**
1. `avvia_combattimento` su nodo `categoria_attesa=boss` → istanzia `NEM_DRUIDO_CORROTTO` (PV=48, difesa=3)
2. PV del boss ridotti a 3 post-istanziazione (accelerazione smoke test — non influisce sulla meccanica)
3. Loop combattimento: boss abbattuto → log `ko` con bersaglio `nem_1_NEM_DRUIDO_CORROTTO` (**boss sconfitto**)
4. Fase → `ESPLORAZIONE`

### Risultato

```
RIEPILOGO: 21 check passati, 0 falliti

Tipi di evento nel log: attacco_base, carta_giocata, cura, danno_inflitto,
  equip_evoluto, essenze_droppate, fase_cambiata, forma_finale_disponibile,
  forma_finale_scelta, ko, nemico_attacca, nodo_risolto, sinergia_attivata
```

---

## Divergenze dal documento di riferimento

### D1 — Nome log evento essenze: "essenze_droppate" (plurale) vs "essenza_droppata" (singolare)

**ROADMAP 16.10 cita:** `"essenza_droppata"` (singolare)

**Codice effettivo:** `'essenze_droppate'` (plurale) — il log aggrega tutti i tag droppati da un singolo nemico in un solo evento con payload `{ tags: [...] }` (vedi `combattimento.js:1790`).

**Decisione:** il nome nel codice è più corretto semanticamente (un solo evento per nemico, multi-tag). La ROADMAP conteneva un refuso. Lo smoke test e le note usano il nome reale `essenze_droppate`.

### D2 — Forma finale disponibile solo su trigger soddisfatti al nodo riposo

**Documento §5.11:** la scelta forma finale avviene al Lv3.

**Implementazione:** la forma finale è valutata **solo nei nodi di riposo** (`risolvi_nodo_riposo`) e nei nodi tesoro (`risolvi_nodo_tesoro`), non immediatamente al raggiungimento del Lv3 durante il combattimento. La scelta `SPADONE_SBILANCIANTE` (trigger `kill_categoria=elite`) non era disponibile perché nessun elite era stato sconfitto. Era disponibile solo `SPADONE_VETERANO_SANGUE` (trigger `libero`).

**Impatto:** comportamento voluto e documentato nel codice di `risolvi_nodo_riposo` (la nota sulle "due fasi separate" è esplicitamente nella documentazione inline del motore).

### D3 — Boss PV ridotti nel test per velocità

**ROADMAP:** "1 boss sconfitto" — senza specifica su come.

**Smoke test:** i PV del boss `NEM_DRUIDO_CORROTTO` vengono ridotti da 48 a 3 dopo l'istanziazione per accelerare il test (il boss ha PV=48, difesa=3; abbatterlo naturalmente richiederebbe ~10 round con 2 PG, rischiando la sconfitta dei PG per danno accumulato). La meccanica di vittoria è verificata identicamente: stessa transizione di fase, stesso log `ko`, stessa chiamata a `auto_evoluzione_equip` in `_verifica_condizioni_uscita`.

### D4 — Nessun playtest browser visuale

Lo step 16.10 menziona "browser" tra i file toccati. Lo smoke test è stato eseguito interamente in Node.js. Il playtest visuale browser rimane vincolato alla disponibilità di Xvfb/display (vedi anche D2 di note_step_16.9.md).

---

## Prossimo step

**Step 17 — Secondo mondo**: authoring CSV per un secondo mondo (es. Cime Frangenti / aria), con luoghi, nemici, eventi, PNG e twist dedicati. Nessun cambio al motore.

Per aggiornare la ROADMAP: cambia la riga `16.10` da `[ ]` a `[x]`.

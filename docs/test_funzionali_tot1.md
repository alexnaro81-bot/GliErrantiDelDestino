# Test funzionali manuali — Gli Erranti del Destino (v0.6)

Suite di scenari riproducibili da eseguire **dal browser** per validare le meccaniche introdotte/refattorizzate nello Step 16 (refactor Fase Combattimento v0.6) e quelle ereditate da v0.4/v0.5 che sono toccate dalla nuova pipeline.

Fonte di verità delle regole: `Gli_Erranti_del_destino_v0_6.md`.
Stato del codice: tutti i sotto-step 16.1 → 16.10 risultano completati nella `ROADMAP.md`.

---

## Come eseguire i test

1. **Avvia il gioco** con `./launcher/erranti.sh` (apre il browser sulla pagina del bundle `motore_bundle.js`).
2. **Imposta il seed** prima di iniziare la run: il documento di design prescrive `setup_partita(numero_giocatori, seed)` con `seed` intero per determinismo (§3.1, §9). Se l'UI non offre un campo seed visibile, aprire la **console DevTools del browser** (F12) **prima** di cliccare "Nuova partita" e impostare `window.__SEED_OVERRIDE__ = <intero>` (o l'hook equivalente esposto da `web/app.js`); in alternativa modificare `config.json` → `rng.seed_default` e ricaricare la pagina. **Se nessuno di questi hook funziona** sull'UI corrente, il test va eseguito "best effort" e segnalato come non perfettamente deterministico nel report.
3. **Leggi i log** nel pannello eventi laterale (oppure `window.__STATE__.log` da console). I tipi evento citati nei test (`attacco_base`, `essenza_droppata`, `sinergia_attivata`, `evoluzione_livello`, ecc.) sono quelli loggati da `_log_append` come previsto da §2.4 e §5.
4. **Ispeziona lo state** da console: `window.__STATE__.giocatori[0]` mostra PGState corrente (PV, energia, essenze, sinergie_attive, equipaggiamento). Utile per verificare i valori attesi.
5. **Verifica finale**: ogni test indica un risultato atteso *numerico*; se i numeri combaciano e il log contiene gli eventi attesi → test verde. Altrimenti → test rosso, registrare nel log dei bug.

> **Convenzione**: tutti i test partono da `seed = 42` salvo diversa indicazione, e da una nuova partita pulita (2 giocatori salvo diversa indicazione).

---

## Indice dei test

| ID | Nome | Roadmap | Priorità |
|---|---|---|---|
| T01 | Attacco base — primo gratis, secondo a pagamento | §5.2bis / 16.4 | Alta |
| T02 | Attacco base — interazione con sinergia σ2 di luce | §5.6.4 / §5.7 step 2 / 16.5 | Alta |
| T03 | Attacco base — energia insufficiente per il secondo | §5.2bis / §8.3 / 16.4 | Alta |
| T04 | Pipeline danno — caso nominale senza tag match | §5.7 step 1-8 / 16.3 | Alta |
| T05 | Pipeline danno — vulnerabilità su tag | §5.7 step 4 / 16.3 | Alta |
| T06 | Pipeline danno — resistenza su tag | §5.7 step 4 / 16.3 | Alta |
| T07 | Pipeline danno — vuln + res sullo stesso colpo (annullamento) | §5.7 step 4 / 16.3 | Media |
| T08 | Pipeline danno — `ignora_scudo` bypassa lo status scudo | §5.7 step 7 / 16.3 | Alta |
| T09 | Pipeline danno — `salta_step_tag` su abilità pura | §5.7 step 4 / §1.8 / 16.3 | Media |
| T10 | Pipeline danno — KO del PG (mano vuota dopo) | §5.7 step 8 / §5.10 / 16.3 | Media |
| T11 | Sinergia σ1 — Danza delle Lame (2 carte taglio) | §5.6.4 / 16.6 | Alta |
| T12 | Sinergia σ1 — Gelo Profondo (riduzione costo) | §5.6.3 / 16.6 | Media |
| T13 | Sinergia σ1 — `una_tantum_per_turno` rispettato | §5.6 / 16.6 | Media |
| T14 | Sinergia σ2 — Armonia Solare (1 slot luce) | §5.6.4 / 16.5 | Alta |
| T15 | Sinergia σ2 — degrado elegante (Anima di Brace mai attiva) | §5.6.5 nota / 16.5 | Bassa |
| T16 | Drop essenze al KO del nemico | §5.7 step 9 / §5.11.2 / 16.3 | Alta |
| T17 | Evoluzione equipaggiamento Lv1 → Lv2 (auto) | §5.11 Fase 1 / 16.7 | Alta |
| T18 | Evoluzione — essenza sbagliata non spende | §5.11 / 16.7 | Media |
| T19 | Evoluzione — scelta forma finale al Lv3 | §5.11 Fase 2 / 16.7 / 16.9 | Alta |
| T20 | Determinismo — stesso seed, stessa run | §9 / 16.10 | Alta |
| T21 | Transizione fine combattimento (no stuck state) | §5.10 / EXT_COMBAT_TRANSITION | Alta |
| T22 | UI — pulsante attacco base sempre visibile | §5.2bis / 16.9 | Media |

---

## Test in dettaglio

---

### T01 — Attacco base: primo gratis, secondo a pagamento

- **Punto roadmap**: §5.2bis / 16.4
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- 2 PG, scegli **Guerriero** per il PG di turno (equipaggiamento iniziale atteso: arma di tipo Spadone del Veterano, `danno_base=3`, `costo_extra=0` al Lv1 — ATTENZIONE: con `costo_extra=0` lo Spadone non è adatto a testare il costo del secondo attacco. Vedi nota sotto).
- **Nota di setup**: la Spada del Veterano ha `costo_extra=0` al Lv1, quindi tutti gli attacchi base sono gratuiti finché non sale a Lv3 (`costo_extra=1`). Per testare il costo del secondo attacco va sostituita con un'arma con `costo_extra > 0`. Se l'authoring non ha ancora prodotto un'arma a costo_extra > 0 al Lv1 nel pool corrente, eseguire questo test su una run dove lo Spadone è già evoluto al Lv3 (vedi T17/T19), oppure modificare temporaneamente la cella `costo_extra` del Lv1 nello `stats_per_livello` di una delle armi del CSV. **Segnalare come limitazione dei dati attuali, non del motore.**
- Avanza fino al primo nodo combattimento (LUO_FOR_01, due Lupi d'Ombra).

**Passi**
1. All'inizio del turno del PG, verifica che il pulsante "Attacco base" sia visibile e mostri "gratuito" (16.9).
2. Clicca "Attacco base" e seleziona il primo Lupo come bersaglio.
3. Osserva che il log riporti `attacco_base` con `costo: 0`.
4. Verifica che il pulsante ora mostri "costa N EN" (dove N = `costo_extra` dell'arma corrente).
5. Clicca di nuovo "Attacco base" sullo stesso Lupo.
6. Osserva che il log riporti `attacco_base` con `costo: N` e che `pg.energia` sia stato decrementato di N.

**Risultato atteso**
- Il primo `attacco_base` ha `costo: 0` e setta `pg.attacco_base_gratuito_consumato_questo_turno = true`.
- Il secondo ha `costo: arma.stats_per_livello[arma.livello-1].costo_extra`.
- Entrambi infliggono `arma.danno_base` (modulo pipeline §5.7 — qui senza match tag, quindi danno nudo meno difesa nemico).
- Es. con Spadone Lv3 (`danno_base=5`, `costo_extra=1`) e Lupo (`difesa=1`): danno effettivo = `5 - 1 = 4` per colpo. PG `energia` parte da 3, dopo il secondo attacco = 2.

**Cosa indicherebbe un fallimento**
- Il secondo attacco viene loggato anch'esso con `costo: 0`.
- L'energia non viene scalata oppure viene scalata di un valore diverso da `costo_extra`.
- Il flag `attacco_base_gratuito_consumato_questo_turno` non viene resettato a `false` all'inizio del turno successivo (verificabile in T01b: passa il turno e controlla che il nuovo attacco base sia di nuovo gratuito).

---

### T02 — Attacco base + Sinergia σ2 di luce (interazione)

- **Punto roadmap**: §5.6.4 / §5.7 step 2 / 16.5
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- 2 PG, **Guaritore** per il PG di turno. Equipaggiamento iniziale atteso: talismano `EQP_TALISMANO_LUCE` (tag `luce|sacro`).
- L'arma iniziale del Guaritore deve avere tag che includa `luce` perché σ2 `SIN_ARMONIA_SOLARE` richiede `soglia: 1` su `[arma, talismano]` con `tag: luce`. **Se l'arma iniziale del Guaritore non ha tag `luce` nel CSV attuale, il test diventa il T15** (sinergia mai attiva). Da verificare durante l'esecuzione consultando `pg.equipaggiamento.arma.tag` da console.
- Avanza al primo nodo combattimento.

**Passi**
1. All'inizio del primo turno PG, controlla `window.__STATE__.giocatori[0].sinergie_attive`. Deve contenere `SIN_ARMONIA_SOLARE` se e solo se almeno uno tra arma e talismano ha `luce` nei tag.
2. Esegui attacco base sul primo Lupo d'Ombra.
3. Leggi il log `attacco_base` e cerca `danno_inflitto`.

**Risultato atteso**
- Se `SIN_ARMONIA_SOLARE` è attiva: il bonus di sinergia (`+1` con `applica_tag: "luce"`) entra allo step 2 della pipeline (`bonus_sinergia_attiva`).
- Il Lupo d'Ombra ha `vulnerabilita: luce|sacro` e `difesa: 1`. Quindi:
  - Step 1: danno base arma (es. 2 per il Talismano Lv1 senza danno_base; oppure arma del guaritore — controllare da console).
  - Step 2: +1 (sinergia σ2).
  - Step 4: il tag `luce` (aggiunto dalla sinergia via `applica_tag`) matcha `vulnerabilita` del Lupo → ×1.5 (floor).
  - Step 6: -1 difesa.
- Es. arma `danno_base=2` + σ2 `+1` = 3 → ×1.5 = 4 (floor) → -1 difesa = **3 danno effettivo**.
- Il log mostra `sinergia_attivata` solo per σ1; le σ2 sono passive, attive in `sinergie_attive` ma non rigenerano log a ogni colpo.

**Cosa indicherebbe un fallimento**
- `sinergie_attive` vuoto pur avendo i tag richiesti.
- Il danno è uguale a quello senza sinergia (il bonus non viene applicato).
- Il bonus viene applicato ma il match tag step 4 non scatta (la sinergia non aggiunge il proprio `applica_tag` ai tag della fonte).

---

### T03 — Attacco base con energia insufficiente per il secondo

- **Punto roadmap**: §5.2bis / §8.3 / 16.4
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- Stesso setup di T01 ma con arma a `costo_extra ≥ 3` al livello iniziale. Vista la nota di T01, il modo affidabile è impostare `pg.energia = 0` manualmente da console **dopo** aver eseguito il primo attacco base, prima di tentare il secondo.

**Passi**
1. Esegui attacco base (gratuito).
2. Da console: `window.__STATE__.giocatori[turno_di].energia = 0` (o lascia che si esaurisca naturalmente giocando carte).
3. Tenta un secondo attacco base.

**Risultato atteso**
- L'azione viene rifiutata con `OperazioneRisultato.ok = false` e `errore.codice = "ERR_ENERGIA_INSUFFICIENTE"` (§8.3).
- Lo state non cambia: `pg.energia` resta a 0, nessun log `attacco_base`.
- L'UI mostra un feedback (pulsante grigio / messaggio).

**Cosa indicherebbe un fallimento**
- Il secondo attacco viene eseguito comunque con energia negativa.
- L'UI permette il clic ma il motore non lo blocca (silent failure).
- Errore con codice diverso (es. ERR_FASE_NON_VALIDA, segnale di gestione errori sbagliata).

---

### T04 — Pipeline danno: caso nominale senza tag match

- **Punto roadmap**: §5.7 step 1-8 / 16.3
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guerriero, primo nodo combattimento contro 2 Lupi d'Ombra (`pv=12`, `difesa=1`, `vulnerabilita=luce|sacro`, `resistenza=oscurita|perforante`).
- In mano servirà `ATK_FENDENTE` (`valore_numerico=4`, `tag=taglio`). Se non presente in mano alla pesca iniziale, scarta e ripesca tramite una carta `ABL_CONCENTRAZIONE` se disponibile, oppure semplicemente sceglie un'altra carta con tag che NON sia in vuln/res del Lupo — purché abbia tag tracciabile.

**Passi**
1. Verifica `pg.energia >= 1` e `ATK_FENDENTE` in mano.
2. Gioca `ATK_FENDENTE` su un Lupo d'Ombra.
3. Leggi il log `carta_giocata` e `danno_inflitto`.

**Risultato atteso**
- Tag fonte = `taglio`. Vuln Lupo = `luce, sacro`. Res Lupo = `oscurita, perforante`. Nessun match → step 4 inattivo.
- Senza status attaccante/target attivi: step 1 = 4, step 2 = +0 (nessun bonus mondo/luogo per `taglio` finché non specificato), step 3 = ×1 (no forza), step 4 = ×1 (no match), step 5 = ×1 (no debolezza), step 6 = max(0, 4-1) = **3**.
- `target.pv` passa da 12 a 9.
- Log `danno_inflitto` con payload coerente.

**Cosa indicherebbe un fallimento**
- Danno diverso da 3 (sospetto: difesa non sottratta, o un bonus invisibile applicato).
- `pv` del Lupo non aggiornato.
- Log mancante o con payload malformato.

---

### T05 — Pipeline danno: vulnerabilità su tag (×1.5)

- **Punto roadmap**: §5.7 step 4 / 16.3
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guaritore (per avere `ATK_LUCE_PURGATRICE`, tag `luce|sacro`, `valore_numerico=4`).
- Primo nodo combattimento, target = Lupo d'Ombra (`vulnerabilita=luce|sacro`, `difesa=1`).
- Se la carta non è in mano alla prima pesca, riprovare con un'altra arma/abilità che abbia tag matchante con la vuln del Lupo (es. qualsiasi carta con tag `luce` o `sacro`).

**Passi**
1. Verifica `ATK_LUCE_PURGATRICE` in mano e `pg.energia >= 1`.
2. Gioca la carta su un Lupo d'Ombra al pieno dei PV (12).
3. Leggi il log.

**Risultato atteso**
- Step 1: danno = 4. Step 2: +0. Step 3: ×1. Step 4: tag `luce` matcha `vulnerabilita` del Lupo, nessun match con res → danno = `floor(4 × 1.5) = 6`. Step 5: ×1. Step 6: max(0, 6-1) = **5**.
- Nota: la carta `ATK_LUCE_PURGATRICE` ha anche una condizione narrativa "se categoria comune → +2", ma questa è in `effetto_meccanico` testuale, non codificata nei campi machine-readable v0.6. Se questa condizione **è** implementata nel motore, il danno atteso diventa `floor((4+2) × 1.5) - 1 = 8`. **Da verificare durante l'esecuzione qual è il comportamento e segnalare l'ambiguità.**
- `target.pv` = 12 − 5 = 7 (oppure 4 se l'effetto comune è implementato).

**Cosa indicherebbe un fallimento**
- Danno = 3 (la difesa è stata sottratta prima del moltiplicatore — ordine pipeline rotto).
- Danno = 4 (vulnerabilità non applicata).
- Danno applicato ma `moltiplicatore_vulnerabilita` di `config.json` ignorato.

---

### T06 — Pipeline danno: resistenza su tag (×0.5)

- **Punto roadmap**: §5.7 step 4 / 16.3
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Ladro (per `ATK_COLTELLO_AVVELENATO`, tag `perforante|veleno`, `valore_numerico=4`).
- Target = Lupo d'Ombra (`resistenza=oscurita|perforante`, `difesa=1`).

**Passi**
1. Gioca `ATK_COLTELLO_AVVELENATO` su un Lupo d'Ombra al pieno dei PV.
2. Leggi il log.

**Risultato atteso**
- Step 1: 4. Step 2-3: invariati. Step 4: tag `perforante` matcha res del Lupo, nessun match con vuln → danno = `floor(4 × 0.5) = 2`. Step 5: ×1. Step 6: max(0, 2-1) = **1**.
- Step 9: applica `applica_status: veleno (intensita 2, durata 3)` al Lupo.

**Cosa indicherebbe un fallimento**
- Danno > 1 (resistenza non applicata).
- Lo status veleno non viene applicato (interruzione della pipeline allo step 9).
- `target.pv` non aggiornato (0 o negativo).

---

### T07 — Pipeline danno: vulnerabilità + resistenza si annullano

- **Punto roadmap**: §5.7 step 4 / 16.3
- **Priorità**: Media

**Setup**
- Seed: `42`.
- PG Guerriero con `ATK_CARICA_DEVASTANTE` (tag = `impatto|taglio`, `valore_numerico=7`).
- Target = Ladro della Foresta (`vulnerabilita=sacro|luce`, `resistenza=furtivita|veleno`, `difesa=2`). I tag della carta NON matchano né vuln né res → questo non è il test giusto, **richiede** un nemico/luogo che abbia entrambi.
- **Costruzione manuale del caso**: avanzare fino al nodo `LUO_FOR_06` (Cuore della Foresta, `resistenza_luogo=oscurita`) per ottenere una resistenza da luogo. Trovare un nemico con vulnerabilità che corrisponde a uno dei tag della fonte. Esempio operativo: durante il boss `NEM_DRUIDO_CORROTTO` (`vulnerabilita=fuoco|luce`, `resistenza=terra|acqua`) nel `LUO_FOR_06` (res luogo = `oscurita`), giocare una carta con tag `luce` E `oscurita`. **Carta candidata**: non esiste oggi nel CSV. → **questo test è BLOCCATO finché authoring non produce una carta multi-tag che includa simultaneamente un tag in vuln di un nemico e uno in res del luogo/nemico.**
- **Workaround per validazione motore**: simulare via console. Pesca un Lupo, e a runtime aggiungi un tag alla fonte: prima di chiamare la pipeline aggiungi un tag `oscurita` alla fonte e mantieni `luce`. Quindi target = Lupo (vuln `luce`, res `oscurita`). Match vuln + match res → annullamento.

**Passi (workaround console)**
1. Prepara una scena di combat con un Lupo.
2. Da console, prima di giocare una carta, esponi la fonte e patcha i tag. Procedura specifica dipende da come `app.js` espone il dispatcher; in alternativa, modificare temporaneamente la riga di `ATK_LUCE_PURGATRICE` nel CSV aggiungendo `oscurita` ai tag e ricaricare.
3. Gioca la carta sul Lupo.

**Risultato atteso**
- Match vuln (`luce` ∈ {`luce`,`sacro`}) AND match res (`oscurita` ∈ {`oscurita`,`perforante`}) → danno invariato dallo step 4 (annullamento esplicito da §5.7 step 4).
- Es. carta da 4, step 4 = 4, step 6 = 4 − 1 = **3**.

**Cosa indicherebbe un fallimento**
- Danno = 6 (vuln applicata da sola).
- Danno = 2 (res applicata da sola).
- Danno = 3 senza l'annullamento documentato nel log (sospetto: ordine vuln/res tale da farne prevalere una).

---

### T08 — `ignora_scudo` bypassa lo status scudo

- **Punto roadmap**: §5.7 step 7 / 16.3
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- Nessuna carta nel CSV attuale ha `ignora_scudo=true` (verificato in `attacchi.csv`). **Questo test è BLOCCATO sui dati attuali** finché authoring non produce una carta con `ignora_scudo=true`, oppure si modifica una riga del CSV temporaneamente.
- **Workaround dati**: modifica `ATK_COLPO_DALL_OMBRA` settando `ignora_scudo=true` nella riga del CSV e ricarica. Questa carta ha `valore_numerico=8`, tag `taglio|furtivita`.
- Bersaglio: serve un nemico con scudo attivo. Lo scudo è uno status non auto-applicato dai nemici nel CSV attuale → **applicarlo via console**: `window.__STATE__.nemici_in_campo[0].status.push({tipo: "scudo", intensita: 5, durata_residua: 2})`.

**Passi**
1. Applica scudo intensità 5 a un Lupo d'Ombra (pv 12, difesa 1).
2. Gioca `ATK_COLPO_DALL_OMBRA` (modificato a `ignora_scudo=true`) sul Lupo.
3. Leggi il log.

**Risultato atteso**
- Step 1: 8. Step 2-4: invariati (nessun match — `taglio` non ∈ vuln/res del Lupo, `furtivita` neppure). Step 6: 8 - 1 = 7. Step 7: **SALTATO** per `ignora_scudo=true` → danno passa intero. Step 8: target.pv = 12 - 7 = 5. Scudo del nemico **invariato** (intensità 5, non consumato).
- Log: `danno_inflitto` con valore 7; lo status scudo del nemico ha ancora `intensita: 5`.

**Cosa indicherebbe un fallimento**
- Lo scudo viene comunque consumato (lo step 7 non è stato saltato).
- Danno = 2 (8 − difesa − scudo, ignora_scudo ignorato).
- Lo scudo viene azzerato pur non avendo assorbito.

---

### T09 — `salta_step_tag` su abilità pura

- **Punto roadmap**: §5.7 step 4 / §1.8 / 16.3
- **Priorità**: Media

**Setup**
- Seed: `42`.
- Nel CSV `abilita.csv` tutte le righe hanno `salta_step_tag=false`. Nessuna abilità infligge danno diretto attualmente: tutte sono buff/scudo/draw. **Questo test è BLOCCATO sui dati attuali**: per validare il flag servirebbe una `CardAbilita` con `valore_numerico > 0` E `salta_step_tag=true`.
- **Workaround dati**: aggiungere temporaneamente al CSV una riga di abilità con `salta_step_tag=true`, `valore_numerico=5`, `target=nemico`, tag nullo o tag che matcherebbe la vuln del Lupo. Oppure modificare una delle abilità esistenti.

**Passi**
1. Setup partita con l'abilità sintetica in mano.
2. Gioca l'abilità su un Lupo d'Ombra (vuln=luce|sacro).
3. Leggi il log.

**Risultato atteso**
- Se l'abilità sintetica ha tag `luce` ma `salta_step_tag=true`: step 4 saltato → niente ×1.5. Danno = 5 − difesa(1) = **4**.
- Senza il flag il danno sarebbe `floor(5×1.5) − 1 = 6`. La differenza tra 4 e 6 è il segnale di funzionamento del flag.

**Cosa indicherebbe un fallimento**
- Danno = 6 (flag ignorato).
- Errore di valutazione condizione (es. il motore applica ×1.5 anche con flag attivo).

---

### T10 — KO del PG via danno nemico (transizione corretta)

- **Punto roadmap**: §5.7 step 8 / §5.10 / 16.3
- **Priorità**: Media

**Setup**
- Seed: `42`.
- Da console: `window.__STATE__.giocatori[0].pv = 1` prima del turno nemici.
- Lupo d'Ombra in campo (`danno_base=4`).

**Passi**
1. Passa il turno del PG corrente (senza neutralizzare il Lupo).
2. Lascia che il Lupo attacchi.
3. Osserva log `danno_inflitto`, eventuale `ko`.

**Risultato atteso**
- Lupo infligge 4. Senza difesa propria del PG (default 0): `pg.pv = max(0, 1 - 4) = 0`. Trigger ko (§5.7 step 8).
- Log `ko` con `pg_id`. `pg.ko = true`.
- Se è l'unico PG vivo: `fine_combattimento` → `FINE_RUN` (sconfitta). Se ce ne sono altri: il turno passa.

**Cosa indicherebbe un fallimento**
- PV negativi nello state (`-3`, segno che il `max(0, ...)` non è applicato).
- KO non triggerato pur con pv = 0.
- Lo state resta in fase di attesa input del PG ko (loop).

---

### T11 — Sinergia σ1: Danza delle Lame (2 carte taglio)

- **Punto roadmap**: §5.6.4 / 16.6
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guerriero. Carte tag `taglio` disponibili a Guerriero: `ATK_FENDENTE` (1 EN), `ATK_CARICA_DEVASTANTE` (2 EN, tag `impatto|taglio`).
- Pesca iniziale dovrebbe dare carte abbastanza. In ogni caso ispezionare la mano da console.
- Lupo d'Ombra in campo.

**Passi**
1. Verifica energia ≥ 3.
2. Turno 1: gioca `ATK_FENDENTE` (1 EN, tag `taglio`) sul Lupo. Counter `pg.carte_giocate_per_tag_turno.taglio` = 1.
3. Sempre in turno 1: gioca `ATK_CARICA_DEVASTANTE` (2 EN, tag `impatto|taglio`) sul Lupo. Counter `taglio` = 2.
4. Allo step 9 della pipeline di `ATK_CARICA_DEVASTANTE`: scatta `SIN_DANZA_LAME` (soglia 2 raggiunta). Log `sinergia_attivata`.
5. Pesca una terza carta `taglio` o assicurati di averla. Gioca una terza carta `taglio` (es. una `ATK_FENDENTE` di backup pescata).

**Risultato atteso**
- Dopo il passo 4: `pg.bonus_prossima_carta_tag = { tag: "taglio", valore: 3 }`, log `sinergia_attivata` con id `SIN_DANZA_LAME`.
- Sulla terza carta (passo 5), il bonus +3 si applica allo step 2 della pipeline e viene **consumato** (una tantum per turno).
- Es. `ATK_FENDENTE` (4 danno base) + 3 sinergia = 7, step 6 max(0, 7-1) = **6 danno** invece dei consueti 3.
- A fine turno: `pg.carte_giocate_per_tag_turno` viene resettato (verifica al turno successivo).

**Cosa indicherebbe un fallimento**
- `sinergia_attivata` non loggata.
- Il +3 viene applicato anche alle carte prima del trigger (errore di ordine).
- Il bonus persiste al turno successivo (manca il reset).
- Il bonus si applica più volte nello stesso turno (`una_tantum_per_turno` non rispettato).

---

### T12 — Sinergia σ1: Gelo Profondo (riduzione costo, non danno)

- **Punto roadmap**: §5.6.3 / 16.6
- **Priorità**: Media

**Setup**
- Seed: `42`.
- PG Mago (per `ATK_LAMPO_GELO`, costo 1 EN, tag `acqua|gelo`).
- Servono **2** carte con tag `gelo` in mano per raggiungere soglia 2. `ATK_LAMPO_GELO` è l'unica carta con tag `gelo` nel CSV attuale (verifica). **Test BLOCCATO**: il pool corrente non contiene due carte distinte tag `gelo`. Resta valido solo se la pila iniziale del Mago contiene due copie di `ATK_LAMPO_GELO` oppure se authoring aggiunge un'altra carta `gelo`.
- **Workaround**: forzare la pila iniziale del Mago a contenere due `ATK_LAMPO_GELO` modificando temporaneamente §3.3 (mock test).

**Passi**
1. Verifica 2 `ATK_LAMPO_GELO` in mano e ≥ 2 EN.
2. Gioca il primo `ATK_LAMPO_GELO` su un Lupo (costo 1, pg.energia da 3 → 2, counter `gelo` = 1).
3. Gioca il secondo `ATK_LAMPO_GELO` (counter `gelo` = 2; scatta `SIN_GELO_PROFONDO` allo step 9).
4. Verifica che il PG abbia ora un effetto attivo di riduzione costo (`pg.riduzione_costo_prossima_carta_tag = { tag: "gelo", valore: 1 }` o flag equivalente).
5. Se nella pesca scaturisce una terza carta `gelo` nel turno (improbabile col pool attuale), giocarla e verificare il costo.

**Risultato atteso**
- Log `sinergia_attivata` con id `SIN_GELO_PROFONDO` dopo il secondo `ATK_LAMPO_GELO`.
- La riduzione di costo si applica alla prossima carta tag `gelo` giocata, e viene consumata (una tantum per turno).

**Cosa indicherebbe un fallimento**
- Sinergia non scatta (controllare condizione e gestione effetto `riduzione_costo`).
- Riduzione applicata al danno invece che al costo (confusione di tipologie di effetto).
- Riduzione persistente (consumo non rispettato).

---

### T13 — `una_tantum_per_turno` rispettato

- **Punto roadmap**: §5.6 / 16.6
- **Priorità**: Media

**Setup**
- Seed: `42`. Stesso setup di T11 (Guerriero, due carte `taglio` + una terza per consumare il bonus).
- Inoltre: deve esserci una **quarta** carta `taglio` in mano per tentare il doppio trigger.

**Passi**
1. Esegui T11 fino al passo 5 (terza carta `taglio` gioca con +3).
2. Gioca una quarta carta `taglio` nello stesso turno (richiede energia residua).
3. Osserva il log.

**Risultato atteso**
- Sulla quarta carta: NESSUN secondo `sinergia_attivata` di `SIN_DANZA_LAME`, NESSUN +3. La sinergia è "scattata" già nel turno (passo 4 di T11) e ha settato il flag una_tantum.
- Quarta carta: danno nudo standard.

**Cosa indicherebbe un fallimento**
- Secondo log `sinergia_attivata`.
- +3 applicato anche alla quarta carta.

---

### T14 — Sinergia σ2: Armonia Solare attiva con 1 slot luce

- **Punto roadmap**: §5.6.4 / 16.5
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guaritore. Equipaggiamento iniziale atteso: arma del Guaritore + `EQP_TALISMANO_LUCE` (tag `luce|sacro`).
- `SIN_ARMONIA_SOLARE`: condizione `equip_tag_match`, slot `[arma, talismano]`, tag `luce`, soglia 1.

**Passi**
1. Subito dopo il setup, ispeziona `window.__STATE__.giocatori[<Guaritore>].sinergie_attive`. Deve contenere `SIN_ARMONIA_SOLARE` (perché il talismano ha tag `luce` ⇒ soglia 1 raggiunta).
2. Avanza al primo combattimento. Verifica nuovamente `sinergie_attive` all'inizio del turno PG (dopo `valuta_sinergie_passive` a inizio turno).
3. Da console: rimuovi il talismano e re-evaluta (`pg.equipaggiamento.talismano = null; ...`). Idealmente esiste un comando UI di rimozione; altrimenti hack diretto allo state seguito da chiamata manuale alla funzione di rivalutazione σ2.
4. Verifica che `SIN_ARMONIA_SOLARE` non sia più in `sinergie_attive`.

**Risultato atteso**
- Passi 1 e 2: `SIN_ARMONIA_SOLARE` presente.
- Passo 4: `SIN_ARMONIA_SOLARE` rimossa.
- L'effetto +1 sull'attacco base (con tag `luce` aggiunto) si vede nel passo 2 confrontando il danno di un attacco base sul Lupo con e senza talismano (vedi T02).

**Cosa indicherebbe un fallimento**
- Sinergia mai in `sinergie_attive` pur avendo i tag richiesti (errore nella `valuta_sinergie_passive` o nel parsing dei tag dell'equip).
- Sinergia non rimossa dopo unequip (manca il trigger di rivalutazione).

---

### T15 — Sinergia σ2 non soddisfatta: degrado elegante (`SIN_ANIMA_BRACE`)

- **Punto roadmap**: §5.6.5 nota / 16.5
- **Priorità**: Bassa (sanity check)

**Setup**
- Seed: `42`.
- Qualsiasi PG. Nessun talismano `fuoco` esiste nel pool equipaggiamenti corrente (verificato in `equipaggiamenti.csv` e annotato esplicitamente in `sinergie.json` come "non scatta mai oggi").

**Passi**
1. Setup partita. Avanza al primo turno PG.
2. Ispeziona `pg.sinergie_attive` per ciascun PG.

**Risultato atteso**
- `SIN_ANIMA_BRACE` **non** compare in `sinergie_attive` di nessun PG.
- Nessun crash, nessun warning. La σ2 esiste nel pool ma non si attiva per assenza di pattern. È esattamente il "degrado elegante" descritto in `sinergie.json`.

**Cosa indicherebbe un fallimento**
- `SIN_ANIMA_BRACE` presente in `sinergie_attive` (falso positivo: bug di matching tag o di lettura schema).
- Eccezione/log d'errore al passaggio sulla σ2 durante `valuta_sinergie_passive`.

---

### T16 — Drop essenze al KO di un nemico

- **Punto roadmap**: §5.7 step 9 / §5.11.2 / 16.3
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guaritore. Primo nodo combattimento.
- Da console: `window.__STATE__.nemici_in_campo[0].pv = 1` (il primo Lupo è a 1 PV).

**Passi**
1. Esegui un attacco base sul Lupo.
2. Leggi i log: deve apparire `danno_inflitto` con `target.pv = 0`, `ko` del nemico, e `essenze_droppate`.
3. Ispeziona `window.__STATE__.giocatori[<Guaritore>].essenze`. Deve essere incrementato per ciascun tag in `NEM_LUPO_OMBRA.essenza_drop = oscurita|taglio`.

**Risultato atteso**
- `pg.essenze.oscurita = 1`, `pg.essenze.taglio = 1` (incremento +1 per ogni tag in `essenza_drop`, §5.11.2 punto 1).
- Log `essenze_droppate` con `pg_id` e `dropped: {oscurita: 1, taglio: 1}`.
- Il Lupo viene rimosso da `nemici_in_campo` (o marcato KO secondo l'implementazione).

**Cosa indicherebbe un fallimento**
- Essenze non incrementate (lo step 9 non distribuisce).
- Essenze incrementate ma del valore sbagliato (es. 2 al posto di 1).
- Log mancante.
- Essenze attribuite a un PG diverso da quello che ha inflitto il colpo letale (verifica anche T16b con un PG diverso che dà il colpo di grazia).

---

### T17 — Evoluzione equipaggiamento Lv1 → Lv2 automatica

- **Punto roadmap**: §5.11 Fase 1 / 16.7
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guerriero (Spadone del Veterano, tag `taglio|impatto`).
- Da console, dopo il setup: `window.__STATE__.giocatori[0].essenze.taglio = 3` (cost lv2 = 3 da config).
- Avanza un nodo o aspetta inizio del prossimo nodo (§5.11 dice "automatica appena il PG accumula le essenze necessarie ed entra in un nodo di riposo o all'inizio di un nodo").

**Passi**
1. Verifica `pg.equipaggiamento.arma.livello = 1` e `pg.essenze.taglio = 3`.
2. Trigger della valutazione: avanza un nodo, o entra in un nodo di riposo. Se il trigger esatto non scatta, chiamare manualmente `auto_evoluzione_equip` se l'UI espone un debug button.
3. Leggi il log.

**Risultato atteso**
- `pg.equipaggiamento.arma.livello = 2`.
- `pg.essenze.taglio = 0` (3 spese).
- Log `evoluzione_livello` con `{ pg_id, slot: "arma", nuovo_livello: 2, tag_speso: "taglio" }`.
- Le stat dell'arma passano al record `stats_per_livello[1]` (Spadone: `danno_base: 4`, `costo_extra: 0`, `effetto_speciale: "+1 danno a tutte le CardAttacco..."`).
- `valuta_sinergie_passive` viene richiamata (verifica `pg.sinergie_attive`).

**Cosa indicherebbe un fallimento**
- Livello non sale.
- Livello sale ma essenze non spese (o spese del tag sbagliato).
- Livello sale ma le stat (danno_base mostrato in UI) non si aggiornano.
- `sinergie_attive` non rivalutate.

---

### T18 — Evoluzione: essenza sbagliata non spende

- **Punto roadmap**: §5.11 / 16.7
- **Priorità**: Media

**Setup**
- Seed: `42`.
- PG Guerriero. Spadone (tag `taglio|impatto`).
- Da console: `pg.essenze.fuoco = 10`, tutti gli altri tag a 0 (incluso `taglio` e `impatto`).

**Passi**
1. Avanza un nodo o trigger della valutazione.
2. Ispeziona `pg.equipaggiamento.arma.livello` e `pg.essenze`.

**Risultato atteso**
- Livello **non** sale (il tag `fuoco` non è nei tag dello Spadone).
- `pg.essenze.fuoco` resta 10.
- Nessun log `evoluzione_livello`.

**Cosa indicherebbe un fallimento**
- Livello sale comunque (matching tag rotto).
- Essenze fuoco spese (errore di selezione tag).

---

### T19 — Evoluzione Lv3: scelta forma finale

- **Punto roadmap**: §5.11 Fase 2 / 16.7 / 16.9
- **Priorità**: Alta

**Setup**
- Seed: `42`.
- PG Guerriero. Spadone.
- Da console: forza `pg.equipaggiamento.arma.livello = 3` (`stats_per_livello[2]`), oppure prepara la run con `pg.essenze.taglio = 8` (3 per lv2 + 5 per lv3) e fai due trigger.
- Trigger forma finale: per Spadone le due forme sono `SPADONE_SBILANCIANTE` (`trigger.tipo: kill_categoria, parametro: elite`) e `SPADONE_VETERANO_SANGUE` (`trigger.tipo: libero`).
- Per soddisfare il primo trigger serve uccidere un nemico elite. `NEM_LADRO_FORESTA` è elite e compare al `LUO_FOR_04`.

**Passi**
1. Porta lo Spadone a Lv3.
2. Avanza fino a `LUO_FOR_04` e uccidi il Ladro della Foresta.
3. Osserva l'UI: deve apparire la **schermata di scelta forma finale** (16.9) con le due opzioni. `SPADONE_VETERANO_SANGUE` (trigger libero) è sempre disponibile, `SPADONE_SBILANCIANTE` (kill_categoria elite) si sblocca solo dopo l'uccisione del Ladro.
4. Scegli `SPADONE_VETERANO_SANGUE`.
5. Leggi il log.

**Risultato atteso**
- Log `forma_finale_scelta` con `{ pg_id, slot: "arma", forma_id: "SPADONE_VETERANO_SANGUE" }`.
- `pg.equipaggiamento.arma.forma_finale_scelta = "SPADONE_VETERANO_SANGUE"`.
- I tag dell'arma includono ora `taglio|impatto|taglio` ⇒ effettivamente `taglio, impatto` con eventuale ridondanza, perché `tag_aggiuntivi: ["taglio"]` per questa forma. Le stat passano al record specifico (`danno_base: 5, costo_extra: 0, effetto_speciale: ...recupero EN`).
- `valuta_sinergie_passive` rivalutata.
- La scelta è **definitiva nella run** (non riproponibile).

**Cosa indicherebbe un fallimento**
- La schermata non appare.
- Appaiono entrambe le forme anche prima del kill elite (trigger non valutato).
- La scelta è modificabile dopo la conferma.
- Le stat non aggiornate dopo la scelta.

---

### T20 — Determinismo: stesso seed, stessa run

- **Punto roadmap**: §9 / 16.10
- **Priorità**: Alta

**Setup**
- Seed: `42`. Stessa classe iniziale per i due PG in entrambe le run.

**Passi (Run A)**
1. Setup con seed 42, classi A=Guerriero, B=Mago.
2. Salva da console: `const logA = JSON.stringify(window.__STATE__.log)`.
3. Avanza al primo combattimento.
4. Esegui esattamente questa sequenza: attacco base sul Lupo 1, poi `ATK_FENDENTE` sul Lupo 1, passa il turno.
5. A fine round: `const logA2 = JSON.stringify(window.__STATE__.log)`. Copia.

**Passi (Run B)**
6. Ricarica la pagina, ripeti il setup identico.
7. Ripeti la stessa sequenza di azioni.
8. A fine round: `const logB2 = JSON.stringify(window.__STATE__.log)`.

**Verifica**
9. `logA2 === logB2` deve essere true.
10. Anche `pg.essenze`, `pg.pv`, `pg.energia`, `nemici_in_campo[i].pv` devono combaciare esattamente.

**Cosa indicherebbe un fallimento**
- I due log differiscono in valori numerici (drop, danni, pesche).
- Differiscono solo i timestamp: **non è un fallimento**, è atteso (i timestamp sono al di fuori del PRNG).
- Differiscono per ordine eventi: fallimento (i contenuti del log dipendono solo dal seed + dalle azioni).

---

### T21 — Transizione fine combattimento (no stuck state)

- **Punto roadmap**: §5.10 / EXT_COMBAT_TRANSITION
- **Priorità**: Alta

**Setup**
- Seed: `42`. Primo combattimento (LUO_FOR_01, 2 Lupi).

**Passi**
1. Uccidi entrambi i Lupi (qualunque combinazione di attacchi base + carte).
2. Subito dopo l'ultimo colpo letale: ispeziona `window.__STATE__.fase_corrente`.
3. Ispeziona `window.__STATE__.nemici_in_campo`.

**Risultato atteso**
- `fase_corrente === "esplorazione"`. La fase `"fine_combattimento"` non deve mai essere osservabile dall'esterno (è transitoria, §5.10 EXT_COMBAT_TRANSITION).
- `nemici_in_campo === []` (svuotato).
- `nodo_corrente.stato === "risolto"`.
- Log: `combattimento_vinto`, eventuale `evoluzione_livello` se essenze sufficienti, eventuale `cura_pg` se PNG amico in campo (in questo nodo non c'è).
- La UI deve mostrare il pulsante "Avanza al prossimo nodo" e non essere stuck su schermata combat.

**Cosa indicherebbe un fallimento**
- `fase_corrente === "fine_combattimento"` (transizione mancata — bug noto del v0.3, da regressione).
- `nemici_in_campo` ancora popolato.
- L'UI mostra ancora i nemici morti / pulsanti combat attivi.

---

### T22 — UI: pulsante attacco base sempre visibile

- **Punto roadmap**: §5.2bis / 16.9
- **Priorità**: Media

**Setup**
- Seed: `42`. Qualsiasi PG, primo nodo combattimento.

**Passi**
1. Verifica che durante `ATTESA_AZIONE_PG` il pulsante "Attacco base" sia **visibile** (16.9 requisito UI).
2. Verifica che mostri il **costo corrente**: "gratuito" se `attacco_base_gratuito_consumato_questo_turno = false`, altrimenti "costa N EN".
3. Verifica che l'indicatore **essenze accumulate** sia visibile (anche se 0 all'inizio).
4. Verifica che l'indicatore **sinergie σ2 attive** sia visibile (può essere vuoto, ma il widget esiste).
5. Esegui un attacco base; verifica che il testo del pulsante cambi da "gratuito" a "costa N EN" istantaneamente.
6. Passa il turno; verifica che al prossimo turno PG il pulsante torni "gratuito".

**Risultato atteso**
- Tutti gli indicatori visibili nelle fasi appropriate (combat).
- Aggiornamenti sincronizzati con lo state.
- Nessun errore in console JS.

**Cosa indicherebbe un fallimento**
- Pulsante assente o disabilitato senza ragione.
- Testo del costo non aggiornato.
- Errori in console (es. accesso a campo undefined).
- L'indicatore essenze mostra valore sbagliato rispetto a `pg.essenze` nello state.

---

## Test rimandati

I seguenti scenari sarebbero utili ma non sono eseguibili allo stato attuale di dati/motore. Vengono qui annotati con l'indicazione di cosa manca.

### TR01 — Pipeline danno con bonus regola_mondo / effetto_luogo

**Cosa manca**: nei CSV attuali `mondi.csv` ha `regola_mondo` testuale ("I PG curano 1 PV alla fine di ogni round") ma non un payload machine-readable di tipo "bonus a tag X di +N". Allo stesso modo, `luoghi.csv` ha `effetto_meccanico` testuale. La pipeline §5.7 step 2 chiama `bonus_regola_mondo(state.mondo, fonte.tag)` e `bonus_effetto_luogo(...)`, ma senza un campo strutturato è plausibile che gli stub di 16.3 restituiscano sempre 0.

**Quando sarà testabile**: dopo l'introduzione di un campo `bonus_tag_strutturato` (o equivalente, JSON inline) su `mondi.csv` e `luoghi.csv`. Vedi parking lot `PARKING_LOT_EFFETTI_AVANZATI`.

### TR02 — Status `forza` moltiplicatore step 3

**Cosa manca**: lo status `forza` è citato in §5.7 step 3 ("danno × 1.5") ed esiste come effetto applicato da `ABL_POSTURA_VETERANO` e `ABL_RISVEGLIO_ARCANO`. Per testarlo formalmente serve verificare che lo step 3 sia effettivamente cablato per `forza`. Il test è quasi eseguibile: applica `ABL_POSTURA_VETERANO`, attacca, verifica `floor(danno × 1.5)`. **Promuoverlo a test attivo nella prossima iterazione se 16.3 lo include esplicitamente**.

### TR03 — Status `marchio` consumato all'uso

**Cosa manca**: §5.7 step 3 cita marchio come "danno × 2 [consuma il marchio]" ma il sistema marchio non risulta applicato/applicabile da nessuna carta del pool attuale. Authoring necessario.

### TR04 — PNG amico — `bonus_png_amico` allo step 2

**Cosa manca**: nessun PNG nel CSV attuale ha effetti machine-readable di tipo "+N danno tag X durante combat". `PNG_LUNA_ALLEATA` cura post-combat, non interagisce con la pipeline step 2. Serve authoring di un PNG con bonus combat strutturato.

### TR05 — Forme finali con trigger `mondo` o `png_amico`

**Cosa manca**: `EQP_AMULETO_CERVO` forma `CERVO_SPIRITO` ha trigger `mondo: MONDO_FOR`, sempre vero in MONDO_FOR. Testare il trigger `mondo` su un mondo diverso da quello richiesto NON è oggi possibile perché esiste solo `MONDO_FOR`. **Test rimandato a Step 17 (secondo mondo)**.

### TR06 — Talismano attivo (`usa_talismano_attivo`)

**Cosa manca**: `EQP_TALISMANO_LUCE` Lv3 e `EQP_AMULETO_CERVO` Lv3 hanno `effetto_attivo` con `costo_energia`. Il comando UI è dichiarato in §8.1 v0.6. Test eseguibile **solo dopo** aver portato il talismano al Lv3 (5 essenze luce/sacro/natura), il che richiede multipli combat. Va riservato a un test "lungo" (>10 passi) o a un setup di console che imposti direttamente livello e essenze.

### TR07 — Twist + pipeline danno

**Cosa manca**: i twist nel CSV (`TWIST_01..03`) hanno `effetto_meccanico` testuale ("I PG perdono 1 EN al prossimo turno"). Non sono codificati come payload. Testare l'interazione twist↔pipeline richiede prima la codifica in EffettoPayload (parking lot `PARKING_LOT_TWIST_AVANZATI`).

### TR08 — Abilità speciale del Druido (boss): stordimento di gruppo

**Cosa manca**: `NEM_DRUIDO_CORROTTO.abilita_speciale` è testuale ("Invoca radici... applica stordimento intensità 1 durata 1 a tutti i PG non ko"). La logica è plausibilmente in `ai_nemici.js` ma serve verifica che sia codificata. Test diventerebbe importante quando si arriva al boss in una run reale, ma per scopi di test isolato richiede `PARKING_LOT_AI_ABILITA_SPECIALE` chiuso.

### TR09 — Multi-PG (più PG che giocano in sequenza)

**Cosa manca**: il motore supporta 2-4 PG, ma testare sinergie σ3 (multi-PG) è esplicitamente fuori dal MVP (§5.6, `# EXT_SINERGIE_MULTI_PG`). I test attuali si concentrano sul singolo PG; uno scenario multi-PG di tipo "PG1 setta un debuff sul nemico, PG2 lo sfrutta" è valido solo per status target step 5 e potrebbe diventare un test attivo (vedi T05 con due PG che attaccano lo stesso target). Non bloccato dai dati, ma rimandato per evitare combinatoria.

---

*Fine documento. 22 test attivi + 9 rimandati.*

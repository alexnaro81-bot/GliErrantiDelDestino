# Test manuali — Step 16.1–16.10

**Data:** 2026-05-22
**Copertura:** roadmap step 16.1–16.10 (pipeline danno, attacco base, sinergie σ1/σ2, evoluzione equipaggiamento, UI v0.6)
**Riferimento design doc:** §5.2bis, §5.6, §5.7, §5.11, §8

---

## Come eseguire i test

1. **Avvio server browser:** `cd web && python3 -m http.server 8080` (oppure `npx serve .`), poi apri `http://localhost:8080`. Il gioco si avvia con la schermata di setup.
2. **Seed PRNG:** inserisci il numero nel campo "Seed PRNG" prima di cliccare "Inizia". Se il campo è vuoto viene usato un seed casuale non riproducibile.
3. **Debug hook (obbligatorio per T-16.1–T-16.7):** in `web/app.js`, aggiungi la riga seguente subito prima di `init();` (riga ~752). Rigenerare il bundle non è necessario — app.js è caricato direttamente.
   ```javascript
   window._t = { get s(){return stato_gioco}, set s(v){stato_gioco=v; render();}, get d(){return db} };
   ```
   Da quel momento: `_t.s` legge/scrive lo stato (con re-render automatico), `_t.d` legge il database, `window.GED` è il motore.
4. **Cronaca log:** il pannello "Cronaca" in basso a destra mostra gli ultimi 30 eventi. Gli eventi v0.6 appaiono in colori dedicati: oro per `sinergia_attivata`, `equip_evoluto`, `forma_finale_scelta`; rame per `attacco_base`.
5. **Test Node (percorso alternativo):** tutti i test da T-16.1 a T-16.7 possono essere eseguiti direttamente in Node usando `smoke_test_16_10.js` come template. Copiare lo script, sostituire il setup e le asserzioni. È il percorso più veloce finché i due prerequisiti browser non sono risolti (vedi sotto).

---

## Prerequisiti browser — due bug non ancora portati dalla versione Node

> Questi bug non bloccano i test UI (T-16.9-*), ma rendono inutilizzabili tutti i test meccanici (T-16.1–T-16.7) nel browser. Verificare e applicare prima di eseguire quei test.

### BUG-B1 — `carica_dati_browser` usa `oggetti.csv` invece di `equipaggiamenti.csv`+`consumabili.csv`

**File:** `strumenti/build_browser.js` (sezione `carica_dati_browser`, riga ~198)

Il parser browser carica `oggetti.csv` e restituisce `db.oggetti`. Il motore bundlato usa `db.equipaggiamenti.find(...)` (C1-fix applicato al codice Node). Risultato: `TypeError: Cannot read properties of undefined (reading 'find')` al primo `gioca_carta`.

**Fix necessario:** nella sezione `carica_dati_browser` di `build_browser.js`, sostituire il caricamento di `oggetti.csv` con:
```javascript
var equipaggiamenti = await fetch_csv('equipaggiamenti.csv');
var consumabili     = await fetch_csv('consumabili.csv');
```
E aggiornare il mapping + il `return` finale per includere `equipaggiamenti` e `consumabili` (con parsing JSON di `stats_per_livello` e `forme_finali` tramite `JSON.parse`), rimuovendo `oggetti`. Dopo la modifica, rigenerare con `node strumenti/build_browser.js`.

### BUG-B3 — `carica_dati_browser` non mappa tag, vuln/res e altri campi v0.6

**Sintomo:** Vulnerabilità e resistenza ignorate nel browser (T-16.3-02/03): danno sempre uguale al caso base, senza moltiplicatore ×1.5/×0.5. Altre meccaniche potenzialmente silenti: `applica_status`, `ignora_difesa`, `ignora_scudo`, `salta_step_tag`, `effetto_strutturato`, bonus vuln/res dei luoghi.

**Causa:** Il mapping duck-typed in `carica_dati_browser` (in `strumenti/build_browser.js`) era rimasto alla versione pre-v0.6. Campi aggiunti nel v0.6 (`tag` per attacchi/abilità, `vulnerabilita`/`resistenza`/`essenza_drop` per nemici, `vulnerabilita_luogo`/`resistenza_luogo` per luoghi) non erano presenti nel mapping, risultando `undefined` a runtime. La pipeline_danno riceveva `tag_fonte = []` e `vuln = []` → nessun match → ×1.5 mai applicato.

**Fix applicato (22/05/2026):** `strumenti/build_browser.js` aggiornato con i campi mancanti; bundle rigenerato. Verificare: ricaricare il browser con Ctrl+Shift+R per svuotare la cache.

---

### BUG-B2 — `setup_partita_browser` non applica il C3-fix (slot equipaggiamento null)

**File:** `web/app.js` righe 143–145

`setup_partita_browser` crea i PG con `equipaggiamento: { arma: null, armatura: null, talismano: null }`. Il C3-fix è presente solo in `motore/setup.js` (`_crea_pg`), che non è chiamato dal percorso browser. Risultato: "Attacco base" ritorna sempre `ERR_ARMA_NON_EQUIPAGGIATA`, σ2 mai attive, evoluzione inerte.

**Fix necessario:** in `setup_partita_browser`, dopo aver calcolato `classe`, aggiungere la stessa logica `pick_equip` / `istanza_equip` presente in `setup.js:1022–1085`. Serve che `db.equipaggiamenti` sia disponibile (richiede BUG-B1 risolto).

---

## Indice dei test

| ID | Nome | Roadmap | Priorità | Ambiente | Superato |
|---|---|---|---|---|
| T-16.1-01 | Bootstrap DB — nessun crash al caricamento | §16.1 | Alta | Browser/Node | si |
| T-16.1-02 | PGState v0.6 — campi e slot equipaggiamento per classe | §16.1 §2.2 | Alta | Browser | si |
| T-16.3-01 | Pipeline danno — caso nominale senza modificatori | §16.3 §5.7 | Alta | Browser | si |
| T-16.3-02 | Pipeline danno — vulnerabilità ×1.5 (luce vs Lupo d'Ombra) | §16.3 §5.7 step 4 | Alta | Browser | si |
| T-16.3-03 | Pipeline danno — resistenza ×0.5 (perforante vs Lupo d'Ombra) | §16.3 §5.7 step 4 | Alta | Browser | si |
| T-16.3-04 | Pipeline danno — scudo assorbe prima della difesa | §16.3 §5.7 step 6–7 | Media | Browser | ? |
| T-16.4-01 | Attacco base — primo gratuito, flag correttamente settato | §16.4 §5.2bis | Alta | Browser | si |
| T-16.4-02 | Attacco base — secondo a pagamento, EN scalata | §16.4 §5.2bis | Alta | Browser | si |
| T-16.4-03 | Attacco base — EN insufficiente per secondo attacco (caso limite) | §16.4 §5.2bis | Media | Browser | |
| T-16.5-01 | σ2 SIN_ARMONIA_SOLARE — attiva con qualsiasi talismano luce | §16.5 §5.6.4 | Alta | Browser | |
| T-16.5-02 | σ2 + attacco base — bonus +1 danno visibile in pipeline | §16.5 §16.3 | Alta | Browser | |
| T-16.5-03 | σ2 disattivazione — rimozione slot azzera sinergie_attive | §16.5 §5.6.4 | Media | Browser | |
| T-16.6-01 | σ1 SIN_DANZA_LAME — 2 carte taglio, log sinergia_attivata | §16.6 §5.6.4 | Alta | Browser | |
| T-16.6-02 | σ1 soglia non raggiunta — 1 carta taglio, nessun log σ1 | §16.6 §5.6.4 | Media | Browser | |
| T-16.6-03 | σ1 reset — contatore carte_giocate_per_tag azzerato a inizio turno | §16.6 §5.6.4 | Media | Browser | |
| T-16.7-01 | Evoluzione Lv1→Lv2 — essenze sufficienti, log equip_evoluto | §16.7 §5.11 | Alta | Browser | |
| T-16.7-02 | Evoluzione Lv2→Lv3 + scelta forma finale libero — flusso completo | §16.7 §5.11 | Alta | Browser | |
| T-16.7-03 | Forma finale condizionale — trigger kill_categoria=boss (post M1-fix) | §16.7 §5.11 | Alta | Browser | |
| T-16.7-04 | Essenze insufficienti — nessuna evoluzione, livello invariato | §16.7 §5.11 | Media | Browser | |
| T-16.9-01 | UI — badge "gratuito" e badge costo EN su attacco base | §16.9 §8 §5.2bis | Alta | Browser | |
| T-16.9-02 | UI — pillole essenze e pillole σ2 nella card PG | §16.9 §8 §5.11 | Media | Browser | |
| T-16.9-03 | UI — modale forma finale si apre e conferma scelta | §16.9 §8 §5.11 | Alta | Browser | |

---

## Test in dettaglio

---

### T-16.1-01 — Bootstrap DB — nessun crash al caricamento

**Punto roadmap:** §16.1 (parser CSV v0.6)

**Setup:** prerequisiti BUG-B1 e BUG-B2 applicati. Seed: 42.

**Passi:**
1. Apri il browser su `http://localhost:8080`. Apri DevTools → Console.
2. Inserisci seed `42`, lascia 2 giocatori, clicca **Inizia**.
3. Attendi che la schermata di gioco appaia (nessun errore rosso in console).
4. In console digita: `Object.keys(_t.d)` e premi Invio.

**Risultato atteso:**
- Nessun errore in console durante il caricamento.
- `Object.keys(_t.d)` restituisce un array che include: `mondi`, `luoghi`, `eventi`, `twist`, `png`, `attacchi`, `abilita`, `equipaggiamenti`, `consumabili`, `nemici`, `config`, `sinergie`.
- `_t.d.equipaggiamenti.length` → `5` (cinque equipaggiamenti nel CSV).
- `_t.d.consumabili.length` → `2`.
- `_t.d.sinergie.sinergie` è un oggetto con 7 chiavi (4 σ1 + 3 σ2).

**Segnali di fallimento:**
- Errore `TypeError: Cannot read properties of undefined` in console → BUG-B1 non applicato.
- `_t.d.equipaggiamenti` è `undefined` → il parser browser restituisce ancora `oggetti` al posto dei due pool separati.
- `Object.keys(_t.d)` non include `equipaggiamenti` → bundle non rigenerato dopo il fix.

---

### T-16.1-02 — PGState v0.6 — campi e slot equipaggiamento per classe

**Punto roadmap:** §16.1 §2.2 (struttura PGState, C3-fix browser)

**Setup:** prerequisiti BUG-B1 e BUG-B2 applicati. Seed: 42.

**Passi:**
1. Avvia partita con seed `42`, 2 giocatori. Clicca **Inizia**.
2. In console: `pg1 = _t.s.giocatori[0]`, poi `pg1.classe`.
3. Controlla `pg1.equipaggiamento` e `pg1.equip_istanze`.
4. Controlla i campi v0.6: `pg1.essenze`, `pg1.sinergie_attive`, `pg1.attacco_base_gratuito_consumato_questo_turno`, `pg1.carte_giocate_per_tag_turno`, `pg1.scelta_forma_pendente`.

**Risultato atteso:**
- `pg1.classe` → `'guerriero'` (primo PG sempre guerriero con 2 giocatori).
- `pg1.equipaggiamento` → `{ arma: 'EQP_SPADONE_VETERANO', armatura: null, talismano: 'EQP_AMULETO_CERVO' }`.
- `pg1.equip_istanze.arma` → `{ livello: 1, forma_scelta_id: null, tag_correnti: ['taglio', 'impatto'] }`.
- `pg1.essenze` → oggetto con le 10 categorie tutte a `0` (`fuoco: 0, acqua: 0, ... taglio: 0, ...`).
- `pg1.sinergie_attive` → `[]` (vuoto prima del primo combattimento).
- `pg1.attacco_base_gratuito_consumato_questo_turno` → `false`.
- `pg1.carta_giocate_per_tag_turno` → `{}`.
- `pg1.scelta_forma_pendente` → `null`.

**Segnali di fallimento:**
- `pg1.equipaggiamento.arma` è `null` → BUG-B2 non applicato.
- Campi `essenze` o `sinergie_attive` assenti → `setup_partita_browser` usa ancora struttura v0.3.
- Slot `accessorio` invece di `talismano` → rinomina slot non applicata.

---

### T-16.3-01 — Pipeline danno — caso nominale senza modificatori

**Punto roadmap:** §16.3 §5.7 (9 step)

**Setup:** prerequisiti applicati. Seed: 42. In console, dopo aver avviato il combattimento al nodo 1:

```javascript
// Snippet setup T-16.3-01
const G = window.GED;
const db = _t.d;
let s = _t.s;
const pg = s.giocatori[0]; // guerriero
const target_id = s.nemici_in_campo[0].istanza_id;
// ATK_COLPO_DECISO: danno 4, tag [impatto], ignora_difesa false
// NEM_LUPO_OMBRA: difesa 1, vuln [luce,sacro], res [oscurita,perforante]
const pv_prima = s.nemici_in_campo[0].pv;
console.log('PV prima:', pv_prima); // atteso: 12
```

**Passi:**
1. Avvia partita seed `42`. Naviga al nodo 1 (combattimento comune). Clicca **Avvia combattimento**.
2. Apri la mano: cerca `ATK_COLPO_DECISO` (o iniettalo in mano: `_t.s.giocatori[0].mano.unshift('ATK_COLPO_DECISO')`).
3. Seleziona **Colpo Deciso** dalla mano, clicca sul **Lupo d'Ombra** come bersaglio.
4. Leggi l'evento `danno_inflitto` nella Cronaca.

**Risultato atteso:**
- Calcolo pipeline: step 1 base=4 → step 2 +0 (nessuna sinergia, nessun σ2 con impatto) → step 3 nessuno status → step 4 tag `impatto` non in vuln `[luce,sacro]` né in res `[oscurita,perforante]` → step 5 nessuno → step 6 −1 difesa = **3** → step 7 nessuno scudo.
- PV Lupo: 12 → **9**.
- Cronaca mostra: `danno_inflitto: 3, residuo_pv: 9`.
- Verifica console: `_t.s.nemici_in_campo[0].pv` → `9`.

**Segnali di fallimento:**
- Danno mostrato diverso da 3 → modificatore inatteso (sinergia σ2 non filtrata, o difesa ignorata).
- PV scende sotto 9 → difesa non sottratta, doppio conteggio, o altro.
- Errore in console → db.equipaggiamenti non risolto (BUG-B1).

---

### T-16.3-02 — Pipeline danno — vulnerabilità ×1.5

**Punto roadmap:** §16.3 §5.7 step 4

**Setup:** stesso di T-16.3-01. In mano inietta `ATK_LUCE_PURGATRICE` se assente:
```javascript
_t.s.giocatori[0].mano.unshift('ATK_LUCE_PURGATRICE');
```

**Passi:**
1. Durante il turno PG, seleziona **Luce Purgatrice** dalla mano.
2. Clicca sul **Lupo d'Ombra** (PV iniziali 12).
3. Leggi `danno_inflitto` nella Cronaca.

**Risultato atteso:**
- Calcolo: base=4 → step 4 tag `luce` in vuln `[luce,sacro]` → `floor(4 × 1.5) = 6` → step 6 −1 difesa = **5**.
- PV Lupo: 12 → **7**.
- Cronaca: `danno_inflitto: 5, residuo_pv: 7`.

**Segnali di fallimento:**
- Danno = 3 (stessa di T-16.3-01) → vulnerabilità ignorata, step 4 non eseguito.
- Danno = 5 ma PV = 8 invece di 7 → difesa non sottratta dopo il moltiplicatore.
- Danno = 9 (floor(6×1.5)) → step 5 "debolezza" applicato per errore.

---

### T-16.3-03 — Pipeline danno — resistenza ×0.5

**Punto roadmap:** §16.3 §5.7 step 4

**Setup:** stesso di T-16.3-01. Inietta in mano:
```javascript
_t.s.giocatori[0].mano.unshift('ATK_COLTELLO_AVVELENATO');
```

**Passi:**
1. Seleziona **Coltello Avvelenato** (danno 4, tag `perforante|veleno`).
2. Attacca il **Lupo d'Ombra** (PV iniziali 12, res `oscurita|perforante`).
3. Leggi `danno_inflitto` nella Cronaca.

**Risultato atteso:**
- Calcolo: base=4 → step 4 tag `perforante` in res `[oscurita,perforante]` → `floor(4 × 0.5) = 2` → step 6 −1 difesa = **1**.
- PV Lupo: 12 → **11**.
- Cronaca: `danno_inflitto: 1, residuo_pv: 11`.

**Segnali di fallimento:**
- Danno = 3 (come T-16.3-01) → resistenza ignorata.
- Danno = 1 ma PV = 12 → step 8 non applicato.
- Danno = 0 (floor del floor) → doppia riduzione.

---

### T-16.3-04 — Pipeline danno — scudo assorbe prima della difesa

**Punto roadmap:** §16.3 §5.7 step 7 (scudo PG)

**Setup:** avvia combattimento. Il PG deve avere `ABL_GUARDIA` in mano:
```javascript
_t.s.giocatori[0].mano.unshift('ABL_GUARDIA');
```

**Passi:**
1. Seleziona **Guardia** dalla mano. Nessun bersaglio nemico (target: se stessi). Clicca per confermare.
2. Cronaca mostra evento con status `scudo: 3` applicato al PG.
3. Clicca **Passa turno**.
4. Il nemico attacca automaticamente (NEM_LUPO_OMBRA, danno_base=4).
5. Leggi `danno_inflitto` e `residuo_pv` del PG nella Cronaca.

**Risultato atteso:**
- Step 7: scudo 3 assorbe `min(3, 4) = 3`. Danno residuo: `4 − 3 = 1`.
- Nota: PG non hanno difesa in §5.7 MVP (step 6 si applica solo ai nemici), quindi lo scudo è l'unico scudo.
- PV PG: 30 → **29**. Scudo rimosso (intensità a 0).
- Cronaca: `danno_inflitto: 1, residuo_pv: 29`.
- Stato: `_t.s.giocatori[0].status` non contiene più `scudo`.

**Segnali di fallimento:**
- PV PG = 26 (danno pieno 4) → scudo non applicato.
- PV PG = 30 (nessun danno) → scudo ha assorbito tutto, ma intensità era 4+, impossibile con ABL_GUARDIA=3.
- Scudo ancora presente con intensità positiva → non è stato rimosso dopo esaurimento.

---

### T-16.4-01 — Attacco base — primo gratuito, flag correttamente settato

**Punto roadmap:** §16.4 §5.2bis

**Setup:** prerequisiti applicati. Seed: 42. Avvia combattimento al nodo 1.

**Passi:**
1. In console: `_t.s.giocatori[0].attacco_base_gratuito_consumato_questo_turno` → atteso `false`.
2. Verifica nella UI: il badge accanto al pulsante "Attacco base" mostra **gratuito** (sfondo verde).
3. Clicca **Attacco base** (unico Lupo d'Ombra come bersaglio automatico).
4. Cronaca mostra evento `attacco_base`.
5. In console: `_t.s.giocatori[0].attacco_base_gratuito_consumato_questo_turno` → atteso `true`.

**Risultato atteso:**
- Guerriero con EQP_SPADONE_VETERANO (danno_base Lv1=3) + SIN_ARMONIA_SOLARE attiva (+1 danno attacco base).
- Danno: 3 + 1(σ2) = 4 − 1(difesa lupo) = **3** PV tolti. PV Lupo: 12 → **9**.
- Flag post-azione: `attacco_base_gratuito_consumato_questo_turno = true`.
- Cronaca: evento `attacco_base` visibile in rame, seguito da `danno_inflitto: 3`.

**Segnali di fallimento:**
- `ERR_ARMA_NON_EQUIPAGGIATA` in un alert → BUG-B2 non applicato.
- Flag rimane `false` dopo l'azione → non aggiornato in `esegui_attacco_base`.
- Danno = 2 invece di 3 → SIN_ARMONIA_SOLARE non attiva (controllare `pg1.sinergie_attive`).

---

### T-16.4-02 — Attacco base — secondo a pagamento, EN scalata

**Punto roadmap:** §16.4 §5.2bis

**Setup:** continuazione di T-16.4-01 nello stesso turno (flag già `true`).

**Passi:**
1. Dopo il primo attacco base, verifica in console: `_t.s.giocatori[0].energia`. Nota il valore (es. 3 EN).
2. Verifica nella UI: il badge mostra ora **0 EN** (costo extra EQP_SPADONE_VETERANO Lv1 = 0).
3. Clicca **Attacco base** una seconda volta.
4. Cronaca mostra secondo evento `attacco_base`.
5. In console: energia aggiornata (stessa, perché costo_extra=0 per il Veterano Lv1).

**Risultato atteso:**
- EQP_SPADONE_VETERANO Lv1: `costo_extra = 0`. Badge mostra **0 EN** (non disabilitato).
- Il secondo attacco va a buon fine: stesso danno del primo (3 PV tolti).
- EN del PG invariata (costo_extra = 0).
- La riga attacco base rimane visibile: solo il badge cambia da verde a blu.

**Segnali di fallimento:**
- Badge ancora verde ("gratuito") → flag non aggiornato nel render.
- Bottone disabilitato nonostante EN sufficienti → `_leggi_costo_extra_arma` non legge l'istanza corretta.
- Nessun secondo evento `attacco_base` in Cronaca.

---

### T-16.4-03 — Attacco base — EN insufficiente per secondo attacco (caso limite)

**Punto roadmap:** §16.4 §5.2bis

**Setup:** arma con `costo_extra > 0`. Forza `EQP_BASTONE_ARCANO` (mago, costo_extra=0 Lv1... hmm, verifichiamo). Inietta un'arma personalizzata o usa un PG con EN a 0:
```javascript
// Porta EN del PG a 0 (simula EN esaurita dopo carte costose)
s = Object.assign({}, _t.s);
s.giocatori = s.giocatori.map((p,i) => i === _t.s.turno_di ? {...p, energia: 0} : p);
_t.s = s;
// Ora flag già consumato: forza il secondo tentativo
s2 = Object.assign({}, _t.s);
s2.giocatori = s2.giocatori.map((p,i) => i === _t.s.turno_di
  ? {...p, attacco_base_gratuito_consumato_questo_turno: true} : p);
_t.s = s2;
```

**Passi:**
1. Con EN = 0 e flag = `true`, verifica il badge nella UI.
2. Verifica che il bottone **Attacco base** sia disabilitato.
3. Clicca il bottone: non deve succedere nulla.

**Risultato atteso:**
- Il badge mostra il costo extra dell'arma (es. "0 EN" per Spadone Lv1).
- Se costo_extra = 0, il bottone rimane abilitato anche a 0 EN (0 ≤ 0 è true).
- Per testare il vero "disabilitato": modifica l'istanza arma con costo_extra = 1 e porta EN a 0:
  ```javascript
  // Clona correttamente lo stato per triggherare il setter e il re-render.
  const s3 = Object.assign({}, _t.s);
  s3.giocatori = s3.giocatori.map((p, i) => i === _t.s.turno_di
    ? {...p, equip_istanze: {...p.equip_istanze, arma: {livello: 3, forma_scelta_id: null, tag_correnti: ['taglio','impatto']}}}
    : p);
  _t.s = s3; // setter: aggiorna stato + chiama render()
  // Alternativa con mutazione diretta (meno sicura, ma funziona):
  // _t.s.giocatori[0].equip_istanze.arma = {livello: 3, forma_scelta_id: null, tag_correnti: ['taglio','impatto']};
  // _t.render(); // usa _t.render(), NON render() che non è globale
  ```
- Badge mostra "1 EN". Con energia = 0, bottone **disabilitato** (grigio).
- Tentativo di click non produce `attacco_base` in Cronaca.

**Segnali di fallimento:**
- Bottone attivo nonostante EN < costo → controllo `btn.disabled = costo_extra > pg.energia` mancante.
- Alert con errore invece di bottone silenziosamente disabilitato → il check EN non è nella UI ma solo nel motore.

---

### T-16.5-01 — σ2 SIN_ARMONIA_SOLARE — attiva con qualsiasi talismano luce

**Punto roadmap:** §16.5 §5.6.4

**Setup:** prerequisiti applicati. Avvia combattimento (avvia_combattimento chiama valuta_sinergie_passive internamente).

**Passi:**
1. In console dopo `avvia_combattimento`: `_t.s.giocatori[0].sinergie_attive`.
2. Verifica che la Cronaca contenga un evento `sinergia_attivata` per `SIN_ARMONIA_SOLARE`.
3. Controlla manualmente la condizione: guerriero ha `EQP_AMULETO_CERVO` (tag `natura|luce`). La σ2 richiede almeno 1 slot in `[arma, talismano]` con tag `luce`, soglia 1. Amuleto Cervo è in slot talismano con tag `luce` → condizione soddisfatta.

**Risultato atteso:**
- `sinergie_attive` → `['SIN_ARMONIA_SOLARE']` (array con almeno questo id).
- Cronaca: `sinergia_attivata: SIN_ARMONIA_SOLARE`.
- Stessa σ2 attiva per tutti e 4 i guerrieri/mago/ladro che partono con EQP_AMULETO_CERVO (tag luce).
- Mago (EQP_BASTONE_ARCANO + EQP_AMULETO_CERVO): stessa attivazione.
- Guaritore (nessuna arma + EQP_TALISMANO_LUCE, tag `luce|sacro`): stessa attivazione.

**Segnali di fallimento:**
- `sinergie_attive` è `[]` → `valuta_sinergie_passive` non chiamata in `avvia_combattimento`, o condizione equip_tag_match non valuta tag_correnti dell'istanza.
- Cronaca non mostra `sinergia_attivata` → log non emesso sulle transizioni.
- `sinergie_attive` contiene id che non esistono in `db.sinergie.sinergie` → bug nel ciclo.

---

### T-16.5-02 — σ2 + attacco base — bonus +1 danno visibile in pipeline

**Punto roadmap:** §16.5 §16.3 (interazione σ2 e pipeline_danno step 2)

**Setup:** stesso di T-16.5-01. SIN_ARMONIA_SOLARE deve essere attiva.

**Passi:**
1. Verifica `_t.s.giocatori[0].sinergie_attive` → `['SIN_ARMONIA_SOLARE']`.
2. Esegui un attacco base sul Lupo d'Ombra (PV=12, difesa=1).
3. Leggi `danno_inflitto` nella Cronaca.
4. Per confronto: disattiva la σ2 e ripeti.
   ```javascript
   // Rimuovi la sinergia manualmente per confronto
   let s = _t.s;
   s.giocatori[0].sinergie_attive = [];
   _t.s = s;
   // Poi esegui di nuovo attacco base (reset flag prima)
   s.giocatori[0].attacco_base_gratuito_consumato_questo_turno = false;
   _t.s = s;
   ```

**Risultato atteso:**
- Con SIN_ARMONIA_SOLARE: step 2 `bonus_sinergia_attiva` → +1 (tipo `bonus_danno_attacco_base`). Danno: 3+1=4 −1difesa = **3 PV** tolti. PV Lupo: 12→9.
- Senza SIN_ARMONIA_SOLARE: step 2 → +0. Danno: 3−1 = **2 PV** tolti. PV Lupo: 12→10.
- Differenza confermata: +1 danno quando σ2 attiva.
- **Nota PARKING_LOT:** l'effetto `applica_tag: 'luce'` della σ2 NON viene aggiunto a `tag_fonte` in pipeline (`bonus_sinergia_attiva` ritorna solo un int). Il Lupo d'Ombra (vuln=luce) non riceve il ×1.5 dall'attacco base con σ2. Questo è un limite documentato (vedi `combattimento.js:1196`).

**Segnali di fallimento:**
- Danno identico con e senza σ2 → `bonus_sinergia_attiva` ignora le σ2 o l'if `e_attacco_base` non scatta.
- Danno = 6 (4×1.5) → il tag `luce` viene erroneamente propagato a `tag_fonte` già ora.

---

### T-16.5-03 — σ2 disattivazione — rimozione slot azzera sinergie_attive

**Punto roadmap:** §16.5 §5.6.4 (idempotenza di valuta_sinergie_passive)

**Setup:** avvia combattimento. SIN_ARMONIA_SOLARE attiva sul guerriero (EQP_AMULETO_CERVO).

**Passi:**
1. Verifica `_t.s.giocatori[0].sinergie_attive` → `['SIN_ARMONIA_SOLARE']`.
2. Rimuovi il talismano dallo slot:
   ```javascript
   let s = _t.s;
   s.giocatori[0].equipaggiamento.talismano = null;
   s.giocatori[0].equip_istanze.talismano = null;
   _t.s = s;
   ```
3. Chiama manualmente `valuta_sinergie_passive`:
   ```javascript
   const r = window.GED.valuta_sinergie_passive(_t.s, 'pg_1', _t.d);
   _t.s = r;
   ```
4. Verifica `_t.s.giocatori[0].sinergie_attive`.
5. Controlla la Cronaca per l'evento `sinergia_disattivata`.

**Risultato atteso:**
- Dopo la rimozione e la rivalutazione: `sinergie_attive` → `[]`.
- Cronaca: `sinergia_disattivata: SIN_ARMONIA_SOLARE` (log emesso solo sulla transizione).
- `valuta_sinergie_passive` è idempotente: richiamarla una seconda volta senza modifiche non produce log duplicati.

**Segnali di fallimento:**
- `sinergie_attive` rimane `['SIN_ARMONIA_SOLARE']` → rivalutazione non rimuove le σ2 non più soddisfatte.
- Nessun log `sinergia_disattivata` → transizione non loggata.
- Log duplicati `sinergia_attivata/disattivata` a ogni chiamata → idempotenza rotta.

---

### T-16.6-01 — σ1 SIN_DANZA_LAME — 2 carte taglio, log sinergia_attivata

**Punto roadmap:** §16.6 §5.6.4

**Setup:** avvia combattimento. Inietta 3 copie di `ATK_FENDENTE` in mano (tag: `taglio`, costo 1 EN):
```javascript
let s = _t.s;
s.giocatori[0].mano.unshift('ATK_FENDENTE', 'ATK_FENDENTE', 'ATK_FENDENTE');
s.giocatori[0].energia = 6; // EN sufficiente per 3 carte
_t.s = s;
```

**Passi:**
1. Verifica `_t.s.giocatori[0].carte_giocate_per_tag_turno` → `{}` (inizio turno).
2. Gioca **Fendente** #1 sul Lupo d'Ombra. Cronaca: `carta_giocata`, no `sinergia_attivata`.
3. In console: `_t.s.giocatori[0].carte_giocate_per_tag_turno` → `{ taglio: 1 }`. Soglia 2 non raggiunta.
4. Gioca **Fendente** #2 sullo stesso bersaglio.
5. Cronaca: appare evento `sinergia_attivata` per `SIN_DANZA_LAME`.
6. In console: `_t.s.giocatori[0].bonus_prossima_carta_tag` → `{ tag: 'taglio', valore: 3 }`.
7. Gioca **Fendente** #3 (il bonus viene consumato): Cronaca mostra `sinergia_consumata` e il danno extra.

**Risultato atteso:**
- Carta 1: danno = 4 −1(difesa) = **3** (nessun bonus).
- Carta 2: danno = 4 −1 = **3**; DOPO, σ1 scatta → `bonus_prossima_carta_tag = {tag:'taglio', valore:3}`.
- Carta 3: danno = 4 +3(σ1) −1 = **6**. `bonus_prossima_carta_tag` → `null` dopo.
- Cronaca: `sinergia_attivata: SIN_DANZA_LAME` visibile in oro tra carta 2 e carta 3.

**Segnali di fallimento:**
- Nessun evento `sinergia_attivata` → `valuta_sinergie_attive` non chiamata dopo step 9 di pipeline_danno.
- Bonus applicato già alla carta 2 (non alla 3) → consumo prematuro.
- `carte_giocate_per_tag_turno.taglio` non aggiornato → contatore non funziona.

---

### T-16.6-02 — σ1 soglia non raggiunta — 1 carta taglio, nessun log σ1

**Punto roadmap:** §16.6 §5.6.4 (caso limite negativo)

**Setup:** avvia combattimento, EN sufficiente. Una sola copia di `ATK_FENDENTE` in mano.

**Passi:**
1. Gioca **Fendente** una volta.
2. Cronaca: evento `carta_giocata`. Verifica che NON appaia `sinergia_attivata`.
3. In console: `_t.s.giocatori[0].carte_giocate_per_tag_turno` → `{ taglio: 1 }`.
4. In console: `_t.s.giocatori[0].bonus_prossima_carta_tag` → `null`.

**Risultato atteso:**
- Soglia SIN_DANZA_LAME = 2 carte taglio. Con 1 sola carta, la soglia non è raggiunta.
- Nessun `sinergia_attivata` in Cronaca.
- `bonus_prossima_carta_tag` rimane `null`.

**Segnali di fallimento:**
- `sinergia_attivata` compare con 1 sola carta → soglia non letta correttamente (off-by-one).
- `bonus_prossima_carta_tag` non null → bonus pre-applicato.

---

### T-16.6-03 — σ1 reset — contatore azzerato a inizio turno successivo

**Punto roadmap:** §16.6 §5.6.4 (reset del contatore tra turni)

**Setup:** continuazione di T-16.6-02 (stato con `carte_giocate_per_tag_turno: { taglio: 1 }`).

**Passi:**
1. Clicca **Passa turno**. I nemici attaccano. Inizia il turno del PG2.
2. Passa il turno di PG2 (se presente). Inizia il turno del PG1.
3. In console: `_t.s.giocatori[0].carte_giocate_per_tag_turno` → atteso `{}`.

**Risultato atteso:**
- `inizio_turno_pg` resetta `carte_giocate_per_tag_turno = {}`.
- Il contatore taglio non porta over da un turno all'altro.

**Segnali di fallimento:**
- `carte_giocate_per_tag_turno.taglio` ancora = 1 a inizio turno successivo → reset mancante in `inizio_turno_pg`.
- σ1 scatta alla prima carta del turno successivo (effetto del contatore residuo).

---

### T-16.7-01 — Evoluzione Lv1→Lv2 — essenze sufficienti, log equip_evoluto

**Punto roadmap:** §16.7 §5.11

**Setup:** guerriero con EQP_SPADONE_VETERANO Lv1. Inserisci esattamente 3 essenze `taglio` (soglia Lv2):
```javascript
let s = _t.s;
s.giocatori[0].essenze.taglio = 3;
_t.s = s;
```

**Passi:**
1. Verifica: `_t.s.giocatori[0].equip_istanze.arma.livello` → `1`.
2. Chiama `auto_evoluzione_equip` dal motore:
   ```javascript
   const r = window.GED.auto_evoluzione_equip(_t.s, 'pg_1', _t.d);
   _t.s = r.state || r; // auto_evoluzione_equip ritorna state direttamente
   ```
3. Cronaca: cerca evento `equip_evoluto`.
4. In console: `_t.s.giocatori[0].equip_istanze.arma.livello` → `2`.
5. `_t.s.giocatori[0].essenze.taglio` → `0` (3 essenze spese).

**Risultato atteso:**
- Soglia Lv2: `config.combattimento.essenze_per_lv2 = 3`. Con taglio=3, soglia raggiunta.
- Livello arma: 1 → **2**.
- `essenze.taglio`: 3 → **0**.
- Cronaca: `equip_evoluto` (visibile in oro).
- Il danno_base dell'attacco base ora usa Lv2: `stats_per_livello[1].danno_base = 4` invece di 3.

**Segnali di fallimento:**
- Livello rimane 1 → `auto_evoluzione_equip` non trova il tag corretto, o soglia non letta da config.
- Essenze non scalate → le essenze non vengono consumate.
- Nessun log `equip_evoluto` → transizione non loggata.

---

### T-16.7-02 — Evoluzione Lv2→Lv3 + scelta forma finale libero (flusso completo)

**Punto roadmap:** §16.7 §5.11 (flusso end-to-end)

**Setup:** guerriero con EQP_SPADONE_VETERANO già al Lv2, essenze taglio=5 (soglia Lv3):
```javascript
let s = _t.s;
s.giocatori[0].equip_istanze.arma = { livello: 2, forma_scelta_id: null, tag_correnti: ['taglio','impatto'] };
s.giocatori[0].essenze.taglio = 5;
_t.s = s;
```

**Passi:**
1. Chiama `auto_evoluzione_equip`:
   ```javascript
   _t.s = window.GED.auto_evoluzione_equip(_t.s, 'pg_1', _t.d);
   ```
2. Cronaca: `equip_evoluto` (Lv2→Lv3). `_t.s.giocatori[0].equip_istanze.arma.livello` → `3`.
3. Naviga a un nodo riposo (o simula la valutazione trigger):
   ```javascript
   _t.s = window.GED.valuta_trigger_forme_finali(_t.s, _t.d);
   ```
4. Cronaca: `forma_finale_disponibile` per SPADONE_VETERANO_SANGUE (trigger `libero` → sempre vero).
5. `_t.s.fase_corrente` → `'attesa_scelta_forma_finale'`.
6. `_t.s.giocatori[0].scelta_forma_pendente` → oggetto con `slot: 'arma'` e `opzioni` contenente `SPADONE_VETERANO_SANGUE`.
7. Conferma la forma:
   ```javascript
   const r = window.GED.conferma_forma_finale(_t.s, 'pg_1', 'arma', 'SPADONE_VETERANO_SANGUE', _t.d);
   _t.s = r.state;
   ```
8. Cronaca: `forma_finale_scelta: SPADONE_VETERANO_SANGUE`.
9. `_t.s.giocatori[0].equip_istanze.arma` → `{ livello: 3, forma_scelta_id: 'SPADONE_VETERANO_SANGUE', tag_correnti: ['taglio','impatto','taglio'] }` (tag aggiuntivi `taglio` della forma uniti).

**Risultato atteso:**
- Soglia Lv3: `essenze_per_lv3 = 5`. Con taglio=5, evoluzione Lv2→Lv3.
- `valuta_trigger_forme_finali` valuta SPADONE_SBILANCIANTE (trigger `kill_categoria=elite`, non soddisfatto) e SPADONE_VETERANO_SANGUE (trigger `libero`, sempre vero).
- Solo SPADONE_VETERANO_SANGUE appare nelle opzioni.
- Dopo `conferma_forma_finale`: fase torna a quella pre-scelta, `scelta_forma_pendente = null`.
- `sinergie_attive` rivalutata (i tag_correnti arma potrebbero cambiare).

**Segnali di fallimento:**
- `forma_finale_disponibile` non appare in Cronaca → trigger `libero` non valutato, o `valuta_trigger_forme_finali` non chiamata.
- SPADONE_SBILANCIANTE appare come opzione → trigger `kill_categoria=elite` erroneamente soddisfatto.
- Fase non torna a esplorazione dopo `conferma_forma_finale` → `fase_prima_di_scelta_forma` non ripristinata.

---

### T-16.7-03 — Forma finale condizionale — trigger kill_categoria=boss (post M1-fix)

**Punto roadmap:** §16.7 §5.11 + M1-fix (payload categoria nel log ko)

**Setup:** guerriero con EQP_AMULETO_CERVO (talismano) al Lv3 senza forma scelta. Instanzia un boss nel campo e uccidilo con essenze aggiornate:

```javascript
// Porta il talismano a Lv3
let s = _t.s;
s.giocatori[0].equip_istanze.talismano = { livello: 3, forma_scelta_id: null, tag_correnti: ['natura','luce'] };
// Aggiungi un boss finto nel log (simula il kill avvenuto in combattimento)
// oppure usa avvia_combattimento su nodo boss con PV ridotti
_t.s = s;
```

**Alternativa più pratica (Node):** copia `smoke_test_16_10.js`, aggiungi un combat con `NEM_DRUIDO_CORROTTO` (boss, PV ridotti a 1), uccidilo, poi chiama `valuta_trigger_forme_finali(state, db)`. Verifica nel log che `forma_finale_disponibile` includa `CERVO_SACRIFICIO` (trigger `kill_categoria=boss`).

**Passi (browser):**
1. Simula kill del boss nel log (M1-fix verifica che `payload.categoria` sia presente):
   ```javascript
   let s = _t.s;
   s.log.push({ id: s.log.length, tipo: 'ko', attore: null,
     bersaglio: 'nem_1_NEM_DRUIDO_CORROTTO',
     payload: { carta: 'NEM_DRUIDO_CORROTTO', categoria: 'boss' },
     testo_narrativo: 'Boss sconfitto.' });
   _t.s = s;
   ```
2. Chiama: `_t.s = window.GED.valuta_trigger_forme_finali(_t.s, _t.d)`.
3. Verifica `_t.s.giocatori[0].scelta_forma_pendente.opzioni` contiene `CERVO_SACRIFICIO`.

**Risultato atteso:**
- `valuta_trigger_forme_finali` cerca nel log eventi `ko` con `payload.categoria === 'boss'`.
- Con M1-fix applicato, il payload contiene `categoria: 'boss'` → trigger soddisfatto.
- `scelta_forma_pendente.opzioni` include sia `CERVO_SACRIFICIO` (boss kill) che `CERVO_SPIRITO` (solo con trigger `mondo`).

**Segnali di fallimento:**
- `scelta_forma_pendente.opzioni` non include `CERVO_SACRIFICIO` → trigger `kill_categoria` non legge `payload.categoria`, o M1-fix non portato nel bundle.
- Forma non disponibile nonostante il ko nel log → ricerca log per tipo `ko` non funziona.

---

### T-16.7-04 — Essenze insufficienti — nessuna evoluzione

**Punto roadmap:** §16.7 §5.11 (caso limite negativo)

**Setup:** guerriero con EQP_SPADONE_VETERANO Lv1, essenze taglio=2 (meno delle 3 richieste):
```javascript
let s = _t.s;
s.giocatori[0].essenze.taglio = 2;
_t.s = s;
```

**Passi:**
1. Verifica `equip_istanze.arma.livello` → `1`.
2. Chiama: `_t.s = window.GED.auto_evoluzione_equip(_t.s, 'pg_1', _t.d)`.
3. Verifica `equip_istanze.arma.livello` → ancora `1`.
4. Verifica `essenze.taglio` → ancora `2` (non consumate).
5. Cronaca: nessun `equip_evoluto`.

**Risultato atteso:**
- Con taglio=2 < soglia 3: nessuna evoluzione, livello invariato, essenze non consumate, nessun log.

**Segnali di fallimento:**
- Livello sale a 2 con solo 2 essenze → soglia letta in modo errato (off-by-one).
- Essenze consumate senza evoluzione → le essenze spariscono prima del controllo.

---

### T-16.9-01 — UI — badge "gratuito" e badge costo EN su attacco base

**Punto roadmap:** §16.9 §8 §5.2bis

**Setup:** avvia partita con seed `42`. Non servono prerequisiti per questo test (la UI funziona anche senza BUG-B1/B2).

**Passi:**
1. Avvia partita seed `42`. Vai al nodo 1 (combattimento). Clicca **Avvia combattimento**.
2. Verifica visivamente: la riga "Attacco base" compare nella zona azioni.
3. Il badge accanto al bottone mostra **gratuito** con sfondo verde.
4. Clicca **Attacco base** (se BUG-B2 non risolto: comparirà un alert di errore — normale, continua il test badge).
5. Se BUG-B2 risolto: dopo il click il badge cambia. Verifica colore e testo.

**Risultato atteso:**
- Prima del click: badge `gratuito` verde, bottone abilitato.
- Dopo il click: badge mostra `N EN` con sfondo blu (dove N = `costo_extra` dell'arma al livello attuale). Per EQP_SPADONE_VETERANO Lv1: `0 EN`.
- La riga "Attacco base" è nascosta quando la fase NON è `attesa_azione_pg` (es. durante il turno dei nemici).

**Segnali di fallimento:**
- Riga attacco base visibile anche durante la fase esplorazione o il turno nemici → `classList.toggle('nascosto')` non funziona.
- Badge non cambia dopo il click → `render_azioni()` non chiamata dopo l'azione, o flag non aggiornato.
- Badge mostra testo errato (es. `NaN EN`) → `_leggi_costo_extra_arma` non trova l'istanza.

---

### T-16.9-02 — UI — pillole essenze e pillole σ2 nella card PG

**Punto roadmap:** §16.9 §8 §5.11 §5.6.4

**Setup:** avvia partita seed `42`. Applica debug hook. Dopo aver avviato il combattimento, inietta essenze e sinergia:
```javascript
let s = _t.s;
s.giocatori[0].essenze.taglio = 5;
s.giocatori[0].essenze.fuoco = 2;
s.giocatori[0].sinergie_attive = ['SIN_ARMONIA_SOLARE'];
_t.s = s; // re-render automatico
```

**Passi:**
1. Osserva la card del PG 1 nell'area giocatori.
2. Verifica la presenza di pillole colorate con testo `taglio: 5` e `fuoco: 2`.
3. Verifica la presenza di una pillola viola con testo `SIN_ARMONIA_SOLARE`.
4. Inietta `essenze.luce = 0`: la pillola `luce` non deve comparire (solo valori > 0 sono mostrati).

**Risultato atteso:**
- Pillole essenze: una per ogni categoria con valore > 0. `taglio: 5` (grigio), `fuoco: 2` (rosso/arancio).
- I 6 tag elementali (fuoco, acqua, terra, aria, oscurita, luce) hanno colori dedicati via CSS `[data-tag="..."]`. I 4 fisici (taglio, impatto, perforante, energia) usano il colore grigio generico.
- Pillola σ2: viola, testo `SIN_ARMONIA_SOLARE`.
- Con `essenze.luce = 0`: nessuna pillola `luce`.

**Segnali di fallimento:**
- Nessuna pillola compare → `_render_essenze` o `_render_sinergie` non chiamate in `render_pg`.
- Pillole per categorie a 0 → filtro `> 0` assente.
- Pillola σ2 assente anche con `sinergie_attive` non vuoto → `_render_sinergie` non legge l'array.

---

### T-16.9-03 — UI — modale forma finale si apre e conferma scelta

**Punto roadmap:** §16.9 §8 §5.11

**Setup:** avvia partita seed `42`. Applica debug hook. Porta il PG1 alla fase `attesa_scelta_forma_finale`:
```javascript
let s = _t.s;
s.fase_corrente = 'attesa_scelta_forma_finale';
s.fase_prima_di_scelta_forma = 'esplorazione';
s.giocatori[0].scelta_forma_pendente = {
  slot: 'arma',
  equip_nome: 'Spadone del Veterano',
  opzioni: [
    { forma_id: 'SPADONE_VETERANO_SANGUE', nome: 'Lama Insaziabile',
      descrizione_narrativa: 'La spada beve il sangue...', tag_aggiuntivi: ['taglio'] },
    { forma_id: 'SPADONE_SBILANCIANTE', nome: 'Lama che Abbatte',
      descrizione_narrativa: 'Ogni fendente può mandarlo a terra.', tag_aggiuntivi: ['impatto'] },
  ]
};
_t.s = s; // render: apri_modale_forma_finale() chiamata automaticamente
```

**Passi:**
1. Il modale **scelta forma finale** deve aprirsi automaticamente (re-render chiama `apri_modale_forma_finale` quando fase = `attesa_scelta_forma_finale`).
2. Verifica titolo modale: `Errante 1: scegli la forma finale di Spadone del Veterano`.
3. Verifica due bottoni: "Lama Insaziabile" (con pillola `taglio`) e "Lama che Abbatte" (con pillola `impatto`).
4. Clicca **Lama Insaziabile**.
5. Modale si chiude. Cronaca mostra `forma_finale_scelta: SPADONE_VETERANO_SANGUE`.
6. Verifica `_t.s.fase_corrente` → `'esplorazione'` (ripristinata da `fase_prima_di_scelta_forma`).
7. Verifica `_t.s.giocatori[0].scelta_forma_pendente` → `null`.

**Risultato atteso:**
- Modale aperto con titolo e sottotitolo corretti.
- Due opzioni con nome, descrizione narrativa e pillola tag.
- Dopo selezione: modale chiuso, stato aggiornato, fase ripristinata.

**Segnali di fallimento:**
- Modale non si apre → `render()` non chiama `apri_modale_forma_finale()` quando fase è `attesa_scelta_forma_finale`.
- Bottoni non presenti → `pendente.opzioni` non iterato correttamente.
- Modale non si chiude → `chiudi_modale_forma_finale()` non chiamata dopo la selezione.
- Fase rimane `attesa_scelta_forma_finale` dopo la conferma → `fase_prima_di_scelta_forma` non ripristinata.

---

## Suggerimento: aggiungere dati CSV per sbloccare i test rimandati

Per trasformare i test rimandati in test eseguibili, è sufficiente aggiungere righe ai CSV (salvo dove indicato "richiede codice"). Non modificare le carte esistenti per non rompere gli scenari già funzionanti.

### SIN_GIURAMENTO_SACRO σ2 (richiede 2 slot con tag `sacro`)

**Problema:** nessuna arma ha tag `sacro`. Il talismano EQP_TALISMANO_LUCE ha `luce|sacro`, ma la soglia è 2 (entrambi gli slot devono avere `sacro`).

**Fix dati:** aggiungi in `equipaggiamenti.csv` una nuova arma:
```
EQP_LAMA_SACRA,Lama Sacra,arma,taglio|sacro,1,3,"[{""danno_base"":3,""costo_extra"":0,""effetto_speciale"":""Nessuno""},{""danno_base"":4,""costo_extra"":0,""effetto_speciale"":""Nessuno""},{""danno_base"":5,""costo_extra"":0,""effetto_speciale"":""Nessuno""}]","[]",guaritore,"Una lama benedetta, consacrata agli ordini sacri.",taglio|sacro
```
Con EQP_LAMA_SACRA (sacro) + EQP_TALISMANO_LUCE (sacro): SIN_GIURAMENTO_SACRO (soglia 2 sacro) si attiva.

### SIN_ANIMA_BRACE σ2 (richiede 2 slot con tag `fuoco`)

**Problema:** nessun talismano ha tag `fuoco`. EQP_BASTONE_ARCANO (arma) ha `fuoco|energia`, ma serve anche un talismano fuoco.

**Fix dati:** aggiungi in `equipaggiamenti.csv` un nuovo talismano:
```
EQP_AMULETO_FIAMMA,Amuleto di Fiamma,talismano,fuoco,1,3,"[{""danno_base"":null,""effetto_passivo"":{""op"":""nessuno""},""effetto_attivo"":null},{""danno_base"":null,""effetto_passivo"":{""op"":""nessuno""},""effetto_attivo"":null},{""danno_base"":null,""effetto_passivo"":{""op"":""nessuno""},""effetto_attivo"":null}]","[]",mago,"Un ciondolo che brucia al tatto.",fuoco
```
Con EQP_BASTONE_ARCANO (fuoco) + EQP_AMULETO_FIAMMA (fuoco): SIN_ANIMA_BRACE (soglia 2 fuoco) si attiva.

### Trigger `png_amico=PNG_GUARDIANO` (TALISMANO_RISONANZA)

**Problema:** non richiede dati aggiuntivi. Il trigger controlla `state.png_in_gioco.some(p => p.id === 'PNG_GUARDIANO')`. Basta iniettare il PNG nello stato prima di `valuta_trigger_forme_finali`:
```javascript
_t.s.png_in_gioco = [{ id: 'PNG_GUARDIANO', nome: 'Guardiano' }];
_t.s = window.GED.valuta_trigger_forme_finali(_t.s, _t.d);
```
Nota: il bonus da combattimento (`bonus_png_amico`) rimane 0 (helper stub) — il trigger della forma finale funziona ugualmente.

### Trigger `nodo_tipo=speciale` (BASTONE_TEMPESTA, PUGNALE_FANTASMA)

**Problema:** richiede una **modifica al codice**. `valuta_trigger_forme_finali` è chiamata solo nei nodi `riposo` e `tesoro`. Quando si valuta il trigger `nodo_tipo=speciale`, il nodo corrente è `riposo`, non `speciale` → trigger mai soddisfatto per design.

**Fix dati (test Node workaround):** senza toccare il codice, è possibile simulare la condizione iniettando il nodo corrente come `speciale`:
```javascript
// In Node, prima di chiamare valuta_trigger_forme_finali:
const idx_speciale = state.mappa.nodi.findIndex(n => n.tipo_nodo === 'speciale');
if (idx_speciale !== -1) state.mappa.nodo_corrente = idx_speciale;
// poi chiama valuta_trigger_forme_finali(state, db)
```
La vera soluzione richiede di chiamare `valuta_trigger_forme_finali` anche nei nodi speciali, oppure cambiare la semantica del trigger in "ha visitato un nodo speciale" (storico visitato).

### Aggiungere carte σ1 mancanti per classi non-guerriero

**Problema:** SIN_CORO_LUMINOSO (σ1, 2 carte sacro) è difficile da raggiungere per classi che non hanno `ATK_LUCE_PURGATRICE` nella pila iniziale. SIN_GELO_PROFONDO (σ1, 2 carte gelo) richiede 2× `ATK_LAMPO_GELO` (mago) in mano.

**Nessun dato da aggiungere** — le carte esistono già. Iniettare in mano da console con le carte già nel pool è sufficiente.

---

## Test rimandati

| ID | Nome | Motivo del rinvio |
|---|---|---|
| T-RIM-01 | σ2 SIN_GIURAMENTO_SACRO — 2 slot sacro | Nessuna arma con tag `sacro` nel pool CSV. Vedi suggerimento dati sopra. |
| T-RIM-02 | σ2 SIN_ANIMA_BRACE — 2 slot fuoco | Nessun talismano con tag `fuoco`. Vedi suggerimento dati sopra. |
| T-RIM-03 | Trigger `nodo_tipo=speciale` (BASTONE_TEMPESTA, PUGNALE_FANTASMA) | Richiede modifica al codice: `valuta_trigger_forme_finali` non è chiamata nei nodi speciali. Vedi suggerimento dati sopra. |
| T-RIM-04 | Trigger `png_amico=PNG_GUARDIANO` (TALISMANO_RISONANZA) | Iniettabile via console (vedi suggerimento). Il combattimento bonus rimane stub ma il trigger funziona. |
| T-RIM-05 | Abilità speciale NEM_LADRO_FORESTA ("sparisce nell'ombra") | PARKING_LOT_AI_ABILITA_SPECIALE: l'IA non esegue il comportamento speciale. Dati presenti nel CSV, codice assente. |
| T-RIM-06 | Bonus `regola_mondo`, `effetto_luogo`, `bonus_equipaggiamento` in pipeline | Helper stub in `combattimento.js` (ritornano sempre 0). Nessun dato da aggiungere: richiedono implementazione. |
| T-RIM-07 | Effetti condizionali abilità (pv_sotto_meta, ultima_pesca_ha_attacco) | PARKING_LOT_EFFETTI_AVANZATI: `_risolvi_abilita` usa regex sul testo narrativo, non legge `effetto_strutturato`. ABL_POSTURA_VETERANO (pv_sotto_meta) e ABL_RISVEGLIO_ARCANO (ultima_pesca) potrebbero non applicare la condizione correttamente. |
| T-RIM-08 | Interazione σ2 `applica_tag` + vulnerabilità nemica | SIN_ARMONIA_SOLARE ha `applica_tag: 'luce'`. Il tag NON viene propagato a `tag_fonte` (PARKING_LOT a `combattimento.js:1196`). Risultato: Lupo d'Ombra (vuln=luce) non riceve ×1.5 dall'attacco base con σ2 luce attiva. |

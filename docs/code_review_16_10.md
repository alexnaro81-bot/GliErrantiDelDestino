# Code Review — Gli Erranti del Destino (v0.6, step 16.1–16.10)

**Data:** 2026-05-21
**Scope:** motore/ (setup.js, combattimento.js, esplorazione.js, ai_nemici.js), web/app.js, data/ (CSV + sinergie.json), design doc Gli_Erranti_del_destino_v0_6.md
**Metodologia:** lettura integrale dei file, grep mirato, esecuzione Node.js read-only per verifica runtime

---

## Riepilogo esecutivo

Il refactor 16.x ha raggiunto la struttura architetturale prevista: PRNG deterministico, pipeline danno a 9 step, sinergie σ1/σ2, evoluzione equipaggiamento, fase bloccante per la scelta forma finale. Il pattern pure-functional è rispettato ai confini dei moduli (nessuna mutazione esterna senza clone) e `Math.random()` è assente ovunque. Rimangono **3 bug critici** che rendono inutilizzabile la versione v0.6 in una partita reale: `db.oggetti` è undefined e causa crash nei nodi tesoro; il trigger `nodo_tipo` confronta il campo sbagliato; i PG partono senza equipaggiamento, rendendo inerte l'intera meccanica centrale (attacco base, sinergie, evoluzione). Si contano inoltre **5 problemi medi** (debiti tecnici che producono comportamenti silenziosi sbagliati) e **4 suggerimenti** per la pulizia del codice.

---

## Problemi critici

### C1 — `db.oggetti` undefined a runtime: crash in nodi tesoro e carte v0.6

**File:** `combattimento.js:588`, `esplorazione.js:250`, `esplorazione.js:553`

**Descrizione:** Il refactor 16.1 ha sostituito `parse_oggetti` con `parse_equipaggiamenti` + `parse_consumabili`, eliminando `db.oggetti` dal database (confermato da `setup.js:31–33` e `setup.js:623–625`, che documentano esplicitamente la rimozione con un "TODO" di aggiornamento dei siti rimanenti). Tre siti non sono stati aggiornati:

```
combattimento.js:588   || db.oggetti.find(c => c.id === carta_id)
esplorazione.js:250    const pool = db.oggetti.filter(...)
esplorazione.js:553    || db.oggetti.find(c => c.id === carta_id)
```

Verifica runtime:
```
db.oggetti: UNDEFINED (TypeError al primo accesso)
db.equipaggiamenti: 5 items
db.consumabili: 2 items
```

**Perché è critico:** qualsiasi sessione di gioco che tocchi un nodo tesoro (`esplorazione.js:250`) o giochi una carta consumabile/equipaggiamento (`combattimento.js:588`) produce un crash non recuperabile (`TypeError: Cannot read properties of undefined (reading 'find')`). È il bug più diffuso e immediato.

**Fix suggerito:**
- `combattimento.js:588`: sostituire con `|| db.equipaggiamenti.find(c => c.id === carta_id) || db.consumabili.find(c => c.id === carta_id)`
- `esplorazione.js:250`: sostituire il pool con `db.equipaggiamenti.concat(db.consumabili).filter(...)`
- `esplorazione.js:553`: stessa sostituzione del sito 1

Nota: anche lo switch in `gioca_carta:660` manca dei case `'consumabile'` ed `'equipaggiamento'` (v0.6); aggiungere i resolver dopo aver risolto il lookup.

---

### C2 — Trigger `nodo_tipo` usa `nodo.tipo` (inesistente) invece di `nodo.tipo_nodo`

**File:** `combattimento.js:2551`

**Descrizione:**
```javascript
case 'nodo_tipo': {
    const nodo = state.mappa && state.mappa.nodi[state.mappa.nodo_corrente];
    return nodo ? nodo.tipo === param : false;   // BUG: campo inesistente
}
```

Il nodo costruito da `costruisci_mappa()` (`setup.js:863`) usa il campo `tipo_nodo`, coerentemente con tutto il resto del codice (es. `esplorazione.js:73: switch (nodo.tipo_nodo)`). Il campo `nodo.tipo` non esiste: il confronto restituisce sempre `undefined === param → false`.

**Perché è critico:** tutte le forme finali con trigger `nodo_tipo` sono permanentemente bloccate. Tra quelle colpite nei CSV attuali: `BASTONE_TEMPESTA` (trigger `nodo_tipo=speciale`) e `PUGNALE_FANTASMA` (trigger `nodo_tipo=speciale`). Essendo un fallimento silenzioso (nessun crash, solo `false`), il bug può passare inosservato per molte sessioni.

**Fix suggerito:** `combattimento.js:2551` → `return nodo ? nodo.tipo_nodo === param : false;`

---

### C3 — `PARKING_LOT_EQUIP_INIZIALE_CLASSE`: PG sempre senza equipaggiamento

**File:** `setup.js:1010–1018`

**Descrizione:** `_crea_pg()` lascia tutti gli slot a `null`:
```javascript
equipaggiamento: { arma: null, armatura: null, talismano: null },
equip_istanze:   { arma: null, armatura: null, talismano: null },
```

Conseguenze a cascata in una partita normale (non tramite test con iniezione manuale):
- `esegui_attacco_base()` → sempre `ERR_ARMA_NON_EQUIPAGGIATA`
- `valuta_sinergie_passive()` → `sinergie_attive = []` (nessuno slot equipaggiato → nessuna σ2 possibile)
- `auto_evoluzione_equip()` → no-op per tutti i PG
- Tutta la meccanica §5.2bis, §5.6, §5.11 è inerte in gioco reale

Questo non è un "nice-to-have": è il prerequisito per verificare che il refactor 16.x funzioni nella pratica. Ogni verifica finora (incluso il smoke test 16.10) ha richiesto l'iniezione manuale dell'equipaggiamento.

**Fix suggerito:** implementare in `_crea_pg()` la mappatura `classe → equip_iniziali`. I CSV di equipaggiamento hanno già un campo `classe_preferita` (`guerriero`, `mago`, `ladro`, `guaritore`, `universale`). La logica: selezionare un'arma e un talismano con `classe_preferita === classe || 'universale'`, assegnarli agli slot, creare le istanze a Lv1.

---

## Problemi medi

### M1 — Payload `ko` senza campo `categoria`: trigger `kill_categoria` sempre false

**File:** `combattimento.js:1796`

**Descrizione:** il log del kill di un nemico emette:
```javascript
s = _log_append(s, 'ko', null, morto.istanza_id, { carta: morto.carta_id }, ...);
```

Il commento a `combattimento.js:2531` documenta che `_trigger_forma_soddisfatto` cerca `ev.payload.categoria`:
```javascript
ev.payload && ev.payload.categoria === param
```

Ma `ev.payload` contiene solo `{ carta: morto.carta_id }`: nessun campo `categoria`. Conseguenza: le forme finali con trigger `kill_categoria` (`CERVO_SACRIFICIO`, `SPADONE_SBILANCIANTE`, `PUGNALE_VELENO`) non scatteranno mai, anche uccidendo boss o elite. L'unico trigger funzionante è `libero`.

**Fix suggerito:** in `pipeline_danno`, al kill del nemico (riga 1796), aggiungere `categoria` al payload:
```javascript
const carta_nem = _carta_nemico_da_id(morto.carta_id, db);
s = _log_append(s, 'ko', null, morto.istanza_id,
    { carta: morto.carta_id, categoria: carta_nem ? carta_nem.categoria : null }, ...);
```

---

### M2 — `_risolvi_arma_pg` usa sempre stats Lv1 ignorando `equip_istanze.livello`

**File:** `combattimento.js:736–780`, `combattimento.js:2340`

**Descrizione:** `_risolvi_arma_pg` legge la definizione dal DB (`db.equipaggiamenti.find(...)`) e la restituisce direttamente. `_costruisci_pseudo_attacco_base` usa poi `arma.livello || 1` — ma `arma.livello` è il livello di default nel CSV (sempre `1`). L'istanza con il livello reale (`pg.equip_istanze.arma.livello`) non viene mai consultata.

Risultato: dopo aver evoluto un'arma a Lv2 o Lv3, `esegui_attacco_base` continua ad usare `danno_base` e `costo_extra` del livello 1 invece del livello effettivo.

Il commento a riga 2340 recita "CHIUDE: PARKING_LOT_ARMA_ISTANZA" ma il PARKING_LOT originale a riga 733 ("in 16.7 questo helper dovrà leggere un'istanza") non è stato effettivamente chiuso. Il commento è fuorviante: `_materializza_istanza_se_serve` gestisce la creazione dell'istanza, ma `_risolvi_arma_pg` non la consulta.

**Fix suggerito:** in `_risolvi_arma_pg`, dopo aver trovato la definizione dell'arma, leggere l'istanza e il livello reale:
```javascript
const istanza = pg.equip_istanze && pg.equip_istanze.arma;
const livello = istanza ? istanza.livello : 1;
return { ok: true, arma: { ...arma, livello } };
```

---

### M3 — Campo `tag_sinergia` parsato ma mai letto dal motore

**File:** `setup.js:391, 422, 519, 562` (parsing), nessuna occorrenza nel motore

**Descrizione:** `parse_attacchi`, `parse_abilita`, `parse_consumabili` e `parse_equipaggiamenti` estraggono `tag_sinergia: to_array_pipe(r.tag_sinergia)` dalle carte. Nessuna funzione di `combattimento.js`, `esplorazione.js`, `ai_nemici.js` legge mai questo campo. Il motore usa il campo `tag` (colonna diversa nei CSV) per i match sinergie e vulnerabilità.

Non è un bug funzionale (è dead code a livello di utilizzo), ma crea confusione: i CSV hanno due colonne tag distinte (`tag` e `tag_sinergia`) senza documentazione della differenza.

**Fix suggerito:** decidere se `tag_sinergia` è un campo riservato per un futuro meccanismo (documentarlo nel CSV con commento) oppure rimuoverlo dal parsing per pulizia.

---

### M4 — `bonus_carte_prossimo_turno` pesca oltre il limite di mano senza scarto

**File:** `combattimento.js:527–545`

**Descrizione:** `inizio_turno_pg()` applica il bonus carte con:
```javascript
// Pesca diretta senza limite (semplificazione MVP)
while (pg_now.mano.length < dimensione_mano + bonus_carte_prossimo_turno) {
    // ...pesca...
}
```

Il design doc §5.4 prevede che le carte in eccesso rispetto alla dimensione mano vengano scartate con log `scarto_per_mano_piena`. Il codice invece pesca tutti i bonus senza limite effettivo superiore: un PG con `dimensione_mano=5` e `bonus=3` pescerebbe fino a 8 carte, con possibili squilibri nel bilanciamento se il bonus si accumula su più round.

Il commento "semplificazione MVP" suggerisce che la limitazione sia intenzionale per ora, ma non è documentata come decisione di design permanente.

**Fix suggerito:** aggiungere log `scarto_per_mano_piena` dopo la pesca se `mano.length > dimensione_mano`, oppure documentare esplicitamente che il limite non viene applicato come variante di design.

---

### M5 — Inconsistenza grafica nei tag CSV: `furtivita` vs `furtività`

**File:** `attacchi.csv:7–8`, `nemici.csv:3`, `equipaggiamenti.csv:5`

**Descrizione:** la stessa parola appare con e senza accento in colonne diverse dello stesso file:
- `ATK_COLTELLO_AVVELENATO` tag_sinergia: `veleno|furtività` (con accento)
- `ATK_COLPO_DALL_OMBRA` tag: `taglio|furtivita` (senza accento)
- `NEM_LADRO_FORESTA` resistenza: `furtivita|veleno`, essenza_drop: `furtivita|impatto`
- `EQP_PUGNALE_OMBRA` tag_sinergia: `furtività|veleno`

Il confronto tag è stringa-stringa (case-sensitive, no normalizzazione), quindi `furtività !== furtivita`. Oggi nessuna sinergia usa `furtivita/furtività` come tag condizione, quindi il bug non produce effetti visibili. Ma se venissero aggiunte sinergie con questo tag, i match potrebbero fallire silenziosamente.

**Fix suggerito:** normalizzare a `furtivita` (senza accento, coerente con i 10 tag ufficiali e con i nemici) in tutti i CSV. Aggiungere una validazione nel parser che avverta se un tag contiene caratteri accentati.

---

## Suggerimenti

### S1 — Commento "CHIUDE: PARKING_LOT_ARMA_ISTANZA" fuorviante a riga 2340

**File:** `combattimento.js:2340`

Il commento afferma che il PARKING_LOT è chiuso, ma il PARKING_LOT originale a riga 733 non è stato rimosso e descrive ancora un lavoro da fare. Il mismatch causa confusione su cosa sia effettivamente implementato. Risolvere eliminando il commento alla riga 733 (o aggiornandolo con un riferimento a M2 sopra) e precisando a riga 2340 che il PARKING_LOT è chiuso *parzialmente* (la struttura dell'istanza esiste, ma `_risolvi_arma_pg` deve ancora leggerla).

---

### S2 — `require('./combattimento')` dentro funzioni in `esplorazione.js`

**File:** `esplorazione.js:115, 191`

Due `require('./combattimento')` sono dentro il corpo delle funzioni `risolvi_nodo_riposo` e `risolvi_nodo_tesoro` invece che in cima al file. Node.js gestisce i require circolari via cache parziale, ma questo pattern è fragile in caso di refactoring del grafo di dipendenze. Non è un bug oggi, ma diventa un rischio se le funzioni vengono spostate o se il modulo viene caricato in ambienti diversi (es. worker thread).

**Fix suggerito:** spostare i require in cima a `esplorazione.js` con un commento esplicito sulla dipendenza circolare.

---

### S3 — `PARKING_LOT_REMOVE_ADAPTER` per `_applica_danno`

**File:** `combattimento.js:1830–1833`

L'adapter `_applica_danno()` (compatibilità con la firma v0.5) è ancora presente con il suo marker `PARKING_LOT_REMOVE_ADAPTER`. Tutti i chiamanti interni dovrebbero già usare direttamente `pipeline_danno`. Prima di rimuoverlo, eseguire un grep per confermare che nessun file esterno lo chiami ancora (incluso `web/app.js`).

---

### S4 — `_risolvi_abilita` usa regex su testo narrativo per determinare effetti meccanici

**File:** `combattimento.js:974–1038`

La funzione legge stringhe come `"cura 3 PV"` o `"applica scudo"` con pattern `desc.includes('scudo')` e `desc.match(/pesca\s+(\d+)/)`. Il marker `PARKING_LOT_EFFETTI_AVANZATI` è già presente. Non è un bug nell'attuale pool di carte ma è un rischio strutturale: un'abilità con "scudo" nella narrativa ma non come effetto meccanico applicherebbe erroneamente lo status. Considerare un campo `effetto_strutturato` nel CSV prima di ampliare il pool oltre le 5 carte attuali.

---

## Mappa di rischio

| Priorità | Area | Perché è fragile |
|---|---|---|
| **R1** | Lookup `db.oggetti` (3 siti) | Crash immediato in nodi tesoro e carte v0.6. Zero tolleranza. |
| **R2** | Catena `esegui_attacco_base` → `_risolvi_arma_pg` → `_costruisci_pseudo_attacco_base` | Tre funzioni concatenate che ignorano il livello reale dell'arma. Qualsiasi modifica a `equip_istanze` potrebbe non riflettersi sul danno effettivo dell'attacco base senza toccare `_risolvi_arma_pg`. |
| **R3** | `pipeline_danno` (hub centrale a 9 step) | Tutte le meccaniche di danno convergono qui (PG, nemici, attacco base, carte). L'ordine dei 9 step è fisso e implicito nel codice: non è documentato come invariante né coperto da test automatici. Un cambio di ordine rompe silenziosamente il bilanciamento. |
| **R4** | Sistema forme finali end-to-end | Dipende da 3 presupposti non tutti soddisfatti: (a) slot equipaggiati (C3), (b) livello reale letto in `_risolvi_arma_pg` (M2), (c) trigger `nodo_tipo` corretto (C2), (d) payload `ko` con `categoria` (M1). Tutti e quattro devono essere corretti prima che il sistema sia testabile realisticamente. |
| **R5** | `_avanza_turno_o_nemici` (FSM combattimento) | La condizione `prossimo <= s.turno_di` è non-ovvia e non ha commento che spieghi il ragionamento. Qualsiasi cambiamento al numero di PG, gestione KO, o ordine di turno potrebbe introdurre regressioni nella macchina a stati senza evidenza immediata. |

---

## Top 3 problemi urgenti

### 1. `db.oggetti` (C1) — Fix immediato prima di qualsiasi test giocato

È l'unico crash garantito. Può essere risolto in 10 minuti toccando 3 righe su 3 file. Blocca qualsiasi test con nodi tesoro o carte consumabili.

### 2. `PARKING_LOT_EQUIP_INIZIALE_CLASSE` (C3) — Prerequisito per testare tutto il resto

Senza arma equipaggiata, l'attacco base è sempre bloccato, le sinergie σ2 non scattano, l'evoluzione non parte. Tutte le meccaniche centrali di v0.6 (§5.2bis, §5.6, §5.11) non sono verificabili in gioco reale. Questo va risolto prima della Step 17: non ha senso aggiungere un secondo mondo se il primo non è giocabile.

### 3. `nodo.tipo` vs `nodo.tipo_nodo` (C2) + payload `ko` senza `categoria` (M1) — Forme finali completamente rotte

Questi due bug silenziosi insieme fanno sì che delle 4 forme finali presenti nei CSV con trigger narrativi (`BASTONE_TEMPESTA`, `PUGNALE_FANTASMA`, `CERVO_SACRIFICIO`, `SPADONE_SBILANCIANTE`), nessuna sia sbloccabile in gioco. Solo i trigger `libero` funzionano. Entrambi i fix sono di 1–2 righe. Conviene affrontarli insieme nello stesso sotto-step.

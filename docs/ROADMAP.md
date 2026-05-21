# ROADMAP — Gli Erranti del Destino

Documento di stato dello sviluppo. **Fonte di verità del progresso** per le chat con Claude. Da tenere sempre nel Project Knowledge, accanto al regolamento Gli_Erranti_del_destino_v0_6.docx e ai file del motore.

## ISTRUZIONI PER CLAUDE (leggere SEMPRE per prime)

Quando l'utente apre una nuova conversazione e scrive frasi come "prossimo step", "continuiamo lo sviluppo", "vedi roadmap", o simili, Claude:

- **Legge questo file** (è già nel Project Knowledge, basta una project_knowledge_search su "ROADMAP").

- **Identifica il prossimo sotto-step ****[ ]**** o ****[~]** nella tabella qui sotto. La numerazione (es. 16.3) è la chiave canonica per riferirsi al lavoro.

- **Legge i file di codice rilevanti** del Project per quel sotto-step prima di scrivere qualsiasi codice. Il regolamento v0.6 è la fonte di verità per le regole di gioco; questo file è la fonte di verità per *cosa è già stato fatto*.

- **Lavora con il pattern dell****'****utente**: codice → verifica esecuzione → conferma → prossimo. Un sotto-step alla volta. Non incatenare.

- **A fine sotto-step**: dice all'utente esattamente cosa modificare in questo file (es. "cambia la riga 16.3 da [ ] a [x] e ricarica il file nel Project"). Non chiede di aggiornare il file da solo: il file resta sotto controllo umano.

- **Convenzioni di codice irrinunciabili** (l'utente è non-tecnico):

- Commenti in italiano, sempre.

- Riferimenti espliciti alle sezioni del regolamento nei commenti (es. // §5.7 step 4: match tag vs vuln/res).

- Pattern pure-functional: clone-at-entry alle funzioni esposte, _log_append in place, funzioni interne in place sul clone già fatto.

- PRNG deterministico (mulberry32), rng_state sempre nello state.

- Features deferred → commento // PARKING_LOT_NOME_BREVE: ….

## STATO COMPLESSIVO

| **Step macro** | **Stato** | **Note** |
| --- | --- | --- |
| 1-10 (motore v0.4) | ✅ Completato | setup, combat, AI, esplorazione, eventi, UI, build, launcher |
| 11 (v0.5 — narratore statico) | ⏸️ Rinviato | Ripreso dopo lo Step 16 |
| **16 (v0.6 — refactor Fase Combattimento)** | 🟡 **IN CORSO** | Dati CSV già autorati. Motore da aggiornare. |
| 17 (secondo mondo) | 📋 Pianificato | Dopo Step 16 |
| 18 (salvataggio/replay localStorage) | 📋 Pianificato | Dopo Step 16 |

## STEP 16 — Refactor Fase Combattimento (v0.6)

Riferimento principale: **§5.2bis, §5.6, §5.7, §5.11 del regolamento v0.6**. Riepilogo del changelog v0.6: passaggio da "carte = unica fonte di danno" a modello RPG con mano (arma → attacco base, carte → manovre speciali) + pipeline danno a 9 step + sinergie σ1/σ2 + evoluzione equipaggiamento.

### Dati già pronti (authoring CSV completato dall'utente)

- ✅ nemici.csv con vulnerabilita, resistenza, essenza_drop

- ✅ attacchi.csv con tag, applica_status, ignora_difesa, ignora_scudo

- ✅ abilita.csv con salta_step_tag

- ✅ equipaggiamenti.csv separato, con tag, livello, livello_max, stats_per_livello (JSON), forme_finali (JSON)

- ✅ consumabili.csv separato

- ✅ luoghi.csv con vulnerabilita_luogo, resistenza_luogo

- ✅ mondi.csv (elemento già presente; vuln/res mondo da verificare in 16.1)

- ✅ classi.csv, lessico_elementi.csv (per Step 19 narratore)

### Sotto-step di codice

Procedere **in ordine**. Ogni sotto-step è testabile da solo prima del successivo. Spunta [x] solo dopo verifica esecuzione.

| **#** | **Stato** | **Sotto-step** | **File toccati** | **Riferimenti regolamento** | **Criterio di ****"****fatto****"** |
| --- | --- | --- | --- | --- | --- |
| 16.1 | [ x] | **Fondazioni**: aggiornare config.json (moltiplicatore_vulnerabilita, moltiplicatore_resistenza), aggiornare parser CSV (parse_attacchi, parse_abilita, parse_nemici, parse_luoghi, parse_mondi) per leggere i nuovi campi, sdoppiare parse_oggetti in parse_equipaggiamenti (con parsing JSON di stats_per_livello e forme_finali) + parse_consumabili, aggiornare _crea_pg per PGState v0.6 (essenze: {…}, sinergie_attive: [], attacco_base_gratuito_consumato_questo_turno, carte_giocate_per_tag_turno, slot talismano al posto di accessorio). | config.json, setup.js | §1.2 §1.3 §1.7 §1.8 §1.9 §1.9bis §1.10 §2.2 | node setup.js (o equivalente test bootstrap) carica tutti i CSV senza errori; ispezione del GameState mostra i nuovi campi popolati con default corretti. |
| 16.2 | [x] | **Sinergie data**: riscrivere sinergie.json da zero con schema v0.6 (record con id, tipo σ1/σ2, condizione, effetto). Popolare 5-8 sinergie minime per testare il motore (poi authoring incrementale). | sinergie.json | §5.6.2 §5.6.3 §5.6.5 | File parsabile come JSON, ogni record valida lo schema §5.6. Nessun codice ancora. |
| 16.3 | [x] | **pipeline_danno() a 9 step**: sostituire _applica_danno con la nuova pipeline_danno() interna (step 1 base, 2 modificatori attaccante additivi, 3 status attaccante moltiplicativi, 4 match tag vs vuln/res, 5 status target moltiplicativi, 6 difesa sottrattiva, 7 scudo, 8 applica danno a PV, 9 side effects post-danno). Helper bonus_regola_mondo, bonus_effetto_luogo, bonus_equipaggiamento, bonus_png_amico, bonus_sinergia_attiva (stub iniziale; le sinergie si agganciano in 16.5/16.6). | combattimento.js, eventualmente config.json | §5.7 §7.1 | Smoke test con seed fisso: stessi danni di prima dove non ci sono tag, danni diversi (×1.5 / ×0.5) dove vuln/res si attiva. Niente regressioni nei test esistenti. |
| 16.4 | [x] | **esegui_attacco_base()**: nuovo entry point del motore (§5.2bis). Aggiungere azione attacco_base nella macchina a stati ATTESA_AZIONE_PG. Il primo attacco base di ogni turno è gratuito; quelli successivi costano arma.costo_extra EN. Costruzione dello pseudo-attacco_base a partire dall'arma equipaggiata e invocazione di pipeline_danno. | combattimento.js | §5.1 §5.2bis §5.7 | Il PG senza giocare carte può attaccare 1×/turno gratis. Se attacca una seconda volta, paga costo_extra. Flag attacco_base_gratuito_consumato_questo_turno si resetta a inizio turno. |
| 16.5 | [x] | **Sinergie σ2 (passive di equipaggiamento)**: valuta_sinergie_passive(state, pg_id) invocata a equip/unequip/evoluzione + inizio combattimento + inizio turno PG. Popola/svuota pg.sinergie_attive. La pipeline_danno step 2 le usa via bonus_sinergia_attiva (completare lo stub di 16.3). | combattimento.js | §5.6.4 §5.7 step 2 | Equipaggiando 2 oggetti con tag che soddisfano una σ2 di sinergie.json → sinergie_attive contiene l'id; togliendone uno → l'id sparisce. Il bonus si vede nel danno. |
| 16.6 | [x] | **Sinergie σ1 (multi-carta in turno)**: valuta_sinergie_attive(state, pg_id, carta) invocata al termine dello step 9 della pipeline_danno. Aggiorna pg.carte_giocate_per_tag_turno. Quando una soglia è raggiunta, applica l'effetto (es. setta bonus_prossima_carta_tag). Reset del contatore a fine turno PG. | combattimento.js | §5.6.4 §5.7 step 9 | Giocare 3 carte con stesso tag in un turno → effetto σ1 scatta (log "sinergia_attivata"). |
| 16.7 | [x] | **Evoluzione equipaggiamento**: auto_evoluzione_equip() (salita livello via essenze, in automatico quando soglia raggiunta) + flusso scelta forma_finale al Lv3 (interruzione del flusso normale, attesa scelta dell'utente, applicazione del ramo evolutivo scelto, rivalutazione σ2). | combattimento.js, esplorazione.js | §5.11 §1.9 (RamoEvolutivo) | Sconfitto nemico → essenze nel pool del PG. Al raggiungimento delle soglie di stats_per_livello → livello sale automaticamente. Al Lv3 → prompt scelta tra le forme_finali definite nel CSV. Dopo scelta → rivalutazione σ2 immediata. |
| 16.8 | [x] | **Debito tecnico ****_DB_REF**: rimuovere la variabile globale di modulo settata da avvia_combattimento. Passare db esplicitamente lungo la catena del ciclo turno (fino a esegui_comportamento in ai_nemici.js). Refactor puro: comportamento invariato. | combattimento.js, ai_nemici.js | §10.x parking lot v0.6 | grep su _DB_REF in tutto il codice → zero risultati. Tutti i test esistenti continuano a passare. |
| 16.9 | [x] | **UI v0.6**: pulsante "Attacco base" sempre visibile durante il turno PG (con indicatore "gratuito" / "costa N EN"), indicatore essenze accumulate, indicatore sinergie σ2 attive, schermata di scelta forma_finale al Lv3. Aggiornare anche etichette degli slot equipaggiamento (talismano al posto di accessorio). | index.html, style.css, app.js | §5.2bis §5.11 §8 | Playtest visuale: tutto cliccabile, niente console error, flusso completo dall'attacco base alla scelta forma finale. |
| 16.10 | [X] | **Rebuild + smoke test full run**: rilancio build_browser.js, partita end-to-end con seed deterministico, verifica che il log eventi contenga le nuove voci ("essenza_droppata", "sinergia_attivata", "equip_evoluto", "forma_finale_scelta"). | build_browser.js, browser | tutto §5 | Una run completa con almeno: 1 attacco base, 1 sinergia σ1 attivata, 1 sinergia σ2 attiva, 1 evoluzione di livello, 1 scelta forma finale, 1 boss sconfitto. |

### PARKING LOT — apertura/chiusura durante lo Step 16

- 🔒 **da chiudere durante 16.x**: PARKING_LOT_SINERGIE (chiuso da 16.5+16.6), PARKING_LOT_PIPELINE_MODIFICATORI (chiuso da 16.3), _DB_REF (chiuso da 16.8), PARKING_LOT_MIGRAZIONE_OGGETTI (chiuso, già fatto a livello dati).

- 🔓 **ancora aperti dopo Step 16**: PARKING_LOT_EFFETTI_AVANZATI, PARKING_LOT_AI_ABILITA_SPECIALE, PARKING_LOT_RICOMPENSE, PARKING_LOT_RIVELA_NODO, PARKING_LOT_TWIST_AVANZATI, PARKING_LOT_SINERGIE_POOL_INIZIALE (authoring continuo), PARKING_LOT_ESSENZE_DROP_TABLE (bilanciamento).

## STEP SUCCESSIVI (sintesi, non ancora dettagliati)

- **Step 17 — Secondo mondo** (es. Cime Frangenti / aria): authoring CSV per un secondo Mondo, con luoghi, nemici, eventi, PNG, twist dedicati. Ampliamento dataset, nessun cambio motore.

- **Step 18 — Salvataggio + replay su localStorage**: §9.2 (snapshot GameState), §9.4 (replay da seed + log eventi). UI: pulsanti salva/carica/replay.

- **Step 19 — Strato narrativo statico (v0.5)**: §13 completo. Modulo motore/narratore.js, integrazione di classi.csv e lessico_elementi.csv, schermate prologo/raccordo/banner/epilogo. Authoring offline dei campi narrativi sulle carte esistenti seguendo §14.

## CONVENZIONI DI LAVORO (riepilogo per l'utente)

- Una conversazione = un sotto-step. Non incatenare.

- A fine sotto-step: aggiorno io (Claude) ti dico la riga da cambiare, tu salvi il file, ricarichi nel Project Knowledge, chiudi la chat.

- Se cambio un file .js durante un sotto-step, lo ricarichi nel Project alla fine, così le chat successive vedono la versione vera.

- Il regolamento Gli_Erranti_del_destino_v0_6.docx è la fonte di verità per le regole; questo ROADMAP.md è la fonte di verità per il *progresso*.
# Gli Erranti del Destino — Convenzioni di progetto

## Cos'è
Gioco di carte fantasy roguelike. Motore Node.js + UI browser + launcher Linux.
Design document: Gli_Erranti_del_destino_v0_6.md (versione corrente, §1–§12 numerate).

## Documento di design
Il design document completo è `Gli_Erranti_del_destino_v0_6.md`.
È la fonte di verità per tutte le meccaniche, suddiviso in sezioni §1–§12.
Quando ti chiedo di implementare qualcosa, prima leggi la sezione
specifica del documento (es. "implementa §7.3" → apri il docx alla §7.3).
Non caricare l'intero documento: leggi solo le sezioni richieste.

## Regole NON NEGOZIABILI per il codice
- TUTTI i commenti in italiano.
- Ogni blocco logico ha un riferimento alla sezione del design doc, es.:
  // §5.7 punto 4: applica difesa del bersaglio
- Pattern pure-functional ai confini dei moduli: ogni funzione esposta
  clona lo state in ingresso e ritorna il clone modificato. NO mutazione
  in place al confine. Eccezione documentata: _log_append.
- PRNG deterministico: mulberry32 con rng_state dentro GameState.

## Struttura
- motore/ — logica di gioco (setup, combattimento, ai_nemici, esplorazione, eventi_mondo)
- data/ — CSV (sorgente dati); Node usa csv-parse/sync, browser usa parser custom
- strumenti/build_browser.js — genera motore_bundle.js per il browser
- launcher/ — erranti.sh e install_desktop.sh

## File da NON toccare salvo richiesta esplicita
- motore_bundle.js (generato)
- node_modules/

## Workflow preferito
- "Codice + verifica esecuzione" a ogni step.
- Feature rimandate marcate con // PARKING_LOT_*
- Transizione fine_combattimento gestita dentro il motore, non dalla UI.

## Versionamento git

Il progetto è sotto controllo versione git. Alla fine di ogni sessione
che abbia portato a uno stato funzionante:

1. Esegui `git status` e mostrami cosa è cambiato.
2. Proponimi un messaggio di commit descrittivo in italiano, che
   indichi il punto di roadmap completato o la natura della modifica.
3. Attendi mia conferma del messaggio prima di committare.
4. Esegui `git add .` e `git commit -m "..."` con il messaggio approvato.

NON fare mai `git reset --hard`, `git push --force`, o altre operazioni
distruttive senza istruzione esplicita da parte mia.

Prima di iniziare un refactor o un cambiamento strutturale grosso,
suggerisci di fare prima un commit dello stato corrente come punto
di ritorno.

## Lingua
Rispondi sempre in italiano, sia nei messaggi in chat sia nei commenti
del codice. Mantieni in inglese solo gli identificatori tecnici
(nomi di funzioni, variabili, comandi shell).

## Modello da usare
Default: sonnet. Per refactor architetturali o debug cross-modulo: opus.
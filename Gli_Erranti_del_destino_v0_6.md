\*\*GLI ERRANTI DEL DESTINO\*\*

\*Framework Regole v0.6 --- Documento Unico\*

## Changelog v0.6 (rispetto a v0.5)

Integrazione completa della \*\*Fase Combattimento\*\* decisa in
sessione dedicata (documento sorgente:
\`Erranti_FaseCombattimento_v0_X.docx\`). Le decisioni della sessione
sono state incorporate nelle sezioni di riferimento del documento
principale, sostituendone le versioni v0.4/v0.5. Il modello di
combattimento passa da \"carte = unica fonte di danno\" a \*\*RPG con
mano (Modello B+)\*\*: l\'arma equipaggiata fornisce un attacco base
ricorrente, le carte Attacco diventano manovre speciali.

Nessun nuovo capitolo è stato aggiunto: tutto il contenuto del documento
di sessione è stato distribuito nelle sezioni esistenti (§1, §2, §5, §7,
§11, §13).

### Cambiamenti meccanici principali

\- \*\*§1.7 CardAttacco\*\* --- aggiunto il campo \`tag\` (elementale +
fisico) per il match vulnerabilità/resistenza nella pipeline danno
(§5.7). Le carte Attacco diventano \*manovre speciali\*: devono avere un
effetto secondario, target multipli, condizione, o danno elevato per
giustificarsi rispetto all\'attacco base dell\'arma.

\- \*\*§1.8 CardAbilità\*\* --- aggiunto il flag \`salta_step_tag\` per
le abilità che fanno danno \"puro\" (non legato a un\'arma).

\- \*\*§1.9 CardOggetto è stata SPLITTATA in due schemi distinti\*\*:

\- \*\*§1.9 CardEquipaggiamento\*\* --- equipaggiabile, sostituisce il
vecchio CardOggetto per gli oggetti che occupano uno slot. Aggiunge
\`tag\`, \`livello\`, \`livello_max\`, \`stats_per_livello\`,
\`forme_finali\` (RamoEvolutivo).

\- \*\*§1.9bis CardConsumabile\*\* --- uso singolo dalla mano, va negli
scarti dopo l\'uso. Non occupa slot.

\- \*\*§1.10 CardNemico\*\* --- aggiunti \`vulnerabilita\`,
\`resistenza\`, \`essenza_drop\`. Estensione analoga (vuln/res a livello
di mondo e luogo) propagata a CardMondo (§1.2) e CardLuogo (§1.3).

\- \*\*§2.2 PGState\*\* --- riallineamento degli slot di equipaggiamento
(\`arma\`, \`armatura\`, \`talismano\` --- sostituisce \`accessorio\`).
Aggiunti \`essenze\` (10 categorie),
\`attacco_base_gratuito_consumato_questo_turno\`, \`sinergie_attive\`.
Il campo \`bonus_carte_prossimo_turno\` di v0.4 resta invariato.

\- \*\*§5.1 macchina a stati\*\* --- aggiunte azioni \`attacco_base\` e
\`usa_talismano_attivo\` nella fase ATTESA_AZIONE_PG.

\- \*\*§5.2bis (NUOVA)\*\* --- \`esegui_attacco_base()\`: il PG può
tirare un attacco base gratuito per turno, eventuali attacchi extra
costano \`arma.costo_extra\` EN.

\- \*\*§5.5 gioca_carta()\*\* --- switch esteso al nuovo CardConsumabile
e CardEquipaggiamento (con sotto-effetti su equip/dequip/evoluzione che
attivano la rivalutazione delle sinergie σ2).

\- \*\*§5.6 sinergie\*\* --- sistema completo a due famiglie: \*\*σ1\*\*
(multi-carta in turno) e \*\*σ2\*\* (pattern di equipaggiamento). Pool
MVP: 15-20 sinergie. Lo schema \`sinergie.json\` è strutturato con
\`condizione\` + \`effetto\` + tassonomie esplicite (§5.6.2, §5.6.3).

\- \*\*§5.7 pipeline_danno()\*\* --- pipeline canonica a \*\*9 step in
ordine fisso\*\* che sostituisce la vecchia \`applica_danno()\`.
Aggiunge match tag vs vuln/res come step 4, e formalizza i side effects
post-danno (drop essenze, aggiornamento \`danni_per_pg\`, valutazione
σ1).

\- \*\*§5.11 (NUOVA)\*\* --- Evoluzione equipaggiamento: meccanica a due
fasi (salita livello via essenze → scelta ramo finale al Lv3 con trigger
narrativo).

\- \*\*§7.1 pipeline modificatori\*\* --- riallineata alla nuova
pipeline_danno; vulnerabilità/resistenze di mondo e luogo si sommano a
quelle del nemico.

### Cambiamenti documentali

\- \*\*§0.2 glossario\*\* --- aggiunti i nuovi token-handle: ESSENZE,
TAG, SLOT, FORMA_FINALE, σ1, σ2, ATTACCO_BASE.

\- \*\*§11 \# EXT registry\*\* --- aggiunti \`EXT_TRIGGER_COMPOSTI\`,
\`EXT_IMMUNITA\`, \`EXT_SINERGIE_MULTI_PG\`,
\`EXT_CONDIZIONI_SINERGIA\`, \`EXT_BUFF\`.

\- \*\*§13.2.7 (rinominata e ampliata)\*\* --- i campi narrativi sono
ora distribuiti su due tabelle: §13.2.7 CardEquipaggiamento e §13.2.7bis
CardConsumabile.

\- \*\*§10.x parking lot\*\* --- \`PARKING_LOT_SINERGIE\` viene
\*\*chiuso\*\* (le sinergie sono ora specificate). Si aggiungono nuovi
parking lot: \`PARKING_LOT_ESSENZE_DROP_TABLE\`,
\`PARKING_LOT_EVOLUZIONE\`, \`PARKING_LOT_CLASSI_PG\`.

\- \*\*§12 checklist\*\* --- aggiunto Step 16 (refactor combattimento
v0.6) come prossima azione operativa per chi implementa.

\### Note di compatibilità e migrazione dati

\- I CSV \`attacchi.csv\` e \`abilita.csv\` esistenti restano
\*\*compatibili in lettura\*\*: il campo \`tag\` viene aggiunto come
opzionale (default = \[\]), il flag \`salta_step_tag\` come opzionale
(default = false). Tuttavia: per beneficiare del nuovo sistema vuln/res
è raccomandato \*\*arricchire\*\* le carte esistenti con tag
elementali/fisici.

\- Il CSV \`oggetti.csv\` richiede una \*\*migrazione\*\*: split in
\`equipaggiamenti.csv\` (record con tipo_oggetto=equipaggiamento del
v0.5) e \`consumabili.csv\` (record con tipo_oggetto=consumabile). I
record \`slot=accessorio\` migrano a \`slot=talismano\`.

\- Il CSV \`nemici.csv\` richiede aggiunta colonne \`vulnerabilita\`,
\`resistenza\`, \`essenza_drop\` (default = \[\] per
retro-compatibilità).

\- Il file \`sinergie.json\` (oggi vuoto) deve essere popolato secondo
lo schema di §5.6.

\- Lo strato narrativo statico (§13, v0.5) \*\*resta valido\*\*: viene
solo arricchito da §13.2.7bis per i consumabili.

\## Changelog v0.5 (rispetto a v0.4)

Estensione narrativa: introduzione dello \*\*strato narrativo
statico\*\* (§13), generato offline dall\'AI in fase di authoring e
riusato senza costi a runtime. Non sono cambiate meccaniche di gioco ---
è cambiato come il gioco \*racconta\* le sue meccaniche.

Aggiunte principali:

\- \*\*§13 --- Strato narrativo statico (nuovo capitolo)\*\*: tassonomia
narrativa universale, estensioni agli schemi delle carte, due nuove
tabelle dati (classi.csv, lessico_elementi.csv), libreria di
prompt-pattern per l\'authoring AI offline.

\- \*\*Convenzione campi di authoring \`\_\*\`\*\* (§1.11.1, §13.0): i
campi CSV il cui nome inizia con underscore sono campi di authoring (es.
\`\_briefing_autore\`), ignorati dal parser di gioco. Servono come
briefing umano per l\'AI di authoring offline.

\- \*\*Campo \`\_briefing_autore\`\*\* in tutte le carte che hanno campi
narrativi derivati (Mondo, Luogo, Nemico, Evento, PNG, Twist,
Equipaggiamento, Consumabile, Classe). Contiene la visione creativa
dell\'autore umano, in cinque registri: concetto-cuore, atmosfera,
riferimenti, vincoli, tono linguistico.

\- \*\*Nuovo modulo previsto motore/narratore.js\*\* (§13.8): genera
prologo, raccordi tra nodi, commenti agli eventi chiave, epilogo,
attingendo dai campi narrativi pre-generati. Zero chiamate AI a runtime,
completamente deterministico via rng_state.

\- \*\*Estensione §2.1 GameState\*\* con i campi \`memoria_narrativa\`
(max 5 elementi) e \`atto_corrente\` (1\|2\|3), utilizzati dal narratore
per i callback testuali e la modulazione tonale a tre atti.

\- \*\*§14 (nuovo)\*\*: workflow operativo di authoring carte (briefing
→ prompt → CSV).

Note di compatibilità: tutti i CSV esistenti restano validi. I campi
narrativi sono \*\*opzionali\*\* in §13: in loro assenza il narratore
degrada elegantemente a testi di fallback. Lo strato narrativo è
un\'estensione additiva, non una rottura.

\## Changelog v0.4 (rispetto a v0.3)

Tre estensioni meccaniche introdotte durante l\'implementazione (vedi
§11 registry):

\- \*\*EXT_TRACK_DAMAGE\*\* (§2.3): l\'istanza nemico tiene traccia di
danni_per_pg e copia comportamento dalla CardNemico, per supportare il
pattern AI \"Tank\" (§5.9).

\- \*\*EXT_BONUS_CARTE_RIPOSO\*\* (§2.2): il PG ha un flag
bonus_carte_prossimo_turno, settato dal nodo riposo (§4.1) e consumato a
inizio del turno successivo.

\- \*\*EXT_COMBAT_TRANSITION\*\* (§5.10): la fase fine_combattimento è
ora considerata transitoria. Dopo aver loggato la vittoria e applicato i
bonus, il motore transita automaticamente a esplorazione e svuota
nemici_in_campo. La UI non deve compensare a mano (in v0.3, l\'UI era
costretta a farlo, causando un bug noto se dimenticato).

Aggiunte documentali:

\- \*\*§9.3 Convenzione di mutabilità del codice\*\*: regola operativa
per chi lavora sul codice (clone una volta per entry point, log_append
in place).

\- \*\*§10.x Limitazioni note del MVP (parking lot)\*\*: lista esplicita
di cosa NON è implementato ancora, perché, e dove vive il punto di
estensione nel codice.

\# \*\*§0 --- Meta del documento e convenzioni\*\*

Specifica tecnico-ludica unica per una partita di \'Gli Erranti del
Destino\'. Pensata per essere consumata da un modello IA (Opus 4.7) che
dovrà generarne l\'implementazione in HTML/JavaScript. Tutti i mazzi e
le meccaniche sono definiti in questo documento.

\### \*\*§0.1 --- Convenzioni di scrittura\*\*

\- \*\*Riferimenti incrociati:\*\* ogni sezione ha un ID (es. §4.2).
Usare l\'ID per puntatori interni invece di ripetere il contenuto.

\- \*\*Schemi:\*\* ogni meccanica è descritta come funzione con
contratto INPUT → OUTPUT → EFFETTI.

\- \*\*Stato:\*\* lo stato del gioco è un singolo oggetto JSON
(GameState, §2.1). Ogni operazione è una pure function (oldState) →
newState.

\- \*\*Dati esterni:\*\* il contenuto delle carte vive in file CSV
separati (vedi §1.11), non in questo documento.

\- \*\*Punti di estensione:\*\* marcati con \`# EXT:\`. Non rimuovere.

\- \*\*Determinismo:\*\* tutta la casualità passa da una singola
funzione rng(seed) per consentire replay e debug.

\- \*\*Glossario:\*\* i termini definiti in §0.2 sono token-handle: non
riformularli, usarli letteralmente.

\### \*\*§0.2 --- Glossario (token-handle)\*\*

\| \*\*Termine\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \|

\| PG \| Personaggio Giocante (uno per giocatore umano) \|

\| PNG \| Personaggio Non Giocante (carta del mazzo Destino) \|

\| PV \| Punti Vita \|

\| EN \| Energia (risorsa per giocare carte Erranti) \|

\| MANO \| Set di carte Erranti in mano al PG \|

\| PILA \| Mazzo Erranti personale del PG (pila pesca) \|

\| SCARTI \| Pila degli scarti del PG \|

\| CAMPO \| Zona in cui restano le carte con durata \> immediato \|

\| NODO \| Carta Luogo attualmente attiva sulla mappa \|

\| BIVIO \| Carta Evento che richiede una scelta A/B \|

\| INCONTRO \| Insieme di nemici presenti in un nodo combattimento \|

\| FASE \| Sotto-stato di un turno (vedi §5.1) \|

\| ROUND \| Ciclo completo: turno di tutti i PG + turno nemici \|

\| RUN \| Una partita intera, dall\'inizio al boss finale o sconfitta \|

\| SLOT \| Posizione di equipaggiamento di un PG (arma, armatura,
talismano --- §2.2) \|

\| ATTACCO_BASE \| Manovra offensiva gratuita o a costo ridotto fornita
dall\'arma equipaggiata (§5.2bis) \|

\| TAG \| Etichetta elementale (fuoco, acqua, terra, aria, oscurità,
luce) o fisica (taglio, impatto, perforante, energia) usata per match
vulnerabilità/resistenza (§5.7 step 4) e sinergie (§5.6) \|

\| ESSENZE \| Risorsa di run per evolvere l\'equipaggiamento. 10
categorie (6 elementali + 4 fisiche). Vedi §5.11 \|

\| FORMA_FINALE \| Variante di evoluzione al Lv3 di un pezzo di
equipaggiamento, sbloccata da un trigger narrativo (§5.11) \|

\| σ1 \| Sinergia multi-carta: si attiva quando N carte con un certo tag
vengono giocate nello stesso turno (§5.6) \|

\| σ2 \| Sinergia di equipaggiamento: si attiva quando
l\'equipaggiamento del PG soddisfa un pattern (§5.6) \|

\| VULNERABILITÀ \| Tag che, se presente nella fonte di danno, applica
moltiplicatore ×1.5 al target (§5.7 step 4) \|

\| RESISTENZA \| Tag che, se presente nella fonte di danno, applica
moltiplicatore ×0.5 al target (§5.7 step 4) \|

\### \*\*§0.3 --- Parametri globali (config.json)\*\*

Tutti i numeri di bilanciamento vivono in un singolo file di
configurazione, non hardcoded:

\`\`\`

{

\"giocatori\": { \"min\": 2, \"max\": 4 },

\"pg\": {

\"pv_iniziali\": 30,

\"pv_massimi\": 30,

\"energia_per_turno\": 3,

\"dimensione_mano\": 5,

\"dimensione_pila_iniziale\": 15

},

\"run\": {

\"nodi_totali\": 12,

\"nodi_prima_di_boss\": 11,

\"twist_min_nodi\": 3

},

\"mappa\": {

\"scelte_per_nodo\": 2,

\"ramificazione\": \"lineare_con_bivi\"

},

\"combattimento\": {

\"attacco_base_gratuito_per_turno\": 1,

\"moltiplicatore_vulnerabilita\": 1.5,

\"moltiplicatore_resistenza\": 0.5,

\"essenze_per_lv2\": 3,

\"essenze_per_lv3\": 5

},

\"rng\": { \"seed_default\": null }

}

// \# EXT: aggiungere qui parametri di nuove meccaniche

\`\`\`

\# \*\*§1 --- Mazzi e schemi delle carte\*\*

Il gioco ruota attorno a 3 mazzi: Destino (narrazione), Erranti (azioni
dei PG), Nemici (avversari). Ogni mazzo contiene tipi di carta diversi,
ciascuno con uno schema JSON che ne definisce i campi. Il contenuto
delle carte vive in CSV esterni (§1.11).

\### \*\*§1.1 --- Panoramica mazzi\*\*

\| \*\*Mazzo\*\* \| \*\*Tipi di carta\*\* \| \*\*Quando si usa\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| Destino \| Mondo, Luogo, Evento, Twist, PNG \| Genera ambientazione e
narrazione \|

\| Erranti \| Attacco, Abilità, Equipaggiamento, Consumabile \| Pescato
dai PG, costituisce le loro azioni; gli equipaggiamenti restano sui SLOT
del PG \|

\| Nemici \| Nemico (categoria: comune/elite/boss) \| Avversari, AI
passiva (§5.9) \|

\### \*\*§1.2 --- CardMondo\*\*

Definisce l\'ambientazione globale della partita e attiva una regola
persistente. Una sola carta Mondo viene pescata all\'inizio della
partita.

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string MONDO\_\[A-Z\]{3,} \| Codice univoco \|

\| nome \| string \| Nome del mondo \|

\| elemento \| enum \| terra │ aria │ acqua │ fuoco │ oscurità │ luce \|

\| descrizione_narrativa \| string \| Testo mostrato ai giocatori \|

\| regola_mondo \| string │ regola_strutturata \| Effetto persistente
(§7.2) \|

\| tag_luoghi \| array \| ID delle CardLuogo associate \|

\| tag_eventi \| array \| ID delle CardEvento associate \|

\| vulnerabilita_mondo \| array (opzionale, v0.6) \| Tag con ×1.5
propagati a tutti i nemici del mondo (§5.7 step 4) \|

\| resistenza_mondo \| array (opzionale, v0.6) \| Tag con ×0.5 propagati
a tutti i nemici del mondo \|

\`\`\`

\"CardMondo\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"elemento\",\"descrizione_narrativa\",

\"regola_mondo\",\"tag_luoghi\",\"tag_eventi\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^MONDO\_\[A-Z\]{3,}\$\"},

\"nome\": {\"type\":\"string\"},

\"elemento\": {\"type\":\"string\",

\"enum\":\[\"terra\",\"aria\",\"acqua\",\"fuoco\",\"oscurità\",\"luce\"\]},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"regola_mondo\": {\"type\":\"string\"},

\"tag_luoghi\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"tag_eventi\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"vulnerabilita_mondo\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"resistenza_mondo\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}}

},

\"additionalProperties\": false

}

\`\`\`

\*\*Nota v0.6.\*\* I tag in \`vulnerabilita_mondo\` e
\`resistenza_mondo\` agiscono come \*temperamento elementale\* del mondo
intero: si sommano a quelli del singolo nemico nella pipeline danno
(§5.7 step 4). Esempio: in MONDO_FUOCO con
\`resistenza_mondo=\[\"fuoco\"\]\`, \*tutti\* i nemici resistono al
fuoco anche se la singola CardNemico non lo dichiara.

\### \*\*§1.3 --- CardLuogo\*\*

Definisce i nodi della mappa. Ha ambientazione specifica e un effetto
che modifica lo svolgimento. Per ogni mondo ci sono 6 carte associate,
più carte universali (universale = true).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| tag_mondo \| string \| ID del mondo (vuoto se universale) \|

\| tipo_nodo \| enum \| combattimento │ evento │ riposo │ tesoro │
speciale \|

\| descrizione_narrativa \| string \| Testo mostrato ai giocatori \|

\| effetto_meccanico \| string │ regola_strutturata \| Modifica regole
nel nodo \|

\| nemici_associati \| array \| ID CardNemico apparibili \|

\| universale \| boolean \| true = vale per ogni mondo \|

\| vulnerabilita_luogo \| array (opzionale, v0.6) \| Tag con ×1.5
propagati ai nemici del nodo \|

\| resistenza_luogo \| array (opzionale, v0.6) \| Tag con ×0.5 propagati
ai nemici del nodo \|

\`\`\`

\"CardLuogo\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"tipo_nodo\",\"descrizione_narrativa\",

\"effetto_meccanico\",\"universale\"\],

\"properties\": {

\"id\": {\"type\":\"string\"},

\"nome\": {\"type\":\"string\"},

\"tag_mondo\": {\"type\":\"string\"},

\"tipo_nodo\": {\"type\":\"string\",

\"enum\":\[\"combattimento\",\"evento\",\"riposo\",\"tesoro\",\"speciale\"\]},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto_meccanico\": {\"type\":\"string\"},

\"nemici_associati\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"universale\": {\"type\":\"boolean\"},

\"vulnerabilita_luogo\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"resistenza_luogo\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}}

},

\"additionalProperties\": false

}

\`\`\`

\### \*\*§1.4 --- CardEvento\*\*

Definisce il percorso narrativo. Ogni carta genera un BIVIO: scelta
duplice A/B con effetti meccanici diversi. Per ogni mondo 6 carte +
carte universali. Vengono rivelate durante la partita.

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| tag_mondo \| string \| ID del mondo (vuoto se universale) \|

\| trigger \| enum \| esplorazione │ combattimento │ sempre \|

\| testo_narrativo \| string \| Descrizione della situazione \|

\| scelta_A \| object effetto_payload \| Effetto opzione A (§6.2) \|

\| scelta_B \| object effetto_payload \| Effetto opzione B (§6.2) \|

\| universale \| boolean \| true = vale per ogni mondo \|

\`\`\`

\"CardEvento\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"trigger\",\"testo_narrativo\",

\"scelta_A\",\"scelta_B\",\"universale\"\],

\"properties\": {

\"id\": {\"type\":\"string\"},

\"nome\": {\"type\":\"string\"},

\"tag_mondo\": {\"type\":\"string\"},

\"trigger\": {\"type\":\"string\",

\"enum\":\[\"esplorazione\",\"combattimento\",\"sempre\"\]},

\"testo_narrativo\": {\"type\":\"string\"},

\"scelta_A\": {\"\$ref\":\"#/definitions/EffettoPayload\"},

\"scelta_B\": {\"\$ref\":\"#/definitions/EffettoPayload\"},

\"universale\": {\"type\":\"boolean\"}

},

\"additionalProperties\": false

}

\`\`\`

\*\*\*Nota v0.3.\*\*\* scelta_A/B non sono più stringhe libere ma
oggetti strutturati \*\*EffettoPayload\*\*, definito in §6.2. Questo
permette al motore di applicare gli effetti senza parsing di testo
libero.

\### \*\*§1.5 --- CardTwist\*\*

Imprevisti e colpi di scena. 15 carte totali, tutte universali, rivelate
durante la partita (§4.3).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| effetto_meccanico \| string │ regola_strutturata \| Modifica anche
retroattiva \|

\| timing \| string \| Quando può essere giocata (es. \'dopo nodo 3\')
\|

\| intensita \| enum \| bassa │ media │ alta \|

\`\`\`

\"CardTwist\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"descrizione_narrativa\",

\"effetto_meccanico\",\"timing\",\"intensita\"\],

\"properties\": {

\"id\": {\"type\":\"string\"},

\"nome\": {\"type\":\"string\"},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto_meccanico\": {\"type\":\"string\"},

\"timing\": {\"type\":\"string\"},

\"intensita\":
{\"type\":\"string\",\"enum\":\[\"bassa\",\"media\",\"alta\"\]}

},

\"additionalProperties\": false

}

\`\`\`

\### \*\*§1.6 --- CardPNG\*\*

Personaggi che entrano nella storia con effetti narrativi e meccanici
(positivi o negativi). 20 carte totali, tutte universali, rivelate
durante la partita (§4.4).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| tag_mondo \| string \| ID mondo preferito (per bonus) \|

\| ruolo \| enum \| alleato │ mercante │ traditore │ guida │ boss_minore
\|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| effetto_passivo \| string │ regola_strutturata \| Attivo finché in
gioco \|

\| effetto_attivo \| string │ regola_strutturata \| Attivo quando
giocato \|

\| mondo_preferito \| enum \| terra │ aria │ acqua │ fuoco │ oscurità │
tutti \|

\`\`\`

\"CardPNG\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"ruolo\",\"descrizione_narrativa\",

\"effetto_passivo\",\"effetto_attivo\",\"mondo_preferito\"\],

\"properties\": {

\"id\": {\"type\":\"string\"},

\"nome\": {\"type\":\"string\"},

\"tag_mondo\": {\"type\":\"string\"},

\"ruolo\": {\"type\":\"string\",

\"enum\":\[\"alleato\",\"mercante\",\"traditore\",\"guida\",\"boss_minore\"\]},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto_passivo\": {\"type\":\"string\"},

\"effetto_attivo\": {\"type\":\"string\"},

\"mondo_preferito\": {\"type\":\"string\",

\"enum\":\[\"terra\",\"aria\",\"acqua\",\"fuoco\",\"oscurità\",\"tutti\"\]}

},

\"additionalProperties\": false

}

\`\`\`

\### \*\*§1.7 --- CardAttacco (mazzo Erranti) --- v0.6\*\*

Manovra offensiva \*speciale\*: con l\'introduzione dell\'attacco base
dell\'arma (§5.2bis), le carte Attacco non sono più \"fare danno
semplice\" ma manovre che si giustificano per almeno una delle seguenti
caratteristiche:

\- \*\*Effetto secondario\*\* (applica status, debuff, marchio, ecc.)

\- \*\*Target diverso da \'singolo\'\*\* (tutti_nemici, nemico_casuale,
target multipli)

\- \*\*Trigger condizionale\*\* (danno maggiorato se condizione X,
double-strike, ecc.)

\- \*\*Costo elevato per danno elevato\*\* (vera \'big attack\' che
giustifica i 2-3 EN)

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string ATK\_\[A-Z\_\]+ \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| classe_preferita \| enum \| guerriero │ mago │ ladro │ guaritore │
universale \|

\| costo_energia \| integer ≥ 0 \| EN spesi per giocarla \|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| effetto_meccanico \| string \| Danno + condizione (es. veleno,
stordimento) \|

\| target \| enum \| nemico │ tutti_nemici │ nemico_casuale \|

\| valore_numerico \| integer \| Danno base (passa a step 1 della
pipeline §5.7) \|

\| tag \| array (v0.6) \| Tag elementali e fisici della manovra (es.
\[\"taglio\",\"fuoco\"\]). Usati nello step 4 della pipeline danno. \|

\| applica_status \| object │ null (v0.6) \| Status applicato al target
dopo lo step 9 (es. {tipo:\"sanguinamento\",intensita:2,durata:3}) \|

\| ignora_difesa \| boolean (v0.6, default false) \| Se true, salta lo
step 6 della pipeline §5.7 \|

\| ignora_scudo \| boolean (v0.6, default false) \| Se true, salta lo
step 7 \|

\| tag_sinergia \| array \| Tag per match in sinergie σ1 (§5.6). Spesso
ridondante con \`tag\` ma tenuto separato per consentire alias (es. una
carta con tag=\[\"taglio\"\] può avere
tag_sinergia=\[\"taglio\",\"veloce\"\]) \|

\| durata \| enum \| immediato (sempre) \|

\`\`\`

\"CardAttacco\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"classe_preferita\",\"costo_energia\",

\"descrizione_narrativa\",\"effetto_meccanico\",\"target\",

\"valore_numerico\",\"tag\",\"tag_sinergia\",\"durata\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^ATK\_\[A-Z\_\]+\$\"},

\"nome\": {\"type\":\"string\"},

\"classe_preferita\": {\"type\":\"string\",

\"enum\":\[\"guerriero\",\"mago\",\"ladro\",\"guaritore\",\"universale\"\]},

\"costo_energia\": {\"type\":\"integer\",\"minimum\":0},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto_meccanico\": {\"type\":\"string\"},

\"target\":
{\"type\":\"string\",\"enum\":\[\"nemico\",\"tutti_nemici\",\"nemico_casuale\"\]},

\"valore_numerico\": {\"type\":\"integer\"},

\"tag\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"applica_status\": {\"type\":\[\"object\",\"null\"\]},

\"ignora_difesa\": {\"type\":\"boolean\",\"default\":false},

\"ignora_scudo\": {\"type\":\"boolean\",\"default\":false},

\"tag_sinergia\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"durata\": {\"type\":\"string\",\"enum\":\[\"immediato\"\]}

},

\"additionalProperties\": false

}

\`\`\`

\*\*Esempi indicativi.\*\*

\- \`ATK_AFFONDO\` --- danno + sanguinamento. tag=\[\"taglio\"\],
applica_status={tipo:\"sanguinamento\",intensita:2,durata:3}.

\- \`ATK_TEMPESTA_LAME\` --- danno area tutti_nemici.
tag=\[\"taglio\"\].

\- \`ATK_COLPO_CONCENTRATO\` --- doppio danno se bersaglio ha marchio
(logica nel modulo combat, vedi \`effetto_meccanico\`).

\### \*\*§1.8 --- CardAbilità (mazzo Erranti) --- v0.6\*\*

Effetto NON offensivo (o offensivo \"puro\" non legato a un\'arma):
status, cura, scudo, draw, manipolazione carte, buff, controllo. Durata
variabile.

Le abilità \*\*non applicano\*\* la pipeline danno standard. Se
un\'abilità infligge danno (raro), il flag \`salta_step_tag=true\`
segnala alla pipeline di saltare lo step 4 (match tag): è un effetto
puro, indipendente dai tag dell\'arma equipaggiata.

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string ABL\_\[A-Z\_\]+ \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| classe_preferita \| enum \| guerriero │ mago │ ladro │ guaritore │
universale \|

\| costo_energia \| integer ≥ 0 \| EN spesi per giocarla \|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| effetto_meccanico \| string \| buff / debuff / cura / controllo \|

\| target \| enum \| se │ alleato │ nemico │ tutti │ gruppo \|

\| valore_numerico \| integer │ null \| Valore effetto \|

\| tag \| array (v0.6, opzionale) \| Tag della carta, usati nel
conteggio σ1 (§5.6) anche se l\'abilità non fa danno \|

\| salta_step_tag \| boolean (v0.6, default false) \| Se true e
l\'abilità fa danno, la pipeline salta lo step 4 \|

\| tag_sinergia \| array \| Tag per combo (§5.6) \|

\| durata \| enum \| immediato │ inizio_turno │ fine_turno │ permanente
\|

\`\`\`

\"CardAbilita\": {

\"type\": \"object\",

\"required\": \[\"id\",\"nome\",\"classe_preferita\",\"costo_energia\",

\"descrizione_narrativa\",\"effetto_meccanico\",\"target\",

\"tag_sinergia\",\"durata\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^ABL\_\[A-Z\_\]+\$\"},

\"nome\": {\"type\":\"string\"},

\"classe_preferita\": {\"type\":\"string\",

\"enum\":\[\"guerriero\",\"mago\",\"ladro\",\"guaritore\",\"universale\"\]},

\"costo_energia\": {\"type\":\"integer\",\"minimum\":0},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto_meccanico\": {\"type\":\"string\"},

\"target\":
{\"type\":\"string\",\"enum\":\[\"se\",\"alleato\",\"nemico\",\"tutti\",\"gruppo\"\]},

\"valore_numerico\": {\"type\":\[\"integer\",\"null\"\]},

\"tag\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"salta_step_tag\": {\"type\":\"boolean\",\"default\":false},

\"tag_sinergia\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"durata\": {\"type\":\"string\",

\"enum\":\[\"immediato\",\"inizio_turno\",\"fine_turno\",\"permanente\"\]}

},

\"additionalProperties\": false

}

\`\`\`

\### \*\*§1.9 --- CardEquipaggiamento (mazzo Erranti) --- NUOVO in
v0.6\*\*

Sostituisce il vecchio \`CardOggetto\` per gli oggetti che occupano uno
SLOT del PG. Un PG ha 3 SLOT (§2.2): \`arma\`, \`armatura\`,
\`talismano\`, sempre occupati (anche dall\'equipaggiamento iniziale
della classe).

Ogni pezzo di equipaggiamento parte al \*\*Livello 1\*\* e può evolvere
fino al \*\*Livello 3\*\* spendendo ESSENZE (§5.11). Al Livello 3 si
sblocca la scelta di una FORMA_FINALE tra 2-3 alternative, ognuna con un
trigger narrativo (§5.11).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string EQP\_\[A-Z\_\]+ \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| slot \| enum \| arma │ armatura │ talismano \|

\| tag \| array \| Tag elementali + fisici dell\'equipaggiamento (es.
\[\"taglio\",\"fuoco\"\]) \|

\| livello \| integer (1..3, default 1) \| Livello corrente \|

\| livello_max \| integer (default 3) \| Massimo livello raggiungibile
\|

\| stats_per_livello \| array (esattamente 3) \| Stat per Lv1, Lv2, Lv3
(vedi sotto) \|

\| forme_finali \| array (2-3 RamoEvolutivo) \| Rami sbloccabili al Lv3
(vedi §5.11) \|

\| classe_preferita \| enum \| guerriero │ mago │ ladro │ guaritore │
universale \|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| tag_sinergia \| array \| Tag per combo σ2 (§5.6) \|

\*\*Struttura di \`stats_per_livello\` per slot:\*\*

\| \*\*Slot\*\* \| \*\*Schema delle stats\*\* \|

\| \-\-- \| \-\-- \|

\| arma \| \`{ \"danno_base\": int, \"costo_extra\": int,
\"effetto_speciale\": string│null }\` \|

\| armatura \| \`{ \"difesa\": int, \"pv_bonus\": int,
\"riduzione_tag\": { \"\<tag\>\": int } }\` \|

\| talismano \| \`{ \"effetto_passivo\": object, \"effetto_attivo\":
object│null }\` \|

\`\`\`

\"CardEquipaggiamento\": {

\"type\": \"object\",

\"required\":
\[\"id\",\"nome\",\"slot\",\"tag\",\"livello_max\",\"stats_per_livello\",

\"forme_finali\",\"descrizione_narrativa\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^EQP\_\[A-Z\_\]+\$\"},

\"nome\": {\"type\":\"string\"},

\"slot\":
{\"type\":\"string\",\"enum\":\[\"arma\",\"armatura\",\"talismano\"\]},

\"tag\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"livello\":
{\"type\":\"integer\",\"minimum\":1,\"maximum\":3,\"default\":1},

\"livello_max\": {\"type\":\"integer\",\"default\":3},

\"stats_per_livello\": {

\"type\":\"array\",\"minItems\":3,\"maxItems\":3,

\"items\":{\"type\":\"object\"}

},

\"forme_finali\": {

\"type\":\"array\",\"minItems\":2,\"maxItems\":3,

\"items\":{\"\$ref\":\"#/definitions/RamoEvolutivo\"}

},

\"classe_preferita\": {\"type\":\"string\",

\"enum\":\[\"guerriero\",\"mago\",\"ladro\",\"guaritore\",\"universale\"\]},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"tag_sinergia\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}}

},

\"additionalProperties\": false

}

\"RamoEvolutivo\": {

\"type\": \"object\",

\"required\":
\[\"id\",\"nome\",\"trigger\",\"stats\",\"descrizione_narrativa\"\],

\"properties\": {

\"id\": {\"type\":\"string\"},

\"nome\": {\"type\":\"string\"},

\"trigger\": {

\"type\":\"object\",

\"properties\": {

\"tipo\": {\"type\":\"string\",

\"enum\":\[\"nodo_tipo\",\"mondo\",\"png_amico\",\"kill_categoria\",\"libero\"\]},

\"parametro\": {\"type\":\"string\"}

}

},

\"stats\": {\"type\":\"object\"},

\"tag_aggiuntivi\":
{\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"descrizione_narrativa\": {\"type\":\"string\"}

}

}

\`\`\`

\### \*\*§1.9bis --- CardConsumabile (mazzo Erranti) --- NUOVO in
v0.6\*\*

Carta oggetto a \*\*uso singolo\*\* che il PG ha in MANO. Si gioca come
una qualsiasi carta Erranti, consuma EN, va negli SCARTI dopo l\'uso.
\*\*Non occupa SLOT\*\* di equipaggiamento. Esempi tipici: Pozione di
Cura, Bomba Incendiaria, Pergamena Arcana, Antidoto.

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string CNS\_\[A-Z\_\]+ \| Codice univoco \|

\| nome \| string \| Nome della carta \|

\| classe_preferita \| enum \| guerriero │ mago │ ladro │ guaritore │
universale \|

\| costo_energia \| integer ≥ 0 \| EN spesi per giocarla \|

\| descrizione_narrativa \| string \| Testo per i giocatori \|

\| effetto \| object EffettoPayload \| Effetto strutturato (§6.2) \|

\| target \| enum \| se │ alleato │ nemico │ tutti_nemici │ tutti_pg │
scena \|

\| tag \| array \| Tag della carta (per sinergie σ1, §5.6) \|

\| tag_sinergia \| array \| Tag per combo (alias narrativo di \`tag\`)
\|

\`\`\`

\"CardConsumabile\": {

\"type\": \"object\",

\"required\":
\[\"id\",\"nome\",\"costo_energia\",\"effetto\",\"target\",

\"descrizione_narrativa\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^CNS\_\[A-Z\_\]+\$\"},

\"nome\": {\"type\":\"string\"},

\"classe_preferita\": {\"type\":\"string\",

\"enum\":\[\"guerriero\",\"mago\",\"ladro\",\"guaritore\",\"universale\"\]},

\"costo_energia\": {\"type\":\"integer\",\"minimum\":0},

\"descrizione_narrativa\": {\"type\":\"string\"},

\"effetto\": {\"\$ref\":\"#/definitions/EffettoPayload\"},

\"target\": {\"type\":\"string\",

\"enum\":\[\"se\",\"alleato\",\"nemico\",\"tutti_nemici\",\"tutti_pg\",\"scena\"\]},

\"tag\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"tag_sinergia\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}}

},

\"additionalProperties\": false

}

\`\`\`

\### \*\*§1.10 --- CardNemico (mazzo Nemici) --- v0.6\*\*

Unica struttura per tutte le categorie (comune, elite, boss),
differenziate dal campo categoria e dai valori numerici. Il nemico non
usa carte: agisce autonomamente seguendo un pattern di comportamento
(§5.9).

I tre campi \`vulnerabilita\`, \`resistenza\`, \`essenza_drop\` (v0.6)
sono essenziali per il match tag della pipeline danno (§5.7 step 4) e
per la distribuzione delle ESSENZE alla sconfitta (§5.11).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string NEM\_\[A-Z\_\]+ \| Codice univoco \|

\| nome \| string \| Nome del nemico \|

\| tag_mondo \| array \| Mondi in cui può apparire \|

\| categoria \| enum \| comune │ elite │ boss \|

\| pv \| integer ≥ 1 \| Punti vita iniziali \|

\| difesa \| integer ≥ 0 \| Danni assorbiti ogni turno \|

\| danno_base \| integer ≥ 0 \| Danno standard al gruppo \|

\| comportamento \| string \| Pattern AI
(Aggro│Tank│Support│Random│Vendicativo│Esecutore o combinazione) \|

\| abilita_speciale \| string │ null \| Effetto unico opzionale \|

\| trigger_abilita \| string │ null \| Condizione attivazione (es.
\'pv\<50%\') \|

\| ricompensa_narrativa \| string \| Drop alla sconfitta \|

\| tag_luogo \| array \| Tipi di nodo in cui appare \|

\| vulnerabilita \| array (v0.6) \| Tag con ×1.5 (§5.7 step 4) \|

\| resistenza \| array (v0.6) \| Tag con ×0.5 (§5.7 step 4) \|

\| essenza_drop \| array (v0.6) \| Categorie di essenza droppabili
(§5.11) \|

\`\`\`

\"CardNemico\": {

\"type\": \"object\",

\"required\":
\[\"id\",\"nome\",\"tag_mondo\",\"categoria\",\"pv\",\"difesa\",

\"danno_base\",\"comportamento\",\"ricompensa_narrativa\",\"tag_luogo\"\],

\"properties\": {

\"id\": {\"type\":\"string\",\"pattern\":\"\^NEM\_\[A-Z\_\]+\$\"},

\"nome\": {\"type\":\"string\"},

\"tag_mondo\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"categoria\":
{\"type\":\"string\",\"enum\":\[\"comune\",\"elite\",\"boss\"\]},

\"pv\": {\"type\":\"integer\",\"minimum\":1},

\"difesa\": {\"type\":\"integer\",\"minimum\":0},

\"danno_base\": {\"type\":\"integer\",\"minimum\":0},

\"comportamento\": {\"type\":\"string\"},

\"abilita_speciale\": {\"type\":\[\"string\",\"null\"\]},

\"trigger_abilita\": {\"type\":\[\"string\",\"null\"\]},

\"ricompensa_narrativa\": {\"type\":\"string\"},

\"tag_luogo\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"vulnerabilita\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"resistenza\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}},

\"essenza_drop\": {\"type\":\"array\",\"items\":{\"type\":\"string\"}}

},

\"additionalProperties\": false

}

\`\`\`

\*\*Esempi indicativi.\*\*

\- \`NEM_LUPO_SPETTRALE\`: vulnerabilita=\[\"luce\",\"sacro\"\],
resistenza=\[\"oscurita\",\"perforante\"\],
essenza_drop=\[\"oscurita\",\"taglio\"\].

\- \`NEM_GOLEM_PIETRA\`: vulnerabilita=\[\"impatto\",\"energia\"\],
resistenza=\[\"taglio\",\"perforante\"\],
essenza_drop=\[\"terra\",\"impatto\"\].

\- \`NEM_SPIRITO_LAGO\`: vulnerabilita=\[\"energia\",\"luce\"\],
resistenza=\[\"acqua\",\"fuoco\"\],
essenza_drop=\[\"acqua\",\"energia\"\].

\### \*\*§1.11 --- Dati esterni: convenzione CSV ↔ JSON\*\*

Il contenuto delle carte vive in file CSV separati dal codice e dal
regolamento. Questo permette di modificare/popolare le carte senza
ricompilare nulla. Il motore HTML/JS carica i CSV all\'avvio (tramite
parser come PapaParse) e li trasforma in array di oggetti che rispettano
gli schemi JSON definiti in §1.2--§1.10.

Struttura cartelle consigliata:

\`\`\`

/data

├── mondi.csv → array CardMondo

├── luoghi.csv → array CardLuogo

├── eventi.csv → array CardEvento

├── twist.csv → array CardTwist

├── png.csv → array CardPNG

├── attacchi.csv → array CardAttacco

├── abilita.csv → array CardAbilita

├── equipaggiamenti.csv → array CardEquipaggiamento (v0.6, ex parte di
oggetti.csv)

├── consumabili.csv → array CardConsumabile (v0.6, ex parte di
oggetti.csv)

├── nemici.csv → array CardNemico

├── classi.csv → array CardClasse (v0.5, §13.4)

├── lessico_elementi.csv → tabella lessico (v0.5, §13.5)

├── sinergie.json → tabella sinergie (§5.6)

└── config.json → parametri globali (§0.3)

\`\`\`

\#### \*\*\*§1.11.1 --- Regole di mappatura CSV → JSON\*\*\*

\| \*\*Tipo JSON\*\* \| \*\*Convenzione CSV\*\* \| \*\*Esempio cella\*\*
\|

\| \-\-- \| \-\-- \| \-\-- \|

\| string \| Cella di testo \| Foresta Sussurrante \|

\| integer \| Numero senza decimali \| 30 \|

\| boolean \| true / false (lowercase) \| true \|

\| enum \| Valore esatto dell\'enum \| combattimento \|

\| array \| Valori separati da │ (pipe) \| MONDO_FOR│MONDO_DES \|

\| string │ null \| Cella vuota = null \| (vuoto) \|

\| object (effetto) \| JSON inline tra virgolette \|
{\"target\":\"pg\",\"op\":\"pv-\",\"valore\":3} \|

\*\*\*Convenzione campi di authoring (v0.5):\*\*\* \*ogni colonna del
CSV il cui nome inizia con underscore\* \`\_\` \*è un\* \*\*\*campo di
authoring\*\*\*\*: vive nel file CSV (è leggibile umanamente, viene
versionato con il dato), ma il parser \`carica_dati()\` in §1.11.3 lo
ignora e non lo include nello schema JSON di gioco. Esempi:\*
\`\_briefing_autore\`, \`\_versione_briefing\`, \`\_note_revisione\`,
\`\_ispirazione\`\*. Vedi §13.0 per il significato e §13.6/§13.7 per
l\'uso.\*

\#### \*\*\*§1.11.2 --- Esempio CSV: mondi.csv\*\*\*

\`\`\`

id,nome,elemento,descrizione_narrativa,regola_mondo,tag_luoghi,tag_eventi,vulnerabilita_mondo,resistenza_mondo

MONDO_FOR,Foresta Sussurrante,terra,\"Una distesa di alberi
millenari...\",\"I PG curano 1 PV a fine
round\",LUO_FOR_01\|LUO_FOR_02\|LUO_FOR_03,EVT_FOR_01\|EVT_FOR_02,fuoco,terra

MONDO_DES,Deserto degli Ossi,fuoco,\"Sabbia rovente sotto due
soli...\",\"I PG perdono 1 PV a fine round se non in
riposo\",LUO_DES_01\|LUO_DES_02,EVT_DES_01\|EVT_DES_02,acqua,fuoco

\`\`\`

\#### \*\*\*§1.11.3 --- Funzione di caricamento\*\*\*

\`carica_dati() → DatabaseCarte\`

PASSI:

\- Per ogni file CSV in \`/data\`:

\- parse con PapaParse (header: true, dynamicTyping: false)

\- per ogni riga:

\- \*\*\*ignora ogni colonna il cui nome inizia con \`\_\`\*\*\* (v0.5:
convenzione campi di authoring, §1.11.1 e §13.0)

\- converti campi array splittando su \`\|\`

\- converti boolean da \"true\"/\"false\" a \`true\`/\`false\`

\- converti integer con \`parseInt\`

\- converti campi JSON inline con \`JSON.parse\`

\- lascia stringhe vuote come \`null\` per campi nullable

\- valida ogni oggetto contro lo schema JSON corrispondente (§1.2-§1.10)

\- push in array tipizzato

\- Ritorna \`DatabaseCarte = { mondi, luoghi, eventi, twist, png,
attacchi, abilita, equipaggiamenti, consumabili, nemici, classi,
lessico_elementi }\`

ERRORI:

\- Se la validazione fallisce: log + skip riga (resilienza).

\- Se file mancante: errore fatale, mostra messaggio UI.

\- \*\*\*Eccezione v0.5:\*\*\* \*i file\* \`classi.csv\` \*e\*
\`lessico_elementi.csv\` \*sono\* \*\*\*opzionali\*\*\*: \*se mancanti,
il narratore (§13.8) degrada a testi di fallback senza interrompere il
caricamento.\*

\#### \*\*\*§1.11.4 --- Workflow consigliato per popolare i dati\*\*\*

1\. Mantieni i CSV su Google Sheets per editing collaborativo.

2\. Esporta come \`.csv\` (File → Download → CSV) quando vuoi testare il
gioco.

3\. Metti i \`.csv\` esportati in \`/data\` del progetto.

4\. Il motore li ricarica al refresh della pagina.

5\. Per release: opzionalmente converti i CSV in un singolo
\`/data/cards.json\` buildato (più veloce da caricare).

\*\*Nota:\*\* i Google Sheets sono ottimi come \*fonte di dati esterna\*
ma non devono essere referenziati nel codice del gioco né nel
regolamento. L\'unica interfaccia stabile è il CSV esportato.

\#### \*\*\*§1.11.5 --- Migrazione v0.5 → v0.6 di oggetti.csv\*\*\*

Il vecchio \`oggetti.csv\` (v0.5) conteneva sia equipaggiamenti che
consumabili in un unico file, differenziati dal campo \`tipo_oggetto\`.
La separazione in due file distinti (\`equipaggiamenti.csv\` e
\`consumabili.csv\`) semplifica la validazione, riduce il numero di
campi nulli per riga e rende la migrazione futura più solida.

\*\*Procedura di migrazione (operativa):\*\*

1\. Aprire \`oggetti.csv\` in editor.

2\. Estrarre tutte le righe con \`tipo_oggetto = \"equipaggiamento\"\` →
\`equipaggiamenti.csv\`. Per ciascuna:

\- rinominare \`slot=accessorio\` → \`slot=talismano\` (allineamento al
nuovo schema).

\- aggiungere i nuovi campi \`tag\`, \`livello\`, \`livello_max\`,
\`stats_per_livello\`, \`forme_finali\` (anche solo come placeholder
iniziale: vedi §5.11 per la struttura).

\- aggiornare il pattern dell\'id da \`OBJ\_\*\` a \`EQP\_\*\`
(consigliato per chiarezza, non strettamente obbligatorio finché il
parser è permissivo).

3\. Estrarre tutte le righe con \`tipo_oggetto = \"consumabile\"\` →
\`consumabili.csv\`. Per ciascuna:

\- convertire \`effetto_meccanico\` (testo libero) in \`effetto\`
strutturato (vedi §6.2 EffettoPayload).

\- aggiornare l\'id da \`OBJ\_\*\` a \`CNS\_\*\`.

4\. Eliminare \`oggetti.csv\` dalla cartella \`/data\` (resta nel repo
\`git\` come record storico).

\*\*PARKING_LOT_MIGRAZIONE_OGGETTI:\*\* la migrazione effettiva del CSV
è uno step di authoring/dati, da affrontare prima del refactor del
motore (§12 Step 16).

\# \*\*§2 --- Modello di stato (GameState)\*\*

L\'intera partita è descritta da un singolo oggetto JSON serializzabile.
Ogni operazione del gioco è una funzione pura \`(GameState, Input) →
GameState\`.

\### \*\*§2.1 --- Schema GameState\*\*

\`\`\`

GameState = {

meta: {

run_id: string,

seed: integer,

versione_regole: \"0.6\",

timestamp_inizio: ISO8601

},

config: { /\* §0.3 \*/ },

mondo: CardMondo, // pescato all\'inizio

mappa: {

nodi: \[NodoIstanziato\], // §3.2

nodo_corrente: integer,

nodi_visitati: \[integer\]

},

giocatori: \[PGState\], // §2.2

nemici_in_campo: \[NemicoIstanziato\], // §2.3

png_in_gioco: \[CardPNG\], // PNG attivi (effetto passivo)

twist_giocati: \[string\], // id già usati

fase_corrente: FaseEnum, // §5.1

turno_di: integer, // indice in giocatori\[\]

round_numero: integer,

log: \[EventoLog\], // append-only, §2.4

rng_state: integer, // stato del PRNG

memoria_narrativa: \[TagMemoria\], // §13.9 (v0.5) --- max 5 elementi,
FIFO

atto_corrente: integer // §13.3 (v0.5) --- 1, 2 o 3

}

\`\`\`

\### \*\*§2.2 --- Schema PGState --- v0.6\*\*

Rispetto a v0.5: gli slot di equipaggiamento sono ora \`arma \| armatura
\| talismano\` (sostituisce \`accessorio\`). Aggiunti \`essenze\` (10
categorie), \`attacco_base_gratuito_consumato_questo_turno\`,
\`sinergie_attive\` (cache delle σ2 attive, ricalcolata a ogni cambio
equip e a inizio combat).

\`\`\`

PGState = {

id: string, // \"pg_1\" ... \"pg_4\"

nome: string,

classe: \"guerriero\"\|\"mago\"\|\"ladro\"\|\"guaritore\",

pv: integer,

pv_max: integer,

energia: integer, // resettata a config.pg.energia_per_turno

mano: \[CardId\],

pila: \[CardId\],

scarti: \[CardId\],

campo: \[CardIstanziata\], // §2.5

status: \[StatusEffect\], // §2.6

ko: boolean, // true se pv == 0

// \-\-- Equipaggiamento (v0.6) \-\--

// I 3 slot sono sempre occupati (anche al setup, dalla classe).

// Ogni slot referenzia un CardEquipaggiamento istanziato (incluso
livello corrente

// e forma_finale_scelta se Lv3+).

equipaggiamento: {

arma: EquipIstanziato \| null,

armatura: EquipIstanziato \| null,

talismano: EquipIstanziato \| null

},

// \-\-- Risorse di run (v0.6) \-\--

essenze: {

fuoco: 0, acqua: 0, terra: 0, aria: 0, oscurita: 0, luce: 0,

taglio: 0, impatto: 0, perforante: 0, energia: 0

},

// \-\-- Stato turno (v0.6) \-\--

attacco_base_gratuito_consumato_questo_turno: false, // reset a inizio
turno (§5.2)

sinergie_attive: \[SinergiaId\], // σ2 cache, ricalcolata da
valuta_sinergie_passive (§5.6)

carte_giocate_per_tag_turno: { \"\<tag\>\": integer }, // contatore per
σ1 (§5.6), reset a inizio turno

// \-\-- Da v0.4 (EXT_BONUS_CARTE_RIPOSO) \-\--

bonus_carte_prossimo_turno: 0 // Default 0. Settato a 1 dal nodo riposo
(§4.1)

// e consumato da pesca_pg (§5.4) all\'inizio del turno successivo.

}

\`\`\`

\*\*Schema \`EquipIstanziato\`:\*\* è una istanza runtime del
CardEquipaggiamento (§1.9) con il suo livello corrente e l\'eventuale
forma_finale_scelta.

\`\`\`

EquipIstanziato = {

carta_id: string, // ref a CardEquipaggiamento.id (es.
\"EQP_SPADA_CREPUSCOLO\")

livello: integer (1..3),

forma_finale_scelta: string\|null, // id del RamoEvolutivo scelto al
Lv3, o null se non ancora scelto

tag_correnti: \[string\] // tag dell\'equip + tag_aggiuntivi della forma
scelta, cache

}

\`\`\`

\### \*\*§2.3 --- Schema NemicoIstanziato\*\*

\`\`\`

NemicoIstanziato = {

istanza_id: string, // \"nem_1\", univoco nel combattimento

carta_id: string, // ref a CardNemico.id

pv: integer,

pv_max: integer,

difesa: integer,

status: \[StatusEffect\],

ultimo_colpito_da: string\|null, // pg_id, per pattern Vendicativo

trigger_attivato: boolean, // per abilita_speciale one-shot

// Nuovo in v0.4 (EXT_TRACK_DAMAGE):

comportamento: string, // Copiato dalla CardNemico all\'istanziazione.

// Disaccoppia l\'AI runtime dal database statico.

danni_per_pg: { \"\<pg_id\>\": integer } // Mappa pg_id → danno
cumulativo inflitto a questo nemico.

// Aggiornata da pipeline_danno step 9 (§5.7).

// Letta dal pattern Tank (§5.9): \"attacca il PG che gli ha fatto più
male\"

// I campi vulnerabilita/resistenza/essenza_drop NON vengono copiati
nell\'istanza:

// restano sulla CardNemico (statica), letti via DatabaseCarte ad ogni
step 4 della pipeline.

}

\`\`\`

\### \*\*§2.4 --- Schema EventoLog (audit trail)\*\*

Il log è append-only e descrive ogni cambiamento di stato. Serve per
replay, UI narrativa, debug.

\`\`\`

EventoLog = {

id: integer, // progressivo

timestamp: ISO8601,

tipo: \"carta_giocata\"\|\"nemico_attacca\"\|\"nodo_risolto\"\|

\"twist_rivelato\"\|\"png_apparso\"\|\"scelta_evento\"\|

\"danno_inflitto\"\|\"cura\"\|\"status_applicato\"\|\"ko\"\|

\"ricompensa\"\|\"fase_cambiata\"\|

// Nuovi in v0.6:

\"attacco_base\"\|\"equipaggiamento_cambiato\"\|

\"evoluzione_livello\"\|\"forma_finale_scelta\"\|

\"essenze_droppate\"\|\"sinergia_attivata\",

attore: string\|null, // pg_id o nem_istanza_id

bersaglio: string\|null,

payload: { /\* dati specifici tipo \*/ },

testo_narrativo: string // generato per UI

}

\`\`\`

\### \*\*§2.5 --- CardIstanziata (carta in campo)\*\*

\`\`\`

CardIstanziata = {

istanza_id: string,

carta_id: string, // ref a CardAbilita \| (raramente CardAttacco con
durata)

proprietario: string, // pg_id

durata_residua: integer\|\"permanente\",

scade_su: \"inizio_turno\"\|\"fine_turno\"\|\"mai\"

}

\`\`\`

\*\*Nota v0.6.\*\* Gli equipaggiamenti non sono più una CardIstanziata
generica: hanno una struttura dedicata \`EquipIstanziato\` agganciata
direttamente a \`pg.equipaggiamento.\<slot\>\` (§2.2). Il \`campo\`
resta usato solo per le carte Abilità con durata \> immediato (es. buff
persistenti).

\### \*\*§2.6 --- StatusEffect\*\*

\`\`\`

StatusEffect = {

tipo: \"veleno\"\|\"sanguinamento\"\|\"stordimento\"\|\"scudo\"\|

\"rigenerazione\"\|\"forza\"\|\"debolezza\"\|\"marchio\",

intensita: integer,

durata_residua: integer, // turni rimanenti, -1 = permanente

origine: string // id_carta o \"ambiente\"

}

// \# EXT_STATUS_NEW: aggiungere nuovi tipi qui senza modificare la
logica esistente

\`\`\`

\# \*\*§3 --- Setup partita\*\*

\### \*\*§3.1 --- Funzione setup_partita()\*\*

\`setup_partita(numero_giocatori, seed?) → GameState\`

PRECONDIZIONI:

\- \`numero_giocatori\` in \`\[config.giocatori.min,
config.giocatori.max\]\`

\- \`seed\`: integer o null (auto-generato)

PASSI:

1\. Inizializza \`meta\` + \`rng_state\`.

2\. \`carica_dati()\` (§1.11.3).

3\. Pesca 1 carta Mondo → \`mondo\`.

4\. \`costruisci_mappa(mondo)\` → \`mappa.nodi\` (§3.2).

5\. Per ogni giocatore \`i\` in \`\[0..n-1\]\`:

\- Richiedi scelta classe.

\- \`costruisci_pila_iniziale(classe)\` → \`pila\` (§3.3).

\- Mescola(\`pila\`).

\- Pesca \`config.pg.dimensione_mano\` carte → \`mano\`.

\- Assegna \`pv_iniziali\`, \`energia = 0\`.

\- \*\*(v0.6)\*\* Assegna l\'equipaggiamento iniziale della classe ai 3
slot (arma, armatura, talismano). Vedi §13.4 (CardClasse) per il payload
\`equipaggiamento_iniziale\`.

\- \*\*(v0.6)\*\* Inizializza \`essenze\` a tutte 0,
\`attacco_base_gratuito_consumato_questo_turno = false\`.

\- \*\*(v0.6)\*\* Valuta sinergie σ2 attive con l\'equipaggiamento
iniziale → \`sinergie_attive\` (§5.6).

6\. Log evento \`\"partita_iniziata\"\`.

7\. \`fase_corrente = \"esplorazione\"\`.

8\. \`turno_di = 0\`, \`round_numero = 1\`.

9\. Ritorna \`GameState\`.

\### \*\*§3.2 --- Funzione costruisci_mappa()\*\*

La mappa è una sequenza ordinata di nodi. Versione v0.3 = lineare con
bivi binari. \`# EXT_GRAPH_MAP\` per mappa a grafo.

\`costruisci_mappa(mondo) → \[NodoIstanziato\]\`

PASSI:

\- \`carte_disponibili\` = filtra CardLuogo dove \`tag_mondo ==
mondo.id\` OR \`universale == true\`.

\- Distribuisci tipi seguendo template:

\- nodi 1..3: \`tipo_nodo\` in \`\[combattimento, evento\]\`

\- nodo 4: \`riposo\`

\- nodi 5..7: \`combattimento + evento + tesoro\`

\- nodo 8: \`riposo\`

\- nodi 9..11: \`combattimento elite + speciale\`

\- nodo 12: \`boss\`

\- Per ogni slot, pesca senza rimpiazzo dalle carte filtrate per tipo.

\- Assegna nemici per nodi di combattimento da \`nemici_associati\`.

\- Ritorna lista.

\`\`\`

NodoIstanziato = {

posizione: integer, // 1..nodi_totali

carta_luogo_id: string,

stato: \"non_visitato\"\|\"in_corso\"\|\"risolto\",

incontro: \[NemicoIstanziato\]\|null,

evento_associato: string\|null

}

\`\`\`

\### \*\*§3.3 --- Funzione costruisci_pila_iniziale() --- v0.6\*\*

\`costruisci_pila_iniziale(classe) → \[CardId\]\`

REGOLA: la pila iniziale (\`config.pg.dimensione_pila_iniziale\`,
default 15) deve contenere:

\- 60% carte con \`classe_preferita == classe\` del PG

\- 30% carte \`universale\`

\- 10% carte di altra classe (per varietà)

Distribuzione consigliata per tipo (v0.6):

\- 8 CardAttacco

\- 5 CardAbilita

\- 2 CardConsumabile

\*\*Nota v0.6.\*\* Gli equipaggiamenti \*\*NON\*\* entrano nella pila
iniziale: vengono assegnati direttamente ai 3 slot da
\`setup_partita()\` step 5 (vedi \`equipaggiamento_iniziale\` su
CardClasse, §13.4). Solo i consumabili (e ovviamente attacchi e abilità)
entrano nel mazzo pesca.

\`# EXT_DECKBUILD\`: configurazione \"build\" personalizzata da
deck-builder.

\# \*\*§4 --- Mappa e progressione tra nodi\*\*

\### \*\*§4.1 --- Risoluzione di un nodo\*\*

Ogni nodo si risolve secondo il proprio \`tipo_nodo\`. La transizione
tra nodi avviene solo quando il nodo corrente è in stato \`risolto\`.

\| \*\*tipo_nodo\*\* \| \*\*Risoluzione\*\* \|

\| \-\-- \| \-\-- \|

\| combattimento \| Avvia ciclo §5 fino a tutti i nemici a pv=0 o tutti
i PG ko \|

\| evento \| Rivela CardEvento, richiedi scelta A/B, applica
effetto_meccanico \|

\| riposo \| Ogni PG: cura PV (+30% pv_max) e pesca 1 carta extra al
prossimo turno (\`bonus_carte_prossimo_turno = 1\`) \|

\| tesoro \| Ogni PG riceve 1 ricompensa pescata da tabella tesoro (può
includere consumabili o essenze). Vedi §4.5 \|

\| speciale \| Evento scriptato definito da \`effetto_meccanico\` della
CardLuogo \|

\### \*\*§4.2 --- Avanzamento al nodo successivo\*\*

\`avanza_nodo(state) → GameState\`

PRECONDIZIONI:

\- \`nodo_corrente.stato == \"risolto\"\`

\- almeno un PG non in ko

PASSI:

1\. Incrementa \`mappa.nodo_corrente\`.

2\. \`nodi_visitati.push(nodo_precedente)\`.

3\. \`valuta_twist(state)\` (§4.3).

4\. \`valuta_apparizione_png(state)\` (§4.4).

5\. Setta nuovo nodo a \`\"in_corso\"\`.

6\. Attiva \`effetto_meccanico\` del nuovo CardLuogo.

7\. \*\*(v0.6)\*\* Valuta \`auto_evoluzione_equip(state)\` per tutti i
PG (§5.11): se un PG ha abbastanza essenze per salire un livello e si
trova in nodo di riposo o ad inizio nodo, la salita è automatica.

8\. \*\*(v0.6)\*\* Ricalcola \`atto_corrente\` per la modulazione
narrativa (§13.3).

9\. Log \`\"nodo_iniziato\"\`.

\### \*\*§4.3 --- Sistema Twist\*\*

\`valuta_twist(state) → GameState\`

REGOLA:

\- probabilità base = 15% per nodo

\- solo se \`round_numero \>= config.run.twist_min_nodi\`

\- solo se twist non già usato

PASSI:

\- Se \`rng() \< soglia\` E ci sono twist disponibili:

\- filtra twist dove \`timing\` è compatibile con stato attuale

\- ordina per intensità crescente nei primi 6 nodi

\- pesca uno casualmente

\- applica \`effetto_meccanico\` (retroattivo se specificato)

\- log \`\"twist_rivelato\"\`

\- \`twist_giocati.push(id)\`

\### \*\*§4.4 --- Sistema PNG\*\*

\`valuta_apparizione_png(state) → GameState\`

REGOLA:

\- probabilità = 25% per nodo (40% se nodo è \`\"speciale\"\`)

\- i PNG con \`mondo_preferito == mondo\` attivo hanno peso doppio nella
pesca

PASSI:

\- Se \`rng() \< soglia\`:

\- pesca CardPNG dal pool disponibile

\- attiva \`effetto_passivo\`

\- aggiungi a \`png_in_gioco\`

\- log \`\"png_apparso\"\`

\`effetto_attivo\` viene innescato da trigger definiti caso per caso
(es. ruolo == \`\"mercante\"\` → fase commercio in nodo riposo).

\### \*\*§4.5 --- Tabella tesoro (v0.6, indicativa)\*\*

Nei nodi di tipo \`tesoro\`, ogni PG riceve una ricompensa pescata da
una tabella probabilistica. La tabella esatta è materia di bilanciamento
(vedi PARKING_LOT_TABELLA_TESORO) ma la distribuzione concettuale è:

\| \*\*Tipo ricompensa\*\* \| \*\*Peso (indicativo)\*\* \| \*\*Note\*\*
\|

\| \-\-- \| \-\-- \| \-\-- \|

\| Consumabile \| 40% \| Pesca da \`consumabili.csv\`, entra
direttamente in mano \|

\| Essenza singola \| 35% \| 1 essenza pesata sul tag del mondo corrente
(§5.11) \|

\| 2 essenze miste \| 15% \| 2 essenze di tag diversi (uno legato al
mondo, uno casuale) \|

\| Equipaggiamento sostitutivo \| 10% \| Pesca da
\`equipaggiamenti.csv\`, il PG può sostituire un slot esistente (la
vecchia equip viene \"fusa\" in 2 essenze del suo tag principale) \|

\*\*PARKING_LOT_TABELLA_TESORO\*\*: la tabella concreta con drop rate
fini e bilanciamento per atto narrativo è da definire (vedi anche §9.2
del documento sorgente FaseCombattimento).

\# \*\*§5 --- Turno di combattimento (v0.6)\*\*

Capitolo riscritto rispetto a v0.5 per integrare le decisioni della
sessione \"Fase Combattimento\". Le modifiche più importanti rispetto a
v0.5:

\- \*\*§5.1\*\* la macchina a stati include \`ATTESA_AZIONE_PG\` con
quattro azioni alternative: attacco base, gioca carta, usa talismano
attivo, passa.

\- \*\*§5.2bis\*\* (nuovo) definisce \`esegui_attacco_base()\`: l\'arma
equipaggiata fornisce un attacco base gratuito a turno.

\- \*\*§5.6\*\* sistema sinergie completo (σ1 + σ2), sostituisce il
vecchio PARKING_LOT_SINERGIE.

\- \*\*§5.7\*\* la vecchia \`applica_danno()\` è sostituita da
\`pipeline_danno()\`, a 9 step canonici, con match tag vs
vulnerabilità/resistenza (step 4).

\- \*\*§5.11\*\* (nuovo) meccanica di evoluzione dell\'equipaggiamento
via essenze.

\### \*\*§5.1 --- Macchina a stati delle fasi (v0.6)\*\*

Un round di combattimento è una macchina a stati deterministica.
Implementare come \`switch\` su \`fase_corrente\`.

\| \*\*FaseEnum\*\* \| \*\*Descrizione\*\* \| \*\*Transizione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| INIZIO_TURNO_PG \| Setup turno del PG corrente (energia, reset flag
attacco base, σ2) \| → STATUS_TICK_PG \|

\| STATUS_TICK_PG \| Applica effetti status (veleno, ecc.) \| → PESCA_PG
\|

\| PESCA_PG \| PG pesca fino a \`dimensione_mano\` \| → ATTESA_AZIONE_PG
\|

\| ATTESA_AZIONE_PG \| Input giocatore: attacco base / gioca carta / usa
talismano / passa \| → RISOLUZIONE_AZIONE │ FINE_TURNO_PG \|

\| RISOLUZIONE_AZIONE \| Risolve l\'azione scelta (carta o attacco base
o talismano) \| → ATTESA_AZIONE_PG \|

\| FINE_TURNO_PG \| Cleanup, scade carte con durata fine_turno \| →
INIZIO_TURNO_PG (next) │ TURNO_NEMICI \|

\| TURNO_NEMICI \| Tutti i nemici agiscono in sequenza \| → FINE_ROUND
\|

\| FINE_ROUND \| Tick effetti di fine round, verifica vittoria/sconfitta
\| → INIZIO_TURNO_PG │ FINE_COMBATTIMENTO \|

\| FINE_COMBATTIMENTO \| Ricompense (essenze, drop) e ritorno a
esplorazione \| → ESPLORAZIONE \|

\*\*Nota v0.4 (EXT_COMBAT_TRANSITION).\*\* La fase
\`FINE_COMBATTIMENTO\` è considerata \*transitoria\*. Il motore esegue
al suo interno: log \`\"combattimento_vinto\"\`, drop essenze ai PG
sopravvissuti (§5.11), bonus PNG fine-combat (§4.4), \`nodo.stato =
\"risolto\"\`, \*\*poi transita immediatamente a ESPLORAZIONE e svuota
\`nemici_in_campo\`\*\*. I chiamanti (UI o test) non devono mai
osservare uno state con \`fase_corrente == \"fine_combattimento\"\`.
Vedere §5.10 per i dettagli.

\`FINE_RUN\` resta invece terminale: la run è finita, lo state non
transita oltre.

\*\*Nota v0.6: rinomina ATTESA_AZIONE_PG.\*\* In v0.5 questa fase si
chiamava \"input gioca carta o passa\". Ora ammette 4 azioni
alternative: il nome \"azione\" è più generico. Il vecchio
\`RISOLUZIONE_CARTA\` è rinominato \`RISOLUZIONE_AZIONE\` per coerenza,
ma il loop di transizioni è identico.

\### \*\*§5.2 --- Funzione inizio_turno_pg() (v0.6)\*\*

\`inizio_turno_pg(state) → GameState\`

PRECONDIZIONI:

\- \`giocatori\[turno_di\].ko == false\` (altrimenti skip al prossimo)

PASSI:

1\. Log \`\"turno_iniziato\"\` per pg.

2\. \`pg.energia = config.pg.energia_per_turno\`.

3\. \*\*(v0.6)\*\* \`pg.attacco_base_gratuito_consumato_questo_turno =
false\`.

4\. \*\*(v0.6)\*\* Reset \`pg.carte_giocate_per_tag_turno = {}\`
(contatore σ1 di turno).

5\. Applica modificatori \`inizio_turno\` (PNG passivi, status,
regola_mondo).

6\. Per ogni carta in \`pg.campo\` dove \`scade_su ==
\"inizio_turno\"\`: rimuovi carta, sposta in scarti.

7\. \*\*(v0.6)\*\* \`valuta_sinergie_passive(state, pg_id)\` (§5.6):
rivaluta σ2 in base all\'equipaggiamento corrente. Aggiorna
\`pg.sinergie_attive\`.

8\. Fase → \`STATUS_TICK_PG\`.

\### \*\*§5.2bis --- Funzione esegui_attacco_base() (NUOVA in v0.6)\*\*

Ogni turno il PG può eseguire l\'attacco base della sua arma
equipaggiata \*\*UNA volta a costo zero\*\*. Dalla seconda volta in poi,
ogni attacco base costa \`arma.costo_extra\` EN. Esempi:

\| \*\*Arma\*\* \| \*\*costo_extra\*\* \| \*\*Comportamento\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| Daga \| 0 \| Tutti gli attacchi base costano 0 EN. Il PG può tirare
quanti attacchi base vuole, gratis. \|

\| Spada Lunga \| 1 \| Il primo gratis, ogni successivo costa 1 EN. \|

\| Spadone \| 2 \| Il primo gratis, ogni successivo costa 2 EN (con 3 EN
totali → max 2 attacchi base in un turno). \|

\`esegui_attacco_base(state, pg_id, target_id) → state\`

PRECONDIZIONI:

\- PG non KO.

\- PG ha arma equipaggiata (in pratica sempre vero perché gli slot sono
sempre occupati, §2.2).

\- Se \`pg.attacco_base_gratuito_consumato_questo_turno == true\`: PG
deve avere \`energia \>= arma.costo_extra\`.

\- \`target_id\` è un nemico in campo (validato).

\- \`fase_corrente == ATTESA_AZIONE_PG\`.

PASSI:

1\. Se \`attacco_base_gratuito_consumato_questo_turno == false\`:

\- \`costo = 0\`

\- \`attacco_base_gratuito_consumato_questo_turno = true\`

\- else: \`costo =
arma.stats_per_livello\[arma.livello-1\].costo_extra\`.

2\. \`pg.energia -= costo\`.

3\. Costruisci \`pseudo_attacco_base\` (oggetto effimero, non una
carta):

\`\`\`

{

valore_numerico: arma.stats_per_livello\[arma.livello-1\].danno_base,

tag: arma.tag_correnti, // include tag della forma_finale_scelta se Lv3
evoluta

target: \"nemico\",

ignora_difesa: false,

ignora_scudo: false,

applica_status:
arma.stats_per_livello\[arma.livello-1\].effetto_speciale \| null

}

\`\`\`

4\. Invoca \`pipeline_danno(state, attaccante=pg,
fonte=pseudo_attacco_base, target_id)\` (§5.7).

5\. Log evento \`\"attacco_base\"\` con \`payload: { pg_id, target_id,
costo, danno_inflitto, tag }\`.

6\. Fase → \`RISOLUZIONE_AZIONE\` (e poi torna a \`ATTESA_AZIONE_PG\`
finché il PG non passa).

7\. Ritorna \`state\`.

\*\*NOTA.\*\* Il reset di
\`attacco_base_gratuito_consumato_questo_turno\` avviene all\'inizio del
turno di ogni PG, in \`inizio_turno_pg\` (§5.2). Questo flag è
\*\*per-PG\*\*, non globale.

\### \*\*§5.3 --- Funzione status_tick()\*\*

\`status_tick(entita) → entita_aggiornata\`

REGOLE PER TIPO:

\| \*\*Status\*\* \| \*\*Effetto al tick\*\* \|

\| \-\-- \| \-\-- \|

\| veleno \| \`entita.pv -= intensita\` \|

\| sanguinamento \| \`entita.pv -= intensita\`; \`intensita -= 1\`
(decay) \|

\| stordimento \| flag \`salta_azione = true\` per questo turno \|

\| scudo \| gestito in \`pipeline_danno\` step 7 (§5.7), non al tick \|

\| rigenerazione \| \`entita.pv = min(pv_max, pv + intensita)\` \|

\| forza \| gestito in \`pipeline_danno\` step 3 \|

\| debolezza \| gestito in \`pipeline_danno\` step 5 (target) \|

\| marchio \| gestito in \`pipeline_danno\` step 3 (consumato all\'uso)
\|

DOPO L\'APPLICAZIONE:

\- Per ogni status: \`durata_residua -= 1\`.

\- Se \`durata_residua == 0\`: rimuovi status.

\- Log \`\"status_applicato\"\` se danno \> 0.

\### \*\*§5.4 --- Funzione pesca_carte()\*\*

\`pesca_carte(pg, quantita) → pg_aggiornato\`

PASSI:

\- Se \`len(pila) \< quantita\`:

\- sposta tutti \`scarti\` in \`pila\`

\- \`mescola(pila)\`

\- Trasferisci primi \`quantita\` da \`pila\` a \`mano\`.

\- Dimensione mano massima = \`config.pg.dimensione_mano +
pg.bonus_carte_prossimo_turno\`.

\- Consuma \`bonus_carte_prossimo_turno\` (azzeralo) dopo la pesca.

\- Carte in eccesso vengono scartate, log \`\"scarto_per_mano_piena\"\`.

\### \*\*§5.5 --- Funzione gioca_carta() (v0.6)\*\*

\`gioca_carta(state, pg_id, carta_id, target?) → GameState\`

PRECONDIZIONI:

\- Carta in \`pg.mano\`.

\- \`pg.energia \>= carta.costo_energia\`.

\- Target valido secondo \`carta.target\`.

\- \`fase_corrente == ATTESA_AZIONE_PG\`.

PASSI:

1\. \`pg.energia -= carta.costo_energia\`.

2\. Fase → \`RISOLUZIONE_AZIONE\`.

3\. \*\*(v0.6)\*\* Per ogni tag in \`carta.tag\`:
\`pg.carte_giocate_per_tag_turno\[tag\] += 1\` (contatore σ1).

4\. Switch su tipo carta:

\*\*CardAttacco\*\* (§1.7):

\- \`pipeline_danno(state, attaccante=pg, fonte=carta, target)\` (§5.7).

\- Se \`carta.applica_status != null\`: applica lo status al target
(parte degli step 9 della pipeline).

\*\*CardAbilita\*\* (§1.8):

\- Se \`carta.valore_numerico\` e l\'effetto è di danno: invoca
\`pipeline_danno\` passando \`fonte.salta_step_tag =
carta.salta_step_tag\`.

\- Altrimenti: applica direttamente l\'effetto
(buff/debuff/cura/controllo) al target.

\- Se \`durata != immediato\`: \`pg.campo.push(CardIstanziata)\`.

\*\*CardConsumabile\*\* (§1.9bis):

\- Applica l\'\`effetto\` (EffettoPayload, §6.2) al target.

\- La carta va in \`pg.scarti\` dopo l\'uso (uso singolo).

\*\*CardEquipaggiamento\*\* (§1.9):

\- Caso pesca da tesoro/evento: il PG decide se equipaggiare. Se sì:
rimuove l\'equip corrente dallo slot (può essere \"fusa\" per essenze,
vedi §5.11), assegna la nuova al \`pg.equipaggiamento\[slot\]\`.

\- \*\*Invalida\*\* \`pg.sinergie_attive\` e invoca
\`valuta_sinergie_passive(state, pg_id)\` (§5.6) per ricalcolare le σ2.

\- Log \`\"equipaggiamento_cambiato\"\` con \`payload: { slot,
vecchio_id, nuovo_id }\`.

5\. \*\*(v0.6)\*\* \`valuta_sinergie_attive(state, pg_id, carta)\`
(§5.6): verifica se la carta appena giocata fa scattare una σ1.

6\. Sposta carta in \`scarti\` (per consumabili e abilità a durata
immediata).

7\. Log \`\"carta_giocata\"\`.

8\. Fase → \`ATTESA_AZIONE_PG\`.

\### \*\*§5.6 --- Sistema sinergie (v0.6)\*\*

Il sistema sinergie sostituisce il PARKING_LOT_SINERGIE di v0.4/v0.5. Le
sinergie sono regole condizionali a due famiglie:

\- \*\*σ1 (sinergia multi-carta)\*\* --- si attiva quando N carte con un
certo tag vengono giocate nello stesso turno (es. \"Danza delle Lame\":
2 carte tag taglio in un turno → +3 danno alla prossima carta taglio del
turno).

\- \*\*σ2 (sinergia di equipaggiamento)\*\* --- si attiva quando
l\'equipaggiamento attuale del PG soddisfa un pattern (es. \"Anima di
Brace\": arma con tag fuoco + talismano con tag fuoco → tutti gli
attacchi base infliggono +1 danno fuoco).

\`σ3 (multi-PG)\` è espressamente \*\*FUORI dal MVP\*\*. \`#
EXT_SINERGIE_MULTI_PG\` per il futuro.

\#### \*\*§5.6.1 --- Schema sinergie.json\*\*

Il file \`sinergie.json\` (oggi presente nel progetto, attualmente
vuoto) viene popolato con record di questa forma:

\`\`\`

{

\"sinergie\": {

\"SIN_DANZA_LAME\": {

\"id\": \"SIN_DANZA_LAME\",

\"nome\": \"Danza delle Lame\",

\"tipo\": \"σ1\",

\"condizione\": {

\"tipo\": \"n_carte_tag_in_turno\",

\"tag\": \"taglio\",

\"soglia\": 2

},

\"effetto\": {

\"tipo\": \"bonus_danno_prossima_carta_con_tag\",

\"tag\": \"taglio\",

\"valore\": 3,

\"una_tantum_per_turno\": true

},

\"descrizione_narrativa\": \"Le lame danzano in armonia...\"

},

\"SIN_ANIMA_BRACE\": {

\"id\": \"SIN_ANIMA_BRACE\",

\"nome\": \"Anima di Brace\",

\"tipo\": \"σ2\",

\"condizione\": {

\"tipo\": \"equip_tag_match\",

\"slot\": \[\"arma\",\"talismano\"\],

\"tag\": \"fuoco\",

\"soglia\": 2

},

\"effetto\": {

\"tipo\": \"bonus_danno_attacco_base\",

\"valore\": 1,

\"applica_tag\": \"fuoco\"

},

\"descrizione_narrativa\": \"Le braci si sintonizzano con la tua
arma...\"

}

}

}

\`\`\`

\#### \*\*§5.6.2 --- Tassonomia delle condizioni\*\*

Tipologie di condizione riconosciute dal motore. \`#
EXT_CONDIZIONI_SINERGIA\` per aggiungerne di nuove.

\| \*\*Tipo condizione\*\* \| \*\*Descrizione\*\* \| \*\*Parametri\*\*
\|

\| \-\-- \| \-\-- \| \-\-- \|

\| n_carte_tag_in_turno \| Count carte con tag X giocate in questo turno
≥ soglia \| \`tag\`, \`soglia\` \|

\| equip_tag_match \| N slot tra quelli listati hanno il tag X \|
\`slot\`, \`tag\`, \`soglia\` \|

\| classe_pg \| Il PG è di una classe specifica \| \`classe\` \|

\| status_attivo \| Il PG ha un certo status (es. forza) \| \`status\`
\|

\| pv_soglia \| Il PG ha PV sotto/sopra una certa soglia \|
\`operatore\` (\<, \>), \`valore\` (%) \|

\#### \*\*§5.6.3 --- Tassonomia degli effetti\*\*

\| \*\*Tipo effetto\*\* \| \*\*Descrizione\*\* \|

\| \-\-- \| \-\-- \|

\| bonus_danno_prossima_carta_con_tag \| Bonus additivo allo step 2
della prossima carta che matcha \|

\| bonus_danno_attacco_base \| Bonus permanente all\'attacco base finché
la condizione σ2 è soddisfatta \|

\| applica_status_a_se \| Applica un certo status al PG \|

\| draw_extra \| Pesca N carte extra \|

\| riduzione_costo \| La prossima carta con tag X costa -1 EN \|

\#### \*\*§5.6.4 --- Quando si valutano le sinergie\*\*

\*\*Sinergie σ1\*\* (multi-carta in turno) --- vengono valutate al
termine dello \*\*STEP 9\*\* della pipeline danno (side effects
post-danno):

\`valuta_sinergie_attive(state, pg_id, carta)\`:

\- Per ogni sinergia σ1 in \`sinergie.json\`:

\- se \`carta.tag\` include il tag della condizione:

\- se \`pg.carte_giocate_per_tag_turno\[tag\] \>= soglia\` E la sinergia
non è già scattata in questo turno (per \`una_tantum_per_turno\`):

\- applica l\'\`effetto\` (es. setta \`pg.bonus_prossima_carta_tag = {
tag, valore }\`)

\- log \`\"sinergia_attivata\"\`

\*\*Sinergie σ2\*\* (equipaggiamento) --- vengono valutate:

\- ad ogni cambio di equipaggiamento
(\`equip\`/\`unequip\`/\`evoluzione\`)

\- a ogni inizio di combattimento (per assicurarsi che i bonus passivi
siano attivi)

\- a inizio turno di ogni PG (per coprire eventuali transizioni)

\`valuta_sinergie_passive(state, pg_id)\`:

\- Per ogni sinergia σ2 in \`sinergie.json\`:

\- verifica la condizione (es. \`equip_tag_match\`)

\- se vera: aggiungi \`sinergia.id\` a \`pg.sinergie_attive\`

\- se falsa e già presente: rimuovi

\- Le sinergie σ2 attive sono memorizzate in \`pg.sinergie_attive\`
(array di ID) per ispezione veloce nella pipeline (§5.7 step 2).

\#### \*\*§5.6.5 --- Pool MVP: target 15-20 sinergie\*\*

Composizione raccomandata del primo pool:

\- \~10 sinergie di tipo σ1 --- coprire le combinazioni più tipiche di
tag (taglio, fuoco, oscurità, impatto, energia).

\- \~5-10 sinergie di tipo σ2 --- premiare le \"build\" coerenti
(arma+talismano, arma+armatura).

\*\*PARKING_LOT_SINERGIE_POOL_INIZIALE\*\*: la lista nominale e numerica
delle 15-20 sinergie iniziali è materia di authoring/bilanciamento, non
di engine. Il motore funziona con sinergie.json vuoto (degrado elegante:
zero sinergie attive).

\### \*\*§5.7 --- pipeline_danno() --- Pipeline canonica del danno
(v0.6)\*\*

\`pipeline_danno(state, attaccante, fonte, target) → state\`

Questa funzione \*\*sostituisce\*\* la vecchia \`applica_danno()\` di
v0.4/v0.5. Per ogni attacco (base o da carta) il calcolo del danno
avviene in \*\*9 step rigorosamente in quest\'ordine\*\*.

\`fonte\` è una delle:

\- CardAttacco (carta giocata) --- vedi §1.7

\- pseudo_attacco_base (costruito dall\'arma in §5.2bis)

\- CardAbilita (raro, con flag \`salta_step_tag\` per saltare step 4)

\#### \*\*STEP 1 --- Danno base\*\*

\`\`\`

danno = fonte.valore_numerico

\`\`\`

\#### \*\*STEP 2 --- Modificatori attaccante (additivi)\*\*

\`\`\`

danno += bonus_regola_mondo(state.mondo, fonte.tag)

danno += bonus_effetto_luogo(state.nodo_corrente, fonte.tag)

danno += bonus_equipaggiamento(attaccante.equipaggiamento, fonte.tag)

danno += bonus_png_amico(state.png_in_gioco, fonte.tag)

danno += bonus_sinergia_attiva(attaccante.sinergie_attive, fonte)

// σ2: es. SIN_ANIMA_BRACE → +1 se attacco_base

// σ1: es. bonus_danno_prossima_carta_con_tag (consumato qui)

\`\`\`

\#### \*\*STEP 3 --- Status attaccante (moltiplicativi)\*\*

\`\`\`

if status.forza: danno = floor(danno × 1.5)

if status.marchio: danno = danno × 2 \[consuma il marchio\]

\# EXT_BUFF: altri buff moltiplicativi qui

\`\`\`

\#### \*\*STEP 4 --- Match tag fonte vs vulnerabilità/resistenza
target\*\*

\*\*SALTATO\*\* se \`fonte.salta_step_tag == true\` (abilità pure).

\`\`\`

tag_fonte = fonte.tag // tag della fonte (arma o carta)

vuln_target = unione(target.vulnerabilita,

state.mondo.vulnerabilita_mondo,

state.nodo_corrente.luogo.vulnerabilita_luogo)

res_target = unione(target.resistenza,

state.mondo.resistenza_mondo,

state.nodo_corrente.luogo.resistenza_luogo)

match_vuln = ∃ tag in tag_fonte : tag ∈ vuln_target

match_res = ∃ tag in tag_fonte : tag ∈ res_target

if match_vuln and not match_res: danno = floor(danno ×
config.combattimento.moltiplicatore_vulnerabilita) // ×1.5

if match_res and not match_vuln: danno = floor(danno ×
config.combattimento.moltiplicatore_resistenza) // ×0.5

if match_vuln and match_res : danno = danno // si annullano

\`\`\`

\#### \*\*STEP 5 --- Status target (moltiplicativi)\*\*

\`\`\`

if target.status.debolezza: danno = floor(danno × 1.5)

\`\`\`

\#### \*\*STEP 6 --- Difesa del target (sottrattiva)\*\*

\*\*SALTATO\*\* se \`fonte.ignora_difesa == true\` (es. nemico
Vendicativo furioso, o carte Attacco specifiche).

\`\`\`

danno = max(0, danno - target.difesa)

\`\`\`

\#### \*\*STEP 7 --- Scudo del target (assorbimento)\*\*

\*\*SALTATO\*\* se \`fonte.ignora_scudo == true\`.

\`\`\`

if target ha status.scudo:

assorbito = min(scudo.intensita, danno)

danno -= assorbito

scudo.intensita -= assorbito

se scudo.intensita == 0: rimuovi lo status scudo

\`\`\`

\#### \*\*STEP 8 --- Applicazione ai PV\*\*

\`\`\`

target.pv = max(0, target.pv - danno)

if target.pv == 0: trigger_ko(target)

\`\`\`

\#### \*\*STEP 9 --- Side effects post-danno\*\*

\`\`\`

\- aggiorna target.danni_per_pg\[attaccante.id\] += danno_effettivo (per
AI Tank, §5.9)

\- aggiorna target.ultimo_colpito_da = attaccante.id (per AI
Vendicativo, §5.9)

\- applica eventuali status secondari di fonte (fonte.applica_status, se
target ancora vivo)

\- valuta_sinergie_attive(state, attaccante.id, fonte) (σ1, §5.6.4)

\- se trigger_kill (target.pv == 0 e target è nemico):

\- drop essenze: per ogni tag in CardNemico.essenza_drop,
pg.essenze\[tag\] += 1

\- log \"essenze_droppate\"

\- se target è boss: trigger di possibili kill_categoria per
RamoEvolutivo (§5.11)

\- log \"danno_inflitto\"

\`\`\`

\#### \*\*§5.7.1 --- Note sul bilanciamento della pipeline\*\*

\- L\'ordine \*\*additivi prima di moltiplicativi\*\* (step 2 prima di
step 3) è lo standard nei deckbuilder: rende i bonus additivi più
impattanti quando combinati con buff.

\- Il match tag (step 4) è moltiplicativo e si applica \*\*dopo\*\* i
buff: \`forza + vulnerabilità = ×1.5 × 1.5 = ×2.25\` totale, che è
notevole ma non rotto.

\- L\'eventuale \*\*immunità TOTALE\*\* (×0) è espressamente fuori dal
MVP: solo vulnerabilità/resistenza. Se in futuro servisse, \`#
EXT_IMMUNITA\`.

\### \*\*§5.8 --- Turno nemici\*\*

\`turno_nemici(state) → GameState\`

PASSI:

\- Fase → \`TURNO_NEMICI\`.

\- Per ogni nemico in \`nemici_in_campo\` (ordine: indice array):

\- \`status_tick(nemico)\` (§5.3).

\- Se status \`stordimento\` attivo: skip e log.

\- Valuta \`trigger_abilita\`:

\- se vero: esegui \`abilita_speciale\` (non consuma azione standard se
one-shot, altrimenti sì).

\- Se non ha agito: \`esegui_comportamento(nemico, state)\` (§5.9).

\- Fase → \`FINE_ROUND\`.

\### \*\*§5.9 --- Pattern di comportamento (AI nemici)\*\*

Ogni pattern è una funzione \`(nemico, state) → Azione\`. L\'azione
contiene \`{ bersaglio, danno, modificatori }\`. Il danno effettivo
viene calcolato passando per \`pipeline_danno()\` con
\`attaccante=nemico\` e una \`fonte\` costruita dal
\`nemico.danno_base\` + tag del nemico (di solito implicito dal mondo,
salvo override).

\| \*\*Pattern\*\* \| \*\*Selezione bersaglio\*\* \| \*\*Azione\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| Aggro \| PG con PV minimi non ko \| Attacco standard \|

\| Tank \| PG che ha colpito di più (max \`danni_per_pg\`) \| Se
\`pv\<50%\`: \`difesa\*2\` + attacco ridotto. Altrimenti attacco
standard \|

\| Support \| Alleato nemico con PV più bassi \| Se ci sono altri
nemici: cura/buff. Altrimenti attacco standard \|

\| Random \| PG casuale non ko \| Attacco standard \|

\| Vendicativo \| \`ultimo_colpito_da\`, o random se null \| Attacco
standard + \`ignora_difesa\` se subìto \>50% pv max \|

\| Esecutore \| PG con PV minimi non ko \| Attacco standard. Se
\`bersaglio.pv \< 3\`: \`ignora_difesa\` \|

Il campo \`CardNemico.comportamento\` può contenere un singolo pattern
oppure una combinazione \`PatternA→PatternB\` che switcha a metà PV. Lo
schema è data-driven, la logica è uno switch.

\### \*\*§5.10 --- Fine combattimento (v0.6)\*\*

\`fine_combattimento(state) → GameState\`

CONDIZIONI DI USCITA (verificate in \`FINE_ROUND\` e dopo ogni azione
PG):

\- \*\*VITTORIA\*\*: \`len(nemici_in_campo) == 0\`

\- \*\*SCONFITTA\*\*: tutti i PG hanno \`ko == true\`

SE VITTORIA (ordine effettivo nel motore):

1\. Fase → \`FINE_COMBATTIMENTO\` (transitoria, non osservabile
dall\'esterno).

2\. Log \`\"combattimento_vinto\"\`.

3\. \*\*(v0.6)\*\* Le essenze sono già state distribuite nel momento del
kill di ciascun nemico (§5.7 step 9). In questa fase si applicano solo i
bonus di gruppo (es. PNG alleato che cura tutti).

4\. Applica bonus cura fine-combat da PNG alleati (§4.4).

5\. \*\*(v0.6)\*\* Per ogni PG: \`auto_evoluzione_equip(pg)\` (§5.11)
--- se ha accumulato abbastanza essenze, l\'equipaggiamento sale di
livello automaticamente.

6\. \`nodo.stato = \"risolto\"\`.

7\. \*\*Fase → ESPLORAZIONE\*\* (transizione automatica,
EXT_COMBAT_TRANSITION).

8\. \*\*\`nemici_in_campo = \[\]\`\*\*.

\*\*PARKING_LOT_RICOMPENSE\*\*: distribuzione di
\`ricompensa_narrativa\` testuale e pesca extra dei PG (drop carte) sono
previste dal regolamento ma non ancora implementate. Andranno tra il
punto 4 e il punto 5 quando aggiunte.

SE SCONFITTA:

1\. Fase → \`FINE_RUN\` (terminale, NON transita oltre).

2\. Log \`\"run_terminata\"\`.

3\. (UI) Mostra epitaffio narrativo aggregato dal log.

\### \*\*§5.11 --- Evoluzione dell\'equipaggiamento (NUOVA in v0.6)\*\*

Ogni pezzo di equipaggiamento (arma, armatura, talismano) parte al
\*\*Livello 1\*\* e può evolvere fino al \*\*Livello 3\*\*. La
progressione è a \*\*due tempi\*\*:

\#### \*\*Fase 1 --- Salita di livello (Lv1 → Lv2 → Lv3)\*\*

\- Spesa di \*\*ESSENZE\*\* per categoria di tag. Ogni livello richiede
una quantità crescente di essenze:

\- Lv1 → Lv2: \`config.combattimento.essenze_per_lv2\` (default 3)

\- Lv2 → Lv3: \`config.combattimento.essenze_per_lv3\` (default 5)

\- L\'essenza spesa deve \*\*matchare almeno uno dei tag\*\*
dell\'equipaggiamento. Esempio: una Spada con
\`tag=\[\"taglio\",\"fuoco\"\]\` può essere salita con Essenze di Taglio
\*\*o\*\* Essenze di Fuoco.

\- La salita di livello è \*\*AUTOMATICA\*\* appena il PG accumula le
essenze necessarie ed entra in un nodo di riposo o all\'inizio di un
nodo (vedi §4.2 step 7). La policy esatta del trigger è materia di
bilanciamento.

\- Le stat del pezzo migliorano secondo \`stats_per_livello\`.

\`auto_evoluzione_equip(state, pg_id) → state\`:

\`\`\`

PER ogni slot in \[arma, armatura, talismano\]:

equip = pg.equipaggiamento\[slot\]

SE equip == null: continue

SE equip.livello == 3: continue // ramo già scelto? gestito sotto

livello_target = equip.livello + 1

costo_essenze = (livello_target == 2)

? config.combattimento.essenze_per_lv2

: config.combattimento.essenze_per_lv3

// L\'essenza usata deve matchare uno dei tag dell\'equip.

// Cerca il tag dell\'equip per cui pg.essenze\[tag\] \>= costo.

tag_utilizzabile = trova_tag(equip.tag, pg.essenze, costo_essenze)

SE tag_utilizzabile != null:

pg.essenze\[tag_utilizzabile\] -= costo_essenze

equip.livello = livello_target

invalida pg.sinergie_attive

valuta_sinergie_passive(state, pg_id)

log \"evoluzione_livello\" { pg_id, slot, nuovo_livello, tag_speso }

\`\`\`

\#### \*\*Fase 2 --- Scelta del ramo (solo al raggiungimento del
Lv3)\*\*

\- Quando un pezzo arriva al Lv3, \*\*NON evolve subito\*\* nella forma
finale: rimane \"Lv3 base\" finché non scatta il trigger narrativo.

\- Ogni pezzo ha \*\*2-3 forme_finali\*\*, ciascuna con un proprio
trigger (vedi \`RamoEvolutivo\` in §1.9).

\- Quando un trigger viene soddisfatto durante la run, l\'UI mostra al
PG il bivio di evoluzione; se più trigger sono soddisfatti per lo stesso
pezzo, il PG sceglie.

\- Una volta scelta una forma, \*\*non è più modificabile in quella
run\*\*.

\#### \*\*§5.11.1 --- Tipologie di trigger narrativi\*\*

Il campo \`trigger.tipo\` del \`RamoEvolutivo\` accetta i valori:

\| \*\*Tipo trigger\*\* \| \*\*Significato\*\* \| \*\*Esempio
parametro\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| nodo_tipo \| Il PG deve completare un nodo di un certo tipo \|
\`\"speciale\"\`, \`\"tesoro\"\` \|

\| mondo \| Si attiva solo nel mondo specificato \| \`\"MONDO_FOR\"\` \|

\| png_amico \| Richiede un certo PNG amichevole in gioco \|
\`\"PNG_GUARDIANO\"\` \|

\| kill_categoria \| Uccidere un nemico di una certa categoria \|
\`\"boss\"\`, \`\"elite\"\` \|

\| libero \| Sempre disponibile (rami \"baseline\" senza vincoli) \| ---
\|

\`# EXT_TRIGGER_COMPOSTI\`: i trigger composti (AND/OR) sono futuro, non
MVP.

\#### \*\*§5.11.2 --- Drop delle essenze (richiamo da §5.7 step 9)\*\*

Le essenze si ottengono da quattro fonti durante la run:

1\. \*\*Vittorie sui nemici\*\* (fonte principale): drop deterministico
basato su \`CardNemico.essenza_drop\` al momento del kill (§5.7 step 9).
Quantità tipica: 1 essenza per categoria listata.

2\. \*\*Nodi tesoro\*\* (§4.5): 1-2 essenze casuali pesate sul mondo
corrente.

3\. \*\*Scelte di evento\*\* (§6.1): alcune scelte A/B premiano con
essenze (encoded via EffettoPayload).

4\. \*\*Twist positivi\*\* (rari).

\*\*PARKING_LOT_ESSENZE_DROP_TABLE\*\*: la tabella di drop fine (quante
essenze drop per categoria nemico, pesi per mondo) è da definire in
bilanciamento.

\#### \*\*§5.11.3 --- Stato delle essenze nel GameState\*\*

Già incluso in \`PGState\` (§2.2):

\`\`\`

essenze: {

fuoco: 0, acqua: 0, terra: 0, aria: 0, oscurita: 0, luce: 0,

taglio: 0, impatto: 0, perforante: 0, energia: 0

}

\`\`\`

Le essenze persistono per tutta la run. Non si \"consumano\"
automaticamente a fine combat: vengono spese solo quando un trigger di
evoluzione (§5.11 Fase 1) le impegna.

\# \*\*§6 --- Risoluzione di eventi e scelte (BIVIO)\*\*

\### \*\*§6.1 --- Funzione risolvi_evento()\*\*

\`risolvi_evento(state, carta_evento_id, scelta) → GameState\`

INPUT:

\- \`scelta\`: \`\"A\"\` \| \`\"B\"\`

PASSI:

\- Recupera CardEvento dal mazzo Destino.

\- Presenta \`testo_narrativo\` + \`scelta_A\` + \`scelta_B\` all\'UI.

\- Attendi input (scelta giocatore corrente, oppure voto di gruppo).

\- Applica effetto della scelta selezionata.

\- L\'effetto è un oggetto EffettoPayload (§6.2).

\- Log \`\"scelta_evento\"\` con scelta e payload.

\- \`nodo.stato = \"risolto\"\` (se \`trigger == \"esplorazione\"\`).

\### \*\*§6.2 --- Schema EffettoPayload (v0.6, esteso)\*\*

Per essere processabile da codice, \`scelta_A\` e \`scelta_B\` nelle
CardEvento sono oggetti strutturati. Lo stesso schema è usato dalle
\`CardConsumabile.effetto\` (§1.9bis):

\`\`\`

EffettoPayload = {

testo_outcome: string, // narrazione del risultato

modifiche: \[

{

target:
\"pg_corrente\"\|\"tutti_pg\"\|\"png\"\|\"mazzo\"\|\"mappa\"\|\"nemico\"\|\"tutti_nemici\",

operazione: \"pv+\"\|\"pv-\"\|\"en+\"\|\"en-\"\|\"pesca\"\|\"scarta\"\|

\"status\"\|\"aggiungi_carta\"\|\"rimuovi_carta\"\|

\"salta_nodo\"\|\"rivela_nodo\"\|

// Nuovi in v0.6:

\"essenza+\"\|\"essenza-\"\|\"equipaggia\"\|\"evoluzione_offerta\",

valore: integer\|string\|object

}

\],

rischio: { probabilita: 0..1, fallback: { /\* modifiche se fallisce \*/
} }

}

// \# EXT_EVENT_OPS: aggiungere operazioni qui senza modificare codice
base

\`\`\`

\*\*Note v0.6 sulle nuove operazioni:\*\*

\- \`essenza+\` / \`essenza-\`: il valore è \`{ tag: \"fuoco\",
quantita: 2 }\`. Modifica \`pg.essenze\[tag\]\`.

\- \`equipaggia\`: il valore è \`{ slot: \"arma\", carta_id:
\"EQP\_\...\" }\`. Equivale alla giocata di una CardEquipaggiamento
(§5.5) ma scatena la stessa rivalutazione σ2.

\- \`evoluzione_offerta\`: il valore è \`{ slot: \"arma\", forma_id:
\"FORMA_X\" }\`. Apre il bivio di scelta della forma_finale (§5.11 Fase
2). Usato in eventi narrativi che soddisfano trigger.

\# \*\*§7 --- Regole di mondo, luogo, twist (applicazione)\*\*

\### \*\*§7.1 --- Ordine di applicazione modificatori (v0.6)\*\*

Quando più effetti modificano la stessa azione, l\'ordine è fisso. In
v0.6 questa pipeline è \*\*integrata direttamente\*\* nella
\`pipeline_danno()\` di §5.7 per il caso \"calcolo del danno\". Per le
altre azioni (pesca, energia, modifiche allo state), la pipeline
concettuale resta:

\`\`\`

pipeline_modificatori(azione) =

1\. regola_mondo (CardMondo.regola_mondo)

2\. effetto_luogo_corrente (CardLuogo.effetto_meccanico)

3\. twist_attivi (CardTwist.effetto_meccanico)

4\. effetto_passivo_png (CardPNG.effetto_passivo)

5\. status_attaccante (forza, marchio, ecc.)

6\. status_target (debolezza, scudo, ecc.)

7\. equipaggiamento (bonus armi/armature/talismani)

8\. sinergie σ1/σ2 (§5.6)

\`\`\`

REGOLA: i modificatori si compongono \*\*moltiplicativamente\*\* per
moltiplicatori, \*\*additivamente\*\* per modifiche piatte. Tutti gli
effetti devono dichiarare se sono \`\"moltiplicatore\"\` o
\`\"piatto\"\`.

\*\*Nota v0.6.\*\* Per il calcolo del danno specifico, la pipeline
canonica è quella di §5.7 (9 step). Per altre operazioni (es. \"ogni PG
cura 1 PV a fine round\" da regola_mondo), gli effetti seguono l\'ordine
sopra ma vengono applicati direttamente, non passano per la pipeline
danno.

\### \*\*§7.2 --- Schema regola_strutturata\*\*

Per consentire al codice di applicare \`regola_mondo\` /
\`effetto_meccanico\` senza parsing di testo libero, ogni regola può
avere una versione strutturata accanto al testo descrittivo:

\`\`\`

regola_strutturata = {

trigger: \"ogni_turno\"\|\"in_combattimento\"\|\"in_esplorazione\"\|

\"su_azione\"\|\"su_danno\"\|\"su_status\"\|\"sempre\",

condizione: { /\* DSL semplice, es. {\"pv_pg\": \"\<50%\"} \*/ } \|
null,

effetto: {

operazione:
\"modifica_danno\"\|\"modifica_pesca\"\|\"modifica_energia\"\|

\"applica_status\"\|\"blocca_azione\"\|\"trigger_evento\",

bersaglio:
\"pg\"\|\"nemico\"\|\"tutti_pg\"\|\"tutti_nemici\"\|\"campo\",

tipo: \"moltiplicatore\"\|\"piatto\",

valore: number\|string

}

}

\`\`\`

\# \*\*§8 --- Interfaccia tra UI e motore di gioco\*\*

Il motore espone un\'API event-driven. La UI HTML invia comandi, riceve
eventi.

\### \*\*§8.1 --- Comandi UI → motore (v0.6)\*\*

\`\`\`

Comando = {

tipo: \"nuova_partita\"\|\"scegli_classe\"\|\"avanza_nodo\"\|

\"gioca_carta\"\|\"passa_turno\"\|\"scegli_scelta_evento\"\|

\"equipaggia\"\|\"salva\"\|\"carica\"\|

// Nuovi in v0.6:

\"attacco_base\"\|\"usa_talismano_attivo\"\|\"scegli_forma_finale\",

payload: object

}

\`\`\`

Esempi:

\`\`\`

{ tipo: \"gioca_carta\",

payload: { pg_id: \"pg_1\", carta_id: \"ATK_AFFONDO\", target: \"nem_2\"
} }

{ tipo: \"attacco_base\",

payload: { pg_id: \"pg_1\", target: \"nem_2\" } } // v0.6

{ tipo: \"usa_talismano_attivo\",

payload: { pg_id: \"pg_1\", target: \"se\" } } // v0.6

{ tipo: \"scegli_forma_finale\",

payload: { pg_id: \"pg_1\", slot: \"arma\", forma_id: \"FORMA_ECLISSI\"
} } // v0.6

{ tipo: \"scegli_scelta_evento\", payload: { scelta: \"A\" } }

\`\`\`

\### \*\*§8.2 --- Eventi motore → UI\*\*

\`Evento = EventoLog\` (vedi §2.4)

La UI sottoscrive il log e re-renderizza componenti pertinenti.

Pattern consigliato: \`subscribe(callback)\` → \`callback(stato_nuovo,
eventi_delta)\`.

\### \*\*§8.3 --- Stato di errore (v0.6)\*\*

\`\`\`

OperazioneRisultato = {

ok: boolean,

state: GameState\|null,

errore: { codice: string, messaggio: string } \| null

}

\`\`\`

Codici errore standard:

\| \*\*Codice\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \|

\| ERR_FASE_NON_VALIDA \| Comando ricevuto in fase sbagliata \|

\| ERR_ENERGIA_INSUFFICIENTE \| costo \> pg.energia (vale anche per
\`costo_extra\` dell\'attacco base, §5.2bis) \|

\| ERR_TARGET_NON_VALIDO \| Target non esiste o non rispetta
\`carta.target\` \|

\| ERR_CARTA_NON_IN_MANO \| Carta non posseduta \|

\| ERR_TURNO_NON_TUO \| \`pg_id != turno_di\` \|

\| ERR_KO \| PG in ko, non può agire \|

\| ERR_DATI_NON_CARICATI \| \`carica_dati()\` non eseguito (§1.11.3) \|

\| ERR_ARMA_NON_EQUIPAGGIATA \| (v0.6) Tentativo di attacco base senza
arma --- non dovrebbe mai accadere visto che gli slot sono sempre
occupati, ma è registrato per resilienza \|

\| ERR_FORMA_FINALE_NON_DISPONIBILE \| (v0.6) Trigger del ramo evolutivo
non soddisfatto \|

\# \*\*§9 --- Determinismo, salvataggio, replay\*\*

\### \*\*§9.1 --- RNG centralizzato\*\*

\`rng(state) → { state_nuovo, valore }\`

\- Tutta la casualità (pesca, twist, PNG, AI random, drop essenze
probabilistici) passa da qui.

\- \`state.rng_state\` viene aggiornato dopo ogni chiamata.

\- PRNG raccomandato: mulberry32 o sfc32 (semplici, deterministici).

\### \*\*§9.2 --- Salvataggio\*\*

Il GameState è interamente serializzabile in JSON. Il salvataggio è una
singola operazione \`localStorage.setItem(\'save\',
JSON.stringify(state))\`.

\*\*Nota v0.6.\*\* I nuovi campi (\`essenze\`,
\`equipaggiamento.\<slot\>.livello\`, \`sinergie_attive\`, ecc.) sono
tutti JSON-serializzabili: nessuna logica di serializzazione aggiuntiva
è richiesta.

\### \*\*§9.3 --- Convenzione di mutabilità del codice (v0.4, vale anche
per v0.6)\*\*

Regola operativa per chi lavora sul codice del motore. Non è una regola
di gioco ma una scelta architetturale che evita una classe di bug
ricorrente.

\*\*Principio.\*\* Lo stato del gioco (GameState, §2.1) è semanticamente
immutabile \*all\'esterno\* di ogni funzione esposta, ma viene mutato
\*internamente\* per evitare cloni a cascata.

\*\*Regola operativa.\*\*

\- Ogni \*\*entry point\*\* (funzione esposta nel \`module.exports\` o
chiamata direttamente da UI/test) \*\*clona lo state UNA VOLTA
all\'inizio\*\* con \`clone(state)\`, e ritorna il clone modificato.
Esempi v0.6: \`gioca_carta\`, \`esegui_attacco_base\`, \`passa_turno\`,
\`avvia_combattimento\`, \`risolvi_nodo\`, \`risolvi_evento\`,
\`avanza_nodo\`, \`scegli_forma_finale\`.

\- Tutte le \*\*funzioni interne\*\* (\`\_pesca_carte\`,
\`\_pipeline_danno\`, \`\_applica_status_tick\`,
\`\_verifica_condizioni_uscita\`, le funzioni del ciclo turno,
\`\_valuta_sinergie_attive\`, \`\_valuta_sinergie_passive\`,
\`\_auto_evoluzione_equip\`) \*\*NON clonano\*\*: lavorano in place
sullo state ricevuto.

\- La funzione \*\*\`\_log_append\` modifica lo state in place e ritorna
lo stesso oggetto\*\*. Non clona.

\*\*Perché.\*\* In v0.3 ogni \`\_log_append\` clonava lo state e
ritornava un nuovo oggetto. Tenere riferimenti a oggetti annidati (es.
\`const nodo = s.mappa.nodi\[s.mappa.nodo_corrente\]\`) attraverso una
\`\_log_append\` rendeva quei riferimenti \*stale\*: modifiche
successive (\`nodo.stato = \"risolto\"\`) finivano nel vuoto perché
\`nodo\` puntava al clone precedente. Questo ha causato tre bug
consecutivi durante lo sviluppo di \`esplorazione.js\` ed
\`eventi_mondo.js\`. Il refactor v0.4 di \`combattimento.js\` allinea
tutti i moduli a questa convenzione.

\*\*Effetto collaterale positivo.\*\* Una giocata di carta produce ora
\~5-8 cloni anziché \~30. Le run più lunghe sono percettibilmente più
reattive.

\*\*Estensione v0.6.\*\* La pipeline_danno (§5.7) è interna: lavora in
place. Solo gli entry point esposti (\`gioca_carta\`,
\`esegui_attacco_base\`) clonano. La rivalutazione σ2
(\`valuta_sinergie_passive\`) è interna e in place.

\### \*\*§9.4 --- Replay\*\*

Il log eventi + seed iniziale è sufficiente a ricostruire la partita
passo passo. Utile per debug e per la UI \'cronaca della run\'.

\# \*\*§10 --- Condizioni di vittoria e sconfitta\*\*

\- \*\*Vittoria:\*\* il boss del nodo finale
(\`config.run.nodi_totali\`) viene sconfitto.

\- \*\*Sconfitta:\*\* tutti i PG hanno \`ko == true\` contemporaneamente
in qualsiasi combattimento.

\- \*\*Abbandono:\*\* evento gestito separatamente (comando
\`\"abbandona_run\"\`).

Al termine, la UI mostra un riepilogo narrativo costruito ricomponendo
gli \`EventoLog\` di tipo \`\"twist_rivelato\"\`, \`\"png_apparso\"\`,
\`\"scelta_evento\"\`, \`\"ko\"\` e (v0.6) \`\"forma_finale_scelta\"\`.

\### \*\*§10.x --- Limitazioni note del MVP (parking lot) --- v0.6\*\*

Lista esplicita di cosa è previsto dal regolamento ma \*\*non ancora
implementato\*\* nel motore. Ciascuno è marcato nel codice con un
commento \`PARKING_LOT\_\*\` per ritrovarlo durante lo sviluppo
successivo.

\*\*Parking lot ancora aperti (residui da v0.5):\*\*

\| Marcatore \| Dove \| Cosa manca \| Step previsto \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| PARKING_LOT_EFFETTI_AVANZATI \| combattimento.js, gioca_carta \| Le
carte hanno \`effetto_meccanico\` come testo libero italiano. Solo il
\`valore_numerico\` base viene applicato. Gli effetti speciali (\"danno
doppio se bersaglio ha sanguinamento\", \"+1 carta a fine combat\") sono
solo narrativa. \| Quando \`regola_strutturata\` (§7.2) sarà aggiunta al
CSV \|

\| PARKING_LOT_PIPELINE_MODIFICATORI \| combattimento.js, vari \| §7.1
pipeline completa di \`regola_mondo\` + \`effetto_luogo\` +
\`effetto_passivo PNG\` + equipaggiamento non applicata. Solo
forza/marchio/debolezza/scudo/difesa agiscono. \| Step 16 (combat v0.6)
\|

\| PARKING_LOT_AI_ABILITA_SPECIALE \| combattimento.js, turno_nemici \|
I nemici hanno \`abilita_speciale\` + \`trigger_abilita\` nei CSV ma non
vengono mai attivati. Pattern AI normali funzionano, abilità speciali
no. \| Step 16 \|

\| PARKING_LOT_RICOMPENSE \| combattimento.js,
\_verifica_condizioni_uscita \| Vittoria di combattimento non
distribuisce \`ricompensa_narrativa\` dei nemici sconfitti e non fa
pescare 1 CardErrante extra come drop. \| Step bilanciamento futuro \|

\| PARKING_LOT_RIVELA_NODO \| esplorazione.js,
\_applica_singola_modifica \| Operazione \`rivela_nodo\` di
EffettoPayload non implementata. \| Quando UI sarà più matura \|

\| PARKING_LOT_TWIST_AVANZATI \| eventi_mondo.js,
\_applica_effetto_twist \| Solo 4 pattern regex riconoscono effetti
meccanici dei twist. Nuovi twist con descrizioni diverse saranno solo
narrativi. \| Quando twist avranno \`regola_strutturata\` \|

\| Debito tecnico \_DB_REF \| combattimento.js, turno_nemici \|
Variabile globale di modulo settata da \`avvia_combattimento\` per
passare \`db\` a \`esegui_comportamento\`. Rende il modulo non
thread-safe. \| Step 16 (combat v0.6): propagazione esplicita di db
lungo la catena del ciclo turno \|

\*\*Parking lot CHIUSI in v0.6:\*\*

\| Marcatore \| Stato \| Note \|

\| \-\-- \| \-\-- \| \-\-- \|

\| PARKING_LOT_SINERGIE \| \*\*CHIUSO in v0.6\*\* \| §5.6 ora specifica
completamente il sistema σ1/σ2. Resta da popolare \`sinergie.json\`
(PARKING_LOT_SINERGIE_POOL_INIZIALE). \|

\*\*Parking lot NUOVI introdotti da v0.6:\*\*

\| Marcatore \| Dove \| Cosa manca \| Step previsto \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| PARKING_LOT_SINERGIE_POOL_INIZIALE \| data/sinergie.json \| 15-20
sinergie iniziali da definire (\~10 σ1 + \~5-10 σ2). Pool concreto è
authoring. \| Authoring v0.6 \|

\| PARKING_LOT_ESSENZE_DROP_TABLE \| data/nemici.csv, combattimento.js
step 9 \| Drop rate fini per categoria nemico e bilanciamento per mondo.
La meccanica funziona (drop deterministico via \`essenza_drop\`), manca
il \*quanto\* per nemico. \| Bilanciamento \|

\| PARKING_LOT_EVOLUZIONE \| combattimento.js, esplorazione.js \|
\`auto_evoluzione_equip\` e flusso scelta \`forma_finale\` sono
specificati (§5.11) ma non ancora codificati. \| Step 16 \|

\| PARKING_LOT_CLASSI_PG \| data/classi.csv \| Lista delle classi PG,
statistiche di partenza, \`equipaggiamento_iniziale\` concreto per slot.
Schema v0.5 (§13.4) c\'è, contenuto no. \| Authoring \|

\| PARKING_LOT_BILANCIAMENTO_CARTE \| data/attacchi.csv,
data/abilita.csv \| Tabella di riferimento per costo EN → danno della
carta, equilibrio attacco base ripetuto vs carta Attacco singola. \|
Bilanciamento \|

\| PARKING_LOT_MIGRAZIONE_OGGETTI \| data/equipaggiamenti.csv,
data/consumabili.csv \| Split di \`oggetti.csv\` v0.5 in due file, con
conversione degli effetti in payload strutturati (§6.2). \|
Authoring/dati pre-Step 16 \|

\| PARKING_LOT_TABELLA_TESORO \| data/tesori.json (TBD) \| Tabella di
drop per nodi tesoro (§4.5). \| Bilanciamento \|

\# \*\*§11 --- Estensioni future (# EXT registry) --- v0.6\*\*

Tutti i punti marcati come \`# EXT\` nel codice e in questo documento
sono punti di estensione progettati per non rompere la struttura
esistente. Roadmap:

\| \*\*ID\*\* \| \*\*Estensione\*\* \| \*\*Sezione di intervento\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| EXT_GRAPH_MAP \| Mappa a grafo invece che lineare \| §3.2 \|

\| EXT_DECKBUILD \| Deck-builder pre-partita per PG \| §3.3 \|

\| EXT_SINERGIE_PLUS \| Nuovi tag e sinergie \| §5.6, sinergie.json \|

\| EXT_STATUS_NEW \| Nuovi tipi di StatusEffect \| §2.6, §5.3 \|

\| EXT_EVENT_OPS \| Nuove operazioni in EffettoPayload \| §6.2 \|

\| EXT_MULTI_BOSS \| Più boss intermedi \| §3.2 \|

\| EXT_NETPLAY \| Sincronizzazione multi-client \| §8 (layer trasporto)
\|

\| EXT_BUILD_JSON \| Build CSV → singolo cards.json \| §1.11.4 \|

\| EXT_NARR_AI_LIVE \| Chiamate AI a runtime per certi momenti narrativi
\| §13.8, §13.11 \|

\| EXT_NARR_LINGUE \| Template narrativi multilingua \| §13.8.2, §13.11
\|

\| EXT_NARR_PERSONALITA \| Personalità narrativa per PG \| §13.11 \|

\| EXT_NARR_MEMORIA_PROFONDA \| Memoria narrativa estesa con decay \|
§13.9, §13.11 \|

\| EXT_NARR_DIRETTORE \| Meta-componente regista del ritmo narrativo \|
§13.11 \|

\| \*\*EXT_TRIGGER_COMPOSTI\*\* \*(v0.6)\* \| Trigger narrativi composti
(AND/OR) per i rami evolutivi \| §5.11, §1.9 RamoEvolutivo \|

\| \*\*EXT_IMMUNITA\*\* \*(v0.6)\* \| Immunità totale ×0 (oggi non
implementata) \| §5.7 step 4 \|

\| \*\*EXT_SINERGIE_MULTI_PG\*\* \*(v0.6)\* \| Sinergie σ3
multi-giocatore \| §5.6 \|

\| \*\*EXT_CONDIZIONI_SINERGIA\*\* \*(v0.6)\* \| Nuove tipologie di
condizione nelle sinergie \| §5.6.2 \|

\| \*\*EXT_BUFF\*\* \*(v0.6)\* \| Buff aggiuntivi moltiplicativi nello
step 3 della pipeline \| §5.7 step 3 \|

\*\*Estensioni già implementate in v0.4:\*\*

\| \# EXT \| Stato \| Sezione \| Note \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| EXT_TRACK_DAMAGE \| Implementato \| §2.3 \| NemicoIstanziato include
\`danni_per_pg\` e \`comportamento\` \|

\| EXT_BONUS_CARTE_RIPOSO \| Implementato \| §2.2 \| PGState include
\`bonus_carte_prossimo_turno\` \|

\| EXT_COMBAT_TRANSITION \| Implementato \| §5.10 \|
\`fine_combattimento\` è ora fase transitoria \|

\# \*\*§12 --- Checklist per chi implementa (Opus 4.7)\*\*

Ordine consigliato per scrivere il codice, una sezione alla volta:

1\. Definire i tipi (TS) o schemi (JSON Schema) di §1 e §2.

2\. Implementare \`carica_dati()\` (§1.11.3) e validare i CSV contro gli
schemi §1.2-§1.10.

3\. Implementare \`rng\` + \`setup_partita\` (§3).

4\. Implementare la macchina a stati delle fasi (§5.1) come switch.

5\. Implementare \`gioca_carta\` + \`applica_danno\` + \`status_tick\`
(§5.5-5.7).

6\. Implementare i pattern AI nemici come funzioni pure (§5.9).

7\. Implementare risoluzione nodi non-combat (§4.1, §6).

8\. Layer UI (HTML/JS): renderizzare GameState, inviare Comandi (§8).

9\. Test deterministico: stesso seed → stessa run.

10\. Bilanciamento via \`config.json\` + CSV, senza toccare codice.

11\. \*\*(v0.5)\*\* Strato narrativo statico: implementare
\`motore/narratore.js\` (§13.8), aggiornare \`carica_dati()\` per skip
campi \`\_\*\` (§1.11.3), aggiungere \`classi.csv\` e
\`lessico_elementi.csv\` (§13.4, §13.5), aggiornare GameState con
\`memoria_narrativa\` e \`atto_corrente\` (§2.1, §13.9), integrare con
\`setup.js\`, \`esplorazione.js\`, \`combattimento.js\`,
\`eventi_mondo.js\` (§13.10), aggiornare UI con schermate
prologo/raccordo/banner/epilogo (§13.10.5). Authoring offline delle
carte esistenti seguendo §14.

12\. \*\*(v0.6, NUOVO) Step 16 --- Refactor Fase Combattimento\*\*:

\- Migrare \`oggetti.csv\` → \`equipaggiamenti.csv\` +
\`consumabili.csv\` (§1.11.5).

\- Aggiungere campo \`tag\` alle carte Attacco esistenti e a tutti gli
equipaggiamenti (PARKING_LOT_BILANCIAMENTO_CARTE).

\- Aggiungere \`vulnerabilita\`, \`resistenza\`, \`essenza_drop\` ai
nemici esistenti.

\- Implementare \`esegui_attacco_base()\` (§5.2bis) come nuovo entry
point del motore.

\- Sostituire \`applica_danno()\` con \`pipeline_danno()\` a 9 step
(§5.7).

\- Implementare \`valuta_sinergie_attive\` e \`valuta_sinergie_passive\`
(§5.6.4); popolare \`sinergie.json\` con 15-20 record.

\- Aggiungere stato runtime al PGState: \`essenze\`,
\`attacco_base_gratuito_consumato_questo_turno\`, \`sinergie_attive\`,
\`carte_giocate_per_tag_turno\` (§2.2).

\- Implementare \`auto_evoluzione_equip()\` e flusso scelta
\`forma_finale\` (§5.11).

\- Aggiornare la UI con: pulsante attacco base, indicatore essenze,
schermata scelta forma finale, indicatore sinergie attive.

\- Risolvere il debito tecnico \`\_DB_REF\` (propagazione esplicita di
\`db\` lungo il ciclo turno).

\### Stato dell\'implementazione (al 17/5/2026, v0.4)

\| Step \| Stato \| File del motore \| Note \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| 1-2 \| ✅ Fatto \| motore/setup.js \| Schemi inline nel parser \|

\| 3 \| ✅ Fatto \| motore/setup.js \| mulberry32, deterministico \|

\| 4-5 \| ✅ Fatto \| motore/combattimento.js \| Refactor v0.4 applicato
\|

\| 6 \| ✅ Fatto \| motore/ai_nemici.js \| 6 pattern + combinazioni \|

\| 7 \| ✅ Fatto \| motore/esplorazione.js, motore/eventi_mondo.js \|
Inclusi Twist (§4.3) e PNG (§4.4) \|

\| 8 \| ✅ Fatto \| web/index.html, web/style.css, web/app.js,
strumenti/build_browser.js \| Bundle browser da Node modules \|

\| 9 \| ✅ Fatto \| --- \| Determinismo verificato \|

\| 10 \| ⏳ In corso \| data/\*.csv, data/config.json \| Iterazione via
playtest \|

\| 11 (v0.5) \| ⏳ Pianificato \| --- \| Authoring carte + modulo
narratore \|

\| 16 (v0.6) \| 📋 Definito, da implementare \| data/\*,
motore/combattimento.js, motore/setup.js, web/app.js \| Vedi parking lot
v0.6 \|

\### Prossimi step suggeriti (v0.6)

\- \*\*Step 16\*\* (vedi sopra): refactor Fase Combattimento.
\*\*Priorità ALTA\*\*, perché tocca l\'intero ciclo turno.

\- \*\*Step 17 (post-combat)\*\*: secondo mondo (es. Cime Frangenti /
aria) per ampliare il dataset.

\- \*\*Step 18\*\*: salvataggio + replay su localStorage (richiama §9.2,
§9.4).

\- \*\*Step 19 (v0.5)\*\*: strato narrativo statico (§13). Authoring AI
offline dei campi narrativi sulle carte esistenti + modulo
\`motore/narratore.js\` + integrazione UI per prologo/raccordi/epilogo.
Si \*\*integra naturalmente\*\* con i nuovi trigger narrativi
dell\'evoluzione (§5.11) --- quei momenti sono perfetti per \"scene
generate\".

\# \*\*§13 --- Strato narrativo statico\*\*

Capitolo nuovo introdotto in v0.5. Definisce come il gioco \*racconta\*
le proprie meccaniche. Non aggiunge meccaniche di gioco né tocca quelle
esistenti.

\### \*\*§13.0 --- Principi e campo di authoring
\`\_briefing_autore\`\*\*

Il problema. Il motore v0.4 genera testo (campo \`testo_narrativo\` di
EventoLog, §2.4) ma il testo è formulaico: i giocatori vedono una
sequenza di nodi e di combattimenti senza una storia che li unisca. Una
run sembra una \*partita\*, non una \*narrazione\*.

L\'obiettivo. Far emergere dalle combinazioni di carte pescate (Mondo +
Luoghi + Nemici + PNG + Twist + Eventi + Classi PG) una \*\*storia
coerente e variabile\*\*, articolata in prologo + raccordi tra nodi +
commenti agli eventi chiave + epilogo. Il giocatore deve poter dire:
\*\"questa storia era della mia run, non poteva essere quella di
un\'altra\"\*.

Il vincolo. Zero chiamate AI a runtime, zero costi. Tutto deve essere
pre-generato in fase di authoring offline.

La soluzione. \*\*Combinatoria di frammenti narrativi pre-generati
dall\'AI\*\*. Le carte vengono arricchite con metadati narrativi (frasi,
aggettivi, parole-chiave, epiteti, dettagli sensoriali) prodotti una
sola volta da un\'AI esterna in fase di authoring. A runtime, un modulo
\`narratore.js\` ricompone questi frammenti via template parametrici,
sempre deterministicamente via \`rng_state\`.

\*\*\*Il campo\*\*\* \`\_briefing_autore\`. Per ogni carta che ha campi
narrativi derivati (Mondo, Luogo, Nemico, Evento, PNG, Twist, Oggetto,
Classe) l\'autore umano scrive un campo \`\_briefing_autore\` che
rappresenta la sua \*\*visione creativa della carta\*\*. Questo campo:

\- vive nel CSV insieme agli altri campi della carta (un\'unica fonte di
verità per carta);

\- inizia con underscore: in conformità a §1.11.1 il parser di gioco lo
\*\*\*ignora\*\*\*. Non viene mai letto a runtime;

\- viene letto solo dall\'AI di authoring offline (workflow §14) come
briefing primario per generare i campi narrativi derivati;

\- resta nel CSV anche dopo la generazione, come \*\*documentazione
viva\*\*: se mesi dopo l\'autore cambia idea sulla carta, basta
riscrivere il briefing e rilanciare il prompt di authoring per
rigenerare coerentemente tutti i campi derivati.

\*\*\*Struttura raccomandata del briefing.\*\*\* Cinque registri, in
ordine non rigido, in testo libero italiano:

1\. \*\*Concetto-cuore\*\*: in una frase, l\'idea essenziale della
carta. Cosa la rende quella carta e non un\'altra.

2\. \*\*Atmosfera ed emozione\*\*: cosa deve far provare al giocatore
quando incontra la carta (timore, malinconia, meraviglia, disagio,
speranza, ironia, ecc.).

3\. \*\*Riferimenti\*\*: a cosa assomiglia. Ispirazioni visive,
letterarie, cinematografiche, mitologiche, musicali. Anche un singolo
riferimento ben mirato vale più di una lista generica.

4\. \*\*Vincoli e antipatterns\*\*: cosa l\'AI NON deve fare. Cliché da
evitare, parole proibite, registri da non usare. Spesso è il registro
più importante: orienta negativamente.

5\. \*\*Tono linguistico\*\*: registro stilistico desiderato. Epico,
asciutto, ironico, lirico, sentenzioso, sussurrato, ecc. Lunghezza media
delle frasi, livello lessicale.

\*\*\*Esempio di briefing\*\*\* per il mondo \`MONDO_TUN\` (Tundra di
Cenere):

\`\"Una terra che era foresta lussureggiante e che oggi è solo cenere
fredda. Non è un mondo bruciato di recente: il Grande Rogo è avvenuto
generazioni fa, e ora la cenere è parte del paesaggio, della cultura,
persino del cibo. La gente che vi nasce ha la pelle pallida e gli occhi
che lacrimano sempre. Non c\'è disperazione attiva --- c\'è una
rassegnazione che è diventata identità. Atmosfera: malinconia
silenziosa, non orrore. Riferimenti: la steppa di Tarkovskij, certe
pagine di McCarthy. EVITA: cliché di terra-bruciata-post-apocalittica
con sopravvissuti aggressivi. Qui la gente è gentile, stanca, parla
poco. Tono linguistico: asciutto, parole semplici, ritmo lento.\"\`

\*\*\*Anti-pattern di briefing.\*\*\* Da NON scrivere:

\- \`\"Un mondo cupo e oscuro pieno di mostri.\"\` --- generico, non
orienta nessuna scelta lessicale.

\- \`\"Mondo fantasy classico.\"\` --- l\'AI restituirà cliché.

\- \`\"Vedi tu.\"\` --- non è un briefing, è abdicare all\'AI.

\### \*\*§13.1 --- Tassonomia narrativa universale (le cinque
dimensioni)\*\*

Ogni carta narrativa, indipendentemente dal tipo, è descritta secondo
cinque dimensioni costanti. La tassonomia è il \*\*contratto\*\* tra ciò
che l\'AI di authoring deve produrre e ciò che il motore di template a
runtime sa consumare.

\| \*\*Dimensione\*\* \| \*\*Cosa contiene\*\* \| \*\*Esempi di
campi\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| Identità \| Chi/cosa è la carta nei suoi nomi e archetipi \| epiteto,
epiteti_alternativi, archetipo_narrativo \|

\| Sensoriale \| Come si percepisce (vista, udito, olfatto, tatto) \|
senso_vista, senso_udito, senso_olfatto, senso_tatto, descrizione_fisica
\|

\| Emotivo \| Che tono evoca, che emozione attiva \| tono_dominante,
emozione_evocata, intensita_drammatica \|

\| Lessicale \| Parole-chiave e formule riusabili nei testi \|
lessico_evocativo, aggettivi_caratteristici, metafora_visiva \|

\| Relazionale \| Come si lega ad altre carte o a momenti narrativi \|
tag_tema, archetipo_avversario, memoria_lascia \|

Ogni schema di carta in §13.2 adatta queste cinque dimensioni alla
propria natura (un luogo ha più peso sensoriale, un PNG ha più peso
identitario e relazionale, un twist ha più peso emotivo).

\*\*\*Regola dei tre fini.\*\*\* Ciascun campo narrativo è progettato
per essere usato in tre modi diversi dal motore narratore (§13.8):

\- come \*\*sostituzione diretta in template\*\* (es.
\`{epiteto_boss}\`);

\- come \*\*selettore di pool\*\* di template (es. \`tono_dominante\`
decide quale pool di prologhi usare);

\- come \*\*iniezione lessicale opportunistica\*\* (es.
\`lessico_evocativo\` viene attinto per saturare slot generici).

Questa triplice utilità è la ragione per cui i campi sono molti ma
piccoli: ogni campo è una \"scheggia\" riusabile, non un blocco di
prosa.

\### \*\*§13.2 --- Estensioni schema CSV: campi narrativi derivati\*\*

Tutti i campi qui elencati sono \*\*opzionali\*\* (nullable in §1.11.1:
cella vuota = null). In assenza, il narratore (§13.8) degrada
elegantemente al fallback. Tutti sono generati dall\'AI di authoring
(workflow §14) a partire dal \`\_briefing_autore\` corrispondente.

\#### \*\*\*§13.2.1 --- CardMondo (estensione di §1.2)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI
(§13.0) \|

\| epiteto \| string \| Forma alternativa solenne del nome ("la Terra
che Brucia") \|

\| aggettivi_caratteristici \| array (3-5) \| Slot generici ("arsa",
"silente", "spaccata") \|

\| senso_vista \| string \| Frammento descrittivo visivo (\~10-15
parole) \|

\| senso_udito \| string \| Frammento descrittivo sonoro \|

\| senso_olfatto \| string \| Frammento descrittivo olfattivo \|

\| senso_tatto \| string \| Frammento descrittivo tattile \|

\| presagio \| string \| Una frase enigmatica (8-15 parole), per
aperture solenni \|

\| incipit_storico \| string \| 2-3 frasi sul passato del mondo, per il
prologo \|

\| tono_dominante \| enum \| cupo │ epico │ malinconico │ selvaggio │
misterioso │ ironico │ tragico \|

\| lessico_evocativo \| array (5-8) \| Termini ricorrenti da iniettare
nei testi \|

\| parola_potere \| string \| Nome misterioso nella lingua antica del
mondo \|

\| figura_retorica_ricorrente \| string \| Tema simbolico
("fuoco_che_consuma", "silenzio_che_grida") \|

\#### \*\*\*§13.2.2 --- CardLuogo (estensione di §1.3)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| epiteto \| string \| Variante solenne del nome \|

\| frase_avvistamento \| string \| Cosa si vede arrivando da lontano
(\~15 parole) \|

\| frase_arrivo \| string \| Cosa si percepisce attraversando la soglia
\|

\| frase_permanenza \| string \| Cosa si sente restando nel luogo \|

\| frase_partenza \| string \| Cosa resta addosso lasciandolo \|

\| dettaglio_unico \| string \| Un elemento concreto evocativo (es. "una
stele incisa in una lingua dimenticata") \|

\| aggettivi_atmosfera \| array (3-4) \| Slot generici \|

\| emozione_evocata \| enum \| timore │ meraviglia │ malinconia │
speranza │ disagio │ raccoglimento │ inquietudine \|

\| pericolo_latente \| string \| Per nodi pre-combattimento, sussurra il
pericolo \|

\| metafora_visiva \| string \| Per chiusure poetiche ("come una tomba
che non sa di esserlo") \|

\#### \*\*\*§13.2.3 --- CardNemico (estensione di §1.10)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| epiteto \| string \| Forma solenne ("il Mietitore delle Brughiere")
\|

\| epiteti_alternativi \| array (2-3) \| Variazioni per testi lunghi \|

\| descrizione_fisica \| string \| 1-2 frasi sull\'aspetto \|

\| verbo_apparizione \| enum \| emerge │ striscia │ scende │ sorge │ si
manifesta │ irrompe │ appare \|

\| verbo_attacco \| enum \| falcia │ squarcia │ morde │ trafigge │
strappa │ schiaccia │ scaglia \|

\| suono_caratteristico \| string \| Per atmosfera ("un sibilo basso
come metallo trascinato") \|

\| motivazione_breve \| string \| 1 frase sulla sua causa ("cerca ciò
che gli fu tolto") \|

\| frase_apparizione \| string \| 1-2 frasi all\'avvio del combattimento
\|

\| frase_sconfitta \| string \| Chiusura del combattimento se sconfitto
\|

\| frase_vittoria \| string \| Chiusura se ha ucciso un PG \|

\| aggettivi_minacciosi \| array (3-4) \| Slot generici \|

\| archetipo_avversario \| enum \| predatore │ sentinella │ corrotto │
tiranno │ errante_caduto │ bestia │ rivelazione \|

\#### \*\*\*§13.2.4 --- CardEvento (estensione di §1.4)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| ambientazione_specifica \| string \| Frammento che localizza
l\'evento ("in una radura dove il sole non arriva") \|

\| tag_tema \| array \| Etichette tematiche (tradimento, fiducia,
sacrificio, hybris...) --- usate dalla memoria_narrativa §13.9 \|

\| frase_post_scelta_A \| string \| Eco narrativa dopo aver scelto A \|

\| frase_post_scelta_B \| string \| Eco narrativa dopo aver scelto B \|

\| eco_lontana \| string \| Frammento usabile come callback in raccordi
successivi (§13.9) \|

\*\*\*Nota.\*\*\* I campi meccanici esistenti \`testo_narrativo\`,
\`scelta_A\`, \`scelta_B\` (§1.4) restano invariati. I nuovi campi sono
additivi e usati dal narratore.

\#### \*\*\*§13.2.5 --- CardPNG (estensione di §1.6)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| epiteto \| string \| (es. "il Mercante senza Volto") \|

\| descrizione_fisica \| string \| 1-2 frasi sull\'aspetto \|

\| tratto_caratterizzante \| string \| Un dettaglio comportamentale o
caratteriale memorabile \|

\| frase_apparizione \| string \| Come entra in scena \|

\| frase_saluto \| string \| Una battuta evocativa di apertura (con
virgolette) \|

\| frase_congedo \| string \| Una battuta evocativa di chiusura \|

\| voce_caratteristica \| string \| Come parla ("piano, scandendo ogni
parola") \|

\| aggettivi_natura \| array (3-4) \| Slot generici \|

\| frase_tradimento \| string \| Solo se ruolo=traditore: la frase della
rivelazione \|

\| memoria_lascia \| string \| Cosa "resta" del PNG dopo la sua
sparizione (per callback narrativi) \|

\#### \*\*\*§13.2.6 --- CardTwist (estensione di §1.5)\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| frase_annuncio \| string \| La frase di sospensione prima della
rivelazione \|

\| frase_rivelazione \| string \| La frase che dichiara il twist \|

\| frase_conseguenza \| string \| La frase che chiude e sposta il tono
\|

\| tag_tema \| array \| Etichette tematiche (tradimento, sovrannaturale,
corruzione...) \|

\| intensita_drammatica \| enum \| sussurro │ crepa │ rottura │
cataclisma \|

\#### \*\*\*§13.2.7 --- CardEquipaggiamento (estensione di §1.9) ---
v0.6\*\*\*

In v0.5 questa sezione descriveva il vecchio \`CardOggetto\`. In v0.6 lo
schema è stato splittato in due (§1.9 CardEquipaggiamento + §1.9bis
CardConsumabile): di conseguenza i campi narrativi sono distribuiti su
due tabelle distinte (§13.2.7 e §13.2.7bis).

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI
(visione creativa del pezzo: origine, mood, riferimenti) \|

\| storia_oggetto \| string \| 1-2 frasi sulla provenienza
dell\'equipaggiamento (per nodi tesoro e momenti di acquisizione) \|

\| frase_acquisizione \| string \| Come viene trovato/ricevuto la prima
volta \|

\| aggettivo_qualita \| string \| (\"consunto\", \"sigillato\",
\"opaco\") --- riusato dal narratore per descrizioni rapide \|

\| descrizione_aspetto_per_livello \| array (3) \| Una descrizione
fisica per ciascun livello (Lv1/Lv2/Lv3): cattura la trasformazione
visiva dell\'oggetto man mano che evolve \|

\| frase_evoluzione_a_lv2 \| string \| Frammento narrativo mostrato dal
narratore quando il pezzo sale da Lv1 a Lv2 \|

\| frase_evoluzione_a_lv3 \| string \| Frammento narrativo mostrato dal
narratore quando il pezzo sale da Lv2 a Lv3 \|

\| frasi_per_forma_finale \| object \| Dizionario \`{ \"FORMA_X\": {
frase_sblocco: \..., frase_scelta: \... } }\` per ciascun ramo
evolutivo. Usato dal narratore al momento della scelta della forma
finale (§5.11 Fase 2) \|

\| eco_in_combattimento \| string \| Frammento breve (1 riga) che il
narratore può iniettare nel log di combattimento per \"ricordare\" la
presenza dell\'oggetto (es. \"la spada sembra cantare al primo colpo\")
\|

\*\*\*Nota v0.6.\*\*\* I campi \`descrizione_aspetto_per_livello\` e
\`frasi_per_forma_finale\` rendono l\'evoluzione (§5.11) un evento
\*narrativo\* oltre che meccanico: il narratore può raccontare la
trasformazione del pezzo invece di limitarsi a un \"livello aumentato a
2\".

\#### \*\*\*§13.2.7bis --- CardConsumabile (estensione di §1.9bis) ---
v0.6\*\*\*

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Brief umano per l\'AI \|

\| storia_oggetto \| string \| 1 frase sulla provenienza (es. \"una
pozione preparata dagli erboristi della Soglia\") \|

\| frase_acquisizione \| string \| Come viene trovato \|

\| frase_uso \| string \| Cosa accade al PG quando lo usa, dal punto di
vista narrativo (es. \"tracanna la pozione e sente il petto scaldarsi\")
\|

\| aggettivo_qualita \| string \| (\"torbido\", \"fragrante\",
\"polveroso\") \|

\| suono_uso \| string \| Onomatopea narrativa al momento del consumo
(es. \"un sibilo, poi un fischio acuto\") \|

\#### \*\*\*§13.2.8 --- CardAttacco / CardAbilità (estensione di §1.7,
§1.8)\*\*\*

Minimi, servono al log di combattimento per rendere il flusso meno
meccanico.

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Significato\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| \_briefing_autore \| string (authoring) \| Opzionale (le carte azione
possono spesso fare a meno del briefing) \|

\| descrizione_gesto \| string \| Cosa fa fisicamente ("taglia l\'aria
con un fendente discendente") \|

\| descrizione_impatto \| string \| Cosa accade al bersaglio ("il colpo
apre una ferita lunga e netta") \|

\| aggettivo_stile \| enum \| feroce │ preciso │ selvaggio │ silenzioso
│ esplosivo │ trattenuto \|

\| suono_effetto \| string \| Onomatopea narrativa ("un sibilo seguito
da un tonfo") \|

\### \*\*§13.3 --- Mappatura nodi → atti narrativi (deterministica)\*\*

L\'arco narrativo della run è strutturato in tre atti, derivati dalla
posizione del nodo corrente sulla mappa di 12 nodi (configurato da
\`config.run.nodi_totali\`):

\| \*\*Atto\*\* \| \*\*Range nodi (nodi_totali=12)\*\* \| \*\*Funzione
drammatica\*\* \| \*\*Tono dei raccordi\*\* \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| I --- Esposizione \| nodi 1-3 \| Scoperta, viaggio, pericolo
crescente \| curioso, ammirato, vagamente apprensivo \|

\| II --- Confronto \| nodi 4-9 \| Escalation, perdite, rivelazioni \|
teso, instabile, drammatico \|

\| III --- Risoluzione \| nodi 10-12 \| Avvicinamento al boss, peso
delle scelte \| solenne, definitivo, di non ritorno \|

\*\*\*Formula deterministica.\*\*\* Dato \`n = nodo_corrente\`
(0-indexed) e \`N = nodi_totali\`:

\- se \`n / N \< 0.25\` → atto 1

\- se \`n / N \< 0.75\` → atto 2

\- altrimenti → atto 3

Il campo \`state.atto_corrente\` viene ricalcolato a ogni
\`avanza_nodo\` (§4.2). Il narratore consulta \`atto_corrente\` per
scegliere il pool di template appropriato (§13.6).

\### \*\*§13.4 --- Nuovo CSV: classi.csv\*\*

Le classi dei PG (guerriero/mago/ladro/guaritore) attualmente vivono
solo nel codice (\`motore/setup.js\`). Per la narrazione servono come
dati di prima classe, con i loro metadati.

Nuovo file \`/data/classi.csv\` con schema:

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Esempio (per guerriero)\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| CL_GUERRIERO \|

\| nome \| string \| Guerriero \|

\| \_briefing_autore \| string (authoring) \| (vedi §13.0) \|

\| archetipo_narrativo \| string \| il Protettore \|

\| archetipi_alternativi \| array (2-3) \| la Lama │ lo Scudo │ il
Veterano \|

\| descrizione_classe_breve \| string \| un guerriero indurito dalle
battaglie \|

\| tratto_caratterizzante \| string \| ha occhi che hanno visto troppe
guerre \|

\| motivazione_archetipo \| string \| protegge perché ha già perso
troppo \|

\| verbo_caratteristico \| string \| affronta \|

\| oggetto_simbolico \| string \| una spada con il fodero consunto \|

\| frase_introduzione \| string \| cammina per primo dove la strada è
più stretta \|

\| aggettivi_natura \| array (3-4) \| risoluto │ silenzioso │ leale \|

\| paura_segreta \| string \| non riuscire a proteggere chi gli sta
accanto \|

\| desiderio_segreto \| string \| un\'ultima battaglia che sia anche
l\'ultima \|

\*\*\*Nota implementativa.\*\*\* \`motore/setup.js\` (§3.1) deve essere
modificato in v0.5 per leggere la classe del PG da \`classi.csv\` invece
dell\'hardcoded \`classi_mvp\`. Vedi §13.10 e §14.

\### \*\*§13.5 --- Nuovo CSV: lessico_elementi.csv\*\*

Tabella di supporto: una riga per elemento, fornisce il \*\*dizionario
tematico\*\* trasversale a tutte le carte di quell\'elemento. Serve al
narratore per garantire coerenza linguistica a livello macro-tematico.

Nuovo file \`/data/lessico_elementi.csv\` con schema (1 riga per ciascun
elemento di \`ENUM_ELEMENTO\` --- terra/aria/acqua/fuoco/oscurità):

\| \*\*Campo\*\* \| \*\*Tipo\*\* \| \*\*Esempio (per fuoco)\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| id \| string \| EL_FUOCO \|

\| nome \| string \| fuoco \|

\| \_briefing_autore \| string (authoring) \| (opzionale per elementi)
\|

\| lessico_evocativo \| array (6-10) \| brace │ fiamma │ ardere │
forgiare │ cenere │ scintilla │ crepitare │ rovente \|

\| metafore \| array (2-3) \| come una fiamma al vento │ con la furia di
una forgia \|

\| colori_dominanti \| array (2-3) \| rosso │ arancio │ ocra \|

\| sensazioni \| array (2-3) \| calore soffocante │ scintille negli
occhi \|

\| verbi_caratteristici \| array (3-5) \| bruciare │ divorare │
consumare │ ardere \|

\*\*\*Uso.\*\*\* Quando il narratore deve riempire uno slot generico in
un template e non trova un valore specifico nella carta corrente,
attinge al \`lessico_elementi.csv\` corrispondente all\'elemento del
mondo della run. Questo garantisce che, anche se due luoghi diversi non
hanno lo stesso lessico, la coerenza tematica del mondo si mantiene.

\### \*\*§13.6 --- Libreria di prompt-pattern per authoring AI\*\*

Questa sezione è la \*\*libreria operativa\*\* di prompt da
copiare-incollare in una conversazione con un\'AI esterna (Claude, GPT,
Gemini --- qualsiasi modello con capacità di seguire istruzioni
strutturate) per arricchire una carta partendo dal suo
\`\_briefing_autore\` e dai suoi campi meccanici.

\*\*\*Convenzioni di tutti i prompt.\*\*\*

\- Il prompt è in italiano, perché il gioco è in italiano e l\'AI deve
scrivere direttamente in italiano.

\- Ogni prompt termina chiedendo l\'output \*\*\*in formato
pipe-separato CSV-compatibile\*\*\*, una colonna per campo, già pronto
da incollare nel CSV.

\- I prompt impongono i \*\*vincoli formali\*\* rilevanti per i campi
(es. \"lessico_evocativo deve essere 5-8 termini separati da \|\").

\- I prompt sono espliciti sulla \*\*lunghezza target\*\* dei singoli
frammenti (es. \"presagio: 8-15 parole, una sola frase, niente
punteggiatura forte\").

\- Ogni prompt include una clausola di stile: \"non usare cliché fantasy
generici, attieniti rigorosamente al briefing autore\".

\#### \*\*\*§13.6.1 --- Prompt-pattern per CardMondo\*\*\*

\`\`\`

RUOLO: Sei un autore narrativo che arricchisce schede di carte per un
gioco di

storie fantasy. La tua missione è generare campi narrativi derivati a
partire

dal briefing dell\'autore umano. Devi essere fedele al briefing, evitare
cliché,

e produrre testi brevi, evocativi, riusabili a runtime via template.

CARTA: CardMondo

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

elemento: {elemento}

descrizione_narrativa: \"{descrizione_narrativa}\"

regola_mondo: \"{regola_mondo}\"

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

ISTRUZIONI:

Produci i seguenti campi rispettando i vincoli per ciascuno. Output in
formato

pipe-separato, una riga per campo nel formato
\"nome_campo\|\|\|valore\". Non

aggiungere virgolette ai valori salvo dove indicato. Non scrivere
preamboli.

CAMPI DA GENERARE:

\- epiteto: una forma alternativa solenne del nome del mondo. 2-5
parole.

Esempio formato: \"la Terra che Brucia\"

\- aggettivi_caratteristici: 4 aggettivi che descrivono il mondo.
Separati da \"\|\".

Devono essere coerenti tra loro e con il briefing. Esempio:
\"spenta\|grigia\|silenziosa\|lenta\"

\- senso_vista: una frase di 10-15 parole su cosa si vede in quel mondo.

Niente metafore astratte: dettagli concreti, immagini fisiche.

\- senso_udito: una frase di 8-12 parole sul paesaggio sonoro.

\- senso_olfatto: una frase di 6-10 parole sull\'odore caratteristico.

\- senso_tatto: una frase di 6-10 parole sulla sensazione sulla pelle.

\- presagio: una frase enigmatica di 8-15 parole, usabile come apertura
solenne.

Non spiega, evoca. Esempio: \"Si dice che chi vi cammina dimentichi il
proprio nome\"

\- incipit_storico: 2-3 frasi (totale 30-50 parole) sul passato del
mondo.

Tono leggendario, scarno. Usabile nel prologo.

\- tono_dominante: scegli UNO tra: cupo, epico, malinconico, selvaggio,

misterioso, ironico, tragico. Quello che meglio si adatta al briefing.

\- lessico_evocativo: 6-8 termini ricorrenti coerenti col briefing.

Separati da \"\|\". NO aggettivi banali (\"oscuro\", \"antico\",
\"potente\").

Termini concreti o evocativi specifici. Esempio:
\"brace\|cenere\|forgia\|crepa\|ferita\|ardere\"

\- parola_potere: un singolo nome inventato che evochi la lingua antica
del

mondo. 2-4 sillabe. Esempio: \"Ynvar\", \"Solhal\", \"Therkin\".

\- figura_retorica_ricorrente: un tema simbolico in formato snake_case
che

caratterizzi il mondo. Esempio: \"fuoco_che_consuma\",
\"silenzio_che_grida\",

\"luce_che_ferisce\"

VINCOLI DI STILE GLOBALI:

\- Non usare le parole \"oscuro\", \"antico\", \"magico\",
\"leggendario\" salvo

che il briefing le imponga esplicitamente.

\- Privilegia lessico concreto e sensoriale.

\- Sii fedele al tono linguistico richiesto dal briefing.

\- Niente cliché fantasy generici.

\`\`\`

\#### \*\*\*§13.6.2 --- Prompt-pattern per CardLuogo\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardLuogo

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

tag_mondo: {tag_mondo}

tipo_nodo: {tipo_nodo}

descrizione_narrativa: \"{descrizione_narrativa}\"

effetto_meccanico: \"{effetto_meccanico}\"

universale: {universale}

DATI DEL MONDO DI APPARTENENZA (per coerenza):

nome_mondo: {nome_mondo}

elemento_mondo: {elemento_mondo}

tono_dominante_mondo: {tono_dominante_mondo}

lessico_evocativo_mondo: {lessico_evocativo_mondo}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- epiteto: variante solenne del nome del luogo. 2-5 parole.

\- frase_avvistamento: 12-18 parole. Cosa si vede arrivando da lontano.

Inquadratura ampia, prospettiva esterna.

\- frase_arrivo: 10-15 parole. Cosa si percepisce attraversando la
soglia.

Cambio di prospettiva: dall\'esterno all\'interno del luogo.

\- frase_permanenza: 10-15 parole. Cosa si sente restando nel luogo.

Senso del tempo che passa, atmosfera che permea.

\- frase_partenza: 10-15 parole. Cosa resta addosso lasciandolo.

Eco, traccia, peso.

\- dettaglio_unico: 8-15 parole. UN elemento concreto evocativo nel
luogo.

Es: \"una stele incisa in una lingua che nessuno ricorda più\",

\"un albero bruciato che ancora goccia resina nera\",

\"un altare con tracce di sale e di cenere\".

\- aggettivi_atmosfera: 3-4 aggettivi separati da \"\|\". Coerenti col
briefing

e col tono del mondo. Es: \"umido\|stagnante\|ovattato\"

\- emozione_evocata: scegli UNA tra: timore, meraviglia, malinconia,
speranza,

disagio, raccoglimento, inquietudine.

\- pericolo_latente: 8-15 parole. Sussurro di pericolo. Usato solo se

tipo_nodo è combattimento o speciale, ma genera in ogni caso (può
servire

per twist successivi).

\- metafora_visiva: 6-12 parole. Una metafora di chiusura, da usare in

raccordi poetici. Es: \"come una tomba che non sa di esserlo\",

\"come un sogno che si dimentica subito al risveglio\".

VINCOLI:

\- Il lessico del luogo deve essere coerente con
lessico_evocativo_mondo:

almeno una parola del mondo deve apparire nei frammenti del luogo.

\- Niente cliché del tipo \"ombre danzanti\", \"mistero impenetrabile\",

\"presenza maligna\".

\- Se il luogo è un nodo di riposo: privilegia frasi che evochino quiete

o ambiguità (non si sa mai se il riposo è davvero riposo).

\`\`\`

\#### \*\*\*§13.6.3 --- Prompt-pattern per CardNemico\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardNemico

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

tag_mondo: {tag_mondo}

categoria: {categoria} // comune \| elite \| boss

pv: {pv}

difesa: {difesa}

danno_base: {danno_base}

comportamento: {comportamento}

abilita_speciale: \"{abilita_speciale}\"

ricompensa_narrativa: \"{ricompensa_narrativa}\"

DATI DEL MONDO DI APPARTENENZA:

nome_mondo: {nome_mondo}

elemento_mondo: {elemento_mondo}

tono_dominante_mondo: {tono_dominante_mondo}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- epiteto: forma solenne del nome del nemico, da usare in apertura di

combattimento. 3-6 parole. Es: \"il Mietitore delle Brughiere\",

\"la Lama Senza Volto\".

\- epiteti_alternativi: 2-3 varianti separate da \"\|\". Usate nei testi

lunghi per evitare ripetizioni. Es: \"l\'Ombra che Cammina\|il
Silenzioso\"

\- descrizione_fisica: 1-2 frasi, totale 15-30 parole. Aspetto concreto.

\- verbo_apparizione: UN verbo tra: emerge, striscia, scende, sorge,

si manifesta, irrompe, appare. Quello più coerente col nemico.

\- verbo_attacco: UN verbo tra: falcia, squarcia, morde, trafigge,

strappa, schiaccia, scaglia. Coerente col danno_base e descrizione
fisica.

\- suono_caratteristico: 6-12 parole. Un suono che lo precede o lo
accompagna.

\- motivazione_breve: 1 frase di 10-15 parole. Cosa lo muove. Dà
profondità

anche a un mostro. Per i boss è più importante.

\- frase_apparizione: 1-2 frasi, totale 20-35 parole. L\'inizio dello
scontro.

Costruisce la tensione PRIMA che il combattimento meccanico inizi.

\- frase_sconfitta: 1 frase di 12-20 parole. Chiusura se il nemico è
sconfitto.

Niente trionfalismi: deve restare poesia.

\- frase_vittoria: 1 frase di 12-20 parole. Chiusura se ha ucciso un PG.

Per i boss è più importante; per i nemici comuni può essere standard.

\- aggettivi_minacciosi: 3-4 aggettivi separati da \"\|\". Es:
\"letale\|silenzioso\|implacabile\"

\- archetipo_avversario: UNO tra: predatore, sentinella, corrotto,
tiranno,

errante_caduto, bestia, rivelazione.

VINCOLI SPECIFICI PER CATEGORIA:

\- Se categoria = \"comune\": tono più sobrio, frasi più brevi.

\- Se categoria = \"elite\": un dettaglio in più che lo distingue.

\- Se categoria = \"boss\": frase_apparizione e motivazione_breve devono

essere particolarmente curate. È il momento culminante della run.

VINCOLI DI STILE:

\- Niente nomi parlanti banali (\"Mostro Distruttore\", \"Bestia
Affamata\").

\- Evita \"malvagio\" come categoria: i nemici hanno una causa, anche
distorta.

\- Coerenza con elemento_mondo nei dettagli sensoriali.

\`\`\`

\#### \*\*\*§13.6.4 --- Prompt-pattern per CardEvento\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardEvento

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

tag_mondo: {tag_mondo}

trigger: {trigger}

testo_narrativo: \"{testo_narrativo}\"

scelta_A (effetto): {scelta_A}

scelta_B (effetto): {scelta_B}

DATI DEL MONDO DI APPARTENENZA:

nome_mondo: {nome_mondo}

tono_dominante_mondo: {tono_dominante_mondo}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- ambientazione_specifica: 8-15 parole. Dove avviene l\'evento, in modo

più specifico del testo_narrativo. Es: \"in una radura dove il sole non

arriva mai\", \"presso un ponte di pietra spaccato a metà\".

\- tag_tema: 1-3 tag separati da \"\|\". Pescati dal seguente
vocabolario:

tradimento, fiducia, sacrificio, hybris, redenzione, scelta_morale,

curiosita, paura, compassione, vendetta, perdita, scoperta, dovere.

\- frase_post_scelta_A: 12-20 parole. Eco narrativa dopo aver scelto A.

NON deve descrivere l\'effetto meccanico (lo fa già
scelta_A.testo_outcome):

deve dare PESO MORALE alla scelta. Es: \"La scelta peserà più di quanto

immaginate.\"

\- frase_post_scelta_B: come sopra, per la scelta B.

\- eco_lontana: 10-15 parole. Una frase usabile come callback in
raccordi

successivi (la memoria_narrativa §13.9 può richiamarla). Deve essere

abbastanza generica da non rompere se appare nodi dopo.

Es: \"Qualcuno, da qualche parte, aveva previsto quel passo.\"

VINCOLI:

\- Le due frasi_post_scelta NON devono giudicare la scelta come
\"giusta\" o

\"sbagliata\": il gioco non ha morale binaria. Devono solo dare peso.

\- Coerenza tonale col mondo.

\`\`\`

\#### \*\*\*§13.6.5 --- Prompt-pattern per CardPNG\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardPNG

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

ruolo: {ruolo} // alleato \| mercante \| traditore \| guida \|
boss_minore

descrizione_narrativa: \"{descrizione_narrativa}\"

effetto_passivo: \"{effetto_passivo}\"

effetto_attivo: \"{effetto_attivo}\"

mondo_preferito: {mondo_preferito}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- epiteto: 3-6 parole. Es: \"il Mercante senza Volto\", \"la Guida dei
Silenzi\".

\- descrizione_fisica: 1-2 frasi, 15-30 parole. Dettagli concreti.

\- tratto_caratterizzante: 8-15 parole. UN dettaglio comportamentale

memorabile. Es: \"sorride sempre, anche quando parla di morte\",

\"non guarda mai negli occhi chi sta per ingannare\".

\- frase_apparizione: 12-20 parole. Come entra in scena.

Es: \"Lo trovate seduto su un tronco caduto, come se vi avesse
aspettato.\"

\- frase_saluto: 8-15 parole, TRA VIRGOLETTE. La prima battuta che dice.

Es: \'\"Ah, finalmente. Vi aspettavo.\"\'

\- frase_congedo: 8-15 parole, TRA VIRGOLETTE. L\'ultima battuta che
dice.

\- voce_caratteristica: 6-10 parole. Come parla.

Es: \"parla piano, scandendo ogni parola\".

\- aggettivi_natura: 3-4 aggettivi separati da \"\|\".

Es: \"ambiguo\|sornione\|saggio\"

\- frase_tradimento: SOLO se ruolo=traditore. 10-15 parole. La frase
della

rivelazione. Se ruolo != traditore: scrivere \"---\" (vuoto).

\- memoria_lascia: 10-15 parole. Cosa \"resta\" del PNG dopo la sua
sparizione.

Può essere fisico (\"qualcosa nei vostri zaini\") o emotivo (\"un
sospetto

che torna nei silenzi\").

VINCOLI:

\- Le battute tra virgolette devono avere una voce distinguibile.

\- Non far parlare il PNG con un italiano artificioso (\"ah, viandanti,

benvenuti!\"). Cerca registri concreti.

\`\`\`

\#### \*\*\*§13.6.6 --- Prompt-pattern per CardTwist\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardTwist

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

descrizione_narrativa: \"{descrizione_narrativa}\"

effetto_meccanico: \"{effetto_meccanico}\"

timing: {timing}

intensita: {intensita}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- frase_annuncio: 12-18 parole. La frase di sospensione, PRIMA della

rivelazione. Crea l\'attesa.

Es: \"Qualcosa cambia. L\'aria si fa pesante. E poi accade.\"

\- frase_rivelazione: 10-18 parole. La dichiarazione del twist.

È il momento del colpo. Una sola frase, secca.

Es: \"Il vostro alleato non era mai stato vostro alleato.\"

\- frase_conseguenza: 10-15 parole. Chiude e sposta il tono della run.

Non ripete la rivelazione: ne mostra il peso.

Es: \"Da questo momento in poi, niente sarà come prima.\"

\- tag_tema: 1-3 tag separati da \"\|\". Pescati dal vocabolario:

tradimento, sovrannaturale, corruzione, rivelazione, perdita,
ironia_amara,

ribaltamento, presagio_avverato.

\- intensita_drammatica: UNO tra: sussurro, crepa, rottura, cataclisma.

Deve essere coerente con il campo \"intensita\" della carta meccanica:

\- intensita \"bassa\" → sussurro o crepa

\- intensita \"media\" → crepa o rottura

\- intensita \"alta\" → rottura o cataclisma

VINCOLI:

\- I twist sono il cuore drammatico del gioco: cura particolarmente la

frase_rivelazione. Deve essere memorabile, citabile.

\- Niente esclamazioni multiple, niente \"!!!\", niente effetti
tipografici.

\`\`\`

\#### \*\*\*§13.6.7 --- Prompt-pattern per CardEquipaggiamento
(v0.6)\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardEquipaggiamento

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

classe_preferita: {classe_preferita}

slot: {slot} // arma \| armatura \| talismano

tag: {tag} // tag elementali + fisici (es. \[\"taglio\",\"fuoco\"\])

stats_per_livello: {stats_per_livello} // Lv1/Lv2/Lv3

forme_finali: {forme_finali} // 2-3 rami evolutivi con i loro id e
trigger

descrizione_narrativa: \"{descrizione_narrativa}\"

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- storia_oggetto: 1-2 frasi di 15-30 parole sulla provenienza del
pezzo. Tono

leggendario o quotidiano a seconda del briefing. Considera che questo
oggetto

evolverà di livello: la storia può seminare il suo potenziale.

Es: \"Si dice sia appartenuto a un re che dimenticò il proprio nome.\"

\- frase_acquisizione: 10-15 parole. Come il pezzo entra in possesso del
PG.

Usata quando viene pescato in un nodo tesoro o equipaggiato all\'inizio.

Es: \"Lo trovate avvolto in un panno, sotto la cenere di un focolare
spento.\"

\- aggettivo_qualita: 1 aggettivo evocativo del pezzo a Lv1.

Es: \"consunto\", \"sigillato\", \"opaco\", \"ancora caldo\".

\- descrizione_aspetto_per_livello: array di 3 stringhe
(\"Lv1\|\|\|\...\",\"Lv2\|\|\|\...\",\"Lv3\|\|\|\...\").

Ciascuna stringa è una breve descrizione fisica del pezzo a quel
livello, che

cattura una progressione visibile: una crepa che si sigilla, una runa
che si

accende, un\'incisione che riappare. Le tre descrizioni devono essere

riconoscibili come stadi dello stesso oggetto.

\- frase_evoluzione_a_lv2: 12-20 parole. Frammento narrativo mostrato
dal narratore

quando il pezzo sale da Lv1 a Lv2. Non descrivere il \"mio livello
aumenta\":

descrivi cosa il PG vede o sente nel pezzo.

Es: \"Le incisioni sull\'elsa si fanno più nette, come se la spada
riconoscesse la mano.\"

\- frase_evoluzione_a_lv3: 12-20 parole. Lo stesso per Lv2 → Lv3, con
tono più solenne.

\- frasi_per_forma_finale: oggetto con chiavi pari agli id delle
forme_finali

passate in DATI. Per ciascuna forma fornisci:

\- frase_sblocco: 10-15 parole. Quando il trigger viene soddisfatto,
prima

della scelta. Suggerisce cosa quel ramo \"potrebbe\" diventare.

\- frase_scelta: 15-25 parole. Mostrata se il PG sceglie quel ramo.

È il momento di trasformazione: deve avere peso.

\- eco_in_combattimento: 1 riga di 8-15 parole. Frammento che il
narratore

può iniettare nel log di combattimento per ricordare la presenza del
pezzo.

Es: \"la spada sembra cantare al primo colpo\".

VINCOLI:

\- Niente \"magico\", \"potente\", \"leggendario\" come prima scelta.

\- Privilegia dettagli fisici concreti.

\- Le frasi per le forme finali devono distinguere chiaramente i rami:
se la

Spada del Crepuscolo ha due forme, \"Lama del Crepuscolo Spezzato\" e
\"Spada

Eclissi\", le rispettive frasi devono evocare immagini diverse, non
sinonimi.

\`\`\`

\#### \*\*\*§13.6.7bis --- Prompt-pattern per CardConsumabile
(v0.6)\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: CardConsumabile

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

classe_preferita: {classe_preferita}

costo_energia: {costo_energia}

effetto: {effetto} // EffettoPayload, §6.2

target: {target}

tag: {tag}

descrizione_narrativa: \"{descrizione_narrativa}\"

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- storia_oggetto: 1 frase di 12-20 parole. Da dove viene il
consumabile.

Es: \"Una pozione preparata dagli erboristi della Soglia, di quelle che
si tengono per i giorni neri.\"

\- frase_acquisizione: 10-15 parole. Come viene trovato/ricevuto.

Es: \"Vi viene messa in mano da un viandante in fuga, senza
spiegazioni.\"

\- frase_uso: 12-20 parole. Cosa accade al PG quando lo usa, in chiave
narrativa,

non meccanica. Non scrivere \"+8 PV\": descrivi la sensazione, il gesto.

Es: \"Tracana la pozione e sente il petto scaldarsi, come dopo un sorso
di brodo a inverno.\"

\- aggettivo_qualita: 1 aggettivo evocativo.

Es: \"torbido\", \"fragrante\", \"polveroso\", \"ancora vivo\".

\- suono_uso: 1 frammento onomatopeico di 4-8 parole.

Es: \"un sibilo, poi un fischio acuto\".

VINCOLI:

\- I consumabili sono spesso oggetti d\'uso quotidiano in mondi
straordinari.

Privilegia la concretezza fisica al fanstico.

\- Niente \"magico\", \"potente\", \"leggendario\" come prima scelta.

\`\`\`

\#### \*\*\*§13.6.8 --- Prompt-pattern per Classe (classi.csv)\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: Classe PG

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

BRIEFING DELL\'AUTORE:

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- archetipo_narrativo: 2-4 parole. La forma archetipica della classe.

Es: \"il Protettore\", \"la Cercatrice di Risposte\".

\- archetipi_alternativi: 2-3 varianti separate da \"\|\". Usabili come
sinonimi.

\- descrizione_classe_breve: 8-15 parole. Una frase identitaria.

\- tratto_caratterizzante: 8-15 parole. Un dettaglio interno.

Es: \"ha occhi che hanno visto troppe guerre\".

\- motivazione_archetipo: 10-15 parole. Perché fa quello che fa.

\- verbo_caratteristico: 1 verbo. Es: \"affronta\", \"indaga\",
\"evita\", \"guarisce\".

\- oggetto_simbolico: 6-12 parole. Un oggetto che la rappresenta.

Es: \"una spada con il fodero consunto\", \"un libro sempre aperto a
metà\".

\- frase_introduzione: 10-18 parole. Come la classe si distingue
narrativamente

nel gruppo. Es: \"cammina sempre per primo, dove la strada è più
stretta\".

\- aggettivi_natura: 3-4 aggettivi separati da \"\|\".

\- paura_segreta: 10-15 parole. Cosa teme davvero quel personaggio.

È materiale per epiloghi e momenti drammatici. Es: \"non riuscire a

proteggere chi gli sta accanto\".

\- desiderio_segreto: 10-15 parole. Cosa vuole davvero.

Es: \"un\'ultima battaglia che sia anche l\'ultima\".

VINCOLI:

\- Le quattro classi devono essere distinguibili: se generi tutte e
quattro,

assicurati che non si sovrappongano (es. tutte \"stanche\", tutte
\"ferite\").

\- paura_segreta e desiderio_segreto sono il materiale poetico per il

narratore: cura particolare.

\`\`\`

\#### \*\*\*§13.6.9 --- Prompt-pattern per CardAttacco /
CardAbilità\*\*\*

\`\`\`

RUOLO: \[identico a §13.6.1\]

CARTA: {CardAttacco \| CardAbilità}

DATI MECCANICI DELLA CARTA:

id: {id}

nome: {nome}

classe_preferita: {classe_preferita}

costo_energia: {costo_energia}

effetto_meccanico: \"{effetto_meccanico}\"

descrizione_narrativa: \"{descrizione_narrativa}\"

target: {target}

valore_numerico: {valore_numerico}

tag_sinergia: {tag_sinergia}

BRIEFING DELL\'AUTORE (opzionale per queste carte):

\"\"\"

{\_briefing_autore}

\"\"\"

CAMPI DA GENERARE (formato pipe-separato \"nome_campo\|\|\|valore\"):

\- descrizione_gesto: 8-15 parole. Cosa fa fisicamente il PG quando
gioca

la carta. Es: \"taglia l\'aria con un fendente discendente\",

\"traccia un cerchio nell\'aria con la mano sinistra\".

\- descrizione_impatto: 8-15 parole. Cosa accade al bersaglio.

Es: \"il colpo apre una ferita lunga e netta\",

\"l\'aria si solidifica intorno al bersaglio per un istante\".

\- aggettivo_stile: UNO tra: feroce, preciso, selvaggio, silenzioso,

esplosivo, trattenuto.

\- suono_effetto: 4-8 parole. Onomatopea narrativa.

Es: \"un sibilo seguito da un tonfo\".

VINCOLI:

\- Coerenza col costo_energia: una carta a costo 1 ha un gesto più
rapido

e contenuto di una a costo 4.

\- Niente effetti speciali tipografici, niente parole maiuscole.

\`\`\`

\### \*\*§13.7 --- Convenzioni di stile per l\'authoring\*\*

Regole trasversali che l\'AI deve rispettare in ogni prompt. Vengono
inserite (o riassunte) in ciascun prompt-pattern di §13.6, ma sono
raccolte qui come riferimento.

\*\*Lessico.\*\*

\- Bandire come prima scelta: \*oscuro, antico, magico, potente,
leggendario, mistico, perduto\*. Sono i cliché fantasy generici e l\'AI
ci scivola in automatico. Vietarli esplicitamente nei prompt ne migliora
drasticamente l\'output.

\- Privilegiare lessico \*\*concreto e sensoriale\*\*: cose che si
possono vedere, toccare, odorare, sentire.

\- Una parola specifica vale dieci aggettivi generici. \"Una stele
incisa in cufico\" è più potente di \"una pietra antica e misteriosa\".

\*\*Sintassi.\*\*

\- Frasi brevi e medie. Evitare subordinate annidate (l\'AI tende a
costruirle, e il risultato è prolisso).

\- Variare la lunghezza per ritmo: una frase corta dopo due medie.

\- Niente esclamazioni multiple, niente puntini di sospensione (l\'AI ne
abusa).

\*\*Voce narrante.\*\*

\- I testi destinati al narratore di runtime sono in \*\*terza persona
impersonale\*\* o, dove indicato, in \*\*seconda persona plurale\*\*
(\"vi\", \"voi\", \"i vostri\").

\- Niente prima persona: i PG non sono io-narranti.

\- Niente didascalie tipo \"(in lontananza, un lupo ulula)\".

\*\*Coerenza tonale.\*\*

\- Ogni carta deve essere fedele al \`tono_dominante\` del proprio mondo
(se applicabile) e al proprio \`\_briefing_autore\`.

\- Se c\'è conflitto tra briefing della carta e tono del mondo: il
\*\*briefing della carta vince\*\* (è una scelta consapevole
dell\'autore).

\*\*Anti-pattern noti.\*\*

\- \*Aggettivi accumulati\*: \"una valle oscura, antica, misteriosa,
dimenticata, ferita\". Ridurre. Massimo 2 aggettivi per sostantivo.

\- \*Punteggiatura emotiva\*: \"\...e poi\... il silenzio\...
totale\...\". Evitare.

\- \*Cosmologie generiche\*: \"le forze ancestrali del male\". Sempre
specifico, sempre concreto.

\- \*Italianisms cinematografici\*: \"vi attende un destino oscuro\".
Asciugare.

\### \*\*§13.8 --- Modulo motore/narratore.js\*\*

Nuovo modulo del motore previsto in v0.5. È un \*\*componente puro\*\*
(nel senso di §9.3): non muta state passati, ritorna stringhe. È
deterministico via \`rng_state\`.

\#### \*\*\*§13.8.1 --- API esposta\*\*\*

\`narratore.genera_prologo(state, db)\` → \`{ movimenti: \[string,
string, string\], rng_state: integer }\`

PASSI:

\- compone i 3 movimenti del prologo (§13.8.4) come 3 stringhe separate

\- ritorna anche il nuovo rng_state (è stato consumato per pescare i
template)

\`narratore.genera_raccordo(state, db, nodo_prec, nodo_succ)\` → \`{
testo: string, rng_state: integer }\`

PASSI:

\- determina \`atto_corrente\` (§13.3) da state

\- seleziona pool template appropriato (atto + tipo_nodo del nodo_succ)

\- controlla memoria_narrativa (§13.9): se c\'è callback applicabile,
può scegliere template \"callback\" con probabilità 0.3

\- pesca un template dal pool, sostituisce gli slot

\- ritorna testo + nuovo rng_state

\`narratore.genera_commento_evento(state, db, evento_log)\` → \`{ testo:
string, rng_state: integer }\`

PASSI:

\- discrimina per \`evento_log.tipo\`: solo alcuni tipi triggerano
commento narrativo (vedi §13.8.5)

\- per ciascun tipo, pool template dedicato

\- aggiorna eventualmente memoria_narrativa

\`narratore.genera_epilogo(state, db, esito)\` → \`{ testo: string,
rng_state: integer }\`

PASSI:

\- \`esito\` è \"vittoria\" o \"sconfitta\"

\- pool template dedicato all\'esito + atto III

\- riceve memoria_narrativa per richiamare 2-3 momenti chiave

\- ritorna 80-120 parole

\*\*\*Tutte le funzioni sono pure\*\*\*: ricevono state come input, non
lo mutano, restituiscono solo il risultato testuale e l\'aggiornamento
del rng_state. Il caller (UI o motore) decide cosa farne.

\#### \*\*\*§13.8.2 --- Architettura interna a template a slot\*\*\*

I template vivono in \*\*file JSON statici\*\* in \`/data/narrazione/\`,
separati per momento narrativo:

\`\`\`

/data/narrazione/

├── prologo_movimento_1.json // 5-8 template per \"Il Mondo\"

├── prologo_movimento_2.json // 5-8 template per \"I Viandanti\"

├── prologo_movimento_3.json // 5-8 template per \"Il Richiamo\"

├── raccordo_atto1.json // raccordi atto I, 6-10 template

├── raccordo_atto2.json // II

├── raccordo_atto3.json // III

├── raccordo_callback.json // template che usano memoria_narrativa

├── commento_combattimento_vinto.json

├── commento_combattimento_perso.json

├── commento_scelta_evento.json

├── commento_twist_rivelato.json

├── commento_png_apparso.json

├── epilogo_vittoria.json

└── epilogo_sconfitta.json

\`\`\`

Ogni file è un array di oggetti template:

\`\`\`

{

\"id\": \"PROL_M1_001\",

\"template\": \"In quei giorni, {nome_mondo} era una terra {agg1} e
{agg2}. {presagio_mondo}\",

\"slot_richiesti\": \[\"nome_mondo\", \"agg1\", \"agg2\",
\"presagio_mondo\"\],

\"slot_fallback\": {

\"agg2\": \"lessico_elementi.aggettivi_caratteristici\[0\]\"

},

\"vincoli\": {

\"atto\": \[1\],

\"tono_mondo\": \[\"cupo\", \"malinconico\", \"epico\"\]

}

}

\`\`\`

\*\*\*Slot.\*\*\* Sono nomi di campi narrativi delle carte coinvolte. Il
narratore mantiene un \*\*contesto di slot\*\* popolato all\'avvio:

\- da \`state.mondo\` (campi narrativi del Mondo della run);

\- da \`state.giocatori\` (campi narrativi delle Classi dei PG);

\- da \`state.mappa.nodi\[corrente\]\` e
\`state.mappa.nodi\[prossimo\]\` (campi del Luogo);

\- dai nemici in campo (se applicabile);

\- dal \`lessico_elementi.csv\` corrispondente all\'elemento del mondo;

\- da \`state.memoria_narrativa\` per i template callback.

\*\*\*Selezione template.\*\*\* All\'interno di un pool, il narratore
filtra prima per vincoli (atto, tono), poi pesca uno dei template
rimasti via \`rng_state\`. Se nessun template soddisfa i vincoli,
\*\*degrada\*\* al primo template del pool (fallback garantito).

\*\*\*Slot fallback.\*\*\* Se uno slot non è popolato (es. il luogo non
ha \`pericolo_latente\`), il template può specificare un \*\*fallback
path\*\*: una catena di lookup alternativi (es.
\`lessico_elementi.metafore\[0\]\`). Se anche il fallback è vuoto, il
narratore \*\*scarta il template\*\* e ne pesca un altro dal pool. Solo
se TUTTI i template del pool falliscono, viene usato un fallback di
ultima istanza (§13.8.6).

\#### \*\*\*§13.8.3 --- Sintassi degli slot\*\*\*

Gli slot nei template usano la sintassi \`{nome_slot}\`. Sono supportate
tre forme:

\- \*\*Slot semplice\*\*: \`{nome_mondo}\` --- lookup diretto in
\`state.mondo.nome\`.

\- \*\*Slot indicizzato\*\*: \`{aggettivi_caratteristici\[0\]}\` ---
primo elemento di un array.

\- \*\*Slot casuale\*\*: \`{aggettivi_caratteristici\[\*\]}\` --- un
elemento casuale dell\'array (consuma rng_state).

\*\*\*Slot speciali predefiniti\*\*\* (il narratore li popola
automaticamente):

\- \`{nome_mondo}\`, \`{epiteto_mondo}\`, \`{presagio_mondo}\` --- dal
Mondo della run.

\- \`{nome_pg_1}\`, \`{nome_pg_2}\`, \`{archetipo_pg_1}\`,
\`{archetipo_pg_2}\`... --- dai PG (numerati per ordine di turno).

\- \`{nome_luogo_prec}\`, \`{nome_luogo_corr}\`, \`{nome_luogo_succ}\`
--- dai nodi limitrofi sulla mappa.

\- \`{epiteto_boss}\` --- dal CardNemico del nodo finale.

\- \`{memoria_1}\`, \`{memoria_2}\` --- primi due tag della
memoria_narrativa, espansi a frase usando il campo \`eco_lontana\` o
\`memoria_lascia\` della carta origine.

\#### \*\*\*§13.8.4 --- Prologo a tre movimenti\*\*\*

Il prologo è generato all\'avvio di una run, una sola volta, e mostrato
dalla UI in \*\*tre schermate consecutive\*\* con un pulsante
\"Continua\" tra una e l\'altra.

\| \*\*Movimento\*\* \| \*\*Titolo UI\*\* \| \*\*Lunghezza\*\* \|
\*\*Focus\*\* \|

\| \-\-- \| \-\-- \| \-\-- \| \-\-- \|

\| 1 \| Il Mondo \| 60-80 parole \| Mondo, atmosfera, presagio. Attiva i
sensi. \|

\| 2 \| I Viandanti \| 80-100 parole \| PG, archetipi, un dettaglio per
ciascuno \|

\| 3 \| Il Richiamo \| 60-80 parole \| Antagonista, posta in gioco,
partenza \|

Il prologo viene generato e mostrato come schermata di apertura della
run, \*\*prima\*\* che l\'UI mostri il primo nodo della mappa.

\#### \*\*\*§13.8.5 --- Commenti agli eventi chiave\*\*\*

Non ogni \`EventoLog\` (§2.4) genera un commento narrativo: solo i tipi
di evento drammaticamente significativi. Tabella di mapping:

\| \*\*EventoLog.tipo\*\* \| \*\*Genera commento narrativo?\*\* \|
\*\*Pool template\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| carta_giocata \| No (sarebbe ripetitivo) \| --- \|

\| danno_inflitto \| No \| --- \|

\| cura \| No \| --- \|

\| status_applicato \| No \| --- \|

\| ko \| Sì (raro, ma alto impatto) \| commento_ko.json \|

\| nemico_attacca \| No (troppo frequente) \| --- \|

\| nodo_risolto \| Sì, ma solo per combattimento \|
commento_combattimento_vinto.json \|

\| twist_rivelato \| Sì \| commento_twist_rivelato.json \|

\| png_apparso \| Sì \| commento_png_apparso.json \|

\| scelta_evento \| Sì \| commento_scelta_evento.json \|

\| ricompensa \| No \| --- \|

\| fase_cambiata \| No \| --- \|

Il commento viene mostrato dalla UI come banner narrativo sopra la zona
log, per 4-6 secondi, poi sfuma. Non sostituisce il log meccanico: lo
\*\*affianca\*\*.

\#### \*\*\*§13.8.6 --- Fallback di ultima istanza\*\*\*

Se per qualsiasi ragione (campi narrativi mancanti, template non
disponibili, dati corrotti) il narratore non riesce a generare un testo,
deve \*\*degradare elegantemente\*\* invece di fallire o restituire
stringa vuota.

Politica:

\- \`genera_prologo\` → ritorna un prologo minimale costruito solo da
\`state.mondo.descrizione_narrativa\` + nomi e classi dei PG.

\- \`genera_raccordo\` → ritorna \`\"Il gruppo prosegue verso
{nome_luogo_succ}.\"\`

\- \`genera_commento_evento\` → ritorna stringa vuota (il commento è
opzionale, non blocca il gioco).

\- \`genera_epilogo\` → ritorna un epilogo minimale: \`\"La storia di
{nome_pg_1} e {nome_pg_2} in {nome_mondo} si chiude qui.\"\` +
vittoria/sconfitta.

Questo garantisce che lo strato narrativo sia \*\*additivo e mai
bloccante\*\* rispetto al motore di gioco esistente.

\### \*\*§13.9 --- Memoria narrativa (TagMemoria)\*\*

Lo stato \`state.memoria_narrativa\` è la lista (al massimo 5 elementi,
FIFO) dei \*\*momenti narrativi salienti\*\* già accaduti nella run.
Permette al narratore di costruire callback testuali che diano alla
storia un senso di continuità.

\#### \*\*\*§13.9.1 --- Schema TagMemoria\*\*\*

\`\`\`

TagMemoria = {

tag: string, // tipo di memoria (vedi §13.9.2)

carta_origine: string, // id della carta che ha generato la memoria

nodo_origine: integer, // indice del nodo della mappa in cui è accaduto

payload: object // dati ausiliari (es. nome_png, scelta_fatta)

}

\`\`\`

\#### \*\*\*§13.9.2 --- Tag supportati\*\*\*

\| \*\*Tag\*\* \| \*\*Trigger\*\* \| \*\*Payload\*\* \|

\| \-\-- \| \-\-- \| \-\-- \|

\| png_incontrato \| EventoLog tipo png_apparso \| { png_id, nome, ruolo
} \|

\| png_tradito \| EventoLog tipo png_apparso con ruolo=traditore \| {
png_id, nome } \|

\| png_alleato \| EventoLog tipo png_apparso con ruolo=alleato \| {
png_id, nome } \|

\| scelta_fatta \| EventoLog tipo scelta_evento \| { evento_id, scelta,
tag_tema } \|

\| pg_quasi_ko \| EventoLog tipo danno_inflitto che porta pv ≤ 25% del
max \| { pg_id, nome } \|

\| pg_ko \| EventoLog tipo ko \| { pg_id, nome } \|

\| twist_subito \| EventoLog tipo twist_rivelato \| { twist_id,
intensita_drammatica } \|

\| boss_visto \| EventoLog tipo fase_cambiata con evento
\"combattimento_iniziato\" e nemico_categoria=boss \| { nemico_id,
epiteto } \|

\#### \*\*\*§13.9.3 --- Aggiornamento della memoria\*\*\*

A ogni \`\_log_append\`, dopo l\'append del log, il motore valuta se
l\'evento deve produrre un TagMemoria. Se sì:

\- crea il TagMemoria

\- lo appende a \`state.memoria_narrativa\`

\- se la lista supera 5 elementi, rimuove il più vecchio (FIFO)

Questa operazione è in place sullo state interno alla funzione
(coerentemente con §9.3) ed è eseguita da una helper privata
\`\_aggiorna_memoria_narrativa(state, evento_log)\`.

\#### \*\*\*§13.9.4 --- Uso della memoria nei template\*\*\*

I template della categoria \"callback\" (file
\`raccordo_callback.json\`) hanno slot speciali del tipo
\`{memoria.png_tradito.nome}\` o \`{memoria.scelta_fatta.eco_lontana}\`.
Il narratore, prima di selezionare un template callback, verifica che la
memoria contenga il tag richiesto. Se non c\'è, scarta il template e
procede con i template normali.

Esempio:

\`\`\`

{

\"id\": \"RACC_CB_001\",

\"template\": \"{nome_luogo_succ} si stende davanti a voi. L\'ombra di
{memoria.png_tradito.nome} li seguiva ancora, anche se la sua voce
taceva.\",

\"slot_richiesti\": \[\"nome_luogo_succ\",
\"memoria.png_tradito.nome\"\],

\"vincoli\": {

\"atto\": \[2, 3\]

}

}

\`\`\`

Quando si attiva, il giocatore percepisce che il gioco \"ricorda\"
quello che è successo nodi prima. È il meccanismo che trasforma una
sequenza in una storia.

\### \*\*§13.10 --- Integrazione con il motore esistente\*\*

Modifiche richieste ai moduli esistenti per supportare §13. Tutte
additive, nessuna breaking.

\#### \*\*\*§13.10.1 --- motore/setup.js\*\*\*

\- Estensione di \`carica_dati()\`: leggere anche \`classi.csv\` e
\`lessico_elementi.csv\` (entrambi opzionali per retrocompatibilità).

\- Estensione del parser CSV: aggiungere lo \*\*skip dei campi
\`\_\*\`\*\* prima della validazione (§1.11.3).

\- Estensione di \`setup_partita()\`: dopo aver creato i PG,
\*\*chiamare \`narratore.genera_prologo(state, db)\`\*\* e memorizzarne
il risultato in \`state.meta.prologo_movimenti\` (nuovo campo, array di
3 stringhe). La UI lo leggerà come schermata di apertura.

\- Inizializzare \`state.memoria_narrativa = \[\]\` e
\`state.atto_corrente = 1\`.

\#### \*\*\*§13.10.2 --- motore/esplorazione.js\*\*\*

\- In \`avanza_nodo\` (§4.2): dopo aver aggiornato \`nodo_corrente\`,
\*\*ricalcolare \`state.atto_corrente\`\*\* secondo la formula §13.3.

\- Dopo l\'avanzamento, chiamare \`narratore.genera_raccordo(state, db,
nodo_prec, nodo_succ)\` e memorizzare il risultato in un campo del nodo
(es. \`nodo_succ.\_raccordo_narrativo\`). La UI lo leggerà al rendering
del nuovo nodo.

\#### \*\*\*§13.10.3 --- motore/combattimento.js\*\*\*

\- In \`fine_combattimento\`: chiamare
\`narratore.genera_commento_evento(state, db, ultimo_evento_log)\` se
applicabile (§13.8.5) e memorizzare in un campo temporaneo dello state
(es. \`state.\_commento_narrativo_pending\`).

\- Stessa logica in \`\_applica_danno\` per il ko (\`tipo: \'ko\'\`).

\#### \*\*\*§13.10.4 --- motore/eventi_mondo.js\*\*\*

\- Stessa logica per \`twist_rivelato\` e \`png_apparso\`.

\- Aggiornamento della memoria narrativa: ogni \`\_log_append\` di tipi
rilevanti chiama \`\_aggiorna_memoria_narrativa(state, evento)\`.

\#### \*\*\*§13.10.5 --- UI (web/app.js + web/index.html +
web/style.css)\*\*\*

\- Schermata di apertura: tre pannelli per i tre movimenti del prologo,
con pulsante \"Continua →\" tra uno e l\'altro. Solo dopo il terzo
movimento si abilita la UI di gioco normale.

\- Banner narrativo: nuovo elemento HTML sopra la zona log, che mostra
\`state.\_commento_narrativo_pending\` se presente, con fade-out dopo
4-6 secondi.

\- Pannello raccordo: il raccordo tra nodi viene mostrato come testo
prominente sopra la descrizione del nuovo nodo (font leggermente
diverso, corsivo, accentato).

\- Schermata di chiusura: mostra l\'epilogo generato da
\`narratore.genera_epilogo\`, con pulsante \"Nuova partita\".
Sostituisce la schermata di vittoria/sconfitta attuale (che è puramente
meccanica).

\#### \*\*\*§13.10.6 --- strumenti/build_browser.js\*\*\*

\- Includere \`motore/narratore.js\` nel bundle.

\- Includere i nuovi JSON di \`/data/narrazione/\` come moduli
importabili a runtime dal browser (fetch + cache).

\### \*\*§13.11 --- Punti di estensione\*\*

Marcatori \# EXT registrati per evoluzioni future del sistema narrativo:

\- \*\*EXT_NARR_AI_LIVE\*\*: aggiunta opzionale di una chiamata AI a
runtime per certi momenti (es. epilogo) come \*\*upgrade opzionale\*\*.
Architettura permette di sostituire \`narratore.genera_epilogo\` con una
variante AI senza toccare il chiamante.

\- \*\*EXT_NARR_LINGUE\*\*: i template sono separati per file → si
possono duplicare per lingua. Aggiunta di \`/data/narrazione/en/\`,
\`/data/narrazione/fr/\` ecc. Il \`\_briefing_autore\` resta sempre in
lingua dell\'autore (di solito italiano).

\- \*\*EXT_NARR_PERSONALITA\*\*: ciascun PG può avere una personalità
narrativa scelta dal giocatore (cauto, impetuoso, ironico). Influenza i
template di raccordo che lo menzionano.

\- \*\*EXT_NARR_MEMORIA_PROFONDA\*\*: ampliamento della memoria a oltre
5 elementi con priorità + decay, per epiloghi più ricchi.

\- \*\*EXT_NARR_DIRETTORE\*\*: un meta-componente che osserva la run e
ne aggiusta il \"ritmo narrativo\" scegliendo template più o meno
intensi a seconda di quanto è già accaduto.

\# \*\*§14 --- Workflow di authoring carte (v0.5)\*\*

Procedura operativa per l\'autore umano che vuole arricchire le carte
con i campi narrativi di §13.

\### \*\*§14.1 --- Pipeline a 5 passi\*\*

Per ogni carta da arricchire:

\- \*\*1. Scrivere i campi meccanici\*\* della carta nel CSV (campi
esistenti definiti in §1.2-§1.10, §13.4).

\- \*\*2. Scrivere il \`\_briefing_autore\`\*\* nella stessa riga del
CSV. Cinque registri (§13.0): concetto-cuore, atmosfera, riferimenti,
vincoli, tono linguistico. È il passaggio più importante e quello a
maggior contenuto autoriale.

\- \*\*3. Lanciare il prompt-pattern\*\* appropriato (§13.6) in una
conversazione con un\'AI esterna. Sostituire i placeholder \`{\...}\`
con i valori effettivi della carta.

\- \*\*4. Validare e correggere\*\* l\'output dell\'AI. Output non
soddisfacente → arricchire o riscrivere il briefing → rilanciare. Non
modificare a mano i campi: il briefing è la fonte di verità, i campi
sono \*derivati\*.

\- \*\*5. Incollare i campi generati\*\* nel CSV. Il
\`\_briefing_autore\` resta nella stessa riga.

\### \*\*§14.2 --- Strumento ausiliario consigliato (opzionale)\*\*

Per chi vuole automatizzare il passo 3, si può predisporre uno script
\`strumenti/genera_narrazione.js\` che:

\- legge \`data/\<tipo_carta\>.csv\`;

\- per ogni riga con \`\_briefing_autore\` non vuoto ma campi narrativi
vuoti, costruisce il prompt-pattern (§13.6) con i placeholder
sostituiti;

\- stampa il prompt pronto da copiare in una chat AI;

\- riceve il risultato (incollato dall\'utente) e lo riscrive nel CSV.

Non è strettamente necessario per il MVP: si può fare tutto a mano via
copy-paste.

\### \*\*§14.3 --- Ordine consigliato di arricchimento\*\*

L\'ordine di arricchimento delle carte conta per la coerenza, perché
alcune carte usano nel prompt i campi di altre (es. il prompt CardLuogo
riceve \`tono_dominante_mondo\` del Mondo di appartenenza).

Ordine consigliato:

\- \*\*1. lessico_elementi.csv\*\* --- base lessicale per tutto il
resto.

\- \*\*2. mondi.csv\*\* --- definisce tono e lessico macroscopici.

\- \*\*3. classi.csv\*\* --- i PG che vivranno qualunque storia.

\- \*\*4. luoghi.csv\*\* --- usano il tono del Mondo.

\- \*\*5. nemici.csv\*\* --- usano il tono e il lessico del Mondo.

\- \*\*6. png.csv\*\* --- usano il Mondo e si interfacciano con le
scelte.

\- \*\*7. eventi.csv\*\* --- usano il tono del Mondo.

\- \*\*8. twist.csv\*\* --- usano il tono macro, sono universali.

\- \*\*9. equipaggiamenti.csv, consumabili.csv, attacchi.csv,
abilita.csv\*\* --- opzionali, per ultime. \*(In v0.6 il vecchio
\`oggetti.csv\` è stato splittato in due file, vedi §1.11.5.)\*

\### \*\*§14.4 --- Manutenzione e iterazione\*\*

Il sistema è progettato per essere iterativo:

\- Cambi il briefing di una carta → rilanci il prompt → rigeneri i campi
→ incolli.

\- Aggiungi una nuova carta → scrivi briefing + prompt → integri.

\- Aggiungi un nuovo tipo di prompt o un nuovo registro stilistico in
§13.7 → puoi rigenerare in batch tutte le carte esistenti.

Il \`\_briefing_autore\` è la \*\*memoria della tua visione
creativa\*\*: anche dopo mesi, un autore che torna sul progetto può
rileggere i briefing per ritrovare l\'intenzione originaria di ciascuna
carta.

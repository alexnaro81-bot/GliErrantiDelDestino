# Gli Erranti del Destino — UI Web

UI essenziale per giocare al gioco in un browser.

## Avvio rapido

Da un terminale, nella root del progetto:

```bash
# 1. Rigenera il bundle del motore per il browser (solo se hai modificato motore/*.js)
node strumenti/build_browser.js

# 2. Avvia un server HTTP locale (qualsiasi va bene, esempio con Python)
python3 -m http.server 8000

# 3. Apri il browser su:
#    http://localhost:8000/web/index.html
```

In alternativa, se hai Node `npx`:
```bash
npx serve .
# poi apri http://localhost:3000/web/index.html
```

**Importante**: il browser non può leggere file dal disco direttamente (`file://`).
Serve un server HTTP, anche minimale, perché `fetch()` funzioni sui CSV.

## Struttura

- `index.html` — struttura della pagina
- `style.css` — tema dark fantasy
- `app.js` — logica UI: rendering + input
- `motore_bundle.js` — il motore di gioco (autogenerato dal build)

## Cosa puoi fare

- Setup: scegli 2-4 giocatori e un seed opzionale (per partite riproducibili)
- Risolvi nodi: combattimento, evento (scelta A/B), riposo, tesoro, speciale
- In combattimento: clicca una carta, scegli un nemico, premi "Passa il turno" quando hai finito
- Avanza nodo dopo nodo fino al boss finale (nodo 12) o alla sconfitta

## Limiti noti dell'MVP

- Solo i nodi vengono renderizzati come quadratini numerati (icone tipo nodo: ⚔ combattimento, ? evento, ♨ riposo, ✦ tesoro, ★ speciale)
- Quando una carta richiede target "tutti nemici" o "se stesso", la giochi senza scegliere nulla
- Le carte di tipo abilità con effetti complessi mostrano solo la descrizione, non l'animazione dell'effetto
- Mobile: layout collassa a colonna unica sotto i 900px ma è pensato per desktop
- Niente animazioni: le transizioni sono istantanee

## Aggiornare il motore

Se modifichi un file in `motore/*.js`, rilancia `node strumenti/build_browser.js` per rigenerare `web/motore_bundle.js`. Il browser caricherà la versione aggiornata al refresh.

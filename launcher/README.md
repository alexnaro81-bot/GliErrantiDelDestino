# Launcher Linux per Gli Erranti del Destino

Una scorciatoia cliccabile per avviare il gioco senza dover lanciare a mano server HTTP e browser.

## Installazione

Una sola volta, da terminale:

```bash
chmod +x launcher/install_desktop.sh
./launcher/install_desktop.sh
```

Lo script ti chiederà se vuoi copiare l'icona anche sul Desktop. Rispondi `s` se vuoi un doppio-click veloce.

## Uso

Tre modi per avviare:

1. **Cerca "Gli Erranti del Destino"** nel menu applicazioni (categoria Giochi)
2. **Doppio click** sull'icona sul Desktop (se l'hai installata)
3. Da terminale: `./launcher/erranti.sh`

In tutti i casi:
- Si apre una piccola finestra terminale con i log del server (puoi minimizzarla)
- Il browser si apre automaticamente sulla pagina del gioco
- Quando vuoi chiudere, basta chiudere il terminale o premere `Ctrl+C` dentro

## File in questa cartella

- `erranti.sh` — lo script che fa tutto il lavoro: trova porta libera, rigenera il bundle del motore se necessario, avvia server HTTP, apre il browser
- `erranti.svg` — icona del gioco (silhouette di un errante sotto un albero, palette dark fantasy)
- `install_desktop.sh` — installa la voce nel menu applicazioni (`~/.local/share/applications/`)
- `README.md` — questo file

## Cosa succede sotto il cofano

`erranti.sh` fa, in ordine:

1. **Si auto-localizza**: capisce dove sta il progetto, anche se sposti la cartella
2. **Rigenera il bundle del motore** (se hai modificato `motore/*.js` da quando l'hai generato l'ultima volta, e se hai Node installato)
3. **Trova una porta libera** partendo da 8000 (sale se occupata, fino a 8049)
4. **Sceglie il server HTTP**: preferisce `python3`, poi `python`, poi `npx serve`
5. **Avvia il server in background** e aspetta che risponda (max 5 secondi)
6. **Apre il browser** con `xdg-open` (standard freedesktop, funziona su GNOME/KDE/XFCE/ecc.)
7. **Cleanup automatico** alla chiusura: il server viene terminato in modo pulito (no processi orfani)

## Prima esecuzione su GNOME / Cinnamon

Alcuni desktop moderni richiedono di "fidarsi" del file `.desktop` prima di eseguirlo. Se vedi un'icona generica invece dell'icona del gioco, clicca con il tasto destro sull'icona → "Consenti l'esecuzione" o "Trust executable". Dopo la prima conferma, funziona normalmente.

## Disinstallazione

```bash
rm ~/.local/share/applications/erranti-del-destino.desktop
rm ~/Desktop/erranti-del-destino.desktop  # se l'hai copiata sul desktop
```

## Requisiti

- Bash 4+ (presente di default su tutte le distro)
- **Almeno uno** di: `python3`, `python`, `npx`
- `xdg-open` per aprire il browser (presente di default sui desktop Linux moderni)
- **Opzionale**: Node.js per la rigenerazione automatica del bundle motore

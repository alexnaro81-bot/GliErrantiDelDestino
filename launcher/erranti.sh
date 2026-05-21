#!/usr/bin/env bash
# =============================================================================
# Gli Erranti del Destino — launcher Linux
# Apre il gioco nel browser di default. Si chiude pulitamente quando termini.
#
# Cosa fa, per non-tecnici:
#   1. Trova una porta libera (parte da 8000, se occupata sale 8001, 8002, ...)
#   2. Se ha Node installato, rigenera il bundle del motore (solo se necessario)
#   3. Avvia un piccolo server HTTP locale (usa python3 o python)
#   4. Aspetta che il server risponda
#   5. Apre la pagina nel tuo browser
#   6. Quando chiudi il terminale (o Ctrl+C), spegne tutto in modo pulito
#
# Lo script si auto-localizza: capisce dov'e' la radice del progetto a partire
# dalla sua posizione (assume di stare in launcher/ o nella radice).
# =============================================================================

set -e

# --- 1. Trova la radice del progetto ---------------------------------------
# Risolve i symlink cosi' funziona anche se lo script e' linkato da altrove.
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"

# Se siamo in launcher/, la radice e' la cartella sopra. Altrimenti e' qui.
if [ -d "$SCRIPT_DIR/../web" ] && [ -d "$SCRIPT_DIR/../motore" ]; then
    PROJ_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -d "$SCRIPT_DIR/web" ] && [ -d "$SCRIPT_DIR/motore" ]; then
    PROJ_ROOT="$SCRIPT_DIR"
else
    echo "Errore: non trovo la radice del progetto (servono le cartelle web/ e motore/)."
    echo "Lo script e' in: $SCRIPT_DIR"
    read -rp "Premi INVIO per chiudere..."
    exit 1
fi

cd "$PROJ_ROOT"
echo "Gli Erranti del Destino"
echo "Progetto: $PROJ_ROOT"
echo ""

# --- 2. Rigenera il bundle se Node e' presente e il bundle e' obsoleto -----
# Logica: se uno dei file motore/*.js e' piu' recente del bundle, rigeneralo.
if command -v node >/dev/null 2>&1; then
    BUNDLE="web/motore_bundle.js"
    NEEDS_REBUILD=0
    if [ ! -f "$BUNDLE" ]; then
        NEEDS_REBUILD=1
        echo "[setup] Bundle browser non trovato: lo genero."
    else
        # Confronta date di modifica.
        for f in motore/*.js; do
            if [ "$f" -nt "$BUNDLE" ]; then
                NEEDS_REBUILD=1
                echo "[setup] $f e' piu' recente del bundle: rigenero."
                break
            fi
        done
    fi
    if [ "$NEEDS_REBUILD" = "1" ]; then
        if [ -f "strumenti/build_browser.js" ]; then
            node strumenti/build_browser.js || echo "[setup] Errore nella generazione del bundle, ma provo lo stesso ad avviare."
        else
            echo "[setup] strumenti/build_browser.js non trovato: skip rigenerazione."
        fi
    else
        echo "[setup] Bundle aggiornato."
    fi
else
    echo "[setup] Node non installato: salto la rigenerazione del bundle."
    echo "        Se hai modificato motore/*.js, il bundle potrebbe non riflettere le modifiche."
fi

# --- 3. Trova una porta libera ---------------------------------------------
# Parte da 8000, prova fino a 8050. Usa bash builtin: /dev/tcp e' una feature
# di bash che permette di tentare una connessione senza tool esterni.
trova_porta_libera() {
    local porta=$1
    while [ "$porta" -lt 8050 ]; do
        # Se la connessione FALLISCE = porta libera.
        if ! (echo > /dev/tcp/127.0.0.1/$porta) 2>/dev/null; then
            echo "$porta"
            return
        fi
        porta=$((porta + 1))
    done
    echo ""  # nessuna porta trovata
}

PORTA=$(trova_porta_libera 8000)
if [ -z "$PORTA" ]; then
    echo "Errore: nessuna porta libera tra 8000-8049."
    read -rp "Premi INVIO per chiudere..."
    exit 1
fi
echo "[setup] Porta scelta: $PORTA"

# --- 4. Sceglie il server HTTP da usare ------------------------------------
# Ordine di preferenza: python3 (piu' comune), python (legacy), node http-server.
if command -v python3 >/dev/null 2>&1; then
    SERVER_CMD="python3 -m http.server $PORTA --bind 127.0.0.1"
elif command -v python >/dev/null 2>&1; then
    # Python 2: il modulo si chiama diversamente.
    SERVER_CMD="python -m SimpleHTTPServer $PORTA"
elif command -v node >/dev/null 2>&1 && command -v npx >/dev/null 2>&1; then
    SERVER_CMD="npx --yes serve -l $PORTA"
else
    echo "Errore: nessun server HTTP disponibile (serve python3, python, o node+npx)."
    read -rp "Premi INVIO per chiudere..."
    exit 1
fi
echo "[setup] Server: $SERVER_CMD"

# --- 5. Avvia il server in background --------------------------------------
# Reindirizzo l'output su /dev/null cosi' la console resta pulita. Tengo il PID
# per poterlo terminare quando lo script finisce.
$SERVER_CMD > /dev/null 2>&1 &
SERVER_PID=$!
echo "[setup] Server avviato (PID $SERVER_PID)."

# --- 6. Cleanup automatico alla chiusura -----------------------------------
# Trap su SIGINT (Ctrl+C), SIGTERM (kill normale), EXIT (uscita normale).
# Cosi' il server muore SEMPRE con lo script, niente processi orfani.
cleanup() {
    # Guard: evita doppia esecuzione se EXIT e SIGTERM scattano in sequenza.
    if [ "${CLEANUP_FATTO:-0}" = "1" ]; then return; fi
    CLEANUP_FATTO=1
    echo ""
    echo "[exit] Chiudo il server..."
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
        # Aspetta che muoia, max 2 secondi.
        for _ in 1 2 3 4; do
            if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
            sleep 0.5
        done
        # Se ancora vivo, forza.
        kill -9 "$SERVER_PID" 2>/dev/null || true
    fi
    echo "[exit] Fatto."
}
trap cleanup EXIT INT TERM

# --- 7. Aspetta che il server risponda (max 5 secondi) ---------------------
URL="http://127.0.0.1:$PORTA/web/index.html"
echo "[setup] Aspetto il server su $URL ..."
for _ in 1 2 3 4 5 6 7 8 9 10; do
    if (echo > /dev/tcp/127.0.0.1/$PORTA) 2>/dev/null; then
        break
    fi
    sleep 0.5
done

# --- 8. Apri il browser ----------------------------------------------------
# xdg-open e' lo standard freedesktop.org. Funziona su tutti i desktop Linux
# (GNOME, KDE, XFCE, ecc.) e apre il browser di default dell'utente.
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
else
    echo "[setup] xdg-open non disponibile. Apri manualmente: $URL"
fi

echo ""
echo "============================================================"
echo "  Il gioco e' aperto nel browser su: $URL"
echo "  Per chiudere: Ctrl+C in questa finestra, oppure chiudila."
echo "============================================================"
echo ""

# --- 9. Resta vivo finche' il server vive ----------------------------------
# 'wait' blocca finche' il processo del server termina. Se l'utente premerá
# Ctrl+C, scatta la trap di cleanup.
wait "$SERVER_PID"

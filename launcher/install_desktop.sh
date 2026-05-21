#!/usr/bin/env bash
# =============================================================================
# Gli Erranti del Destino — installa il launcher nel menu applicazioni Linux
#
# Cosa fa, per non-tecnici:
#   1. Rende eseguibile lo script erranti.sh
#   2. Genera un file .desktop (la voce nel menu applicazioni) con i path
#      corretti per la tua installazione
#   3. Lo copia in ~/.local/share/applications/ (la cartella standard per i
#      menu utente su tutte le distro Linux desktop)
#   4. Opzionalmente, lo copia anche sul Desktop dell'utente, cosi' hai
#      un'icona cliccabile su cui doppio-click
#
# Dopo aver eseguito questo script, "Gli Erranti del Destino" appare nel menu
# applicazioni alla categoria Giochi. Sul desktop, se hai chiesto la copia
# desktop, puoi fare doppio-click sull'icona.
#
# USO:
#   chmod +x launcher/install_desktop.sh
#   ./launcher/install_desktop.sh
# =============================================================================

set -e

# Trova la cartella del progetto.
SCRIPT_PATH="$(readlink -f "$0")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
PROJ_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -d "$PROJ_ROOT/web" ] || [ ! -d "$PROJ_ROOT/motore" ]; then
    echo "Errore: non trovo le cartelle web/ e motore/ in $PROJ_ROOT"
    echo "Lancia questo script da launcher/install_desktop.sh"
    exit 1
fi

LANCIATORE="$PROJ_ROOT/launcher/erranti.sh"
ICONA="$PROJ_ROOT/launcher/erranti.svg"

# Rendi eseguibile il launcher.
chmod +x "$LANCIATORE"
echo "[install] Reso eseguibile: $LANCIATORE"

# Genera il file .desktop con path assoluti.
# - Type=Application: tipo eseguibile (alternativi: Link, Directory)
# - Exec: il comando lanciato al click. bash -c "...; read" mantiene il
#   terminale aperto in caso di errore, cosi' vedi il messaggio.
# - Terminal=true: apre un terminale (mostra i log del server)
# - Categories=Game;: appare nella sezione Giochi del menu
# - Icon: path assoluto all'SVG
TARGET_USER="$HOME/.local/share/applications/erranti-del-destino.desktop"
mkdir -p "$HOME/.local/share/applications"

cat > "$TARGET_USER" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Gli Erranti del Destino
Comment=Avventura fantasy a carte multiplayer locale
Exec=bash -c '"$LANCIATORE"; echo; read -p "Premi INVIO per chiudere..."'
Path=$PROJ_ROOT
Icon=$ICONA
Terminal=true
Categories=Game;RolePlaying;
StartupNotify=false
EOF

chmod +x "$TARGET_USER"
echo "[install] Creato: $TARGET_USER"

# Aggiorna il database desktop (cosi' il menu vede la nuova voce subito).
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "[install] Database menu aggiornato."
fi

# Chiedi se copiare anche sul Desktop.
DESKTOP_DIR=""
if [ -d "$HOME/Desktop" ]; then DESKTOP_DIR="$HOME/Desktop"
elif [ -d "$HOME/Scrivania" ]; then DESKTOP_DIR="$HOME/Scrivania"
elif [ -d "$HOME/Bureau" ]; then DESKTOP_DIR="$HOME/Bureau"
fi

if [ -n "$DESKTOP_DIR" ]; then
    echo ""
    read -rp "Vuoi copiare l'icona anche sul Desktop ($DESKTOP_DIR)? [s/N]: " risposta
    if [ "$risposta" = "s" ] || [ "$risposta" = "S" ]; then
        TARGET_DESKTOP="$DESKTOP_DIR/erranti-del-destino.desktop"
        cp "$TARGET_USER" "$TARGET_DESKTOP"
        chmod +x "$TARGET_DESKTOP"
        # GNOME (e altri DE moderni) richiede "permesso di esecuzione come
        # programma" tramite metadata. Lo settiamo se gio possibile.
        if command -v gio >/dev/null 2>&1; then
            gio set "$TARGET_DESKTOP" metadata::trusted true 2>/dev/null || true
        fi
        echo "[install] Copiato su: $TARGET_DESKTOP"
        echo "  Nota: alla prima esecuzione, alcuni desktop (GNOME, Cinnamon)"
        echo "  chiedono di confermare l'esecuzione (clic destro -> Consenti)."
    fi
fi

echo ""
echo "============================================================"
echo "  Installazione completata."
echo "  Cerca 'Gli Erranti del Destino' nel menu applicazioni,"
echo "  oppure fai doppio click sull'icona sul Desktop."
echo "============================================================"

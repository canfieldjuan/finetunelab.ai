#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
OS_NAME=$(uname -s)
INSTALL_DIR="${INSTALL_DIR:-$HOME/.finetunelab/training-agent}"
SERVICE_NAME="finetunelab-training-agent"
PLIST_NAME="com.finetunelab.training-agent"
PYTHON_BIN="${PYTHON_BIN:-python3}"

log() { echo "[install] $*"; }

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  log "python3 is required but not found on PATH"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  log "rsync is required; please install rsync and re-run"
  exit 1
fi

log "Installing to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

log "Syncing project files"
rsync -a --delete --exclude '.git' --exclude 'venv' --exclude '__pycache__' "$REPO_ROOT/" "$INSTALL_DIR/"

log "Creating virtual environment"
"$PYTHON_BIN" -m venv "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -r "$INSTALL_DIR/requirements.txt"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  log "Created $INSTALL_DIR/.env (edit BACKEND_URL and API_KEY)"
fi

mkdir -p "$INSTALL_DIR/logs"

if [[ "$OS_NAME" == "Linux" ]]; then
  UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=FineTuneLab Training Agent
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/python -m src.main
Restart=on-failure
EnvironmentFile=$INSTALL_DIR/.env
StandardOutput=append:$INSTALL_DIR/logs/agent.log
StandardError=append:$INSTALL_DIR/logs/agent.log

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now ${SERVICE_NAME}.service
  log "Service started. Check with: systemctl --user status ${SERVICE_NAME}"
elif [[ "$OS_NAME" == "Darwin" ]]; then
  LAUNCH_DIR="$HOME/Library/LaunchAgents"
  mkdir -p "$LAUNCH_DIR"
  cat > "$LAUNCH_DIR/${PLIST_NAME}.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/venv/bin/python</string>
    <string>-m</string>
    <string>src.main</string>
  </array>
  <key>WorkingDirectory</key><string>$INSTALL_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>
  <key>StandardOutPath</key><string>$INSTALL_DIR/logs/agent.log</string>
  <key>StandardErrorPath</key><string>$INSTALL_DIR/logs/agent.log</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
EOF
  launchctl unload "$LAUNCH_DIR/${PLIST_NAME}.plist" >/dev/null 2>&1 || true
  launchctl load "$LAUNCH_DIR/${PLIST_NAME}.plist"
  log "Service loaded. Check with: launchctl list | grep ${PLIST_NAME}"
else
  log "Unsupported OS: $OS_NAME. Use install.ps1 on Windows."
  exit 1
fi

log "Done. Edit $INSTALL_DIR/.env then restart the service if needed."
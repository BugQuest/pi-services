#!/usr/bin/env bash
# Install pi-services on a Raspberry Pi (run as the `realitynauts` user, with
# sudo available).
#
#   bash deploy/install.sh
#
# Idempotent: re-running just refreshes files and reloads systemd.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "[1/6] Creating drop-in folder /etc/pi-services/enabled/"
sudo install -d -m 0755 /etc/pi-services/enabled

echo "[2/6] Installing systemd units"
sudo install -m 0644 "$HERE/pi-services.service" /etc/systemd/system/pi-services.service
sudo install -m 0644 "$HERE/wifi-radar.service" /etc/systemd/system/wifi-radar.service

echo "[3/6] Installing sudoers snippet"
sudo install -m 0440 "$HERE/sudoers.d-pi-services" /etc/sudoers.d/pi-services
sudo visudo -c >/dev/null

echo "[4/6] Curating wifi-radar (symlinked into /etc/pi-services/enabled/)"
sudo ln -sfn /etc/systemd/system/wifi-radar.service /etc/pi-services/enabled/wifi-radar.service
# Curate pi-services itself too (it can read its own logs at least).
sudo ln -sfn /etc/systemd/system/pi-services.service /etc/pi-services/enabled/pi-services.service

echo "[5/6] Setting up Python venv if missing"
if [ ! -d "$ROOT/.venv" ]; then
  python3 -m venv "$ROOT/.venv"
fi
"$ROOT/.venv/bin/pip" install --upgrade pip
"$ROOT/.venv/bin/pip" install -e "$ROOT"

echo "[6/6] Reloading systemd and enabling units"
sudo systemctl daemon-reload
sudo systemctl enable --now pi-services.service

cat <<'EOF'

Done.

  Dashboard:   http://<pi>:8001/
  Tail logs:   journalctl -u pi-services -f
  Curate:      sudo ln -sfn /etc/systemd/system/<unit>.service /etc/pi-services/enabled/

Convert nohup wifi-radar to systemd (one-time):
  pkill -9 -f 'uvicorn app.main:app' || true
  sudo systemctl enable --now wifi-radar.service
EOF

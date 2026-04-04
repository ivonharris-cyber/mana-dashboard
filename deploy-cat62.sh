#!/usr/bin/env bash
#
# deploy-cat62.sh — Deploy mana-dashboard to a remote host (e.g. cat62 via Tailscale)
#
# Usage:  ./deploy-cat62.sh <host-ip-or-name> [ssh-user]
#   host-ip-or-name  Tailscale hostname or IP of the target machine
#   ssh-user         SSH user on the target (default: root)
#
# Example:
#   ./deploy-cat62.sh cat62
#   ./deploy-cat62.sh 100.64.0.5 ivonh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REMOTE_DIR="/opt/mana-dashboard"
SERVICE_NAME="mana-dashboard"
SERVICE_PORT=3003
NODE_MAJOR=22          # minimum Node.js major version required
TARBALL="mana-dashboard-deploy.tar.gz"

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <host-ip-or-name> [ssh-user]"
  exit 1
fi

TARGET_HOST="$1"
SSH_USER="${2:-root}"
SSH_TARGET="${SSH_USER}@${TARGET_HOST}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Deploying mana-dashboard to ${SSH_TARGET}:${REMOTE_DIR}"

# ---------------------------------------------------------------------------
# 1. Build the frontend
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 1: Building frontend ---"
(cd app && npx vite build)
echo "Frontend build complete."

# ---------------------------------------------------------------------------
# 2. Create tarball (server/ + app/dist/, excluding node_modules & data/*.db)
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 2: Creating deployment tarball ---"
tar czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='server/data/*.db' \
  server/ \
  app/dist/

echo "Created ${TARBALL} ($(du -h "$TARBALL" | cut -f1))"

# ---------------------------------------------------------------------------
# 3. SCP the tarball to the target host
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 3: Uploading tarball to ${SSH_TARGET} ---"
scp "$TARBALL" "${SSH_TARGET}:/tmp/${TARBALL}"
echo "Upload complete."

# ---------------------------------------------------------------------------
# 4. SSH in: extract, install deps, configure systemd service
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 4: Installing on remote host ---"
ssh "${SSH_TARGET}" bash -s <<REMOTE_SCRIPT
set -euo pipefail

echo "[remote] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "[remote] ERROR: Node.js not found. Install Node.js ${NODE_MAJOR} first."
  exit 1
fi

NODE_VER=\$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "\$NODE_VER" -lt ${NODE_MAJOR} ]]; then
  echo "[remote] ERROR: Node.js \$NODE_VER found, but ${NODE_MAJOR}+ required."
  exit 1
fi
echo "[remote] Node.js \$(node -v) OK"

# Create target directory
echo "[remote] Setting up ${REMOTE_DIR}..."
mkdir -p "${REMOTE_DIR}"

# Extract tarball
echo "[remote] Extracting tarball..."
tar xzf "/tmp/${TARBALL}" -C "${REMOTE_DIR}"
rm -f "/tmp/${TARBALL}"

# Install production dependencies
echo "[remote] Installing server dependencies..."
cd "${REMOTE_DIR}/server"
npm install --production --no-audit --no-fund

# Create .env if it doesn't exist
if [[ ! -f "${REMOTE_DIR}/server/.env" ]]; then
  echo "[remote] Creating default .env..."
  cat > "${REMOTE_DIR}/server/.env" <<'ENVFILE'
PORT=${SERVICE_PORT}
JWT_SECRET=mana-meta-maori-2026
N8N_URL=http://localhost:5678
ENVFILE
  echo "[remote] .env created — edit ${REMOTE_DIR}/server/.env to customise."
else
  echo "[remote] .env already exists, leaving it unchanged."
fi

# Create data directory if missing (for SQLite)
mkdir -p "${REMOTE_DIR}/server/data"

# Write systemd unit file
echo "[remote] Writing systemd service ${SERVICE_NAME}..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNITFILE
[Unit]
Description=ManaMetaMaori Command Center Dashboard
After=network.target

[Service]
Type=simple
User=${SSH_USER}
WorkingDirectory=${REMOTE_DIR}/server
ExecStart=$(command -v node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${SERVICE_PORT}
EnvironmentFile=-${REMOTE_DIR}/server/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
UNITFILE

# Reload and (re)start the service
echo "[remote] Enabling and starting ${SERVICE_NAME}..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# Brief pause then show status
sleep 2
echo ""
echo "[remote] Service status:"
systemctl status "${SERVICE_NAME}" --no-pager || true

echo ""
echo "[remote] Deployment complete!"
echo "[remote] Dashboard should be available at http://${TARGET_HOST}:${SERVICE_PORT}"

REMOTE_SCRIPT

# ---------------------------------------------------------------------------
# 5. Cleanup local tarball
# ---------------------------------------------------------------------------
rm -f "$TARBALL"

echo ""
echo "==> Deployment to ${SSH_TARGET} finished successfully."
echo "    URL: http://${TARGET_HOST}:${SERVICE_PORT}"
echo "    Service: systemctl status ${SERVICE_NAME}"
echo "    Logs: journalctl -u ${SERVICE_NAME} -f"

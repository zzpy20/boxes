#!/bin/bash
# Boxes VPS Setup Script
# Run on a fresh Ubuntu 22.04/24.04 VPS:
#   curl -fsSL https://raw.githubusercontent.com/zzpy20/boxes/main/setup.sh | bash
# Or with a custom auth token:
#   curl -fsSL https://raw.githubusercontent.com/zzpy20/boxes/main/setup.sh | AUTH_TOKEN=yourpassword bash

set -e

REPO_URL="https://github.com/zzpy20/boxes"
APP_DIR="/opt/boxes"
AUTH_TOKEN="${AUTH_TOKEN:-changeme}"

echo "================================================"
echo "  Boxes VPS Setup"
echo "================================================"
echo ""

# ── 1. System update ──────────────────────────────
echo "[1/6] Updating system packages..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq -o Dpkg::Options::="--force-confkeep"

# ── 2. Install Docker ─────────────────────────────
echo "[2/6] Installing Docker..."
if command -v docker &>/dev/null; then
  echo "  Docker already installed, skipping."
else
  curl -fsSL https://get.docker.com | sh
fi

# ── 3. Install nginx ──────────────────────────────
echo "[3/6] Installing nginx..."
if command -v nginx &>/dev/null; then
  echo "  nginx already installed, skipping."
else
  apt-get install -y -qq nginx
fi

# ── 4. Clone or update repo ───────────────────────
echo "[4/6] Cloning boxes repo..."
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo already exists, pulling latest..."
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# Write AUTH_TOKEN into docker-compose.yml
sed -i "s/AUTH_TOKEN=.*/AUTH_TOKEN=$AUTH_TOKEN/" "$APP_DIR/docker-compose.yml"
echo "  AUTH_TOKEN set."

# ── 5. Configure nginx ────────────────────────────
echo "[5/6] Configuring nginx..."
cat > /etc/nginx/sites-available/boxes <<'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/boxes /etc/nginx/sites-enabled/boxes
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  nginx configured."

# ── 6. Firewall ───────────────────────────────────
echo "[6/6] Configuring firewall (ufw)..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw delete allow 3000/tcp 2>/dev/null || true
echo "  Firewall: ports 22, 80, 443 open. Port 3000 blocked."

# ── Start app ─────────────────────────────────────
echo ""
echo "Starting Boxes app..."
docker compose -f "$APP_DIR/docker-compose.yml" up -d --build

echo ""
echo "================================================"
echo "  Done! Boxes is running."
echo ""
echo "  URL:      http://$(curl -s ifconfig.me)"
echo "  Passcode: $AUTH_TOKEN"
echo ""
echo "  To restore a backup:"
echo "    scp boxes-backup-YYYY-MM-DD.tar.gz root@<ip>:/tmp/"
echo "    docker volume create boxes_boxes-data"
echo "    docker run --rm -v boxes_boxes-data:/data -v /tmp:/backup alpine tar xzf /backup/boxes-backup-YYYY-MM-DD.tar.gz -C /data"
echo "    docker compose -f $APP_DIR/docker-compose.yml restart"
echo "================================================"

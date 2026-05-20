#!/usr/bin/env bash
#
# init-tls.sh — issue the initial Let's Encrypt cert for api.<domain>.
#
# Usage:  sudo bash init-tls.sh api.volt.dev contact@volt.dev
#
# Prereqs: setup-server.sh has run; DNS A record for the domain points to this host.

set -euo pipefail

DOMAIN="${1:?usage: init-tls.sh <domain> <email>}"
EMAIL="${2:?usage: init-tls.sh <domain> <email>}"

if ! command -v certbot >/dev/null; then
  apt-get update
  apt-get install -y certbot
fi

# We use the standalone authenticator on port 80 since Nginx is not yet running.
# After the cert is issued, Nginx in the compose stack picks it up from
# /etc/letsencrypt (mounted into the container).
echo "─── Stopping anything on port 80 ─────────────────────────"
docker compose -f /srv/volt/docker-compose.yml down nginx 2>/dev/null || true

echo "─── Requesting cert for $DOMAIN ─────────────────────────"
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

echo "─── Setting up auto-renewal ─────────────────────────"
# certbot installs a systemd timer by default. We add a deploy hook so Nginx
# reloads after each renewal.
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
# Reload the Nginx container after cert renewal
docker compose -f /srv/volt/docker-compose.yml exec -T nginx nginx -s reload || true
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# Verify the timer is active
systemctl status certbot.timer --no-pager | head -5 || true

echo "─── Restarting Nginx ─────────────────────────"
docker compose -f /srv/volt/docker-compose.yml up -d nginx

echo
echo "✓ TLS provisioned for $DOMAIN"
echo "  Certificate location: /etc/letsencrypt/live/$DOMAIN/"
echo "  Auto-renewal:         systemctl status certbot.timer"

#!/usr/bin/env bash
#
# setup-server.sh — one-time provisioning for a fresh Ubuntu 24.04 LTS VPS.
#
# Run as root on the target host:
#   curl -fsSL https://raw.githubusercontent.com/<owner>/volt/main/scripts/setup-server.sh | bash
#
# Or copy this file over and run:  sudo bash setup-server.sh
#
# This installs Docker, creates the `deploy` user with SSH key, opens firewall
# ports, and prepares /srv/volt for the deploy workflow.
#
# Idempotent — safe to re-run.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root."
  exit 1
fi

echo "─── Updating system packages ─────────────────────────"
apt-get update
apt-get upgrade -y
apt-get install -y \
  ca-certificates curl gnupg ufw fail2ban \
  python3 python3-pip jq

echo "─── Installing Docker ─────────────────────────"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
fi

echo "─── Creating deploy user ─────────────────────────"
# `deploy` is the SSH user used by GitHub Actions; passwordless sudo only for
# Docker via group membership (no full sudo).
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi
usermod -aG docker deploy

# SSH key bootstrap — the actual key gets installed manually the first time.
# (We can't include the key inline; this just preps the directory.)
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

echo
echo "→ Now paste the deploy public key into:"
echo "    /home/deploy/.ssh/authorized_keys"
echo "  (then save the matching private key as GitHub secret DEPLOY_SSH_KEY)"
echo

echo "─── Preparing /srv/volt ─────────────────────────"
mkdir -p /srv/volt/{data,backups,nginx,certbot}
chown -R deploy:deploy /srv/volt

echo "─── Firewall ─────────────────────────"
# Allow SSH + HTTP + HTTPS only.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "─── fail2ban (basic SSH brute-force protection) ─────────────────────────"
systemctl enable fail2ban
systemctl start fail2ban

echo "─── SSH hardening ─────────────────────────"
# Disable root login + password auth — keys only.
SSHD_CONFIG=/etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' $SSHD_CONFIG
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' $SSHD_CONFIG
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' $SSHD_CONFIG
systemctl reload ssh

echo
echo "════════════════════════════════════════════════════════"
echo "✓ Server bootstrap complete."
echo
echo "Next steps:"
echo "  1. Install the deploy public key in /home/deploy/.ssh/authorized_keys"
echo "  2. Run: bash scripts/init-tls.sh <domain> <email>  to provision TLS"
echo "  3. Copy your .env to /srv/volt/.env"
echo "  4. Trigger the GitHub deploy workflow"
echo "════════════════════════════════════════════════════════"

#!/usr/bin/env bash
#
# restore-backup.sh — restore Postgres from a backup file.
#
# DESTRUCTIVE: this drops + recreates the public schema. Use with care.
#
# Usage:  sudo bash restore-backup.sh /srv/volt/backups/volt-20260520-030000.sql.gz

set -euo pipefail

BACKUP_FILE="${1:?usage: restore-backup.sh <path-to-dump.sql.gz>}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "File not found: $BACKUP_FILE"
  exit 1
fi

cat <<EOF
⚠  About to restore from $BACKUP_FILE
   This will REPLACE the entire public schema in the volt database.
   Proceed? (yes/NO)
EOF
read -r confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "─── Stopping backend ─────────────────────────"
docker compose -f /srv/volt/docker-compose.yml stop backend

echo "─── Dropping schema ─────────────────────────"
docker compose -f /srv/volt/docker-compose.yml exec -T postgres \
  psql -U volt -d volt -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "─── Restoring from $BACKUP_FILE ─────────────────────────"
gunzip -c "$BACKUP_FILE" | docker compose -f /srv/volt/docker-compose.yml exec -T postgres \
  psql -U volt -d volt

echo "─── Starting backend ─────────────────────────"
docker compose -f /srv/volt/docker-compose.yml start backend

# Wait for health
for i in {1..15}; do
  if docker compose -f /srv/volt/docker-compose.yml exec -T backend wget -q -O- http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ Restore complete; backend healthy."
    exit 0
  fi
  sleep 2
done

echo "::warning::Backend did not come back healthy. Check logs: docker compose logs backend"
exit 1

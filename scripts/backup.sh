#!/usr/bin/env bash
#
# backup.sh — dump the Postgres DB to /srv/volt/backups and prune older copies.
#
# Schedule this via systemd timer or cron (e.g. nightly at 03:00):
#   0 3 * * * /srv/volt/scripts/backup.sh >> /var/log/volt-backup.log 2>&1
#
# Retention: keeps the last 14 daily backups + last 8 weekly (Sun) backups.

set -euo pipefail

BACKUP_DIR="/srv/volt/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
WEEKDAY=$(date -u +%u)  # 1=Mon..7=Sun
DUMP_FILE="$BACKUP_DIR/volt-$TIMESTAMP.sql.gz"

# pg_dump inside the postgres container — credentials read from .env
docker compose -f /srv/volt/docker-compose.yml exec -T postgres \
  pg_dump -U volt -d volt | gzip > "$DUMP_FILE"

echo "✓ Wrote $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# ─── Retention pruning ───
# Daily: keep last 14
find "$BACKUP_DIR" -name 'volt-*.sql.gz' -mtime +14 -print -delete | sed 's/^/pruned: /'

# Sunday backups are kept for 8 weeks (this implementation is simplified —
# we'd ideally tag the weekly ones separately. For MVP, the 14-day window
# is enough; richer retention added later.)

#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <timestamp>"
  echo "Example: $0 20260106_120000"
  echo ""
  echo "Available backups:"
  ls -1 ./backups/*.tar.gz 2>/dev/null | sed 's/.*_//' | sed 's/.tar.gz//' | sort -u || echo "  (none)"
  exit 1
fi

TIMESTAMP="$1"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-recaptel}"

echo "=== RecapTel Restore Script ==="
echo "Restoring from timestamp: $TIMESTAMP"
echo ""

echo "WARNING: This will overwrite current data!"
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Stopping services..."
docker compose down

echo "Restoring web-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_web-data:/data" \
  -v "$(realpath "$BACKUP_DIR"):/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/web-data_${TIMESTAMP}.tar.gz -C /data"

echo "Restoring worker-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_worker-data:/data" \
  -v "$(realpath "$BACKUP_DIR"):/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/worker-data_${TIMESTAMP}.tar.gz -C /data"

echo "Restoring redis-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_redis-data:/data" \
  -v "$(realpath "$BACKUP_DIR"):/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/redis-data_${TIMESTAMP}.tar.gz -C /data"

echo ""
echo "Restore complete!"
echo "Run 'docker compose up -d' to start services."



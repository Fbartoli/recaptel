#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_PROJECT="${COMPOSE_PROJECT:-recaptel}"

mkdir -p "$BACKUP_DIR"

echo "=== RecapTel Backup Script ==="
echo "Timestamp: $TIMESTAMP"
echo "Backup dir: $BACKUP_DIR"

echo ""
echo "Backing up web-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_web-data:/data:ro" \
  -v "$(realpath "$BACKUP_DIR"):/backup" \
  alpine tar czf "/backup/web-data_${TIMESTAMP}.tar.gz" -C /data .

echo "Backing up worker-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_worker-data:/data:ro" \
  -v "$(realpath "$BACKUP_DIR"):/backup" \
  alpine tar czf "/backup/worker-data_${TIMESTAMP}.tar.gz" -C /data .

echo "Backing up redis-data volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_redis-data:/data:ro" \
  -v "$(realpath "$BACKUP_DIR"):/backup" \
  alpine tar czf "/backup/redis-data_${TIMESTAMP}.tar.gz" -C /data .

echo ""
echo "Backup complete!"
ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}.tar.gz

echo ""
echo "To restore, use:"
echo "  ./scripts/restore.sh $TIMESTAMP"



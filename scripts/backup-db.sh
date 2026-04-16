#!/bin/bash
set -euo pipefail

DATABASE_URL=$(grep '^DATABASE_URL=' /home/erp/99tech-erp/.env | cut -d= -f2- | sed 's/^"//' | sed 's/"$//')
export DATABASE_URL

TS=$(date +'%Y-%m-%d_%H-%M-%S')
OUT=/home/erp/backups/ninety9tech_erp_${TS}.sql.gz
LOG=/home/erp/backup-logs/backup.log

mkdir -p /home/erp/backups /home/erp/backup-logs

echo "[$(date +'%F %T')] Starting backup -> ${OUT}" >> "$LOG"

if pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$OUT" 2>> "$LOG"; then
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "[$(date +'%F %T')] SUCCESS (${SIZE})" >> "$LOG"
else
  echo "[$(date +'%F %T')] FAILED" >> "$LOG"
  rm -f "$OUT"
  exit 1
fi

find /home/erp/backups -name 'ninety9tech_erp_*.sql.gz' -mtime +14 -delete

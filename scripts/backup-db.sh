#!/bin/bash
# Nightly DB backup.
#   1. pg_dump + gzip locally  (~/backups, 14-day retention)
#   2. rclone copy to Google Drive  (99erp:99techerp-backups/, 30-day retention)
# Logs: ~/backup-logs/backup.log
set -euo pipefail

DATABASE_URL=$(grep '^DATABASE_URL=' /home/erp/99tech-erp/.env | cut -d= -f2- | sed 's/^"//' | sed 's/"$//')
export DATABASE_URL

TS=$(date +'%Y-%m-%d_%H-%M-%S')
OUT=/home/erp/backups/ninety9tech_erp_${TS}.sql.gz
LOG=/home/erp/backup-logs/backup.log

mkdir -p /home/erp/backups /home/erp/backup-logs

echo "[$(date +'%F %T')] Starting backup -> ${OUT}" >> "$LOG"

# 1. Local dump
if pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$OUT" 2>> "$LOG"; then
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "[$(date +'%F %T')] LOCAL SUCCESS (${SIZE})" >> "$LOG"
else
  echo "[$(date +'%F %T')] LOCAL FAILED" >> "$LOG"
  rm -f "$OUT"
  exit 1
fi

# 2. Off-site copy to Google Drive (non-fatal if it fails)
if rclone copy "$OUT" 99erp:99techerp-backups/ 2>> "$LOG"; then
  echo "[$(date +'%F %T')] REMOTE UPLOAD SUCCESS" >> "$LOG"
else
  echo "[$(date +'%F %T')] REMOTE UPLOAD FAILED (local copy is intact)" >> "$LOG"
fi

# 3. Local retention: 14 days
find /home/erp/backups -name 'ninety9tech_erp_*.sql.gz' -mtime +14 -delete

# 4. Remote retention: 30 days
rclone delete 99erp:99techerp-backups/ --min-age 30d --include 'ninety9tech_erp_*.sql.gz' 2>> "$LOG" || true

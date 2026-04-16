#!/bin/bash
# Restores the latest backup into a throwaway DB and compares row counts
# against production. Drops the throwaway DB when done.
set -euo pipefail

TEST_DB=ninety9tech_erp_restore_test
PROD_DB=ninety9tech_erp
LATEST_BACKUP=$(ls -t /home/erp/backups/ninety9tech_erp_*.sql.gz | head -1)

echo "Latest backup: $LATEST_BACKUP"
echo "Test DB:       $TEST_DB"
echo ""

# Drop test DB if left over from a previous failed run
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $TEST_DB;" > /dev/null

echo "Creating test database..."
sudo -u postgres psql -c "CREATE DATABASE $TEST_DB OWNER erp_admin;" > /dev/null

echo "Restoring backup..."
gunzip -c "$LATEST_BACKUP" | sudo -u postgres psql -d "$TEST_DB" > /tmp/restore.log 2>&1
RESTORE_ERRORS=$(grep -cE '^(ERROR|FATAL)' /tmp/restore.log || true)
echo "  Restore complete. Errors in log: $RESTORE_ERRORS"
if [ "$RESTORE_ERRORS" -gt 0 ]; then
  echo "  Last 5 errors:"
  grep -E '^(ERROR|FATAL)' /tmp/restore.log | tail -5 | sed 's/^/    /'
fi

echo ""
echo "Row counts (production vs restored):"
TABLES=(employees assets asset_assignments departments companies locations)
printf "  %-25s %10s %10s %s\n" "table" "prod" "restored" "status"
printf "  %-25s %10s %10s %s\n" "-----" "----" "--------" "------"

ALL_OK=1
for T in "${TABLES[@]}"; do
  PROD=$(sudo -u postgres psql -d "$PROD_DB" -tAc "SELECT COUNT(*) FROM $T;" 2>/dev/null || echo "ERR")
  REST=$(sudo -u postgres psql -d "$TEST_DB" -tAc "SELECT COUNT(*) FROM $T;" 2>/dev/null || echo "ERR")
  if [ "$PROD" = "$REST" ]; then
    STATUS="OK"
  else
    STATUS="MISMATCH"
    ALL_OK=0
  fi
  printf "  %-25s %10s %10s %s\n" "$T" "$PROD" "$REST" "$STATUS"
done

echo ""
echo "Cleaning up test database..."
sudo -u postgres psql -c "DROP DATABASE $TEST_DB;" > /dev/null

echo ""
if [ "$ALL_OK" = "1" ] && [ "$RESTORE_ERRORS" = "0" ]; then
  echo "RESULT: RESTORE TEST PASSED"
else
  echo "RESULT: RESTORE TEST FAILED"
  exit 1
fi

#!/bin/bash
# 99 Tech ERP — Master Inventory Import
# Wipes dummy data and imports real employees + assets from the uploaded files.
# Safe to re-run.

set -e

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  99 Tech ERP — Master Inventory Import"
echo "========================================"
echo ""

# Ensure deps are installed (in case this is a fresh clone)
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "[1/5] Wiping existing data tables via raw SQL..."
npx --yes ts-node --compiler-options '{"module":"CommonJS"}' prisma/wipe-data.ts
echo ""

echo "[2/5] Applying schema changes (prisma db push)..."
npx prisma db push --accept-data-loss
echo "  ✓ Schema synced"
echo ""

echo "[3/5] Regenerating Prisma client..."
npx prisma generate
echo "  ✓ Client regenerated"
echo ""

echo "[4/5] Re-seeding expense categories..."
npx --yes ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-categories.ts
echo ""

echo "[5/5] Running master inventory import..."
npx --yes ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-master-inventory.ts
echo ""

echo "========================================"
echo "  Import finished."
echo "  Start the dev server with:"
echo "    npm run dev"
echo "========================================"
echo ""
read -p "Press Enter to close this window..."

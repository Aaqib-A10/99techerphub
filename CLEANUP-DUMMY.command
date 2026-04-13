#!/bin/bash
# Remove dummy/test assets from the database
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "🧹 Removing dummy/test assets..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/remove-dummy-assets.ts

echo "🚀 Starting dev server..."
npm run dev

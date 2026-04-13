#!/bin/bash
# Import assets from Access DB export into 99 ERP
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "📦 Pushing any schema changes..."
npx prisma db push --accept-data-loss

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "📥 Importing 283 assets from Access DB..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-access-db.ts

echo "🚀 Starting dev server..."
npm run dev

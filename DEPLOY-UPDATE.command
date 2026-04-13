#!/bin/bash
# Deploy all schema changes, seed data, and restart
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "📦 Pushing schema changes to database..."
npx prisma db push --accept-data-loss

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "🌱 Seeding expense categories and initial data..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-categories.ts

echo "📥 Importing 283 assets from Access DB..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-access-db.ts

echo "🚀 Starting dev server..."
npm run dev

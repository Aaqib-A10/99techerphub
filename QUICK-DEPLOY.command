#!/bin/bash
# Quick deploy: push schema changes, regenerate client, restart dev server
# (Does NOT re-seed or re-import assets)
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "📦 Pushing schema changes to database..."
npx prisma db push --accept-data-loss

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "🚀 Starting dev server..."
npm run dev

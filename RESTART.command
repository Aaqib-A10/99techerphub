#!/bin/bash
# Restart the dev server with fresh Prisma client
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "🚀 Starting dev server..."
npm run dev

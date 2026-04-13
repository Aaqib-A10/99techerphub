#!/bin/bash
# Deploy v3 — Full ERP buildout: auth, RBAC, exit workflow, digital access, master data, exports, charts, and more
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "🧹 Removing stale empty [id] dir to fix dynamic slug conflict..."
rm -rf "app/api/onboarding/[id]" 2>/dev/null || true

echo "📦 Installing new deps (qrcode, html5-qrcode, @types/qrcode)..."
npm install qrcode html5-qrcode @types/qrcode --silent || true

echo "📦 Pushing schema changes to database (no-op if unchanged)..."
npx prisma db push --accept-data-loss

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "🌱 Seeding email templates (idempotent)..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-email-templates.ts || true

echo "👤 Seeding default users (4 roles)..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-users.ts || true

echo "🚀 Starting dev server..."
npm run dev

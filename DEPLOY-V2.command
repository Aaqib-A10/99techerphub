#!/bin/bash
# Deploy v2 — adds Offer Letters, Onboarding tokens, Email Templates
cd "$(dirname "$0")"
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo "🔄 Stopping any running dev server..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

echo "📦 Pushing schema changes to database..."
npx prisma db push --accept-data-loss

echo "🔧 Regenerating Prisma client..."
npx prisma generate

echo "🌱 Seeding email templates..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-email-templates.ts

echo "🚀 Starting dev server..."
npm run dev

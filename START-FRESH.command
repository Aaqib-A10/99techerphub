#!/bin/bash
cd "$(dirname "$0")"
echo "=== Stopping any running Next.js servers ==="
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
sleep 2
echo "=== Clearing build cache ==="
rm -rf .next
echo "=== Starting fresh dev server ==="
npm run dev

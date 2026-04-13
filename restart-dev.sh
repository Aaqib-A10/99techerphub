#!/bin/bash
# Kill ALL Next.js/node dev processes and restart clean
echo "Killing all Next.js processes..."
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
sleep 2

echo "Clearing Next.js build cache..."
rm -rf .next

echo "Starting dev server..."
npm run dev

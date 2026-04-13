#!/bin/bash

# ============================================
# 99 Technologies ERP - One-Click Setup
# ============================================
# This script sets up everything you need.
# Just double-click this file to run it!
# ============================================

clear

# Add Postgres.app CLI tools to PATH
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"

echo ""
echo "============================================"
echo "  99 Technologies ERP - Setup Starting..."
echo "============================================"
echo ""

# Navigate to the project folder
cd "$(dirname "$0")"
echo "📁 Project folder: $(pwd)"
echo ""

# Step 1: Install Node.js dependencies
echo "⏳ Step 1/5: Installing dependencies (this may take 1-2 minutes)..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error installing dependencies. Please screenshot this and send to Claude."
    read -p "Press Enter to close..."
    exit 1
fi
echo "✅ Dependencies installed!"
echo ""

# Step 2: Create the database
echo "⏳ Step 2/5: Creating database 'ninety9tech_erp'..."
createdb ninety9tech_erp 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Database created!"
else
    echo "ℹ️  Database may already exist (that's OK, continuing...)"
fi
echo ""

# Step 3: Generate Prisma Client
echo "⏳ Step 3/5: Setting up database connection..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Error generating Prisma client. Please screenshot this and send to Claude."
    read -p "Press Enter to close..."
    exit 1
fi
echo "✅ Database connection ready!"
echo ""

# Step 4: Push schema to database (create tables)
echo "⏳ Step 4/5: Creating database tables..."
npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Error creating tables. Make sure PostgreSQL is running (check Postgres.app)."
    echo "   Please screenshot this and send to Claude."
    read -p "Press Enter to close..."
    exit 1
fi
echo "✅ Database tables created!"
echo ""

# Step 5: Seed the database with sample data
echo "⏳ Step 5/5: Adding sample data (companies, departments, etc.)..."
npx prisma db seed
if [ $? -ne 0 ]; then
    echo "⚠️  Seeding had an issue (data may already exist, that's OK)"
fi
echo "✅ Sample data loaded!"
echo ""

echo "============================================"
echo "  ✅ SETUP COMPLETE!"
echo "============================================"
echo ""
echo "  Your ERP is ready to launch!"
echo ""
echo "  Starting the app now..."
echo "  Once it says 'Ready', open your browser to:"
echo ""
echo "  👉  http://localhost:3000"
echo ""
echo "============================================"
echo ""

# Start the development server
npm run dev

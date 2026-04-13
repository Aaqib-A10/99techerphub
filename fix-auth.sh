#!/bin/bash
# One-command fix for auth setup
echo "=== 99 Tech ERP — Auth Fix ==="
echo ""

echo "[1/4] Regenerating Prisma client..."
npx prisma generate
echo ""

echo "[2/4] Migrating old role values in database (SUPER_ADMIN→ADMIN, ADMIN_IT→HR, FINANCE→ACCOUNTANT)..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/migrate-roles.ts
echo ""

echo "[3/4] Pushing schema to database..."
npx prisma db push
echo ""

echo "[4/4] Re-hashing all passwords with bcrypt..."
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/reset-passwords.ts
echo ""

echo "=== Done! Restart your dev server (Ctrl+C then npm run dev) ==="
echo ""
echo "Login accounts:"
echo "  admin@99technologies.com / admin123     (ADMIN)"
echo "  hr@99technologies.com / hr123           (HR)"
echo "  manager@99technologies.com / manager123 (MANAGER)"
echo "  accountant@99technologies.com / finance123 (ACCOUNTANT)"
echo "  employee@99technologies.com / emp123     (EMPLOYEE)"

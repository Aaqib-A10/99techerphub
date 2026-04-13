/**
 * Pre-migration script: Update existing user roles from old enum values to new ones
 * using raw SQL, BEFORE running prisma db push.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/migrate-roles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[migrate-roles] Starting role migration...\n');

  // Step 1: Add new enum values to PostgreSQL (if they don't exist)
  const newValues = ['ADMIN', 'HR', 'MANAGER', 'ACCOUNTANT'];
  for (const val of newValues) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS '${val}'`
      );
      console.log(`  + Added enum value: ${val}`);
    } catch (e: any) {
      // Already exists — that's fine
      if (e.message?.includes('already exists')) {
        console.log(`  ✓ Enum value already exists: ${val}`);
      } else {
        console.log(`  ⚠ Could not add ${val}: ${e.message}`);
      }
    }
  }

  // Step 2: Update existing rows to use new role names
  const mappings = [
    { old: 'SUPER_ADMIN', new: 'ADMIN' },
    { old: 'ADMIN_IT', new: 'HR' },
    { old: 'FINANCE', new: 'ACCOUNTANT' },
  ];

  for (const m of mappings) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE users SET role = '${m.new}'::"UserRole" WHERE role = '${m.old}'::"UserRole"`
      );
      console.log(`  ✓ Updated ${m.old} → ${m.new} (${result} rows)`);
    } catch (e: any) {
      // The old value might not exist if this is a fresh DB
      console.log(`  ⚠ ${m.old} → ${m.new}: ${e.message?.split('\n')[0] || 'skipped'}`);
    }
  }

  // Step 3: Also update onboarding_tasks ownerRole strings
  for (const m of mappings) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE onboarding_tasks SET "ownerRole" = '${m.new}' WHERE "ownerRole" = '${m.old}'`
      );
      if (result > 0) console.log(`  ✓ Updated onboarding_tasks ownerRole: ${m.old} → ${m.new} (${result} rows)`);
    } catch {
      // Table might not exist yet
    }
  }

  console.log('\n[migrate-roles] Done! Now run: npx prisma db push');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('[migrate-roles] Failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

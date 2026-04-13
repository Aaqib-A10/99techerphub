/**
 * One-time script: Re-hash ALL user passwords with bcrypt.
 * Fixes login issues caused by old crypto.scrypt hashes.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/reset-passwords.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Known default passwords for seeded accounts
const KNOWN_PASSWORDS: Record<string, string> = {
  'admin@99technologies.com': 'admin123',
  'hr@99technologies.com': 'hr123',
  'it@99technologies.com': 'it123',
  'manager@99technologies.com': 'manager123',
  'accountant@99technologies.com': 'finance123',
  'finance@99technologies.com': 'finance123',
  'employee@99technologies.com': 'emp123',
};

async function main() {
  console.log('[reset-passwords] Fetching all users...');
  const users = await prisma.user.findMany();
  console.log(`[reset-passwords] Found ${users.length} users.\n`);

  let updated = 0;

  for (const user of users) {
    // Check if password is already bcrypt (bcrypt hashes start with "$2a$" or "$2b$")
    if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
      console.log(`  ✓ ${user.email} — already bcrypt, skipping`);
      continue;
    }

    // Look up known password
    const knownPw = KNOWN_PASSWORDS[user.email];
    if (!knownPw) {
      console.log(`  ⚠ ${user.email} — unknown password, resetting to "changeme123"`);
      const hash = await bcrypt.hash('changeme123', 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      });
      updated++;
      continue;
    }

    // Re-hash with bcrypt
    const hash = await bcrypt.hash(knownPw, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });
    console.log(`  ✓ ${user.email} — re-hashed with bcrypt`);
    updated++;
  }

  console.log(`\n[reset-passwords] Done. Updated ${updated} user(s).`);
  console.log('[reset-passwords] You can now log in with the default credentials.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('[reset-passwords] Failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

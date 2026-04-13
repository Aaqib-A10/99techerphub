/**
 * Standalone user seed script — safe to run from ts-node outside Next.js context.
 * Uses bcryptjs for password hashing (matches the login verification).
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-users.ts
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

const DEFAULT_USERS: Array<{ email: string; password: string; role: UserRole }> = [
  { email: 'admin@99technologies.com', password: 'admin123', role: 'ADMIN' },
  { email: 'hr@99technologies.com', password: 'hr123', role: 'HR' },
  { email: 'manager@99technologies.com', password: 'manager123', role: 'MANAGER' },
  { email: 'accountant@99technologies.com', password: 'finance123', role: 'ACCOUNTANT' },
  { email: 'employee@99technologies.com', password: 'emp123', role: 'EMPLOYEE' },
];

async function main() {
  console.log('[seed-users] Starting...');
  for (const u of DEFAULT_USERS) {
    const passwordHash = await hashPassword(u.password);
    const existing = await prisma.user.findUnique({ where: { email: u.email } });

    if (existing) {
      // Force-update password hash and role for existing users
      await prisma.user.update({
        where: { email: u.email },
        data: { passwordHash, role: u.role, isActive: true },
      });
      console.log(`[seed-users] Updated: ${u.email} (${u.role}) — password re-hashed with bcrypt`);
    } else {
      await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          role: u.role,
          isActive: true,
        },
      });
      console.log(`[seed-users] Created: ${u.email} (${u.role})`);
    }
  }
  console.log('[seed-users] Done.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('[seed-users] Failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { UserRole } from '@prisma/client';

const DEFAULT_USERS = [
  {
    email: 'admin@99technologies.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    name: 'Admin User',
  },
  {
    email: 'hr@99technologies.com',
    password: 'hr123',
    role: UserRole.HR,
    name: 'HR Manager',
  },
  {
    email: 'manager@99technologies.com',
    password: 'manager123',
    role: UserRole.MANAGER,
    name: 'Department Manager',
  },
  {
    email: 'accountant@99technologies.com',
    password: 'finance123',
    role: UserRole.ACCOUNTANT,
    name: 'Accountant',
  },
  {
    email: 'employee@99technologies.com',
    password: 'emp123',
    role: UserRole.EMPLOYEE,
    name: 'Employee',
  },
];

/**
 * Seed default users if they don't exist
 */
export async function seedDefaultUsers(): Promise<void> {
  console.log('[Seed] Creating default users...');

  for (const userData of DEFAULT_USERS) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      console.log(`[Seed] User already exists: ${userData.email}`);
      continue;
    }

    const passwordHash = await hashPassword(userData.password);

    await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        role: userData.role,
        isActive: true,
      },
    });

    console.log(`[Seed] Created user: ${userData.email} (${userData.role})`);
  }

  console.log('[Seed] Default users setup complete!');
}

export default seedDefaultUsers;

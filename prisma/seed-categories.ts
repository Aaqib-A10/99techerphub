import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed Expense Categories
  const expenseCategories = [
    { name: 'Hardware Procurement', code: 'HW', description: 'Laptops, monitors, peripherals, etc.' },
    { name: 'Software & Licenses', code: 'SW', description: 'Software subscriptions and licenses' },
    { name: 'Marketing', code: 'MKT', description: 'Marketing campaigns, ads, branding' },
    { name: 'Utilities', code: 'UTL', description: 'Electricity, internet, phone bills' },
    { name: 'Office Supplies', code: 'OFS', description: 'Stationery, printer supplies, etc.' },
    { name: 'Travel & Transportation', code: 'TRV', description: 'Business travel, commute, fuel' },
    { name: 'Meals & Entertainment', code: 'MNE', description: 'Team meals, client entertainment' },
    { name: 'Training & Development', code: 'TND', description: 'Courses, certifications, workshops' },
    { name: 'Rent & Facilities', code: 'RNT', description: 'Office rent, maintenance, repairs' },
    { name: 'Miscellaneous', code: 'MSC', description: 'Other uncategorized expenses' },
  ];

  for (const cat of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  console.log('Expense categories seeded');

  // Seed initial admin User (if not exists)
  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: 'admin@99technologies.com',
        passwordHash: 'placeholder', // In production, use bcrypt
        role: 'ADMIN',
      },
    });
    console.log('Admin user created');
  }

  // Add department codes if missing
  const deptCodes: Record<string, string> = {
    'Development': 'DEV',
    'Tech Support': 'SUP',
    'Sales': 'SAL',
    'Marketing': 'MKT',
    'HR': 'HR',
    'Finance': 'FIN',
    'Admin': 'ADM',
    'Operations': 'OPS',
  };

  for (const [name, code] of Object.entries(deptCodes)) {
    await prisma.department.updateMany({
      where: { name, code: '' },
      data: { code },
    });
  }

  console.log('Department codes updated');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

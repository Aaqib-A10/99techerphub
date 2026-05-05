/**
 * Plain-JS expense-category seed (no ts-node required).
 *
 * Mirrors prisma/seed-categories.ts but runs directly with node so
 * prod doesn't have to fight with TypeScript over SSH. Idempotent —
 * upserts by code, so re-running just refreshes descriptions.
 *
 * Run with:
 *   node prisma/seed-expense-categories.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = [
  { code: 'HW',  name: 'Hardware Procurement',     description: 'Laptops, monitors, peripherals, etc.' },
  { code: 'SW',  name: 'Software & Licenses',       description: 'Software subscriptions and licenses' },
  { code: 'MKT', name: 'Marketing',                 description: 'Marketing campaigns, ads, branding' },
  { code: 'UTL', name: 'Utilities',                 description: 'Electricity, internet, phone bills' },
  { code: 'OFS', name: 'Office Supplies',           description: 'Stationery, printer supplies, etc.' },
  { code: 'TRV', name: 'Travel & Transportation',   description: 'Business travel, commute, fuel' },
  { code: 'MNE', name: 'Meals & Entertainment',     description: 'Team meals, client entertainment' },
  { code: 'TND', name: 'Training & Development',    description: 'Courses, certifications, workshops' },
  { code: 'RNT', name: 'Rent & Facilities',         description: 'Office rent, maintenance, repairs' },
  { code: 'MSC', name: 'Miscellaneous',             description: 'Other uncategorized expenses' },
];

async function main() {
  console.log(`Upserting ${CATEGORIES.length} expense categories…`);
  for (const c of CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, isActive: true },
      create: { code: c.code, name: c.name, description: c.description },
    });
    console.log(`  ✓ ${c.code.padEnd(4)} ${c.name}`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

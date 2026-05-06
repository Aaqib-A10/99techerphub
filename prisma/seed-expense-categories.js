/**
 * Plain-JS expense-category seed (no ts-node required).
 *
 * Mirrors the 15 ledger Account Heads (seed-ledger.js) so when an
 * expense is approved the auto-post finds a matching ledger category
 * by name with no manual remapping. Idempotent.
 *
 * Migration safety: the previous seed used different names (Hardware
 * Procurement, Office Supplies, etc.). To avoid `Unique constraint
 * failed on (name)` when re-seeding over an old DB, this script
 * attempts to find an existing row by EITHER code OR name and updates
 * it in-place; only creates if neither exists. Old codes (HW/SW/etc.)
 * naturally drift to the new codes (ADV/COMPUTER/etc.) without
 * breaking foreign keys on Expense.categoryId.
 *
 * Run with:
 *   node prisma/seed-expense-categories.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = [
  { code: 'ADV',       name: 'Advertising and Promotion',                 description: 'Marketing, ads, branding' },
  { code: 'BANK_FEE',  name: 'Bank Service Charges',                       description: 'Bank fees, transaction charges' },
  { code: 'CLEAN',     name: 'Cleaning and Janitorial Exp.',               description: 'AC repair, maintenance, janitorial' },
  { code: 'COMPUTER',  name: 'Computer and Accessories',                   description: 'Laptops, peripherals, batteries' },
  { code: 'DEPREC',    name: 'Depreciation Expense',                       description: 'Asset depreciation' },
  { code: 'DONATION',  name: 'Donation & Charity',                         description: 'Donations, gifts, charity' },
  { code: 'OPEX_SAL',  name: 'Operational Salary/Rent',                    description: 'Operational salary or rent disbursements' },
  { code: 'UTILITY',   name: 'Utilities (Electric/Internet/Phone)',        description: 'Electricity, internet, phone' },
  { code: 'TRAVEL',    name: 'Travel and Conveyance',                      description: 'Business travel, fuel, conveyance' },
  { code: 'OFFICE',    name: 'Office Supplies',                            description: 'Stationery, printer supplies' },
  { code: 'LEGAL',     name: 'Legal and Professional Fees',                description: 'Legal counsel, professional services' },
  { code: 'INSURANCE', name: 'Insurance',                                  description: 'Insurance premiums' },
  { code: 'REFUND',    name: 'Refunds and Reversals',                      description: 'Refunded amounts and reversals' },
  { code: 'CASH_INJ',  name: 'Cash Injection / Capital In',                description: 'Owner / investor capital injection' },
  { code: 'REVENUE',   name: 'Sales / Revenue',                            description: 'Operating revenue' },
];

async function main() {
  console.log(`Upserting ${CATEGORIES.length} expense categories…`);
  for (const c of CATEGORIES) {
    // Find by code OR name — covers both fresh DBs and DBs seeded with
    // the older HW/SW/etc. set whose names overlap with the new list.
    const existing = await prisma.expenseCategory.findFirst({
      where: { OR: [{ code: c.code }, { name: c.name }] },
    });
    if (existing) {
      await prisma.expenseCategory.update({
        where: { id: existing.id },
        data: {
          code: c.code,
          name: c.name,
          description: c.description,
          isActive: true,
        },
      });
    } else {
      await prisma.expenseCategory.create({
        data: { code: c.code, name: c.name, description: c.description },
      });
    }
    console.log(`  ✓ ${c.code.padEnd(10)} ${c.name}`);
  }

  // Soft-deactivate any expense categories that aren't in the new list.
  // Old rows (HW / SW / MKT / etc. from the previous seed) stay in the
  // table because Expense.categoryId may reference them, but they
  // disappear from /expenses/new because the dropdown filters by
  // isActive=true.
  const keepCodes = CATEGORIES.map((c) => c.code);
  const deactivated = await prisma.expenseCategory.updateMany({
    where: {
      isActive: true,
      code: { notIn: keepCodes },
    },
    data: { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(
      `Deactivated ${deactivated.count} legacy categor${deactivated.count === 1 ? 'y' : 'ies'} not in the new list.`,
    );
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

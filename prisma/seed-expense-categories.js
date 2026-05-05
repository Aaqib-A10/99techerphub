/**
 * Plain-JS expense-category seed (no ts-node required).
 *
 * Mirrors the 15 standardised Account Heads from seed-ledger.js so the
 * expense form and the Master Ledger speak the same vocabulary. When
 * an approved expense auto-posts to the ledger, the category names line
 * up exactly — no "Travel & Transportation" vs "Travel and Conveyance"
 * mismatch. Same `code` values too so future migrations can join the
 * two tables on code if we ever unify the schemas.
 *
 * Run with:
 *   node prisma/seed-expense-categories.js
 *
 * Idempotent — upserts by code.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATEGORIES = [
  { code: 'ADV',       name: 'Advertising and Promotion',          description: 'Ad spend, sponsorships, branded content.' },
  { code: 'BANK_FEE',  name: 'Bank Service Charges',               description: 'Bank fees, wire fees, processing charges.' },
  { code: 'CLEAN',     name: 'Cleaning and Janitorial Exp.',       description: 'Office cleaning, AC repair, maintenance.' },
  { code: 'COMPUTER',  name: 'Computer and Accessories',           description: 'Laptops, peripherals, batteries, parts.' },
  { code: 'DEPREC',    name: 'Depreciation Expense',               description: 'Asset depreciation entries.' },
  { code: 'DONATION',  name: 'Donation & Charity',                 description: 'CSR contributions, school gifts, charity.' },
  { code: 'OPEX_SAL',  name: 'Operational Salary/Rent',            description: 'Operational salaries, office rent.' },
  { code: 'UTILITY',   name: 'Utilities (Electric/Internet/Phone)', description: 'Electricity, internet, phone bills.' },
  { code: 'TRAVEL',    name: 'Travel and Conveyance',              description: 'Business travel, fuel, taxi, hotels.' },
  { code: 'OFFICE',    name: 'Office Supplies',                    description: 'Stationery, printing, pantry, tissue paper.' },
  { code: 'LEGAL',     name: 'Legal and Professional Fees',        description: 'Lawyers, consultants, audit, professional services.' },
  { code: 'INSURANCE', name: 'Insurance',                          description: 'Health, asset, vehicle, liability insurance.' },
  { code: 'REFUND',    name: 'Refunds and Reversals',              description: 'Money refunded to or returned by the company.' },
  // Income heads — kept for parity with the ledger so a one-off
  // capital-injection or sales receipt can still be filed via the
  // expense form if needed. Rare, but matches the ledger 1:1.
  { code: 'CASH_INJ',  name: 'Cash Injection / Capital In',        description: 'Owner injection, loan proceeds, capital in.' },
  { code: 'REVENUE',   name: 'Sales / Revenue',                    description: 'Sales receipts, customer payments.' },
];

async function main() {
  console.log(`Upserting ${CATEGORIES.length} expense categories…`);
  for (const c of CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, isActive: true },
      create: { code: c.code, name: c.name, description: c.description },
    });
    console.log(`  ✓ ${c.code.padEnd(10)} ${c.name}`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

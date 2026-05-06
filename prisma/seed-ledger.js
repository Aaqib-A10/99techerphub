/**
 * Seed the Finance Ledger:
 *   - Standard Account Heads (governance list from spec)
 *   - Opening Balance entry of PKR 103,057
 *
 * Run with:
 *   node prisma/seed-ledger.js
 *
 * Idempotent — categories upserted by code, opening balance only inserted
 * if no LedgerEntry with source=OPENING exists yet.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Governance list from the spec, plus a few extras the legacy spreadsheet
// referenced. `code` is the short identifier used internally; `name` is
// what the user sees in the dropdown.
const CATEGORIES = [
  { code: 'ADV', name: 'Advertising and Promotion', type: 'expense' },
  { code: 'BANK_FEE', name: 'Bank Service Charges', type: 'expense' },
  { code: 'CLEAN', name: 'Cleaning and Janitorial Exp.', type: 'expense' },
  { code: 'COMPUTER', name: 'Computer and Accessories', type: 'expense' },
  { code: 'DEPREC', name: 'Depreciation Expense', type: 'expense' },
  { code: 'DONATION', name: 'Donation & Charity', type: 'expense' },
  { code: 'OPEX_SAL', name: 'Operational Salary/Rent', type: 'expense' },
  // Common additions the legacy data implied
  { code: 'UTILITY', name: 'Utilities (Electric/Internet/Phone)', type: 'expense' },
  { code: 'TRAVEL', name: 'Travel and Conveyance', type: 'expense' },
  { code: 'OFFICE', name: 'Office Supplies', type: 'expense' },
  { code: 'LEGAL', name: 'Legal and Professional Fees', type: 'expense' },
  { code: 'INSURANCE', name: 'Insurance', type: 'expense' },
  { code: 'CASH_INJ', name: 'Cash Injection / Capital In', type: 'income' },
  { code: 'REVENUE', name: 'Sales / Revenue', type: 'income' },
  { code: 'REFUND', name: 'Refunds and Reversals', type: 'either' },
  // OTHER is intentionally the LAST seeded category. The picker pins
  // it at the bottom regardless of sort order, but a high sortOrder
  // also lets the inline "+ Create category" affordance slot new
  // user-created categories above it (sortOrder = lastSeed + n).
  { code: 'OTHER', name: 'Other', type: 'either' },
];

const OPENING_BALANCE_PKR = 103057;

async function main() {
  console.log(`Upserting ${CATEGORIES.length} ledger categories…`);
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    // OTHER pinned at sortOrder=999 so user-created categories from the
    // inline "+ Create" affordance slot between the last seeded entry
    // and OTHER (auto-assigned to lastSeed+1, lastSeed+2, …).
    const sortOrder = c.code === 'OTHER' ? 999 : i;
    await prisma.ledgerCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, type: c.type, sortOrder },
      create: {
        code: c.code,
        name: c.name,
        type: c.type,
        sortOrder,
      },
    });
    console.log(`  ✓ ${c.code.padEnd(12)} ${c.name}`);
  }

  // Opening balance — one-time. Only inserts if no OPENING entry exists.
  const existingOpening = await prisma.ledgerEntry.findFirst({
    where: { source: 'OPENING' },
  });
  if (existingOpening) {
    console.log(
      `Opening balance already posted (SN ${existingOpening.serialNo}, balance ${existingOpening.runningBal}). Skipping.`,
    );
  } else {
    // Need a posting user. Default to the first ADMIN.
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { id: 'asc' },
    });
    if (!admin) {
      console.error(
        'No active ADMIN user found — cannot post opening balance. Skipping.',
      );
    } else {
      const cashInjCat = await prisma.ledgerCategory.findUnique({
        where: { code: 'CASH_INJ' },
      });
      if (!cashInjCat) {
        console.error('CASH_INJ category not found — skipping opening balance.');
      } else {
        const serialNo = await nextSerial();
        const created = await prisma.ledgerEntry.create({
          data: {
            serialNo,
            transDate: new Date('2026-04-01T00:00:00Z'),
            transDetail: 'Opening balance — April 2026 (verified from legacy ledger)',
            categoryId: cashInjCat.id,
            quantity: 0,
            unitPrice: 0,
            creditAmt: OPENING_BALANCE_PKR,
            debitAmt: 0,
            runningBal: OPENING_BALANCE_PKR,
            currency: 'PKR',
            source: 'OPENING',
            createdById: admin.id,
          },
        });
        console.log(
          `Opening balance posted: ${created.serialNo} = PKR ${OPENING_BALANCE_PKR.toLocaleString()}`,
        );
      }
    }
  }

  console.log('Done.');
}

// Mirrors the production serial generator: SN-NNNNNN, six-digit pad,
// derived from the highest existing serial + 1. Good enough for a
// one-off seed; the API uses an advisory lock for concurrency.
async function nextSerial() {
  const last = await prisma.ledgerEntry.findFirst({
    orderBy: { id: 'desc' },
    select: { serialNo: true },
  });
  if (!last) return 'SN-000001';
  const m = last.serialNo.match(/^SN-(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `SN-${String(n).padStart(6, '0')}`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

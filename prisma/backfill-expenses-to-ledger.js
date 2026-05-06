/**
 * Backfill ledger entries for any APPROVED Expense that doesn't already
 * have one paired by source/sourceId.
 *
 * Why this script exists: the auto-post-from-approval path on
 * /api/expenses/[id]/approve is wrapped in a try/catch and silently
 * no-ops if the ledger schema isn't present. Every expense approved
 * BEFORE the ledger went live is therefore invisible to the Master
 * Ledger. This script catches them up.
 *
 * Idempotent — only inserts a ledger row when (source=EXPENSE,
 * sourceId=expense.id) doesn't already exist.
 *
 * Run with:
 *   node prisma/backfill-expenses-to-ledger.js
 *
 * Dry-run (preview without writing):
 *   node prisma/backfill-expenses-to-ledger.js --dry-run
 */
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const SERIAL_LOCK_KEY = 99_000_001;

async function main() {
  try {
    await prisma.ledgerCategory.count();
  } catch (e) {
    console.error(
      'Ledger schema not deployed yet. Run `npx prisma db push --accept-data-loss && node prisma/seed-ledger.js` first.',
    );
    process.exit(1);
  }

  const approved = await prisma.expense.findMany({
    where: { status: 'APPROVED' },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { expenseDate: 'asc' },
  });
  console.log(`Found ${approved.length} APPROVED expenses.`);

  const alreadyPosted = await prisma.ledgerEntry.findMany({
    where: { source: 'EXPENSE' },
    select: { sourceId: true },
  });
  const postedIds = new Set(
    alreadyPosted.map((r) => r.sourceId).filter((id) => id !== null),
  );

  const todo = approved.filter((e) => !postedIds.has(e.id));
  console.log(`${todo.length} need backfill (the rest already paired).`);
  if (todo.length === 0) return;

  let posted = 0;
  let skipped = 0;
  for (const e of todo) {
    try {
      const cat =
        (await prisma.ledgerCategory.findFirst({
          where: { name: { equals: e.category?.name, mode: 'insensitive' } },
        })) ??
        (await prisma.ledgerCategory.findFirst({ where: { code: 'OFFICE' } })) ??
        (await prisma.ledgerCategory.findFirst({ where: { isActive: true } }));
      if (!cat) {
        console.warn(`  · skip ${e.expenseNumber} — no ledger category found`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  · would post ${e.expenseNumber} (PKR ${Number(e.amount).toLocaleString()}) — ${cat.name}`,
        );
        posted++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(${SERIAL_LOCK_KEY})`,
        );

        // Compute prev balance for this transDate
        const prev = await tx.ledgerEntry.findFirst({
          where: {
            OR: [
              { transDate: { lt: e.expenseDate } },
              { transDate: e.expenseDate, id: { lt: 999_999_999 } },
            ],
          },
          orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
          select: { runningBal: true },
        });
        const prevBal = prev ? Number(prev.runningBal) : 0;
        const debit = Number(e.amount);
        const newBal = prevBal - debit;

        const last = await tx.ledgerEntry.findFirst({
          orderBy: { id: 'desc' },
          select: { serialNo: true },
        });
        const n = last
          ? parseInt(last.serialNo.replace(/^SN-/, ''), 10) + 1
          : 1;
        const serialNo = `SN-${String(n).padStart(6, '0')}`;

        const created = await tx.ledgerEntry.create({
          data: {
            serialNo,
            transDate: e.expenseDate,
            transDetail: `Expense ${e.expenseNumber} — ${
              e.description ?? e.vendor ?? 'no description'
            } (backfilled)`,
            categoryId: cat.id,
            quantity: '0',
            unitPrice: '0',
            creditAmt: '0',
            debitAmt: debit.toFixed(2),
            runningBal: newBal.toFixed(2),
            currency: 'PKR',
            companyId: e.companyId,
            source: 'EXPENSE',
            sourceId: e.id,
            attachmentUrl: e.receiptUrl ?? null,
            attachmentMeta: Prisma.JsonNull,
            createdById: await pickPosterUserId(tx, e),
          },
        });

        // Walk forward and refresh runningBal on later rows
        const downstream = await tx.ledgerEntry.findMany({
          where: {
            OR: [
              { transDate: { gt: e.expenseDate } },
              { transDate: e.expenseDate, id: { gt: created.id } },
            ],
          },
          orderBy: [{ transDate: 'asc' }, { id: 'asc' }],
          select: { id: true, creditAmt: true, debitAmt: true },
        });
        let bal = newBal;
        for (const r of downstream) {
          bal = bal + Number(r.creditAmt) - Number(r.debitAmt);
          await tx.ledgerEntry.update({
            where: { id: r.id },
            data: { runningBal: bal.toFixed(2) },
          });
        }
      });

      console.log(`  ✓ ${e.expenseNumber} posted`);
      posted++;
    } catch (err) {
      console.error(`  · error on ${e.expenseNumber}:`, err.message);
      skipped++;
    }
  }

  console.log(
    `Done. ${posted} posted, ${skipped} skipped.${DRY_RUN ? ' (dry-run)' : ''}`,
  );
}

async function pickPosterUserId(tx, expense) {
  const approval = await tx.expenseApproval.findFirst({
    where: { expenseId: expense.id, action: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    select: { approvedById: true },
  });
  if (approval?.approvedById) return approval.approvedById;
  const submitter = await tx.user.findFirst({
    where: { employeeId: expense.submittedById },
    select: { id: true },
  });
  if (submitter) return submitter.id;
  const admin = await tx.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  if (admin) return admin.id;
  const any = await tx.user.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!any) throw new Error('No active user to attribute backfill to.');
  return any.id;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

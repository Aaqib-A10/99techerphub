/**
 * One-shot backfill: for every active employee who doesn't yet have
 * a SalaryHistory row, derive their starting BASE salary from their
 * accepted OfferLetter (the salary the company committed to at hire).
 *
 * Idempotent: skips employees who already have any SalaryHistory.
 * Skips employees with no accepted OfferLetter — they need to be
 * entered manually by HR (or imported via CSV later).
 *
 * Usage:
 *   node prisma/backfill-salary-from-offer-letters.js
 *   DRY_RUN=1 node prisma/backfill-salary-from-offer-letters.js
 */

const { PrismaClient } = require('@prisma/client');

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const prisma = new PrismaClient();
  console.log(`Backfill starting (DRY_RUN=${DRY_RUN})`);

  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        empCode: true,
        dateOfJoining: true,
      },
    });

    let backfilled = 0;
    let alreadyHave = 0;
    let noOffer = 0;

    for (const emp of employees) {
      const existing = await prisma.salaryHistory.count({
        where: { employeeId: emp.id },
      });
      if (existing > 0) {
        alreadyHave++;
        continue;
      }

      // Pick the most-recently-accepted offer with a non-null salary.
      // If they got multiple offers (rare — promotion via offer letter),
      // the latest accepted one is the most relevant starting point.
      const offer = await prisma.offerLetter.findFirst({
        where: {
          employeeId: emp.id,
          status: 'ACCEPTED',
          salary: { not: undefined },
        },
        orderBy: { acceptedDate: 'desc' },
      });

      if (!offer || !offer.salary) {
        noOffer++;
        continue;
      }

      const effectiveFrom =
        offer.acceptedDate ?? emp.dateOfJoining ?? offer.offerDate ?? new Date();

      if (DRY_RUN) {
        console.log(
          `[dry-run] ${emp.empCode} ${emp.firstName} ${emp.lastName} → ${offer.currency} ${Number(offer.salary).toLocaleString()} from ${effectiveFrom.toISOString().slice(0, 10)}`,
        );
        backfilled++;
        continue;
      }

      await prisma.salaryHistory.create({
        data: {
          employeeId: emp.id,
          baseSalary: offer.salary,
          currency: offer.currency || 'PKR',
          effectiveFrom,
          reason: 'Hired (backfill from offer letter)',
        },
      });
      backfilled++;
    }

    console.log('\nSummary:');
    console.log(`  ${DRY_RUN ? 'Would backfill' : 'Backfilled'}: ${backfilled}`);
    console.log(`  Already had SalaryHistory: ${alreadyHave}`);
    console.log(`  Skipped (no accepted offer letter): ${noOffer}`);
    console.log(
      `  Note: skipped employees need manual entry via the Compensation page.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

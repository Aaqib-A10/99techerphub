/**
 * Backfill OrgAssignment rows from existing Employee.reportingManagerId.
 *
 * One-off migration after introducing the OrgAssignment table. For every active
 * employee that has a reporting manager, creates one open SOLID-line assignment:
 *   validFrom = dateOfJoining (or createdAt if missing)
 *   validTo   = NULL  (currently open)
 *   relationshipType = SOLID
 *
 * Safe to re-run: if an open SOLID row already exists for an (employeeId), the
 * existing row is left alone. New rows are only inserted for employees that
 * have a reportingManagerId but no open SOLID assignment yet.
 *
 * Usage:
 *   npx tsx scripts/backfill-org-assignments.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== OrgAssignment Backfill ===\n');

  // 1. Pull every employee with a reporting manager.
  const employees = await prisma.employee.findMany({
    where: { reportingManagerId: { not: null } },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      reportingManagerId: true,
      dateOfJoining: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log(`[1/3] Found ${employees.length} employees with a reportingManagerId`);

  // 2. Pre-load existing open SOLID rows so we don't create duplicates.
  const existing = await prisma.orgAssignment.findMany({
    where: { relationshipType: 'SOLID', validTo: null },
    select: { employeeId: true, managerId: true },
  });
  const alreadyOpenFor = new Map(existing.map((r) => [r.employeeId, r.managerId]));
  console.log(`[2/3] ${alreadyOpenFor.size} employees already have an open SOLID assignment`);

  // 3. Insert one row per employee that doesn't already have an open SOLID.
  let inserted = 0;
  let skipped = 0;
  let mismatched = 0;

  for (const emp of employees) {
    const openManagerId = alreadyOpenFor.get(emp.id);
    if (openManagerId !== undefined) {
      // Sanity check: the open row should match the cache. If it doesn't, log it
      // — that's a divergence the user should know about, but don't auto-correct.
      if (openManagerId !== emp.reportingManagerId) {
        mismatched++;
        console.warn(
          `  ⚠ ${emp.empCode} ${emp.firstName} ${emp.lastName}: ` +
            `open SOLID points to ${openManagerId}, but reportingManagerId = ${emp.reportingManagerId}`
        );
      }
      skipped++;
      continue;
    }

    const validFrom = emp.dateOfJoining ?? emp.createdAt;
    await prisma.orgAssignment.create({
      data: {
        employeeId: emp.id,
        managerId: emp.reportingManagerId!,
        relationshipType: 'SOLID',
        validFrom,
        validTo: null,
        reason: 'backfill from reportingManagerId',
      },
    });
    inserted++;
  }

  console.log(
    `\n[3/3] Done — inserted: ${inserted}, skipped (already had open row): ${skipped}` +
      (mismatched > 0 ? `, mismatched: ${mismatched}` : '')
  );
  if (mismatched > 0) {
    console.log(
      `\n⚠ Divergences exist between open SOLID assignments and Employee.reportingManagerId.\n` +
        `   This means someone updated the cache without going through orgTreeService.\n` +
        `   Resolve manually before relying on the assignment table as source of truth.`
    );
  }
  console.log('\n✅ Backfill complete\n');
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * One-off re-org executed 2026-04-30:
 *  - Lead Gen team (SAL-116/117/118/119) moves under Aqib (ITAD-382)
 *  - RTI-171 (Tayyab Raza) moves under Umer Tariq (LRI-174)
 *  - Create "Sales Manager (Open)" placeholder reporting to Hammad
 *  - Remaining sales reps (SAL-101/104/108/112/214) move under the placeholder
 *
 * After updating Employee.reportingManagerId, this script wipes the
 * OrgAssignment table and re-builds it from current state. Acceptable for
 * Phase 1 since no consumers depend on assignment history yet; future
 * re-orgs should go through orgTreeService.assignManager() to preserve it.
 *
 * Run:
 *   npx tsx scripts/reorg-sales-2026-04-30.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Sales Re-org (2026-04-30) ===\n');

  const salDept = await prisma.department.findUnique({ where: { code: 'SAL' } });
  if (!salDept) throw new Error('SAL department not found');

  const aqib = await prisma.employee.findUnique({ where: { empCode: 'ITAD-382' } });
  const umer = await prisma.employee.findUnique({ where: { empCode: 'LRI-174' } });
  const hammad = await prisma.employee.findUnique({ where: { empCode: 'EXEC-003' } });
  if (!aqib || !umer || !hammad) throw new Error('Required manager(s) missing');

  // 1. Sales Manager placeholder
  console.log('[1/4] Ensuring Sales Manager (Open) placeholder...');
  const salesMgr = await prisma.employee.upsert({
    where: { empCode: 'SAL-MGR' },
    update: { designation: 'Sales Manager', reportingManagerId: hammad.id, isActive: true },
    create: {
      empCode: 'SAL-MGR',
      firstName: 'Sales Manager',
      lastName: '(Open)',
      designation: 'Sales Manager',
      departmentId: salDept.id,
      employmentStatus: 'PERMANENT',
      dateOfJoining: new Date(),
      isActive: true,
      lifecycleStage: 'ACTIVE',
      reportingManagerId: hammad.id,
    },
  });
  console.log(`  ✓ ${salesMgr.empCode}  Sales Manager (Open) → Hammad`);

  // 2. Lead Gen → Aqib
  console.log('\n[2/4] Moving Lead Gen team to Aqib (ITAD-382)...');
  for (const code of ['SAL-116', 'SAL-117', 'SAL-118', 'SAL-119']) {
    const r = await prisma.employee.updateMany({
      where: { empCode: code },
      data: { reportingManagerId: aqib.id },
    });
    console.log(`  ${r.count > 0 ? '✓' : '⚠'} ${code} → Aqib (${r.count} updated)`);
  }

  // 3. RTI-171 → Umer Tariq
  console.log('\n[3/4] Moving RTI-171 to Umer Tariq (LRI-174)...');
  const rtiResult = await prisma.employee.updateMany({
    where: { empCode: 'RTI-171' },
    data: { reportingManagerId: umer.id },
  });
  console.log(`  ${rtiResult.count > 0 ? '✓' : '⚠'} RTI-171 → Umer Tariq (${rtiResult.count} updated)`);

  // 4. Remaining sales reps → Sales Manager (Open)
  console.log('\n[4/4] Moving remaining sales reps to Sales Manager (Open)...');
  for (const code of ['SAL-101', 'SAL-104', 'SAL-108', 'SAL-112', 'SAL-214']) {
    const r = await prisma.employee.updateMany({
      where: { empCode: code },
      data: { reportingManagerId: salesMgr.id },
    });
    console.log(`  ${r.count > 0 ? '✓' : '⚠'} ${code} → Sales Manager (${r.count} updated)`);
  }

  // 5. Refresh OrgAssignment table
  console.log('\nRefreshing org_assignments table...');
  const deleted = await prisma.orgAssignment.deleteMany({});
  console.log(`  Deleted ${deleted.count} prior rows`);

  const employees = await prisma.employee.findMany({
    where: { reportingManagerId: { not: null } },
    select: { id: true, reportingManagerId: true, dateOfJoining: true, createdAt: true },
  });
  for (const e of employees) {
    await prisma.orgAssignment.create({
      data: {
        employeeId: e.id,
        managerId: e.reportingManagerId!,
        relationshipType: 'SOLID',
        validFrom: e.dateOfJoining ?? e.createdAt,
        validTo: null,
        reason: 'reorg-sales-2026-04-30',
      },
    });
  }
  console.log(`  Inserted ${employees.length} fresh rows`);

  console.log('\n✅ Sales re-org complete\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * One-off: seed the 99 Tech leadership tier so the org tree has anchors.
 *
 * What this does (idempotent — safe to re-run):
 *   1. Ensures the EXEC department exists.
 *   2. Creates 5 leadership Employee records that don't currently exist:
 *        EXEC-001  Ijaz Haider          (Chairman)
 *        EXEC-002  Azhar Zeeshan        (CEO)
 *        EXEC-003  Mohammad Hammad      (COO)
 *        ITAD-382  Aqib Ali Shehzad     (ITAD Manager)
 *        EP-373    Nasir Khan           (Head of Eternal Perfumes)
 *      All set to PERMANENT, dateOfJoining = today (placeholder — fix in UI),
 *      workEmail = NULL (manual entry).
 *   3. Updates designations on 4 existing employees to match the org chart:
 *        LRI-174   "OPERATIONS MANAGER"        → "Manager RTI/LRI"
 *        CSR-129   "Customer support Team Lead" → "Head of CSR"
 *        CSR-132   "N/A"                       → "Director of E-commerce"
 *        197       "Admin & HR"                → "Admin and Accounts"
 *   4. Wires the leadership reporting chain:
 *        Ijaz <- Azhar <- Hammad <- (CTO Saffi, Yaseen, Waleed Tariq,
 *                                    Umer Tariq, Ebad, Aqib, Nasir)
 *
 * Run:
 *   npx tsx scripts/seed-leadership.ts
 *
 * Then re-run scripts/backfill-org-assignments.ts to materialize the
 * OrgAssignment rows for the leadership chain.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Seeding 99 Tech Leadership ===\n');

  // ---- 1. EXEC department ----
  console.log('[1/4] Ensuring EXEC department...');
  const execDept = await prisma.department.upsert({
    where: { code: 'EXEC' },
    update: { name: 'Executive', isActive: true },
    create: { code: 'EXEC', name: 'Executive', isActive: true },
  });
  console.log(`  ✓ EXEC dept (id=${execDept.id})`);

  const itadDept = await prisma.department.findUnique({ where: { code: 'ITAD' } });
  const epDept = await prisma.department.findUnique({ where: { code: 'EP' } });
  if (!itadDept) throw new Error('ITAD department not found — run prisma/normalize-departments.ts first');
  if (!epDept) throw new Error('EP department not found — run prisma/normalize-departments.ts first');

  // ---- 2. New leadership records ----
  console.log('\n[2/4] Creating new leadership records...');
  const today = new Date();

  const newRecords = [
    { empCode: 'EXEC-001', firstName: 'Ijaz',     lastName: 'Haider',       designation: 'Chairman',                  departmentId: execDept.id },
    { empCode: 'EXEC-002', firstName: 'Azhar',    lastName: 'Zeeshan',      designation: 'CEO',                       departmentId: execDept.id },
    { empCode: 'EXEC-003', firstName: 'Mohammad', lastName: 'Hammad',       designation: 'COO',                       departmentId: execDept.id },
    { empCode: 'ITAD-382', firstName: 'Aqib',     lastName: 'Ali Shehzad',  designation: 'ITAD Manager',              departmentId: itadDept.id },
    { empCode: 'EP-373',   firstName: 'Nasir',    lastName: 'Khan',         designation: 'Head of Eternal Perfumes',  departmentId: epDept.id },
  ];

  for (const r of newRecords) {
    await prisma.employee.upsert({
      where: { empCode: r.empCode },
      update: {
        firstName: r.firstName,
        lastName: r.lastName,
        designation: r.designation,
        departmentId: r.departmentId,
      },
      create: {
        empCode: r.empCode,
        firstName: r.firstName,
        lastName: r.lastName,
        designation: r.designation,
        departmentId: r.departmentId,
        employmentStatus: 'PERMANENT',
        dateOfJoining: today,
        isActive: true,
        lifecycleStage: 'ACTIVE',
      },
    });
    console.log(`  ✓ ${r.empCode.padEnd(10)} ${r.firstName} ${r.lastName} — ${r.designation}`);
  }

  // ---- 3. Update existing leadership designations ----
  console.log('\n[3/4] Updating existing leadership designations...');
  const updates = [
    { empCode: 'LRI-174', designation: 'Manager RTI/LRI' },
    { empCode: 'CSR-129', designation: 'Head of CSR' },
    { empCode: 'CSR-132', designation: 'Director of E-commerce' },
    { empCode: '197',     designation: 'Admin and Accounts' },
  ];
  for (const u of updates) {
    const result = await prisma.employee.updateMany({
      where: { empCode: u.empCode },
      data: { designation: u.designation },
    });
    if (result.count === 0) {
      console.warn(`  ⚠ ${u.empCode}: not found`);
    } else {
      console.log(`  ✓ ${u.empCode.padEnd(10)} → "${u.designation}"`);
    }
  }

  // ---- 4. Wire the leadership reporting chain ----
  console.log('\n[4/4] Wiring leadership reporting chain...');
  const ijaz = await prisma.employee.findUnique({ where: { empCode: 'EXEC-001' } });
  const azhar = await prisma.employee.findUnique({ where: { empCode: 'EXEC-002' } });
  const hammad = await prisma.employee.findUnique({ where: { empCode: 'EXEC-003' } });
  if (!ijaz || !azhar || !hammad) throw new Error('Failed to resolve newly-created leadership records');

  const chain: { empCode: string; mgrId: number | null; label: string }[] = [
    { empCode: 'EXEC-001', mgrId: null,      label: 'Ijaz (Chairman)            → (root)' },
    { empCode: 'EXEC-002', mgrId: ijaz.id,   label: 'Azhar (CEO)                → Ijaz' },
    { empCode: 'EXEC-003', mgrId: azhar.id,  label: 'Hammad (COO)               → Azhar' },
    { empCode: 'DEV-217',  mgrId: hammad.id, label: 'Saffi ud Din (CTO)         → Hammad' },
    { empCode: 'CSR-132',  mgrId: hammad.id, label: 'Yaseen (Dir E-com)         → Hammad' },
    { empCode: 'CSR-129',  mgrId: hammad.id, label: 'Waleed Tariq (Head CSR)    → Hammad' },
    { empCode: 'LRI-174',  mgrId: hammad.id, label: 'Umer Tariq (Mgr RTI/LRI)   → Hammad' },
    { empCode: '197',      mgrId: hammad.id, label: 'Ebad (Admin & Accounts)    → Hammad' },
    { empCode: 'ITAD-382', mgrId: hammad.id, label: 'Aqib (ITAD Manager)        → Hammad' },
    { empCode: 'EP-373',   mgrId: hammad.id, label: 'Nasir (Head of EP)         → Hammad' },
  ];

  for (const c of chain) {
    const result = await prisma.employee.updateMany({
      where: { empCode: c.empCode },
      data: { reportingManagerId: c.mgrId },
    });
    if (result.count === 0) {
      console.warn(`  ⚠ ${c.empCode}: not found, skipped`);
    } else {
      console.log(`  ✓ ${c.label}`);
    }
  }

  console.log('\n✅ Leadership seeded\n');
  console.log('Next steps:');
  console.log('  1. Verify: npx tsx scripts/export-org-structure.ts');
  console.log('     (open org-structure.csv — leadership rows should show currentManager filled in)');
  console.log('  2. Re-run org-assignment backfill: npx tsx scripts/backfill-org-assignments.ts');
  console.log('     (should now insert ~10 OrgAssignment rows for the leadership chain)');
  console.log('  3. Continue filling in IC managers via CSV → import-org-structure.ts');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

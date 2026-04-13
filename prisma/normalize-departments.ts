/**
 * Normalize employee departments using their empCode prefix.
 *
 * Why: The original import carried 60+ messy department strings from the
 * Excel sheet ("Dev", "Dev Department", "99 Tech Admin", "SJ Customer Support"...).
 * The canonical HR taxonomy is actually encoded in the empCode prefix
 * (DEV-139, SAL-101, CSR-125, EP-128, LRI-173, DR-364, UT-168, etc.).
 *
 * What this script does:
 *   1. Upserts a clean set of canonical departments keyed by prefix code.
 *   2. Walks every Employee, parses the empCode prefix, and reassigns
 *      `departmentId` to the matching canonical dept.
 *   3. Prunes orphaned legacy departments that no longer have employees
 *      (and aren't referenced by expenses / expense categories).
 *
 * Safe to re-run: upserts + id lookups are idempotent.
 *
 * Usage:
 *   npx tsx prisma/normalize-departments.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- Canonical department taxonomy ---------------------------------------
// code = short canonical key, name = display name shown in UI
const CANONICAL_DEPTS: { code: string; name: string }[] = [
  { code: 'DEV', name: 'Development' },
  { code: 'SAL', name: 'Sales' },
  { code: 'CSR', name: 'Customer Support' },
  { code: 'EP', name: 'EP' },
  { code: 'DM', name: 'Digital Marketing' },
  { code: 'LRI', name: 'LRI' },
  { code: 'RTI', name: 'RTI' },
  { code: 'ITAD', name: 'ITAD' },
  { code: 'UT', name: 'UT' },
  { code: 'MB', name: 'MB' },
  { code: 'DR', name: 'DR' },
  { code: 'PCM', name: 'PCMart' },
  { code: 'SS', name: 'SS' },
  { code: 'ACC', name: 'Accounts' },
  { code: 'EP-UK', name: 'EP (UK)' },
  { code: 'BSA', name: 'BSA' },
  { code: 'ADMIN', name: 'Admin' },
  { code: 'HR', name: 'Human Resources' },
  { code: 'BO', name: 'Back Office' },
  { code: 'UNASSIGNED', name: 'Unassigned' },
];

// Prefix parser ------------------------------------------------------------
// Captures leading alpha or alpha-alpha blocks before the first digit or dash-digit.
// Examples: DEV-139 → DEV, EP-UK-291 → EP-UK, SAL-101 → SAL
function parsePrefix(empCode: string): string | null {
  const s = (empCode || '').trim().toUpperCase();
  if (!s) return null;
  // Try "LET-LET-###" first (e.g. EP-UK-291)
  let m = s.match(/^([A-Z]+-[A-Z]+)-?\d*/);
  if (m) return m[1];
  // Fall back to plain "LET-###" or "LET"
  m = s.match(/^([A-Z]+)/);
  if (m) return m[1];
  return null;
}

// Map parsed prefix → canonical code
function mapPrefixToCode(prefix: string): string {
  const p = prefix.toUpperCase();
  // Exact matches first
  if (CANONICAL_DEPTS.find((d) => d.code === p)) return p;
  // Common aliases
  const aliases: Record<string, string> = {
    DEV: 'DEV',
    SAL: 'SAL',
    SALES: 'SAL',
    CSR: 'CSR',
    EP: 'EP',
    'EP-UK': 'EP-UK',
    DM: 'DM',
    LRI: 'LRI',
    RTI: 'RTI',
    ITAD: 'ITAD',
    UT: 'UT',
    MB: 'MB',
    DR: 'DR',
    PCM: 'PCM',
    SS: 'SS',
    ACC: 'ACC',
    BSA: 'BSA',
  };
  return aliases[p] || 'UNASSIGNED';
}

// Fallback for employees with numeric / non-prefix empCodes — use their
// current department string as a hint.
function fallbackFromLegacyDeptName(legacyName: string | null | undefined): string {
  const n = (legacyName || '').toLowerCase();
  if (!n) return 'UNASSIGNED';
  if (n.includes('admin')) return 'ADMIN';
  if (n.includes('human') || n.includes('hr')) return 'HR';
  if (n.includes('back office') || n.includes('mnc')) return 'BO';
  if (n.includes('shopify') || n.includes('develop')) return 'DEV';
  if (n.includes('sales')) return 'SAL';
  if (n.includes('customer')) return 'CSR';
  if (n.includes('marketing')) return 'DM';
  if (n.includes('account')) return 'ACC';
  return 'UNASSIGNED';
}

async function main() {
  console.log('\n=== Department Normalization ===\n');

  // --- Step 1: Upsert canonical departments ------------------------------
  console.log('[1/4] Upserting canonical departments...');
  const deptIdByCode: Record<string, number> = {};
  for (const d of CANONICAL_DEPTS) {
    // Upsert by code (the unique column we care about for canonical lookup).
    // If a legacy department happens to share the canonical display name
    // we just reuse its row so the FK relation stays intact.
    const existingByCode = await prisma.department.findUnique({ where: { code: d.code } });
    const existingByName = existingByCode
      ? null
      : await prisma.department.findUnique({ where: { name: d.name } });

    let row;
    if (existingByCode) {
      row = await prisma.department.update({
        where: { id: existingByCode.id },
        data: { name: d.name, isActive: true },
      });
    } else if (existingByName) {
      row = await prisma.department.update({
        where: { id: existingByName.id },
        data: { code: d.code, isActive: true },
      });
    } else {
      row = await prisma.department.create({ data: { code: d.code, name: d.name } });
    }
    deptIdByCode[d.code] = row.id;
    console.log(`  ✓ ${d.code.padEnd(10)} → ${d.name} (id=${row.id})`);
  }

  // --- Step 2: Reassign employees ----------------------------------------
  console.log('\n[2/4] Reassigning employees by empCode prefix...');
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      empCode: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  console.log(`  Found ${employees.length} employees`);

  let reassigned = 0;
  let unchanged = 0;
  const prefixCounts: Record<string, number> = {};

  for (const emp of employees) {
    const prefix = parsePrefix(emp.empCode);
    let targetCode: string;
    if (!prefix || /^\d+$/.test(emp.empCode.trim())) {
      // Numeric-only or unparseable
      targetCode = fallbackFromLegacyDeptName(emp.department?.name);
    } else {
      targetCode = mapPrefixToCode(prefix);
    }
    prefixCounts[targetCode] = (prefixCounts[targetCode] || 0) + 1;

    const targetId = deptIdByCode[targetCode];
    if (!targetId) {
      console.warn(`  ⚠ no canonical dept for code ${targetCode} (${emp.empCode})`);
      continue;
    }

    if (emp.departmentId !== targetId) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { departmentId: targetId },
      });
      reassigned++;
    } else {
      unchanged++;
    }
  }

  console.log(`  ✓ Reassigned: ${reassigned}`);
  console.log(`  ✓ Already correct: ${unchanged}`);
  console.log('\n  Distribution after normalization:');
  Object.entries(prefixCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, n]) => {
      const name = CANONICAL_DEPTS.find((d) => d.code === code)?.name || code;
      console.log(`    ${code.padEnd(10)} ${String(n).padStart(4)}  ${name}`);
    });

  // --- Step 3: Prune orphan departments ----------------------------------
  console.log('\n[3/4] Pruning orphan departments...');
  const canonicalIds = new Set(Object.values(deptIdByCode));
  const allDepts = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true, expenses: true, expenseCategories: true },
      },
    },
  });
  let pruned = 0;
  for (const d of allDepts) {
    if (canonicalIds.has(d.id)) continue;
    const c = d._count;
    if (c.employees === 0 && c.expenses === 0 && c.expenseCategories === 0) {
      await prisma.department.delete({ where: { id: d.id } });
      console.log(`  ✗ Deleted empty legacy dept "${d.name}" (id=${d.id})`);
      pruned++;
    } else {
      // Keep but deactivate so it's hidden from pickers
      if (d.isActive) {
        await prisma.department.update({
          where: { id: d.id },
          data: { isActive: false },
        });
        console.log(
          `  ~ Deactivated "${d.name}" (still referenced: emps=${c.employees} exp=${c.expenses} cat=${c.expenseCategories})`
        );
      }
    }
  }
  console.log(`  ✓ Pruned ${pruned} orphan departments`);

  // --- Step 4: Summary ---------------------------------------------------
  console.log('\n[4/4] Final state:');
  const finalDepts = await prisma.department.findMany({
    where: { isActive: true },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ name: 'asc' }],
  });
  finalDepts.forEach((d) => {
    console.log(`  ${d.code.padEnd(10)} ${d.name.padEnd(24)} ${d._count.employees} employees`);
  });
  console.log(`\n  ${finalDepts.length} active departments, ${employees.length} employees\n`);
  console.log('✅ Normalization complete\n');
}

main()
  .catch((err) => {
    console.error('❌ Normalization failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

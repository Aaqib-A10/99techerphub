/**
 * POST /api/admin/normalize-departments
 *
 * Rebuilds the department taxonomy based on the empCode prefix encoded in
 * every employee record. Replaces the messy Excel-imported department
 * strings ("Dev", "Dev Department", "SJ Customer Support", ...) with the
 * canonical codes the company actually uses internally (DEV, SAL, CSR,
 * EP, LRI, RTI, DR, UT, ITAD, etc.).
 *
 * Idempotent — safe to re-run. See /prisma/normalize-departments.ts for
 * the CLI equivalent with the same logic.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

function parsePrefix(empCode: string): string | null {
  const s = (empCode || '').trim().toUpperCase();
  if (!s) return null;
  let m = s.match(/^([A-Z]+-[A-Z]+)-?\d*/);
  if (m) return m[1];
  m = s.match(/^([A-Z]+)/);
  if (m) return m[1];
  return null;
}

function mapPrefixToCode(prefix: string): string {
  const p = prefix.toUpperCase();
  if (CANONICAL_DEPTS.find((d) => d.code === p)) return p;
  const aliases: Record<string, string> = {
    SALES: 'SAL',
  };
  return aliases[p] || 'UNASSIGNED';
}

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

export async function POST() {
  try {
    const log: string[] = [];
    log.push('=== Department Normalization ===');

    // --- Step 1: Upsert canonical departments ---
    log.push('[1/4] Upserting canonical departments');
    const deptIdByCode: Record<string, number> = {};
    for (const d of CANONICAL_DEPTS) {
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
    }

    // --- Step 2: Reassign employees ---
    log.push('[2/4] Reassigning employees by empCode prefix');
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        empCode: true,
        departmentId: true,
        department: { select: { name: true } },
      },
    });

    let reassigned = 0;
    let unchanged = 0;
    const prefixCounts: Record<string, number> = {};

    for (const emp of employees) {
      const prefix = parsePrefix(emp.empCode);
      let targetCode: string;
      if (!prefix || /^\d+$/.test(emp.empCode.trim())) {
        targetCode = fallbackFromLegacyDeptName(emp.department?.name);
      } else {
        targetCode = mapPrefixToCode(prefix);
      }
      prefixCounts[targetCode] = (prefixCounts[targetCode] || 0) + 1;

      const targetId = deptIdByCode[targetCode];
      if (!targetId) continue;

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
    log.push(`  Reassigned: ${reassigned}, unchanged: ${unchanged}`);

    // --- Step 3: Prune / deactivate orphan departments ---
    log.push('[3/4] Pruning orphan departments');
    const canonicalIds = new Set(Object.values(deptIdByCode));
    const allDepts = await prisma.department.findMany({
      include: {
        _count: {
          select: { employees: true, expenses: true, expenseCategories: true },
        },
      },
    });

    let pruned = 0;
    let deactivated = 0;
    for (const d of allDepts) {
      if (canonicalIds.has(d.id)) continue;
      const c = d._count;
      if (c.employees === 0 && c.expenses === 0 && c.expenseCategories === 0) {
        await prisma.department.delete({ where: { id: d.id } });
        pruned++;
      } else if (d.isActive) {
        await prisma.department.update({
          where: { id: d.id },
          data: { isActive: false },
        });
        deactivated++;
      }
    }
    log.push(`  Pruned ${pruned}, deactivated ${deactivated}`);

    // --- Step 4: Final state ---
    const finalDepts = await prisma.department.findMany({
      where: { isActive: true },
      include: { _count: { select: { employees: true } } },
      orderBy: [{ name: 'asc' }],
    });

    log.push(`[4/4] Final: ${finalDepts.length} active departments, ${employees.length} employees`);

    return NextResponse.json({
      ok: true,
      log,
      summary: {
        totalEmployees: employees.length,
        reassigned,
        unchanged,
        prunedDepartments: pruned,
        deactivatedDepartments: deactivated,
        activeDepartments: finalDepts.length,
      },
      distribution: Object.entries(prefixCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({
          code,
          name: CANONICAL_DEPTS.find((d) => d.code === code)?.name || code,
          count,
        })),
      finalDepartments: finalDepts.map((d) => ({
        code: d.code,
        name: d.name,
        employees: d._count.employees,
      })),
    });
  } catch (error: any) {
    console.error('Normalization error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Normalization failed' },
      { status: 500 }
    );
  }
}

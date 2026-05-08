import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_VIEW_ROLES } from '@/lib/auth';

/**
 * GET /api/compensation/employee/[id]
 *
 * Drives the Compensation tab on the employee detail page. Returns
 * the four compensation streams (salary history, bonuses, commissions,
 * deductions) for a single employee plus a precomputed summary card.
 *
 * Visibility rules:
 *   - ADMIN / HR / ACCOUNTANT  → any employee
 *   - MANAGER                  → only their direct reports
 *   - the employee themselves  → their own record (read-only enforced
 *                                 at the UI level)
 *   - other EMPLOYEE roles     → 403
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const employeeId = parseInt(params.id);
  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Permission: HR/Admin/Accountant always; self always; manager only
  // for their direct reports.
  let allowed = COMPENSATION_VIEW_ROLES.includes(user.role as any);
  if (!allowed && user.employeeId === employeeId) allowed = true;
  if (!allowed && user.role === 'MANAGER' && user.employeeId) {
    const target = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { reportingManagerId: true },
    });
    if (target?.reportingManagerId === user.employeeId) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [
    employee,
    salaryHistory,
    bonuses,
    commissions,
    deductions,
    billingSplits,
  ] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        empCode: true,
        firstName: true,
        lastName: true,
        designation: true,
        department: { select: { name: true } },
      },
    }),
    prisma.salaryHistory.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.bonus.findMany({
      where: { employeeId },
      orderBy: { awardedDate: 'desc' },
    }),
    prisma.commission.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deduction.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    }),
    // Active billing splits — for the banner on the Compensation tab.
    // Read-only here; full CRUD lives on the Finance tab.
    prisma.billingSplit.findMany({
      where: {
        employeeId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      include: { company: { select: { id: true, name: true, code: true } } },
      orderBy: { percentage: 'desc' },
    }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Summary card values — same shape as the register row so the UI
  // helper functions can be reused.
  const active = salaryHistory.find((s) => s.effectiveTo == null);
  const previous = salaryHistory.find(
    (s) => s.effectiveTo != null && (active ? s.id !== active.id : true),
  );
  const ytdSum = (
    arr: { amount: any; currency: string; awardedDate?: Date; createdAt?: Date }[],
    dateKey: 'awardedDate' | 'createdAt',
  ): { pkr: number; usd: number } => {
    let pkr = 0;
    let usd = 0;
    for (const r of arr) {
      const d = (r as any)[dateKey] as Date;
      if (!d || new Date(d) < yearStart) continue;
      const n = Number(r.amount) || 0;
      if (r.currency === 'USD') usd += n;
      else pkr += n;
    }
    return { pkr, usd };
  };
  const ytdBonus = ytdSum(bonuses as any, 'awardedDate');
  const ytdCommission = ytdSum(commissions as any, 'createdAt');

  return NextResponse.json({
    employee,
    summary: {
      currentBase: active ? Number(active.baseSalary) : null,
      currentCurrency: active?.currency ?? null,
      currentSince: active?.effectiveFrom ?? null,
      lastRaise: active && previous
        ? {
            effectiveFrom: active.effectiveFrom,
            incrementPct: active.incrementPct
              ? Number(active.incrementPct)
              : null,
            previousBase: Number(previous.baseSalary),
            reason: active.reason,
          }
        : null,
      ytdBonusPkr: ytdBonus.pkr,
      ytdBonusUsd: ytdBonus.usd,
      ytdCommissionPkr: ytdCommission.pkr,
      ytdCommissionUsd: ytdCommission.usd,
    },
    salaryHistory,
    bonuses,
    commissions,
    deductions,
    billingSplits,
    canEdit: ['ADMIN', 'HR'].includes(user.role),
  });
}

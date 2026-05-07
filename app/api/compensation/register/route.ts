import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_VIEW_ROLES } from '@/lib/auth';

/**
 * GET /api/compensation/register
 *
 * Drives the /people/compensation index page. Returns one row per
 * active employee with a precomputed summary so the page doesn't
 * need to fan out N queries client-side. Each row includes:
 *   - currentBase  : latest active SalaryHistory.baseSalary (null = unset)
 *   - currentCurrency
 *   - lastRaise    : { effectiveFrom, incrementPct } for the most
 *                    recent raise (i.e. the previous BASE that was
 *                    superseded), null if no prior raise
 *   - ytdBonusPkr  / ytdBonusUsd  : bonuses awarded this calendar year
 *   - ytdCommissionPkr / ytdCommissionUsd
 *
 * HR + Admin + Accountant only. Other roles get 403.
 */
export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_VIEW_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // Fetch all active employees with their compensation slices in one
  // batched query — Prisma's nested include keeps this to a single
  // round-trip instead of N+1.
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: { select: { id: true, name: true } },
      salaryHistory: {
        select: {
          id: true,
          baseSalary: true,
          currency: true,
          effectiveFrom: true,
          effectiveTo: true,
          incrementPct: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      },
      bonuses: {
        where: { awardedDate: { gte: yearStart } },
        select: { amount: true, currency: true },
      },
      commissions: {
        where: { createdAt: { gte: yearStart } },
        select: { amount: true, currency: true },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const rows = employees.map((e) => {
    const active = e.salaryHistory.find((s) => s.effectiveTo == null);
    const previous = e.salaryHistory.find(
      (s) => s.effectiveTo != null && (active ? s.id !== active.id : true),
    );
    const sumByCurrency = (
      arr: { amount: any; currency: string }[],
    ): { pkr: number; usd: number } => {
      let pkr = 0;
      let usd = 0;
      for (const r of arr) {
        const n = Number(r.amount) || 0;
        if (r.currency === 'USD') usd += n;
        else pkr += n;
      }
      return { pkr, usd };
    };
    const ytdBonus = sumByCurrency(e.bonuses);
    const ytdCommission = sumByCurrency(e.commissions);

    return {
      employeeId: e.id,
      empCode: e.empCode,
      name: `${e.firstName} ${e.lastName}`,
      designation: e.designation,
      department: e.department,
      currentBase: active ? Number(active.baseSalary) : null,
      currentCurrency: active?.currency ?? null,
      lastRaise: active && previous
        ? {
            effectiveFrom: active.effectiveFrom,
            incrementPct: active.incrementPct
              ? Number(active.incrementPct)
              : null,
            previousBase: Number(previous.baseSalary),
          }
        : null,
      ytdBonusPkr: ytdBonus.pkr,
      ytdBonusUsd: ytdBonus.usd,
      ytdCommissionPkr: ytdCommission.pkr,
      ytdCommissionUsd: ytdCommission.usd,
    };
  });

  return NextResponse.json(rows);
}

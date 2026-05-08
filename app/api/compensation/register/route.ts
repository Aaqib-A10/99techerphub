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
export async function GET(request: NextRequest) {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_VIEW_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // ?period=YYYY-MM scopes the "Monthly payable" column to that month.
  // Defaults to current month so the register's headline number is
  // "this month's payable" without any clicks.
  const periodRaw = request.nextUrl.searchParams.get('period');
  const now = new Date();
  const period =
    periodRaw && /^\d{4}-\d{2}$/.test(periodRaw)
      ? periodRaw
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [py, pm] = period.split('-').map((s) => parseInt(s));
  const monthStart = new Date(py, pm - 1, 1);
  const monthEnd = new Date(py, pm, 0, 23, 59, 59, 999);

  // ?includeInactive=1 expands the list to exited employees so HR can
  // pull comp history for off-boarded staff. Default off — the
  // typical view is "people we currently pay".
  const includeInactive =
    request.nextUrl.searchParams.get('includeInactive') === '1';

  // Fetch employees with their compensation slices in one batched
  // query — Prisma's nested include keeps this to a single
  // round-trip instead of N+1.
  const employees = await prisma.employee.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      isActive: true,
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
        select: { amount: true, currency: true, awardedDate: true },
      },
      adjustments: {
        where: { awardedDate: { gte: yearStart } },
        select: { amount: true, currency: true, awardedDate: true, period: true },
      },
      commissions: {
        where: { createdAt: { gte: yearStart } },
        select: { amount: true, currency: true, period: true },
      },
      deductions: {
        where: { createdAt: { gte: yearStart } },
        select: { amount: true, currency: true, period: true },
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

    // ----- Monthly payable for the chosen period --------------
    // Same formula the per-employee Compensation tab uses.
    // Currency-aware, no FX conversion.
    const monthBase = active
      ? {
          pkr: active.currency === 'PKR' ? Number(active.baseSalary) : 0,
          usd: active.currency === 'USD' ? Number(active.baseSalary) : 0,
        }
      : { pkr: 0, usd: 0 };
    const inMonth = (d: Date | null | undefined) =>
      d ? new Date(d) >= monthStart && new Date(d) <= monthEnd : false;

    const monthBonus = sumByCurrency(
      e.bonuses.filter((b) => inMonth(b.awardedDate as any)),
    );
    const monthAdj = sumByCurrency(
      e.adjustments.filter((a) => inMonth(a.awardedDate as any)),
    );
    const monthComm = sumByCurrency(
      e.commissions.filter((c) => c.period === period),
    );
    const monthDed = sumByCurrency(
      e.deductions.filter((d) => d.period === period),
    );
    const monthlyPayablePkr =
      monthBase.pkr +
      monthBonus.pkr +
      monthAdj.pkr +
      monthComm.pkr -
      monthDed.pkr;
    const monthlyPayableUsd =
      monthBase.usd +
      monthBonus.usd +
      monthAdj.usd +
      monthComm.usd -
      monthDed.usd;

    return {
      employeeId: e.id,
      empCode: e.empCode,
      name: `${e.firstName} ${e.lastName}`,
      designation: e.designation,
      isActive: e.isActive,
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
      monthlyPayablePkr,
      monthlyPayableUsd,
    };
  });

  return NextResponse.json({ period, rows });
  } catch (err: any) {
    // Without this catch a Prisma / runtime error becomes an empty
    // 500 and the client surfaces "Unexpected end of JSON input"
    // instead of the real cause. The most common one is the prod DB
    // missing a column from the latest schema push, so we add a hint.
    console.error('[compensation/register]', err);
    const msg = err?.message ?? 'Unexpected error';
    const hint =
      /Unknown\s+arg|column .* does not exist|Bonus|relation .* does not exist/i.test(
        String(msg),
      )
        ? ' (Run `npx prisma db push && pm2 restart 99tech-erp` on the server.)'
        : '';
    return NextResponse.json(
      { error: `Failed to load compensation register: ${msg}${hint}` },
      { status: 500 },
    );
  }
}

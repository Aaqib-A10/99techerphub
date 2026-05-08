import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_VIEW_ROLES } from '@/lib/auth';
import { getUsdToPkrRate, toPkr } from '@/lib/currency';

/**
 * GET /api/compensation/cost-by-company?asOf=YYYY-MM-DD
 *
 * Aggregates active salary cost across companies based on the
 * `BillingSplit` allocations as of the given date (default: today).
 *
 * For each company:
 *   - allocatedPkr  : sum of (employee_PKR_salary * split% / 100)
 *                     across every PKR-paid employee whose split
 *                     hits this company.
 *   - allocatedUsd  : same for USD.
 *   - pkrEquivalent : allocatedPkr + allocatedUsd × FX rate, for
 *                     a single at-a-glance figure.
 *   - employeeCount : how many distinct employees have any active
 *                     split into this company (some at 100%, some
 *                     fractional).
 *
 * "Unallocated" appears as a synthetic row when an employee's
 * active splits don't cover 100% — the gap is parked there so HR
 * sees what's not yet billed.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!COMPENSATION_VIEW_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const asOfRaw = request.nextUrl.searchParams.get('asOf');
    const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 });
    }

    // Pull every active employee + their active salary and active
    // splits in one round-trip.
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        empCode: true,
        salaryHistory: {
          where: {
            effectiveFrom: { lte: asOf },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        billingSplits: {
          where: {
            effectiveFrom: { lte: asOf },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
          },
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    // Aggregate buckets keyed by companyId (number, plus a special
    // 'unallocated' synthetic key).
    type Bucket = {
      companyId: number | null;
      companyName: string;
      companyCode: string | null;
      allocatedPkr: number;
      allocatedUsd: number;
      employeeIds: Set<number>;
    };
    const buckets = new Map<number | string, Bucket>();
    const getBucket = (
      key: number | 'unallocated',
      name: string,
      code: string | null,
    ): Bucket => {
      let b = buckets.get(key);
      if (!b) {
        b = {
          companyId: typeof key === 'number' ? key : null,
          companyName: name,
          companyCode: code,
          allocatedPkr: 0,
          allocatedUsd: 0,
          employeeIds: new Set(),
        };
        buckets.set(key, b);
      }
      return b;
    };

    let totalEmployees = 0;
    let totalSalariedEmployees = 0;
    let totalUnallocatedPkr = 0;
    let totalUnallocatedUsd = 0;

    for (const e of employees) {
      totalEmployees++;
      const active = e.salaryHistory[0];
      if (!active) continue;
      totalSalariedEmployees++;
      const baseAmount = Number(active.baseSalary) || 0;
      const baseCurrency = active.currency;

      // Sum splits → distribute base accordingly. Anything not
      // covered lands in the "Unallocated" bucket so finance can see
      // their billing gaps.
      let coveredPct = 0;
      for (const s of e.billingSplits) {
        const pct = Number(s.percentage);
        coveredPct += pct;
        const portion = (baseAmount * pct) / 100;
        const b = getBucket(
          s.companyId,
          s.company?.name ?? `Company #${s.companyId}`,
          s.company?.code ?? null,
        );
        if (baseCurrency === 'USD') b.allocatedUsd += portion;
        else b.allocatedPkr += portion;
        b.employeeIds.add(e.id);
      }
      const uncoveredPct = Math.max(0, 100 - coveredPct);
      if (uncoveredPct > 0.01) {
        const portion = (baseAmount * uncoveredPct) / 100;
        const b = getBucket('unallocated', 'Unallocated', null);
        if (baseCurrency === 'USD') {
          b.allocatedUsd += portion;
          totalUnallocatedUsd += portion;
        } else {
          b.allocatedPkr += portion;
          totalUnallocatedPkr += portion;
        }
        b.employeeIds.add(e.id);
      }
    }

    const fxRate = getUsdToPkrRate();
    const rows = Array.from(buckets.values())
      .map((b) => ({
        companyId: b.companyId,
        companyName: b.companyName,
        companyCode: b.companyCode,
        allocatedPkr: Math.round(b.allocatedPkr * 100) / 100,
        allocatedUsd: Math.round(b.allocatedUsd * 100) / 100,
        pkrEquivalent: Math.round(
          (b.allocatedPkr + toPkr(b.allocatedUsd, 'USD')) * 100,
        ) / 100,
        employeeCount: b.employeeIds.size,
      }))
      .sort((a, b) => b.pkrEquivalent - a.pkrEquivalent);

    const totals = {
      pkr: rows.reduce((a, r) => a + r.allocatedPkr, 0),
      usd: rows.reduce((a, r) => a + r.allocatedUsd, 0),
      pkrEquivalent: rows.reduce((a, r) => a + r.pkrEquivalent, 0),
      employeesTotal: totalEmployees,
      employeesWithSalary: totalSalariedEmployees,
      unallocatedPkr: totalUnallocatedPkr,
      unallocatedUsd: totalUnallocatedUsd,
      fxRate,
    };

    return NextResponse.json({
      asOf: asOf.toISOString().slice(0, 10),
      rows,
      totals,
    });
  } catch (err: any) {
    console.error('[compensation/cost-by-company]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to compute cost by company' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/billing-split
 *
 * Add a new BillingSplit for an employee. Each split says "X% of this
 * employee's salary is billed to this company." A single employee
 * can have multiple active splits at once; the API enforces that the
 * sum of active percentages for that employee never exceeds 100.
 *
 * Body: { employeeId, companyId, percentage, effectiveFrom, effectiveTo? }
 *
 * "Active" means effectiveTo IS NULL OR effectiveTo > now. We check
 * the would-be total against this set after the new row would be
 * inserted; if it'd push past 100% we reject with a clear message
 * so HR can adjust an existing row instead.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const employeeId = parseInt(body?.employeeId);
    const companyId = parseInt(body?.companyId);
    const percentage = Number(body?.percentage);
    const effectiveFromRaw = body?.effectiveFrom;
    const effectiveToRaw = body?.effectiveTo;

    if (!Number.isFinite(employeeId)) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return NextResponse.json(
        { error: 'percentage must be between 0 and 100' },
        { status: 400 },
      );
    }
    if (!effectiveFromRaw) {
      return NextResponse.json(
        { error: 'effectiveFrom is required' },
        { status: 400 },
      );
    }

    const effectiveFrom = new Date(effectiveFromRaw);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return NextResponse.json(
        { error: 'effectiveFrom is not a valid date' },
        { status: 400 },
      );
    }
    const effectiveTo = effectiveToRaw ? new Date(effectiveToRaw) : null;
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      return NextResponse.json(
        { error: 'effectiveTo is not a valid date' },
        { status: 400 },
      );
    }

    // Verify employee + company exist before checking the cap.
    const [emp, company] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
      prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
    ]);
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    // Sum currently-active percentages for this employee.
    const now = new Date();
    const existing = await prisma.billingSplit.findMany({
      where: {
        employeeId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      select: { id: true, companyId: true, percentage: true },
    });

    // Reject if the same company already has an active split — HR
    // should edit the existing row, not duplicate it.
    if (existing.some((s) => s.companyId === companyId)) {
      return NextResponse.json(
        {
          error: `An active split for ${company.name} already exists. Edit that row instead of adding a duplicate.`,
        },
        { status: 409 },
      );
    }

    const existingSum = existing.reduce(
      (acc, s) => acc + Number(s.percentage),
      0,
    );
    if (existingSum + percentage > 100.0001) {
      // The 0.0001 fudge is for Decimal rounding — 33.33+33.33+33.34
      // can sum to 100.0000001 in float arithmetic. Anything past
      // that is a real over-allocation.
      return NextResponse.json(
        {
          error: `Would push allocation to ${(existingSum + percentage).toFixed(2)}% (max 100). Active total is currently ${existingSum.toFixed(2)}%.`,
        },
        { status: 400 },
      );
    }

    const created = await prisma.billingSplit.create({
      data: { employeeId, companyId, percentage, effectiveFrom, effectiveTo },
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('[compensation/billing-split POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to create split' },
      { status: 500 },
    );
  }
}

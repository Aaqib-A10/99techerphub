import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/salary
 *
 * Sets a new BASE salary for an employee. Atomic: inserts the new
 * SalaryHistory row AND end-dates the previously active row (if any)
 * inside one transaction so an employee never has two active base
 * salaries at the same instant. Auto-computes incrementPct vs the
 * previous active row when both currencies match.
 *
 * Body:
 *   employeeId: number
 *   baseSalary: number          (positive)
 *   currency:   'PKR' | 'USD'   (default PKR)
 *   effectiveFrom: ISO date     (when the new salary kicks in)
 *   reason?:    string
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const employeeId = parseInt(body?.employeeId);
  const baseSalary = Number(body?.baseSalary);
  const currency = body?.currency === 'USD' ? 'USD' : 'PKR';
  const effectiveFromRaw = body?.effectiveFrom;
  const reason: string | null =
    typeof body?.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : null;

  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
    return NextResponse.json(
      { error: 'baseSalary must be a positive number' },
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

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Find the currently-active BASE for this employee (if any) so we
  // can compute the increment % and end-date it.
  const previous = await prisma.salaryHistory.findFirst({
    where: { employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Increment % only meaningful when currencies match — comparing PKR
  // 250k to USD 2k is not a raise, it's a re-comp.
  let incrementPct: number | null = null;
  if (previous && previous.currency === currency) {
    const prevBase = Number(previous.baseSalary);
    if (prevBase > 0) {
      incrementPct = ((baseSalary - prevBase) / prevBase) * 100;
      // Round to 2 dp; schema column is Decimal(5,2).
      incrementPct = Math.round(incrementPct * 100) / 100;
    }
  }

  // The new row's effectiveFrom is the previous row's effectiveTo
  // exclusive — we end-date the previous to the day before the new
  // one starts so the timeline reads cleanly without overlap.
  const previousEnd = new Date(effectiveFrom.getTime() - 1);

  const created = await prisma.$transaction(async (tx) => {
    if (previous) {
      await tx.salaryHistory.update({
        where: { id: previous.id },
        data: { effectiveTo: previousEnd },
      });
    }
    return tx.salaryHistory.create({
      data: {
        employeeId,
        baseSalary,
        currency,
        effectiveFrom,
        incrementPct,
        reason,
      },
    });
  });

  return NextResponse.json(created, { status: 201 });
}

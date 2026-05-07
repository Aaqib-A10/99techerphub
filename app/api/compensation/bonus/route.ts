import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/bonus
 *
 * Awards a one-time bonus. No supersede logic — bonuses are
 * independent events.
 *
 * Body:
 *   employeeId, amount, currency?, reason, period?, awardedDate?,
 *   isPaid?, notes?
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const employeeId = parseInt(body?.employeeId);
  const amount = Number(body?.amount);
  const currency = body?.currency === 'USD' ? 'USD' : 'PKR';
  const reason: string =
    typeof body?.reason === 'string' ? body.reason.trim() : '';
  const period: string | null =
    typeof body?.period === 'string' && body.period.trim()
      ? body.period.trim()
      : null;
  const awardedDate = body?.awardedDate
    ? new Date(body.awardedDate)
    : new Date();
  const isPaid = body?.isPaid === true;
  const notes: string | null =
    typeof body?.notes === 'string' && body.notes.trim()
      ? body.notes.trim()
      : null;

  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive number' },
      { status: 400 },
    );
  }
  if (!reason) {
    return NextResponse.json(
      { error: 'reason is required (e.g. "Eid bonus 2026")' },
      { status: 400 },
    );
  }
  if (Number.isNaN(awardedDate.getTime())) {
    return NextResponse.json(
      { error: 'awardedDate is not a valid date' },
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

  const created = await prisma.bonus.create({
    data: {
      employeeId,
      amount,
      currency,
      reason,
      period,
      awardedDate,
      isPaid,
      notes,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

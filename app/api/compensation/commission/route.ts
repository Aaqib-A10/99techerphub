import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/commission
 *
 * Records a commission earned for a specific period. The Commission
 * model uses a free-form `period` string (e.g. "2026-05" or "Q1 2026")
 * because commission cycles vary by team — sales might be quarterly,
 * delivery might be monthly.
 *
 * Body: employeeId, amount, currency?, description, period, isPaid?
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
  const description: string =
    typeof body?.description === 'string' ? body.description.trim() : '';
  const period: string =
    typeof body?.period === 'string' ? body.period.trim() : '';
  const isPaid = body?.isPaid === true;

  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive number' },
      { status: 400 },
    );
  }
  if (!description) {
    return NextResponse.json(
      { error: 'description is required' },
      { status: 400 },
    );
  }
  if (!period) {
    return NextResponse.json(
      { error: 'period is required (e.g. "2026-05" or "Q1 2026")' },
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

  const created = await prisma.commission.create({
    data: { employeeId, amount, currency, description, period, isPaid },
  });

  return NextResponse.json(created, { status: 201 });
}

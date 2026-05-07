import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/deduction
 *
 * Records a one-time deduction for a specific period — typically a
 * loan installment, an advance recovery, or an absence-related
 * deduction. Deductions are entered manually each cycle (no
 * auto-recurring) per the product spec.
 *
 * Body: employeeId, amount, currency?, deductionType, description?,
 *       period
 */

const ALLOWED_TYPES = new Set([
  'TAX',
  'LOAN',
  'ADVANCE',
  'INSURANCE',
  'OTHER',
]);

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
  const deductionType: string =
    typeof body?.deductionType === 'string'
      ? body.deductionType.toUpperCase()
      : '';
  const description: string | null =
    typeof body?.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null;
  const period: string =
    typeof body?.period === 'string' ? body.period.trim() : '';

  if (!Number.isFinite(employeeId)) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'amount must be a positive number' },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(deductionType)) {
    return NextResponse.json(
      {
        error: `deductionType must be one of ${Array.from(ALLOWED_TYPES).join(', ')}`,
      },
      { status: 400 },
    );
  }
  if (!period) {
    return NextResponse.json(
      { error: 'period is required (e.g. "2026-05")' },
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

  const created = await prisma.deduction.create({
    data: { employeeId, amount, currency, deductionType, description, period },
  });

  return NextResponse.json(created, { status: 201 });
}

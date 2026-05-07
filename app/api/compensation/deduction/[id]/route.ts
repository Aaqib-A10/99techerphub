import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

const ALLOWED_TYPES = new Set(['TAX', 'LOAN', 'ADVANCE', 'INSURANCE', 'OTHER']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = parseInt(params.id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const body = await request.json();
  const data: any = {};
  if (body.amount != null) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0)
      return NextResponse.json({ error: 'amount must be positive' }, { status: 400 });
    data.amount = n;
  }
  if (body.currency != null) data.currency = body.currency === 'USD' ? 'USD' : 'PKR';
  if (body.deductionType != null) {
    const t = String(body.deductionType).toUpperCase();
    if (!ALLOWED_TYPES.has(t))
      return NextResponse.json(
        { error: `deductionType must be one of ${Array.from(ALLOWED_TYPES).join(', ')}` },
        { status: 400 },
      );
    data.deductionType = t;
  }
  if (body.description !== undefined)
    data.description = body.description ? String(body.description).trim() : null;
  if (body.period != null) data.period = String(body.period).trim();

  const updated = await prisma.deduction.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = parseInt(params.id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  await prisma.deduction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

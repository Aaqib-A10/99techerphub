import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

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
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const body = await request.json();
  const data: any = {};
  if (body.amount != null) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0)
      return NextResponse.json({ error: 'amount must be positive' }, { status: 400 });
    data.amount = n;
  }
  if (body.currency != null) data.currency = body.currency === 'USD' ? 'USD' : 'PKR';
  if (body.reason != null) data.reason = String(body.reason).trim();
  if (body.period !== undefined)
    data.period = body.period ? String(body.period).trim() : null;
  if (body.awardedDate != null) {
    const d = new Date(body.awardedDate);
    if (Number.isNaN(d.getTime()))
      return NextResponse.json({ error: 'invalid awardedDate' }, { status: 400 });
    data.awardedDate = d;
  }
  if (body.isPaid != null) data.isPaid = !!body.isPaid;
  if (body.notes !== undefined)
    data.notes = body.notes ? String(body.notes).trim() : null;

  const updated = await prisma.bonus.update({ where: { id }, data });
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
  await prisma.bonus.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

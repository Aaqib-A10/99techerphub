import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * PATCH / DELETE for a single SalaryHistory row. Only HR/Admin.
 *
 * PATCH editable fields: baseSalary, currency, effectiveFrom, reason.
 * effectiveTo is derived (auto-set when superseded by a newer BASE);
 * we don't expose it for direct edit to avoid broken timelines.
 *
 * DELETE is a hard delete — Salary rows are auditable but small in
 * volume; keeping a soft-delete flag would over-complicate the model.
 * If the deleted row was the active BASE, the next-most-recent row's
 * effectiveTo gets cleared so it becomes active again.
 */
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
  if (body.baseSalary != null) {
    const n = Number(body.baseSalary);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: 'baseSalary must be positive' },
        { status: 400 },
      );
    }
    data.baseSalary = n;
  }
  if (body.currency != null) data.currency = body.currency === 'USD' ? 'USD' : 'PKR';
  if (body.effectiveFrom != null) {
    const d = new Date(body.effectiveFrom);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: 'effectiveFrom is not a valid date' },
        { status: 400 },
      );
    }
    data.effectiveFrom = d;
  }
  if (body.reason != null)
    data.reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;

  const updated = await prisma.salaryHistory.update({ where: { id }, data });
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
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const target = await prisma.salaryHistory.findUnique({
    where: { id },
    select: { id: true, employeeId: true, effectiveTo: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If we're deleting the active BASE, the previous row should become
  // active again — clear its effectiveTo. Atomic to keep timeline
  // consistent.
  await prisma.$transaction(async (tx) => {
    await tx.salaryHistory.delete({ where: { id } });
    if (target.effectiveTo == null) {
      const previous = await tx.salaryHistory.findFirst({
        where: { employeeId: target.employeeId },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (previous && previous.effectiveTo != null) {
        await tx.salaryHistory.update({
          where: { id: previous.id },
          data: { effectiveTo: null },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

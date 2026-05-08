import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * PATCH / DELETE for a single BillingSplit row. HR/Admin only.
 *
 * Same 100% cap is enforced on PATCH as on POST, computed against
 * other active rows (this row's old percentage is excluded from
 * the existing-total before the new value is added back).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const target = await prisma.billingSplit.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};

    if (body.percentage != null) {
      const n = Number(body.percentage);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        return NextResponse.json(
          { error: 'percentage must be between 0 and 100' },
          { status: 400 },
        );
      }
      // Sum other active rows (excluding this one).
      const now = new Date();
      const others = await prisma.billingSplit.findMany({
        where: {
          employeeId: target.employeeId,
          id: { not: id },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        select: { percentage: true },
      });
      const otherSum = others.reduce((a, s) => a + Number(s.percentage), 0);
      if (otherSum + n > 100.0001) {
        return NextResponse.json(
          {
            error: `Would push allocation to ${(otherSum + n).toFixed(2)}% (max 100). Other active rows total ${otherSum.toFixed(2)}%.`,
          },
          { status: 400 },
        );
      }
      data.percentage = n;
    }

    if (body.companyId != null) {
      const cid = parseInt(body.companyId);
      if (!Number.isFinite(cid))
        return NextResponse.json({ error: 'invalid companyId' }, { status: 400 });
      data.companyId = cid;
    }

    if (body.effectiveFrom != null) {
      const d = new Date(body.effectiveFrom);
      if (Number.isNaN(d.getTime()))
        return NextResponse.json(
          { error: 'invalid effectiveFrom' },
          { status: 400 },
        );
      data.effectiveFrom = d;
    }

    if (body.effectiveTo !== undefined) {
      if (body.effectiveTo == null || body.effectiveTo === '') {
        data.effectiveTo = null;
      } else {
        const d = new Date(body.effectiveTo);
        if (Number.isNaN(d.getTime()))
          return NextResponse.json(
            { error: 'invalid effectiveTo' },
            { status: 400 },
          );
        data.effectiveTo = d;
      }
    }

    const updated = await prisma.billingSplit.update({
      where: { id },
      data,
      include: { company: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[compensation/billing-split PATCH]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to update split' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    await prisma.billingSplit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[compensation/billing-split DELETE]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to delete split' },
      { status: 500 },
    );
  }
}

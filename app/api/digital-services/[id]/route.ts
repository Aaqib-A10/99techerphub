import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * PATCH / DELETE for a single digital service. Admin only.
 *
 * Editable fields: name, description, category, defaultPlan,
 * ownerEmployeeId, iconUrl, isActive.
 *
 * Soft delete via isActive=false is preferred over hard DELETE —
 * services may have access-request history that should remain
 * referenceable. DELETE is exposed only for cleanup of mis-typed
 * rows that never had any activity; the route refuses to delete
 * services with linked requests or grants.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json();
  const data: any = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.description !== undefined)
    data.description = body.description ? String(body.description).trim() : null;
  if (body.category !== undefined)
    data.category = body.category ? String(body.category).trim() : null;
  if (body.defaultPlan !== undefined)
    data.defaultPlan = body.defaultPlan ? String(body.defaultPlan).trim() : null;
  if (body.ownerEmployeeId !== undefined) {
    data.ownerEmployeeId =
      body.ownerEmployeeId == null || body.ownerEmployeeId === ''
        ? null
        : parseInt(body.ownerEmployeeId);
  }
  if (body.iconUrl !== undefined)
    data.iconUrl = body.iconUrl ? String(body.iconUrl).trim() : null;
  if (body.isActive != null) data.isActive = !!body.isActive;

  try {
    const updated = await prisma.digitalService.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, empCode: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A service with that name already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: e?.message ?? 'Failed to update service' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  // Refuse hard-delete if the service has any history — admin should
  // soft-delete via isActive=false instead.
  const [requestsCount, grantsCount] = await Promise.all([
    prisma.digitalAccessRequest.count({ where: { serviceId: id } }),
    prisma.digitalService
      .findUnique({ where: { id }, select: { name: true } })
      .then((s) =>
        s
          ? prisma.digitalAccess.count({ where: { serviceName: s.name } })
          : 0,
      ),
  ]);
  if (requestsCount > 0 || grantsCount > 0) {
    return NextResponse.json(
      {
        error: `Service has ${requestsCount} request${requestsCount === 1 ? '' : 's'} and ${grantsCount} grant${grantsCount === 1 ? '' : 's'} in history. Toggle "Active" off instead of deleting.`,
      },
      { status: 409 },
    );
  }

  await prisma.digitalService.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

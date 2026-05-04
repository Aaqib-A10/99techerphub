import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// PATCH — admin/HR/manager edits an existing digital access record.
// Editable fields: serviceName, accountId, notes, isActive (re-activate
// a revoked record). Reactivation clears revokedDate so the row reads
// as freshly granted again.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'HR', 'MANAGER', 'ACCOUNTANT'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const existing = await prisma.digitalAccess.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const update: Record<string, any> = {};
  const changed: string[] = [];

  if (typeof body.serviceName === 'string' && body.serviceName.trim()) {
    const v = body.serviceName.trim();
    if (v !== existing.serviceName) {
      update.serviceName = v;
      changed.push('serviceName');
    }
  }
  if ('accountId' in body) {
    const v = typeof body.accountId === 'string' ? body.accountId.trim() || null : null;
    if (v !== existing.accountId) {
      update.accountId = v;
      changed.push('accountId');
    }
  }
  if ('notes' in body) {
    const v = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    if (v !== existing.notes) {
      update.notes = v;
      changed.push('notes');
    }
  }
  if (typeof body.isActive === 'boolean' && body.isActive !== existing.isActive) {
    update.isActive = body.isActive;
    update.revokedDate = body.isActive ? null : new Date();
    changed.push('isActive');
  }

  if (changed.length === 0) {
    return NextResponse.json({ ...existing, _changed: [] });
  }

  const updated = await prisma.digitalAccess.update({
    where: { id },
    data: update,
  });

  await prisma.auditLog
    .create({
      data: {
        tableName: 'digital_access',
        recordId: id,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        oldValues: changed.reduce<Record<string, any>>((acc, f) => {
          acc[f] = (existing as any)[f];
          return acc;
        }, {}),
        newValues: changed.reduce<Record<string, any>>((acc, f) => {
          acc[f] = (updated as any)[f];
          return acc;
        }, {}),
      },
    })
    .catch(() => {});

  return NextResponse.json({ ...updated, _changed: changed });
}

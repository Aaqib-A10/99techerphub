import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'HR'].includes(user.role)) {
    return NextResponse.json({ error: 'Admin/HR only' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const data = await request.json();
  const update: any = {};
  if (typeof data.name === 'string' && data.name.trim()) update.name = data.name.trim();
  if (typeof data.isActive === 'boolean') update.isActive = data.isActive;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const before = await prisma.marketplace.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = await prisma.marketplace.update({ where: { id }, data: update });
    await prisma.auditLog.create({
      data: {
        tableName: 'marketplaces',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: before,
        newValues: updated,
      },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update marketplace' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recordId = parseInt(params.id);
    const record = await prisma.digitalAccess.findUnique({ where: { id: recordId } });

    if (!record) return NextResponse.json({ error: 'Digital access record not found' }, { status: 404 });
    if (!record.isActive) return NextResponse.json({ error: 'Access is already revoked' }, { status: 400 });

    const updatedRecord = await prisma.digitalAccess.update({
      where: { id: recordId },
      data: { isActive: false, revokedDate: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'digital_access',
        recordId,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        newValues: { isActive: false, revokedDate: new Date() },
      },
    });

    return NextResponse.json(updatedRecord, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
  }
}
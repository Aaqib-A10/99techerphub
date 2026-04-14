import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    // Fetch current template
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Toggle isActive
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        isActive: !template.isActive,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'email_templates',
        recordId: id,
        action: 'UPDATE',
        module: 'EMAIL_TEMPLATES',
        oldValues: { isActive: template.isActive },
        newValues: { isActive: updated.isActive },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to toggle email template status',
      },
      { status: 500 }
    );
  }
}

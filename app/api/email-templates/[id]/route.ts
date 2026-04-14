import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const data = await request.json();

    // Fetch existing template
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // If templateKey is being changed, verify uniqueness
    if (data.templateKey && data.templateKey !== existing.templateKey) {
      const duplicate = await prisma.emailTemplate.findUnique({
        where: { templateKey: data.templateKey },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            error: 'Template key already exists',
            details: data.templateKey,
          },
          { status: 409 }
        );
      }
    }

    // Update template
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        templateKey: data.templateKey || existing.templateKey,
        name: data.name || existing.name,
        category: data.category || existing.category,
        subject: data.subject || existing.subject,
        bodyHtml: data.bodyHtml || existing.bodyHtml,
        bodyText: data.bodyText !== undefined ? data.bodyText : existing.bodyText,
        mergeFields: data.mergeFields || existing.mergeFields,
        description: data.description !== undefined ? data.description : existing.description,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'email_templates',
        recordId: id,
        action: 'UPDATE',
        module: 'EMAIL_TEMPLATES',
        oldValues: existing,
        newValues: updated,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to update email template',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    // Fetch template before deletion
    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete template
    await prisma.emailTemplate.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'email_templates',
        recordId: id,
        action: 'DELETE',
        module: 'EMAIL_TEMPLATES',
        oldValues: template,
      },
    });

    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to delete email template',
      },
      { status: 500 }
    );
  }
}

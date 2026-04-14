import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    const where = category && category !== 'ALL' ? { category } : {};

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      templateKey,
      name,
      category,
      subject,
      bodyHtml,
      bodyText,
      mergeFields,
      description,
    } = data;

    // Validate required fields
    if (!templateKey || !name || !category || !subject || !bodyHtml) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details:
            'templateKey, name, category, subject, and bodyHtml are required',
        },
        { status: 400 }
      );
    }

    // Check if templateKey is unique
    const existing = await prisma.emailTemplate.findUnique({
      where: { templateKey },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Template key already exists', details: templateKey },
        { status: 409 }
      );
    }

    // Create template
    const template = await prisma.emailTemplate.create({
      data: {
        templateKey,
        name,
        category,
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        mergeFields: mergeFields || [],
        description: description || null,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'email_templates',
        recordId: template.id,
        action: 'CREATE',
        module: 'EMAIL_TEMPLATES',
        newValues: template,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to create email template',
      },
      { status: 500 }
    );
  }
}

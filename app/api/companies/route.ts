import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
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

    if (!data.code || !data.name || !data.country) {
      return NextResponse.json(
        { error: 'Code, name, and country are required' },
        { status: 400 }
      );
    }

    const company = await prisma.company.create({
      data: {
        code: data.code,
        name: data.name,
        country: data.country,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'companies',
        recordId: company.id,
        action: 'CREATE',
        module: 'MASTER_DATA',
        newValues: company,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    );
  }
}

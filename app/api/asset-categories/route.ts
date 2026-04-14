import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const categories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching asset categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset categories' },
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

    if (!data.code || !data.name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    const category = await prisma.assetCategory.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'asset_categories',
        recordId: category.id,
        action: 'CREATE',
        module: 'MASTER_DATA',
        newValues: category,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset category:', error);
    return NextResponse.json(
      { error: 'Failed to create asset category' },
      { status: 500 }
    );
  }
}

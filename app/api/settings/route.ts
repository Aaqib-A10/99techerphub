import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [companies, departments, locations, assetCategories, expenseCategories] = await Promise.all([
      prisma.company.findMany({ orderBy: { name: 'asc' } }),
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.location.findMany({ orderBy: { name: 'asc' } }),
      prisma.assetCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.expenseCategory.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return NextResponse.json({ companies, departments, locations, assetCategories, expenseCategories });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { type, ...fields } = data;

    let result;

    switch (type) {
      case 'company':
        result = await prisma.company.create({
          data: { code: fields.code, name: fields.name, country: fields.country || 'US' },
        });
        break;
      case 'department':
        result = await prisma.department.create({
          data: { name: fields.name, code: fields.code },
        });
        break;
      case 'location':
        result = await prisma.location.create({
          data: { name: fields.name, address: fields.address || null, country: fields.country || 'PK' },
        });
        break;
      case 'assetCategory':
        result = await prisma.assetCategory.create({
          data: { name: fields.name, code: fields.code, description: fields.description || null },
        });
        break;
      case 'expenseCategory':
        result = await prisma.expenseCategory.create({
          data: { name: fields.name, code: fields.code, description: fields.description || null, isGlobal: true },
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        tableName: type,
        recordId: result.id,
        action: 'CREATE',
        module: 'SETTINGS',
        newValues: result,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create record', details: error?.message }, { status: 500 });
  }
}

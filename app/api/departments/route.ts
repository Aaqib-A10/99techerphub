import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.code || !data.name) {
      return NextResponse.json(
        { error: 'Code and name are required' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        code: data.code,
        name: data.name,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'departments',
        recordId: department.id,
        action: 'CREATE',
        module: 'MASTER_DATA',
        newValues: department,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: 'Failed to create department', details: error?.message },
      { status: 500 }
    );
  }
}

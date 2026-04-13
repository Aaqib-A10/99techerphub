import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {};
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (activeOnly) where.isActive = true;

    const records = await prisma.digitalAccess.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: { grantedDate: 'desc' },
    });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch digital access records', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const access = await prisma.digitalAccess.create({
      data: {
        employeeId: parseInt(data.employeeId),
        serviceName: data.serviceName,
        accountId: data.accountId || null,
        notes: data.notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'digital_access',
        recordId: access.id,
        action: 'CREATE',
        module: 'EMPLOYEE',
        newValues: access,
      },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to grant access', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    const access = await prisma.digitalAccess.update({
      where: { id },
      data: { isActive: false, revokedDate: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'digital_access',
        recordId: id,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        newValues: { isActive: false, revokedDate: new Date() },
      },
    });

    return NextResponse.json(access);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to revoke access', details: error?.message },
      { status: 500 }
    );
  }
}

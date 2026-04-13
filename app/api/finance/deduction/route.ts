import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const deductions = await prisma.deduction.findMany({
      include: { employee: { select: { firstName: true, lastName: true, empCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(deductions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deductions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const deduction = await prisma.deduction.create({
      data: {
        employeeId: parseInt(data.employeeId),
        amount: parseFloat(data.amount),
        currency: data.currency || 'PKR',
        deductionType: data.deductionType,
        description: data.description || null,
        period: data.period,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'deductions',
        recordId: deduction.id,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: deduction,
      },
    });

    return NextResponse.json(deduction, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create deduction', details: error?.message }, { status: 500 });
  }
}

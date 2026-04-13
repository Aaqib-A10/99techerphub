import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const commissions = await prisma.commission.findMany({
      include: { employee: { select: { firstName: true, lastName: true, empCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(commissions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const commission = await prisma.commission.create({
      data: {
        employeeId: parseInt(data.employeeId),
        amount: parseFloat(data.amount),
        currency: data.currency || 'PKR',
        description: data.description,
        period: data.period,
        isPaid: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'commissions',
        recordId: commission.id,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: commission,
      },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create commission', details: error?.message }, { status: 500 });
  }
}

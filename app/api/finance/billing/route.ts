import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const billingSplits = await prisma.billingSplit.findMany({
      include: {
        employee: true,
        company: true,
      },
      orderBy: { employee: { lastName: 'asc' } },
    });

    return NextResponse.json(billingSplits);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch billing splits', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { employeeId, splits } = data;

    // splits is an array of { companyId, percentage }
    // Validate percentages sum to 100
    const totalPercentage = splits.reduce(
      (sum: number, split: any) => sum + parseFloat(split.percentage),
      0
    );

    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Billing percentages must sum to 100%' },
        { status: 400 }
      );
    }

    // Close existing splits for this employee
    const existingSplits = await prisma.billingSplit.findMany({
      where: { employeeId: parseInt(employeeId), effectiveTo: null },
    });

    if (existingSplits.length > 0) {
      await prisma.billingSplit.updateMany({
        where: {
          employeeId: parseInt(employeeId),
          effectiveTo: null,
        },
        data: { effectiveTo: new Date() },
      });
    }

    // Create new splits
    const newSplits = await Promise.all(
      splits.map((split: any) =>
        prisma.billingSplit.create({
          data: {
            employeeId: parseInt(employeeId),
            companyId: parseInt(split.companyId),
            percentage: parseFloat(split.percentage),
            effectiveFrom: new Date(),
          },
          include: {
            employee: true,
            company: true,
          },
        })
      )
    );

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'billing_splits',
        recordId: newSplits[0]?.id || 0,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: { splits: newSplits },
        oldValues: { splits: existingSplits },
      },
    });

    return NextResponse.json(newSplits, { status: 201 });
  } catch (error: any) {
    console.error('Error creating billing splits:', error);
    return NextResponse.json(
      { error: 'Failed to create billing splits', details: error?.message },
      { status: 500 }
    );
  }
}

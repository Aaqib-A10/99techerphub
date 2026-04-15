import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { parseCurrency } from '@/lib/currency';

// GET: Fetch current salary for employee(s)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (employeeId) {
      const salary = await prisma.salaryHistory.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      return NextResponse.json(salary || {});
    }

    const salaries = await prisma.salaryHistory.findMany({
      where: { effectiveTo: null },
      include: { employee: true },
      orderBy: { employee: { lastName: 'asc' } },
    });
    return NextResponse.json(salaries);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch salary records' },
      { status: 500 }
    );
  }
}

// POST: Create salary increment — ATOMIC with advisory lock
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const employeeId = parseInt(data.employeeId);
    const newBaseSalary = parseCurrency(data.baseSalary);

    const salary = await prisma.$transaction(async (tx) => {
      // Advisory lock per employee — serializes concurrent salary updates
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(99002, ${employeeId})`;

      // Close current salary record (inside transaction)
      const currentSalary = await tx.salaryHistory.findFirst({
        where: { employeeId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (currentSalary) {
        await tx.salaryHistory.update({
          where: { id: currentSalary.id },
          data: { effectiveTo: new Date(data.effectiveFrom) },
        });
      }

      const incrementPct = currentSalary
        ? ((newBaseSalary - Number(currentSalary.baseSalary)) / Number(currentSalary.baseSalary)) * 100
        : null;

      const newSalary = await tx.salaryHistory.create({
        data: {
          employeeId,
          baseSalary: newBaseSalary,
          currency: data.currency || 'PKR',
          effectiveFrom: new Date(data.effectiveFrom),
          incrementPct: incrementPct ? Math.round(incrementPct * 100) / 100 : null,
          reason: data.reason || null,
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'salary_history',
          recordId: newSalary.id,
          action: 'CREATE',
          module: 'FINANCE',
          newValues: newSalary as any,
          oldValues: currentSalary as any,
        },
      });

      return newSalary;
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error: any) {
    console.error('Error creating salary record:', error);
    return NextResponse.json({ error: 'Failed to create salary record' }, { status: 500 });
  }
}

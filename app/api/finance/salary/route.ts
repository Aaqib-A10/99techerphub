import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

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
      // Get current salary for a specific employee
      const salary = await prisma.salaryHistory.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          effectiveTo: null,
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      return NextResponse.json(salary || {});
    }

    // Get all active salaries
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

// POST: Create salary increment for an employee
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Close current salary record
    const currentSalary = await prisma.salaryHistory.findFirst({
      where: { employeeId: parseInt(data.employeeId), effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (currentSalary) {
      await prisma.salaryHistory.update({
        where: { id: currentSalary.id },
        data: { effectiveTo: new Date(data.effectiveFrom) },
      });
    }

    const incrementPct = currentSalary
      ? ((parseFloat(data.baseSalary) - currentSalary.baseSalary) / currentSalary.baseSalary) * 100
      : null;

    const salary = await prisma.salaryHistory.create({
      data: {
        employeeId: parseInt(data.employeeId),
        baseSalary: parseFloat(data.baseSalary),
        currency: data.currency || 'PKR',
        effectiveFrom: new Date(data.effectiveFrom),
        incrementPct: incrementPct ? parseFloat(incrementPct.toFixed(2)) : null,
        reason: data.reason || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'salary_history',
        recordId: salary.id,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: salary,
        oldValues: currentSalary,
      },
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create salary record' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const payrollRuns = await prisma.payrollRun.findMany({
      include: {
        company: true,
        items: {
          include: { employee: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(payrollRuns);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch payroll runs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const period = data.period; // e.g., "2026-03"
    const companyId = data.companyId ? parseInt(data.companyId) : null;

    // Check if payroll already exists for this period
    const existing = await prisma.payrollRun.findFirst({
      where: { period, companyId },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Payroll run already exists for ${period}` },
        { status: 400 }
      );
    }

    // Get all active employees (optionally filtered by company)
    const where: any = { isActive: true };
    if (companyId) where.companyId = companyId;

    const employees = await prisma.employee.findMany({
      where,
      include: {
        salaryHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        commissions: {
          where: { period, isPaid: false },
        },
        deductions: {
          where: { period },
        },
      },
    });

    // Create payroll run
    const payrollRun = await prisma.payrollRun.create({
      data: {
        period,
        companyId,
        status: 'DRAFT',
      },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    // Create payroll items for each employee
    for (const emp of employees) {
      const baseSalary = emp.salaryHistory[0]?.baseSalary || 0;
      const commissions = emp.commissions.reduce((sum, c) => sum + c.amount, 0);
      const deductions = emp.deductions.reduce((sum, d) => sum + d.amount, 0);
      const netPay = baseSalary + commissions - deductions;

      await prisma.payrollItem.create({
        data: {
          payrollRunId: payrollRun.id,
          employeeId: emp.id,
          baseSalary,
          commissions,
          bonuses: 0,
          deductions,
          netPay,
          currency: emp.salaryHistory[0]?.currency || 'PKR',
        },
      });

      totalGross += baseSalary + commissions;
      totalDeductions += deductions;
      totalNet += netPay;
    }

    // Update totals
    const updatedRun = await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: { totalGross, totalDeductions, totalNet },
      include: { company: true, items: { include: { employee: true } } },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'payroll_runs',
        recordId: payrollRun.id,
        action: 'CREATE',
        module: 'PAYROLL',
        newValues: { period, companyId, employeeCount: employees.length, totalNet },
      },
    });

    return NextResponse.json(updatedRun, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payroll run:', error);
    return NextResponse.json(
      { error: 'Failed to create payroll run', details: error?.message },
      { status: 500 }
    );
  }
}

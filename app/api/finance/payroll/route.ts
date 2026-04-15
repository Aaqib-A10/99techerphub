import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { toMinor, toMajor } from '@/lib/currency';

export async function GET() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const period = data.period; // e.g., "2026-03"
    const companyId = data.companyId ? parseInt(data.companyId) : null;

    const result = await prisma.$transaction(async (tx) => {
      // Check if payroll already exists for this period
      const existing = await tx.payrollRun.findFirst({
        where: { period, companyId },
      });
      if (existing) {
        throw new Error(`Payroll run already exists for ${period}`);
      }

      // Get all active employees (optionally filtered by company)
      const where: any = { isActive: true };
      if (companyId) where.companyId = companyId;

      const employees = await tx.employee.findMany({
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
      const payrollRun = await tx.payrollRun.create({
        data: {
          period,
          companyId,
          status: 'DRAFT',
        },
      });

      // Use integer minor-unit arithmetic to avoid floating-point rounding errors
      let totalGrossMinor = 0;
      let totalDeductionsMinor = 0;
      let totalNetMinor = 0;

      // Create payroll items for each employee
      for (const emp of employees) {
        const baseSalaryMinor = toMinor(emp.salaryHistory[0]?.baseSalary);
        const commissionsMinor = emp.commissions.reduce((sum, c) => sum + toMinor(c.amount), 0);
        const deductionsMinor = emp.deductions.reduce((sum, d) => sum + toMinor(d.amount), 0);
        const netPayMinor = baseSalaryMinor + commissionsMinor - deductionsMinor;

        await tx.payrollItem.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: emp.id,
            baseSalary: toMajor(baseSalaryMinor),
            commissions: toMajor(commissionsMinor),
            bonuses: 0,
            deductions: toMajor(deductionsMinor),
            netPay: toMajor(netPayMinor),
            currency: emp.salaryHistory[0]?.currency || 'PKR',
          },
        });

        totalGrossMinor += baseSalaryMinor + commissionsMinor;
        totalDeductionsMinor += deductionsMinor;
        totalNetMinor += netPayMinor;
      }

      const totalGross = toMajor(totalGrossMinor);
      const totalDeductions = toMajor(totalDeductionsMinor);
      const totalNet = toMajor(totalNetMinor);

      // Update totals
      const updatedRun = await tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { totalGross, totalDeductions, totalNet },
        include: { company: true, items: { include: { employee: true } } },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'payroll_runs',
          recordId: payrollRun.id,
          action: 'CREATE',
          module: 'PAYROLL',
          newValues: { period, companyId, employeeCount: employees.length, totalNet },
        },
      });

      return updatedRun;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payroll run:', error);
    if (error.message?.startsWith('Payroll run already exists')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create payroll run' },
      { status: 500 }
    );
  }
}

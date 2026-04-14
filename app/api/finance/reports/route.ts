import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reports = await prisma.monthlyReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const period = data.period; // YYYY-MM
    const companyId = data.companyId ? parseInt(data.companyId) : null;

    // Generate summary data
    const periodStart = new Date(`${period}-01`);
    const nextMonth = new Date(periodStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const companyFilter = companyId ? { companyId } : {};

    const [
      totalExpenses,
      approvedExpenses,
      pendingExpenses,
      payrollRun,
      headcount,
      newHires,
      assetCount,
    ] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...companyFilter, expenseDate: { gte: periodStart, lt: nextMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { ...companyFilter, status: 'APPROVED', expenseDate: { gte: periodStart, lt: nextMonth } },
        _sum: { amount: true },
      }),
      prisma.expense.count({
        where: { ...companyFilter, status: 'PENDING', expenseDate: { gte: periodStart, lt: nextMonth } },
      }),
      prisma.payrollRun.findFirst({
        where: { period, ...(companyId ? { companyId } : {}) },
        include: { items: true },
      }),
      prisma.employee.count({ where: { isActive: true, ...companyFilter } }),
      prisma.employee.count({
        where: { ...companyFilter, dateOfJoining: { gte: periodStart, lt: nextMonth } },
      }),
      prisma.asset.count({ where: { isRetired: false, ...companyFilter } }),
    ]);

    const summary = {
      totalExpenseAmount: totalExpenses._sum.amount || 0,
      totalExpenseCount: totalExpenses._count || 0,
      approvedExpenseAmount: approvedExpenses._sum.amount || 0,
      pendingExpenses,
      payrollGross: payrollRun?.totalGross || 0,
      payrollNet: payrollRun?.totalNet || 0,
      payrollDeductions: payrollRun?.totalDeductions || 0,
      payrollEmployees: payrollRun?.items?.length || 0,
      headcount,
      newHires,
      totalAssets: assetCount,
    };

    const report = await prisma.monthlyReport.create({
      data: {
        period,
        companyId,
        title: `Monthly Report - ${period}${companyId ? '' : ' (All Companies)'}`,
        status: 'DRAFT',
        summary,
        generatedBy: 1,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'monthly_reports',
        recordId: report.id,
        action: 'CREATE',
        module: 'FINANCE',
        newValues: report,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

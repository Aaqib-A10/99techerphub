import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.monthlyReport.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.monthlyReport.count(),
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
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
      exits,
      assetCount,
      newAssets,
    ] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...companyFilter, expenseDate: { gte: periodStart, lt: nextMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          ...companyFilter,
          status: 'APPROVED',
          expenseDate: { gte: periodStart, lt: nextMonth },
        },
        _sum: { amount: true },
      }),
      prisma.expense.count({
        where: {
          ...companyFilter,
          status: 'PENDING',
          expenseDate: { gte: periodStart, lt: nextMonth },
        },
      }),
      prisma.payrollRun.findFirst({
        where: { period, ...(companyId ? { companyId } : {}) },
        include: { items: true },
      }),
      prisma.employee.count({ where: { isActive: true, ...companyFilter } }),
      prisma.employee.count({
        where: { ...companyFilter, dateOfJoining: { gte: periodStart, lt: nextMonth } },
      }),
      prisma.employeeExit.count({
        where: {
          employee: companyId ? { companyId } : {},
          exitDate: { gte: periodStart, lt: nextMonth },
        },
      }),
      prisma.asset.count({ where: { isRetired: false, ...companyFilter } }),
      prisma.asset.count({
        where: {
          ...companyFilter,
          createdAt: { gte: periodStart, lt: nextMonth },
        },
      }),
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
      exits,
      totalAssets: assetCount,
      newAssets,
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
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { reportId, action, notes } = data;

    const updateData: any = {};

    if (action === 'submit_review') {
      updateData.status = 'UNDER_REVIEW';
      updateData.reviewedBy = 1;
    } else if (action === 'send') {
      updateData.status = 'SENT';
      updateData.sentAt = new Date();
    } else if (action === 'acknowledge') {
      updateData.status = 'ACKNOWLEDGED';
      updateData.acknowledgedAt = new Date();
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (notes) updateData.notes = notes;

    const report = await prisma.monthlyReport.update({
      where: { id: parseInt(reportId) },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'monthly_reports',
        recordId: report.id,
        action: 'UPDATE',
        module: 'FINANCE',
        newValues: report,
      },
    });

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

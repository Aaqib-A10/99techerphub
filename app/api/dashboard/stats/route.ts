import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // ==========================================
    // ZONE 1: ASSET HEALTH
    // ==========================================
    const [
      totalAssets,
      assignedAssets,
      unassignedAssets,
      assetsByCategory,
      assetsByCondition,
      assetsByCompany,
      assetsNearWarrantyExpiry,
      damagedAssets,
      lostAssets,
      longUnassigned,
    ] = await Promise.all([
      prisma.asset.count({ where: { isRetired: false } }),
      prisma.asset.count({ where: { isAssigned: true, isRetired: false } }),
      prisma.asset.count({ where: { isAssigned: false, isRetired: false } }),
      prisma.asset.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        where: { isRetired: false },
      }),
      prisma.asset.groupBy({
        by: ['condition'],
        _count: { id: true },
        where: { isRetired: false },
      }),
      prisma.asset.groupBy({
        by: ['companyId'],
        _count: { id: true },
        where: { isRetired: false },
      }),
      prisma.asset.count({
        where: {
          isRetired: false,
          warrantyExpiry: {
            lte: in30Days,
            gte: now,
          },
        },
      }),
      prisma.asset.count({
        where: { condition: 'DAMAGED', isRetired: false },
      }),
      prisma.asset.count({
        where: { condition: 'LOST', isRetired: false },
      }),
      prisma.asset.count({
        where: {
          isAssigned: false,
          isRetired: false,
          updatedAt: { lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // ==========================================
    // ZONE 2: WORKFORCE INSIGHTS
    // ==========================================
    const [
      totalEmployees,
      activeEmployees,
      permanentEmployees,
      probationEmployees,
      consultantEmployees,
      employeesByDept,
      upcomingBirthdaysCount,
      upcomingAnniversariesCount,
      probationEndingCount,
      newHiresThisMonth,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { isActive: true } }),
      prisma.employee.count({
        where: { employmentStatus: 'PERMANENT', isActive: true },
      }),
      prisma.employee.count({
        where: { employmentStatus: 'PROBATION', isActive: true },
      }),
      prisma.employee.count({
        where: { employmentStatus: 'CONSULTANT', isActive: true },
      }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        _count: { id: true },
        where: { isActive: true },
      }),
      prisma.employee.count({
        where: {
          isActive: true,
          dateOfBirth: { not: null },
        },
      }),
      prisma.employee.count({
        where: {
          isActive: true,
        },
      }),
      prisma.employee.count({
        where: {
          isActive: true,
          employmentStatus: 'PROBATION',
          probationEndDate: { gte: now, lte: in30Days },
        },
      }),
      // New hires — strictly employees who joined within the last 30 days
      prisma.employee.count({
        where: {
          dateOfJoining: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: now,
          },
        },
      }),
    ]);

    // ==========================================
    // ZONE 3: EXPENSE & PAYROLL ANALYTICS
    // ==========================================
    const [
      totalApprovedExpenses,
      monthlyApprovedExpenses,
      lastMonthApprovedExpenses,
      pendingExpensesCount,
      approvedExpensesCount,
      expensesByCategory,
      topExpensesByCategory,
      latestPayrollRun,
      totalPayroll,
      payrollRunCount,
    ] = await Promise.all([
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { status: 'APPROVED' },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          status: 'APPROVED',
          createdAt: {
            gte: currentMonth,
            lt: nextMonth,
          },
        },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          status: 'APPROVED',
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: currentMonth,
          },
        },
      }),
      prisma.expense.count({ where: { status: 'PENDING' } }),
      prisma.expense.count({ where: { status: 'APPROVED' } }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        _sum: { amount: true },
        where: { status: 'APPROVED' },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      prisma.payrollRun.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { company: true },
      }),
      prisma.payrollRun.aggregate({
        _sum: { totalNet: true },
      }),
      prisma.payrollRun.count(),
    ]);

    // ==========================================
    // ZONE 4: REPORTING STATUS
    // ==========================================
    const latestReport = await prisma.monthlyReport.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // ==========================================
    // ZONE 5: ACTIVITY FEED
    // ==========================================
    const recentActivityCount = await prisma.auditLog.count();

    // Return comprehensive dashboard stats
    return NextResponse.json({
      // Asset Health
      assetHealth: {
        totalAssets,
        assignedAssets,
        unassignedAssets,
        assetsByCategory,
        assetsByCondition,
        assetsByCompany,
        assetsNearWarrantyExpiry,
        damagedAssets,
        lostAssets,
        longUnassigned,
      },

      // Workforce
      workforce: {
        totalEmployees,
        activeEmployees,
        permanentEmployees,
        probationEmployees,
        consultantEmployees,
        employeesByDept,
        upcomingBirthdaysCount,
        upcomingAnniversariesCount,
        probationEndingCount,
        newHiresThisMonth,
      },

      // Expense & Payroll
      finance: {
        totalApprovedExpenses: totalApprovedExpenses._sum.amount || 0,
        monthlyApprovedExpenses: monthlyApprovedExpenses._sum.amount || 0,
        lastMonthApprovedExpenses: lastMonthApprovedExpenses._sum.amount || 0,
        pendingExpensesCount,
        approvedExpensesCount,
        expensesByCategory,
        topExpensesByCategory: topExpensesByCategory.slice(0, 5),
        latestPayrollRun,
        totalPayroll: totalPayroll._sum.totalNet || 0,
        payrollRunCount,
      },

      // Reporting
      reporting: {
        latestReport,
      },

      // Activity
      activity: {
        recentActivityCount,
      },

      // Metadata
      metadata: {
        timestamp: now.toISOString(),
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', details: String(error) },
      { status: 500 }
    );
  }
}


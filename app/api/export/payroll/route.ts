import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exportToCSV, exportToHTML } from '@/lib/services/exportService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period'); // Format: YYYY-MM
    const format = searchParams.get('format') || 'csv'; // csv or html

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Invalid period format (use YYYY-MM)' }, { status: 400 });
    }

    if (!['csv', 'html'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format (csv or html)' }, { status: 400 });
    }

    // Parse period
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Fetch payroll run and items
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        company: true,
        items: {
          include: {
            employee: {
              include: { department: true },
            },
          },
        },
      },
    });

    if (!payrollRun) {
      return NextResponse.json({ error: 'No payroll data found for this period' }, { status: 404 });
    }

    // Format data for export
    const rows = payrollRun.items.map((item) => ({
      empCode: item.employee.empCode,
      firstName: item.employee.firstName,
      lastName: item.employee.lastName,
      department: item.employee.department.name,
      designation: item.employee.designation,
      baseSalary: item.baseSalary?.toFixed(2) || '0.00',
      commissions: item.commissions?.toFixed(2) || '0.00',
      bonuses: item.bonuses?.toFixed(2) || '0.00',
      deductions: item.deductions?.toFixed(2) || '0.00',
      netPay: item.netPay?.toFixed(2) || '0.00',
    }));

    const columns = [
      { key: 'empCode', label: 'Employee Code' },
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'baseSalary', label: 'Base Salary' },
      { key: 'commissions', label: 'Commissions' },
      { key: 'bonuses', label: 'Bonuses' },
      { key: 'deductions', label: 'Deductions' },
      { key: 'netPay', label: 'Net Pay' },
    ];

    if (format === 'csv') {
      const csv = exportToCSV(rows, columns);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payroll-${period}.csv"`,
        },
      });
    } else {
      const html = exportToHTML(`Payroll Report - ${period}`, rows, columns);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="payroll-${period}.html"`,
        },
      });
    }
  } catch (error) {
    console.error('Payroll export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

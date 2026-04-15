import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotificationsForRole } from '@/lib/services/notificationService';
import { getSessionUser } from '@/lib/auth';
import { parseCurrency } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const meta = searchParams.get('meta');

    if (meta === 'true') {
      const [categories, companies, employees, departments] = await Promise.all([
        prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.employee.findMany({
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true, empCode: true },
          orderBy: { firstName: 'asc' },
        }),
        prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      ]);
      return NextResponse.json({ categories, companies, employees, departments });
    }

    const expenses = await prisma.expense.findMany({
      include: {
        category: true,
        company: true,
        submittedBy: true,
        department: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Generate expense number with advisory lock to prevent race conditions
    const expenseNumber = await prisma.$transaction(async (tx) => {
      // Advisory lock to serialize expense number generation
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(99001)`;

      const now = new Date();
      const prefix = `EXP-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const latest = await tx.expense.findFirst({
        where: { expenseNumber: { startsWith: prefix } },
        orderBy: { expenseNumber: 'desc' },
        select: { expenseNumber: true },
      });

      let nextSeq = 1;
      if (latest?.expenseNumber) {
        const parts = latest.expenseNumber.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }

      return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
    });

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId: parseInt(data.categoryId),
        companyId: parseInt(data.companyId),
        departmentId: data.departmentId ? parseInt(data.departmentId) : null,
        submittedById: parseInt(data.submittedById),
        amount: parseCurrency(data.amount),
        currency: data.currency || 'PKR',
        description: data.description,
        vendor: data.vendor || null,
        expenseDate: new Date(data.expenseDate),
        paymentMethod: data.paymentMethod || null,
        invoiceNumber: data.invoiceNumber || null,
        receiptUrl: data.receiptUrl || null,
        status: 'PENDING',
      },
    });

    // Notify every Finance + Super Admin user about the new pending expense
    try {
      const submitter = await prisma.employee.findUnique({
        where: { id: parseInt(data.submittedById) },
        select: { firstName: true, lastName: true },
      });
      const submitterName = submitter
        ? `${submitter.firstName} ${submitter.lastName}`
        : 'Someone';
      const title = `New Expense Awaiting Approval`;
      const message = `${submitterName} submitted ${expenseNumber} for ${data.currency || 'PKR'} ${Number(data.amount).toLocaleString()}`;
      const link = `/expenses/${expense.id}`;

      await createNotificationsForRole('ACCOUNTANT', {
        type: 'EXPENSE_SUBMITTED',
        title,
        message,
        link,
      });
      await createNotificationsForRole('ADMIN', {
        type: 'EXPENSE_SUBMITTED',
        title,
        message,
        link,
      });
    } catch (err) {
      console.warn('[expenses/POST] failed to create notifications:', err);
    }

    await prisma.auditLog.create({
      data: {
        tableName: 'expenses',
        recordId: expense.id,
        action: 'CREATE',
        module: 'EXPENSE',
        newValues: expense,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}

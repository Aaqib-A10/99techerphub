import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        category: true,
        company: true,
        submittedBy: true,
        approvals: {
          include: { approvedBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Remove dependent rows first (approvals) to avoid FK violations
    await prisma.expenseApproval.deleteMany({ where: { expenseId: id } }).catch(() => {});
    await prisma.expense.delete({ where: { id } });

    await prisma.auditLog
      .create({
        data: {
          tableName: 'expenses',
          recordId: id,
          action: 'DELETE',
          module: 'EXPENSE',
          oldValues: existing,
        },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense', details: error?.message },
      { status: 500 }
    );
  }
}

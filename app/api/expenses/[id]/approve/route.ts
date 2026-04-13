import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';
import { NotificationType } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expenseId = parseInt(params.id);
    const data = await request.json();
    const action = data.action; // APPROVED, REJECTED, NEEDS_REVISION

    // For now, use approvedById = 1 (admin user placeholder)
    // In production, this would come from the auth session
    const approvedById = 1;

    // Create approval record
    const approval = await prisma.expenseApproval.create({
      data: {
        expenseId,
        approvedById,
        action,
        comments: data.comments || null,
      },
    });

    // Update expense status
    const updateData: any = {
      status: action === 'NEEDS_REVISION' ? 'NEEDS_REVISION' : action,
    };

    if (action === 'REJECTED') {
      updateData.rejectionReason = data.comments || 'No reason provided';
    }
    if (action === 'NEEDS_REVISION') {
      updateData.revisionNotes = data.comments || null;
    }

    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        submittedBy: {
          include: { user: true },
        },
      },
    });

    // Notify the submitter via their linked User account
    try {
      const submitterUserId = updatedExpense.submittedBy.user?.id;
      if (submitterUserId) {
        const typeMap: Record<string, NotificationType> = {
          APPROVED: 'EXPENSE_APPROVED',
          REJECTED: 'EXPENSE_REJECTED',
          NEEDS_REVISION: 'EXPENSE_REVISION',
        };
        const titleMap: Record<string, string> = {
          APPROVED: 'Expense Approved',
          REJECTED: 'Expense Rejected',
          NEEDS_REVISION: 'Expense Needs Revision',
        };
        const verbMap: Record<string, string> = {
          APPROVED: 'was approved',
          REJECTED: 'was rejected',
          NEEDS_REVISION: 'needs revision',
        };

        const message = data.comments
          ? `${updatedExpense.expenseNumber} (${updatedExpense.currency} ${updatedExpense.amount.toLocaleString()}) ${verbMap[action]}. Note: ${data.comments}`
          : `${updatedExpense.expenseNumber} (${updatedExpense.currency} ${updatedExpense.amount.toLocaleString()}) ${verbMap[action]}.`;

        await createNotification({
          userId: submitterUserId,
          type: typeMap[action] || 'GENERAL',
          title: titleMap[action] || 'Expense Updated',
          message,
          link: `/expenses/${expenseId}`,
        });
      }
    } catch (err) {
      console.warn('[expenses/approve] failed to notify submitter:', err);
    }

    await prisma.auditLog.create({
      data: {
        tableName: 'expense_approvals',
        recordId: approval.id,
        action: 'CREATE',
        module: 'EXPENSE',
        newValues: { expenseId, action, comments: data.comments },
      },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error: any) {
    console.error('Error approving expense:', error);
    return NextResponse.json(
      { error: 'Failed to process approval', details: error?.message },
      { status: 500 }
    );
  }
}

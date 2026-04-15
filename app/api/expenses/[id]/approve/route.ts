import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';
import { NotificationType } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expenseId = parseInt(params.id);
    const data = await request.json();
    const action = data.action; // APPROVED, REJECTED, NEEDS_REVISION

    const approvedById = currentUser.id;

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

    // Wrap approval creation, expense update, and audit log in a transaction
    const { approval, updatedExpense } = await prisma.$transaction(async (tx) => {
      const approvalRecord = await tx.expenseApproval.create({
        data: {
          expenseId,
          approvedById,
          action,
          comments: data.comments || null,
        },
      });

      const expense = await tx.expense.update({
        where: { id: expenseId },
        data: updateData,
        include: {
          submittedBy: {
            include: { user: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'expense_approvals',
          recordId: approvalRecord.id,
          action: 'CREATE',
          module: 'EXPENSE',
          newValues: { expenseId, action, comments: data.comments },
        },
      });

      return { approval: approvalRecord, updatedExpense: expense };
    });

    // Notify the submitter via their linked User account (outside transaction)
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
          ? `${updatedExpense.expenseNumber} (${updatedExpense.currency} ${Number(updatedExpense.amount).toLocaleString()}) ${verbMap[action]}. Note: ${data.comments}`
          : `${updatedExpense.expenseNumber} (${updatedExpense.currency} ${Number(updatedExpense.amount).toLocaleString()}) ${verbMap[action]}.`;

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

    return NextResponse.json(approval, { status: 201 });
  } catch (error: any) {
    console.error('Error approving expense:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}

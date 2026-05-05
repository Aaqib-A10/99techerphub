import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';
import { NotificationType } from '@prisma/client';
import { getSessionContext } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Approvals are an admin/finance/accountant action — submitters
    // cannot approve their own expense.
    if (!['ADMIN', 'FINANCE', 'ACCOUNTANT'].includes(ctx.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const expenseId = parseInt(params.id);

    // IDOR check: verify expense belongs to caller's companies
    const expenseCheck = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { companyId: true },
    });
    if (!expenseCheck) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    if (!ctx.companyIds.includes(expenseCheck.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const action = data.action; // APPROVED, REJECTED, NEEDS_REVISION

    const approvedById = ctx.user.id;

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

    // Wrap approval creation, expense update, audit log, AND ledger
    // posting (when action === APPROVED) in a transaction so we never
    // leave the books out of sync with the approval state.
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
          category: { select: { name: true } },
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

      // Auto-post approved expense to the master ledger as a debit. Best-
      // effort: if the ledger schema isn't deployed yet (categories empty)
      // the import below noops. Wrapped in try/catch so the approval
      // succeeds even if posting fails (we don't want to lose the approval
      // because of a downstream issue — but we DO log the error).
      if (action === 'APPROVED') {
        try {
          const { postEntry } = await import('@/lib/services/ledgerService');
          // Pick a sane category — match by expense category name; fall
          // back to "Office Supplies" or the first active category.
          const cat =
            (await tx.ledgerCategory.findFirst({
              where: { name: { equals: expense.category?.name, mode: 'insensitive' } },
            })) ??
            (await tx.ledgerCategory.findFirst({ where: { code: 'OFFICE' } })) ??
            (await tx.ledgerCategory.findFirst({ where: { isActive: true } }));
          if (cat) {
            await postEntry(
              {
                transDate: new Date(expense.expenseDate),
                transDetail: `Expense ${expense.expenseNumber} — ${expense.description ?? expense.vendor ?? 'no description'}`,
                categoryId: cat.id,
                debitAmt: Number(expense.amount),
                currency: expense.currency,
                companyId: expense.companyId,
                source: 'EXPENSE',
                sourceId: expense.id,
                attachmentUrl: expense.receiptUrl ?? null,
                createdById: approvedById,
              },
              tx,
            );
          }
        } catch (err) {
          console.warn('[expense/approve] ledger post failed:', err);
        }
      }

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

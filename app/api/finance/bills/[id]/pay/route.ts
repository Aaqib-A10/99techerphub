import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { LedgerError, postEntry } from '@/lib/services/ledgerService';

const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

// POST /api/finance/bills/[id]/pay  { paidDate?: ISO }
// Marks the bill PAID and posts a debit ledger entry in one transaction.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const paidDate = body?.paidDate ? new Date(body.paidDate) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id } });
      if (!bill) throw new LedgerError('Bill not found.');
      if (bill.status === 'PAID') throw new LedgerError('Bill already paid.');
      if (bill.status === 'CANCELLED') throw new LedgerError('Bill is cancelled.');

      const entry = await postEntry(
        {
          transDate: paidDate,
          transDetail: `${bill.vendorName} — ${bill.billNumber}`,
          categoryId: bill.categoryId,
          debitAmt: Number(bill.amount),
          currency: bill.currency,
          companyId: bill.companyId,
          source: 'BILL',
          sourceId: bill.id,
          attachmentUrl: bill.attachmentUrl,
          attachmentMeta: bill.attachmentMeta,
          createdById: user.id,
        },
        tx,
      );

      const updated = await tx.bill.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: paidDate,
          ledgerEntryId: entry.id,
        },
      });
      return { bill: updated, ledger: entry };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[bills/pay]', e);
    return NextResponse.json({ error: 'Failed to mark paid' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { LedgerError, postEntry } from '@/lib/services/ledgerService';

const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

// POST /api/finance/ledger/manual
//
// Direct ledger insert — for one-off corrections that don't fit the
// Bill / Cheque / OPEX flows. Same image hard-stop as cash-out OPEX
// because we can't otherwise prove the entry is legitimate.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const transDate = body?.transDate ? new Date(body.transDate) : null;
  const transDetail = (body?.transDetail || '').toString().trim();
  const categoryId = parseInt(body?.categoryId);
  const creditAmt = parseFloat(body?.creditAmt ?? '0');
  const debitAmt = parseFloat(body?.debitAmt ?? '0');
  const attachmentUrl = (body?.attachmentUrl || '').toString();

  if (!transDate || isNaN(transDate.getTime())) {
    return NextResponse.json({ error: 'transDate is required' }, { status: 400 });
  }
  if (!transDetail) {
    return NextResponse.json({ error: 'transDetail is required' }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }
  // Server validates the credit/debit XOR but we do a quick check here
  // so the user gets a friendlier message than the service-level error.
  if ((creditAmt > 0 && debitAmt > 0) || (creditAmt === 0 && debitAmt === 0)) {
    return NextResponse.json(
      { error: 'Enter exactly one of credit or debit (and > 0).' },
      { status: 400 },
    );
  }

  try {
    const entry = await prisma.$transaction(async (tx) =>
      postEntry(
        {
          transDate,
          transDetail,
          categoryId,
          creditAmt,
          debitAmt,
          currency: 'PKR',
          companyId: body?.companyId ? parseInt(body.companyId) : null,
          source: 'MANUAL',
          sourceId: null,
          attachmentUrl: attachmentUrl || null,
          attachmentMeta: body?.attachmentMeta,
          createdById: user.id,
        },
        tx,
      ),
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (e: any) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[ledger/manual]', e);
    return NextResponse.json({ error: 'Failed to post entry' }, { status: 500 });
  }
}

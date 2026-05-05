import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { LedgerError, postEntry } from '@/lib/services/ledgerService';

const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

// POST /api/finance/cheques/[id]/clear  { clearedDate?: ISO }
// Marks cheque CLEARED and posts a credit (RECEIVED) or debit (ISSUED)
// to the ledger in one transaction.
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
  const clearedDate = body?.clearedDate ? new Date(body.clearedDate) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ch = await tx.cheque.findUnique({ where: { id } });
      if (!ch) throw new LedgerError('Cheque not found.');
      if (ch.status === 'CLEARED') throw new LedgerError('Cheque already cleared.');
      if (ch.status === 'CANCELLED') throw new LedgerError('Cheque is cancelled.');

      const isCredit = ch.direction === 'RECEIVED';
      const entry = await postEntry(
        {
          transDate: clearedDate,
          transDetail: `${ch.bankName} ${ch.instrumentNo} — ${
            isCredit ? 'received from' : 'paid to'
          } ${ch.partyName}`,
          // Pick a reasonable category by direction; admins can recategorise
          // via reversing entry if needed.
          categoryId: await pickDefaultCategory(tx, isCredit ? 'CASH_INJ' : 'OPEX_SAL'),
          creditAmt: isCredit ? Number(ch.amount) : 0,
          debitAmt: isCredit ? 0 : Number(ch.amount),
          currency: ch.currency,
          companyId: ch.companyId,
          source: 'CHEQUE',
          sourceId: ch.id,
          attachmentUrl: ch.attachmentUrl,
          attachmentMeta: ch.attachmentMeta,
          createdById: user.id,
        },
        tx,
      );

      const updated = await tx.cheque.update({
        where: { id },
        data: {
          status: 'CLEARED',
          clearedAt: clearedDate,
          ledgerEntryId: entry.id,
        },
      });
      return { cheque: updated, ledger: entry };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[cheques/clear]', e);
    return NextResponse.json({ error: 'Failed to mark cleared' }, { status: 500 });
  }
}

async function pickDefaultCategory(
  tx: any,
  preferredCode: string,
): Promise<number> {
  const cat =
    (await tx.ledgerCategory.findUnique({ where: { code: preferredCode } })) ??
    (await tx.ledgerCategory.findFirst({ orderBy: { sortOrder: 'asc' } }));
  if (!cat) throw new LedgerError('No ledger category seeded — run prisma/seed-ledger.js.');
  return cat.id;
}

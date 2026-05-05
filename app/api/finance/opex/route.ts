import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { LedgerError, postEntry } from '@/lib/services/ledgerService';

const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER'];
const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!FINANCE_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const where: any = {};
  if (type) where.type = type;

  const entries = await prisma.opexEntry.findMany({
    where,
    orderBy: { paidAt: 'desc' },
    include: {
      category: { select: { id: true, code: true, name: true } },
      company: { select: { id: true, name: true, code: true } },
      ledgerEntry: { select: { id: true, serialNo: true, runningBal: true } },
    },
  });
  return NextResponse.json(entries);
}

// POST — recurring outflow. Always cash-out, posts to ledger immediately.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const type = body?.type;
  const recipient = (body?.recipient || '').toString().trim();
  const amount = parseFloat(body?.amount);
  const categoryId = parseInt(body?.categoryId);
  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
  const attachmentUrl = (body?.attachmentUrl || '').toString();

  if (!['RENTAL', 'MAINTENANCE', 'DONATION', 'SALARY', 'UTILITY', 'OTHER'].includes(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }
  if (!recipient) return NextResponse.json({ error: 'recipient is required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }
  if (!attachmentUrl) {
    return NextResponse.json(
      { error: 'A receipt/voucher is required (image hard-stop).' },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const opex = await tx.opexEntry.create({
        data: {
          type,
          recipient,
          period: body?.period ?? null,
          amount: amount.toFixed(2),
          currency: body?.currency || 'PKR',
          categoryId,
          companyId: body?.companyId ? parseInt(body.companyId) : null,
          description: body?.description ?? null,
          attachmentUrl,
          attachmentMeta: body?.attachmentMeta ?? undefined,
          paidAt,
          createdById: user.id,
        },
      });
      const entry = await postEntry(
        {
          transDate: paidAt,
          transDetail: `${type.charAt(0)}${type.slice(1).toLowerCase()} — ${recipient}${
            body?.period ? ` (${body.period})` : ''
          }`,
          categoryId,
          debitAmt: amount,
          currency: body?.currency || 'PKR',
          companyId: body?.companyId ? parseInt(body.companyId) : null,
          source: 'OPEX',
          sourceId: opex.id,
          attachmentUrl,
          attachmentMeta: body?.attachmentMeta ?? undefined,
          createdById: user.id,
        },
        tx,
      );
      const updated = await tx.opexEntry.update({
        where: { id: opex.id },
        data: { ledgerEntryId: entry.id },
      });
      return { opex: updated, ledger: entry };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[opex/POST]', e);
    return NextResponse.json({ error: 'Failed to post OPEX entry' }, { status: 500 });
  }
}

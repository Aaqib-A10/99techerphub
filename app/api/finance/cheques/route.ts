import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER'];
const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!FINANCE_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const direction = searchParams.get('direction');
  const where: any = {};
  if (status) where.status = status;
  if (direction) where.direction = direction;

  const cheques = await prisma.cheque.findMany({
    where,
    orderBy: [{ status: 'asc' }, { chequeDate: 'desc' }],
    include: {
      company: { select: { id: true, name: true, code: true } },
      ledgerEntry: { select: { id: true, serialNo: true } },
    },
  });
  return NextResponse.json(cheques);
}

// POST — create a new cheque record. Cheques don't post to the ledger
// until status flips CLEARED via /api/finance/cheques/[id]/clear.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const instrumentNo = (body?.instrumentNo || '').toString().trim();
  const bankName = (body?.bankName || '').toString().trim();
  const partyName = (body?.partyName || '').toString().trim();
  const amount = parseFloat(body?.amount);
  const chequeDate = body?.chequeDate ? new Date(body.chequeDate) : null;
  const direction = body?.direction;
  const attachmentUrl = (body?.attachmentUrl || '').toString();

  if (!instrumentNo) return NextResponse.json({ error: 'instrumentNo is required' }, { status: 400 });
  if (!bankName) return NextResponse.json({ error: 'bankName is required' }, { status: 400 });
  if (!partyName) return NextResponse.json({ error: 'partyName is required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
  }
  if (!chequeDate || isNaN(chequeDate.getTime())) {
    return NextResponse.json({ error: 'chequeDate is required' }, { status: 400 });
  }
  if (!['RECEIVED', 'ISSUED'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be RECEIVED or ISSUED' }, { status: 400 });
  }
  if (!attachmentUrl) {
    return NextResponse.json(
      { error: 'A cheque scan/photo is required (image hard-stop).' },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.cheque.create({
      data: {
        instrumentNo,
        bankName,
        partyName,
        chequeDate,
        amount: amount.toFixed(2),
        currency: body?.currency || 'PKR',
        direction,
        companyId: body?.companyId ? parseInt(body.companyId) : null,
        description: body?.description ?? null,
        attachmentUrl,
        attachmentMeta: body?.attachmentMeta ?? undefined,
        createdById: user.id,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A cheque with that instrument number on that bank already exists.' },
        { status: 409 },
      );
    }
    console.error('[cheques/POST]', e);
    return NextResponse.json({ error: 'Failed to create cheque' }, { status: 500 });
  }
}

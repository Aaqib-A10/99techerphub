import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { LedgerError, postReversingEntry } from '@/lib/services/ledgerService';

const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

// POST /api/finance/ledger/[id]/reverse  { reason: string }
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
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  try {
    const result = await prisma.$transaction(async (tx) =>
      postReversingEntry(id, reason, user.id, tx),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[ledger/reverse]', e);
    return NextResponse.json(
      { error: 'Failed to post reversal' },
      { status: 500 },
    );
  }
}

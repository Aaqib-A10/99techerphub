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
  const where: any = {};
  if (status) where.status = status;

  const bills = await prisma.bill.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    include: {
      category: { select: { id: true, code: true, name: true } },
      company: { select: { id: true, name: true, code: true } },
      ledgerEntry: { select: { id: true, serialNo: true } },
    },
  });
  return NextResponse.json(bills);
}

// POST — create a new bill. Requires attachmentUrl (image hard-stop on
// Bills per the spec). Bills don't post to the ledger until status flips
// PAID via /api/finance/bills/[id]/pay.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const billNumber = (body?.billNumber || '').toString().trim();
  const vendorName = (body?.vendorName || '').toString().trim();
  const amount = parseFloat(body?.amount);
  const billDate = body?.billDate ? new Date(body.billDate) : null;
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  const categoryId = parseInt(body?.categoryId);
  const attachmentUrl = (body?.attachmentUrl || '').toString();

  if (!billNumber) return NextResponse.json({ error: 'billNumber is required' }, { status: 400 });
  if (!vendorName) return NextResponse.json({ error: 'vendorName is required' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
  }
  if (!billDate || isNaN(billDate.getTime())) {
    return NextResponse.json({ error: 'billDate is required' }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }
  if (!attachmentUrl) {
    return NextResponse.json(
      { error: 'A bill scan/photo is required (image hard-stop).' },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.bill.create({
      data: {
        billNumber,
        vendorName,
        vendorContact: body?.vendorContact ?? null,
        amount: amount.toFixed(2),
        currency: body?.currency || 'PKR',
        billDate,
        dueDate,
        categoryId,
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
        { error: 'A bill with that bill number already exists.' },
        { status: 409 },
      );
    }
    console.error('[bills/POST]', e);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}

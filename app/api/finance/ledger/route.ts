import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER'];

// GET /api/finance/ledger
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD     date range (transDate)
//   ?category=<id>                      filter by category
//   ?source=BILL|CHEQUE|OPEX|...        filter by source
//   ?company=<id>                       filter by company
//   ?q=                                 free-text search on transDetail/serialNo
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!FINANCE_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const categoryParam = searchParams.get('category');
  const sourceParam = searchParams.get('source');
  const companyParam = searchParams.get('company');
  const q = (searchParams.get('q') || '').trim();

  const where: any = {};
  if (from || to) {
    where.transDate = {};
    if (from) where.transDate.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.transDate.lte = toDate;
    }
  }
  if (categoryParam) where.categoryId = parseInt(categoryParam);
  if (sourceParam) where.source = sourceParam;
  if (companyParam) where.companyId = parseInt(companyParam);
  if (q) {
    where.OR = [
      { serialNo: { contains: q, mode: 'insensitive' } },
      { transDetail: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [entries, summary] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ transDate: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true } },
      },
    }),
    prisma.ledgerEntry.aggregate({
      where,
      _sum: { creditAmt: true, debitAmt: true },
      _count: true,
    }),
  ]);

  // Most-recent runningBal across the WHOLE ledger (ignoring filters) so
  // the page can show the current cash position even when the user has
  // a date filter applied that excludes the latest entry.
  const latest = await prisma.ledgerEntry.findFirst({
    orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
    select: { runningBal: true },
  });

  return NextResponse.json({
    entries,
    summary: {
      count: summary._count,
      totalCredit: Number(summary._sum.creditAmt ?? 0),
      totalDebit: Number(summary._sum.debitAmt ?? 0),
      currentBalance: Number(latest?.runningBal ?? 0),
    },
  });
}

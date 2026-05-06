import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext } from '@/lib/auth';

const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER'];

// GET /api/finance/ledger
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD     date range (transDate)
//   ?category=<id>                      filter by category
//   ?source=BILL|CHEQUE|OPEX|...        filter by source
//   ?company=<id>                       filter by company (intersected with caller's scope)
//   ?q=                                 free-text search on transDetail/serialNo
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!FINANCE_ROLES.includes(ctx.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const categoryParam = searchParams.get('category');
  const sourceParam = searchParams.get('source');
  const requestedCompany = searchParams.get('company');
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
  if (q) {
    where.OR = [
      { serialNo: { contains: q, mode: 'insensitive' } },
      { transDetail: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Company scope: ADMINs see every company. Anyone else is restricted
  // to their ctx.companyIds. A ?company= filter is INTERSECTED with the
  // allowed set — never widens. Cross-company / null-company entries
  // (like the OPENING balance) stay visible because they aren't tied
  // to a specific company.
  if (ctx.user.role !== 'ADMIN') {
    if (requestedCompany) {
      const requested = parseInt(requestedCompany);
      if (!ctx.companyIds.includes(requested)) {
        // Asked for a company they can't see → return empty.
        return NextResponse.json({
          entries: [],
          summary: { count: 0, totalCredit: 0, totalDebit: 0, currentBalance: 0 },
        });
      }
      where.OR = [
        ...(where.OR ?? []),
        { companyId: requested },
        { companyId: null },
      ];
    } else {
      where.OR = [
        ...(where.OR ?? []),
        { companyId: { in: ctx.companyIds } },
        { companyId: null },
      ];
    }
  } else if (requestedCompany) {
    where.companyId = parseInt(requestedCompany);
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

  // Pair-injection for reversals: if an entry in the result has a
  // reversal (or IS one), pull the partner row even if the current
  // filter would have excluded it. Without this, a date or category
  // filter could show a debit while hiding its credit, making the
  // running totals look wrong.
  const knownIds = new Set(entries.map((e) => e.id));
  const partnerIds = new Set<number>();
  for (const e of entries) {
    if (e.reversesEntryId && !knownIds.has(e.reversesEntryId)) {
      partnerIds.add(e.reversesEntryId);
    }
    if (e.isReversed) {
      // Find the contra (the one that points back to this row) — may
      // also have been filtered out by date/category.
      partnerIds.add(e.id); // marker: we'll lookup contras for these
    }
  }
  if (partnerIds.size > 0) {
    const partners = await prisma.ledgerEntry.findMany({
      where: {
        OR: [
          { id: { in: Array.from(partnerIds) } },
          { reversesEntryId: { in: Array.from(partnerIds) } },
        ],
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });
    for (const p of partners) {
      if (!knownIds.has(p.id)) {
        entries.push(p);
        knownIds.add(p.id);
      }
    }
    entries.sort((a, b) => {
      const td = a.transDate.getTime() - b.transDate.getTime();
      return td !== 0 ? td : a.id - b.id;
    });
  }

  // Most-recent runningBal across the FULL ledger (ignoring filters) so
  // the page can show the current cash position even when the user has
  // a date filter applied that excludes the latest entry. Same scope
  // intersection as the main query so non-admins don't see another
  // company's closing balance.
  const latestWhere: any = {};
  if (ctx.user.role !== 'ADMIN') {
    latestWhere.OR = [
      { companyId: { in: ctx.companyIds } },
      { companyId: null },
    ];
  }
  const latest = await prisma.ledgerEntry.findFirst({
    where: latestWhere,
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

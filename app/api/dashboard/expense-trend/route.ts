import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/dashboard/expense-trend?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns approved-expense totals bucketed by month and currency.
 * Drives the Expense Trend card on the dashboard. PKR and USD are
 * always returned separately — never converted, never summed.
 *
 * Response:
 *   {
 *     range: { from: string; to: string },
 *     buckets: [
 *       { month: "2026-03", pkr: 125400, usd: 1800, count: 12 },
 *       ...
 *     ]
 *   }
 *
 * Months with no expenses still show in the array with zeros so the
 * chart's x-axis is contiguous.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const fromRaw = sp.get('from');
    const toRaw = sp.get('to');

    // Default: last 3 calendar months including the current one. The
    // user can override via ?from / ?to from the range picker.
    const now = new Date();
    let from = fromRaw
      ? new Date(fromRaw)
      : new Date(now.getFullYear(), now.getMonth() - 2, 1);
    let to = toRaw
      ? new Date(toRaw)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: 'Invalid from / to date' },
        { status: 400 },
      );
    }
    // Cap range at 3 years to keep the response small. The chart is
    // not meant for multi-year analytics.
    const threeYears = 3 * 365 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > threeYears) {
      from = new Date(to.getTime() - threeYears);
    }

    const expenses = await prisma.expense.findMany({
      where: {
        status: 'APPROVED',
        expenseDate: { gte: from, lte: to },
      },
      select: { amount: true, currency: true, expenseDate: true },
    });

    // Bucket by YYYY-MM. Pre-seed every month in the range so the
    // chart shows zero-bars for months with no spend instead of
    // collapsing to the months that happen to have data.
    const buckets = new Map<string, { pkr: number; usd: number; count: number }>();
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { pkr: 0, usd: 0, count: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const e of expenses) {
      const d = new Date(e.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const slot = buckets.get(key);
      if (!slot) continue;
      const n = Number(e.amount) || 0;
      if (e.currency === 'USD') slot.usd += n;
      else slot.pkr += n;
      slot.count += 1;
    }

    const result = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    return NextResponse.json({
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      buckets: result,
    });
  } catch (err: any) {
    console.error('[dashboard/expense-trend]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to load expense trend' },
      { status: 500 },
    );
  }
}

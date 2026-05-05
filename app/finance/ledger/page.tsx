import { prisma } from '@/lib/prisma';
import LedgerClient from './client';

export const dynamic = 'force-dynamic';

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  // Server-side pre-fetch for the All tab so the page renders with data
  // on first paint. Sub-tabs lazy-load their own data on tab change.
  const [categories, latestBalance] = await Promise.all([
    prisma.ledgerCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.ledgerEntry.findFirst({
      orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
      select: { runningBal: true },
    }),
  ]);

  return (
    <LedgerClient
      categories={JSON.parse(JSON.stringify(categories))}
      currentBalance={Number(latestBalance?.runningBal ?? 0)}
      initialTab={searchParams.tab ?? 'all'}
    />
  );
}

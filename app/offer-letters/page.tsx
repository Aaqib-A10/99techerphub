export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import OfferLetterTable from './OfferLetterTable';
import { KpiTile, Card } from '@/app/components/design';

export default async function OfferLettersPage() {
  const offerLetters = await prisma.offerLetter.findMany({
    include: {
      employee: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const [draftCount, sentCount, acceptedCount, declinedCount] = await Promise.all([
    prisma.offerLetter.count({ where: { status: 'DRAFT' } }),
    prisma.offerLetter.count({ where: { status: 'SENT' } }),
    prisma.offerLetter.count({ where: { status: 'ACCEPTED' } }),
    prisma.offerLetter.count({ where: { status: 'DECLINED' } }),
  ]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            People · Documents
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Offer Letters
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            Track and manage candidate offers
          </p>
        </div>
        <Link
          href="/offer-letters/new"
          className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14 M5 12h14" />
          </svg>
          New Offer
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile tone="amber" label="Draft" value={draftCount} meta="Awaiting send" />
        <KpiTile tone="blue" label="Sent" value={sentCount} meta="Pending response" />
        <KpiTile tone="green" label="Accepted" value={acceptedCount} />
        <KpiTile tone="rose" label="Declined" value={declinedCount} />
      </div>

      <Card
        title="All Offers"
        subtitle={`${offerLetters.length} ${offerLetters.length === 1 ? 'record' : 'records'}`}
        padded={false}
      >
        <OfferLetterTable offerLetters={JSON.parse(JSON.stringify(offerLetters))} />
      </Card>
    </div>
  );
}

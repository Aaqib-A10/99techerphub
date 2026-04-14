export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import OfferLetterTable from './OfferLetterTable';

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
      <PageHero
        eyebrow="People / Offers"
        title="Offer Letters"
        description="Create and manage employment offer letters"
        actions={
          <Link href="/offer-letters/new" className="btn btn-accent">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Offer Letter
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-label">Total Offers</div>
          <div className="stat-value">{offerLetters.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Draft</div>
          <div className="stat-value text-gray-600">{draftCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sent</div>
          <div className="stat-value text-blue-600">{sentCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Accepted</div>
          <div className="stat-value text-green-600">{acceptedCount}</div>
        </div>
      </div>

      {/* Offer Letters Table */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="section-heading">All Offer Letters</h2>
          <span className="text-sm text-gray-500">{offerLetters.length} records</span>
        </div>
        <OfferLetterTable offerLetters={JSON.parse(JSON.stringify(offerLetters))} />
      </div>
    </div>
  );
}

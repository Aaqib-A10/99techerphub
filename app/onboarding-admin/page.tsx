import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHero from '@/app/components/PageHero';
import CopyLinkButton from './CopyLinkButton';

// Admin list buckets. Order matters — "Pending Review" is the action
// queue and lands first by default.
type Bucket =
  | 'PENDING_REVIEW' // isComplete + reviewStatus = PENDING
  | 'INVITATION_SENT' // !isComplete + reviewStatus = PENDING
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED';

const BUCKET_META: Record<Bucket, { label: string; color: string; description: string }> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    description: 'Candidate has submitted — needs your review.',
  },
  INVITATION_SENT: {
    label: 'Invitation Sent',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    description: 'Link generated, candidate has not yet filled the form.',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    description: 'You asked for changes. Waiting on candidate to resubmit.',
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    description: 'Hire complete — Employee record created.',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    description: 'Application was rejected.',
  },
};

const BUCKET_ORDER: Bucket[] = [
  'PENDING_REVIEW',
  'INVITATION_SENT',
  'NEEDS_REVISION',
  'APPROVED',
  'REJECTED',
];

function bucketOf(s: { isComplete: boolean; reviewStatus: string }): Bucket {
  if (s.reviewStatus === 'APPROVED') return 'APPROVED';
  if (s.reviewStatus === 'REJECTED') return 'REJECTED';
  if (s.reviewStatus === 'NEEDS_REVISION') return 'NEEDS_REVISION';
  return s.isComplete ? 'PENDING_REVIEW' : 'INVITATION_SENT';
}

export default async function OnboardingAdminPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const submissions = await (prisma.onboardingSubmission as any).findMany({
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { id: true, empCode: true } } },
  });

  // Compute counts and group
  const grouped: Record<Bucket, any[]> = {
    PENDING_REVIEW: [],
    INVITATION_SENT: [],
    NEEDS_REVISION: [],
    APPROVED: [],
    REJECTED: [],
  };
  for (const s of submissions) grouped[bucketOf(s)].push(s);

  // Default tab: "Pending Review" if any, otherwise the first non-empty,
  // else just PENDING_REVIEW.
  const tabParam = (searchParams.tab || '').toUpperCase() as Bucket;
  let activeTab: Bucket = BUCKET_ORDER.includes(tabParam) ? tabParam : 'PENDING_REVIEW';
  if (!tabParam && grouped.PENDING_REVIEW.length === 0) {
    const firstWithItems = BUCKET_ORDER.find((b) => grouped[b].length > 0);
    if (firstWithItems) activeTab = firstWithItems;
  }
  const activeRows = grouped[activeTab];

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <div>
      <PageHero
        eyebrow="People / Onboarding"
        title="Candidate Onboarding"
        description="Manage candidate onboarding submissions"
        actions={
          <Link href="/onboarding-admin/new" className="btn btn-accent">
            Send Onboarding Form
          </Link>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {BUCKET_ORDER.map((b) => {
          const meta = BUCKET_META[b];
          const count = grouped[b].length;
          const isActive = b === activeTab;
          return (
            <Link
              key={b}
              href={`/onboarding-admin?tab=${b}`}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? meta.color + ' shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {meta.label}
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/70' : 'bg-gray-100'
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mb-4">{BUCKET_META[activeTab].description}</p>

      {activeRows.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">Nothing in this bucket.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Company</th>
                  <th>
                    {activeTab === 'PENDING_REVIEW' || activeTab === 'INVITATION_SENT'
                      ? 'Created'
                      : activeTab === 'APPROVED'
                      ? 'Approved'
                      : 'Updated'}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((submission: any) => (
                  <tr key={submission.id}>
                    <td className="font-medium">
                      <div>{submission.candidateName || '-'}</div>
                      {submission.candidateEmail && (
                        <div className="text-xs text-gray-500">
                          {submission.candidateEmail}
                        </div>
                      )}
                    </td>
                    <td>{submission.position || '-'}</td>
                    <td>{submission.companyName || '-'}</td>
                    <td>
                      {formatDate(
                        activeTab === 'PENDING_REVIEW' || activeTab === 'INVITATION_SENT'
                          ? submission.submittedAt || submission.createdAt
                          : submission.reviewedAt || submission.updatedAt
                      )}
                    </td>
                    <td>
                      {activeTab === 'INVITATION_SENT' ? (
                        <CopyLinkButton url={`${getAppUrl()}/onboarding/${submission.token}`} />
                      ) : activeTab === 'APPROVED' && submission.employee?.id ? (
                        <Link
                          href={`/employees/${submission.employee.id}`}
                          className="text-brand-primary hover:text-brand-dark font-medium text-sm"
                        >
                          View Employee →
                        </Link>
                      ) : activeTab === 'PENDING_REVIEW' || activeTab === 'NEEDS_REVISION' ? (
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/onboarding-admin/${submission.id}`}
                            className="text-brand-primary hover:text-brand-dark font-medium text-sm"
                          >
                            Review
                          </Link>
                          {submission.token && (
                            <>
                              <span className="text-gray-300">·</span>
                              <CopyLinkButton
                                url={`${getAppUrl()}/onboarding/${submission.token}`}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={`/onboarding-admin/${submission.id}`}
                          className="text-brand-primary hover:text-brand-dark font-medium text-sm"
                        >
                          Review
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

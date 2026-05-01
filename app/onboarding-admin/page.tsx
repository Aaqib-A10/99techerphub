import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import CopyLinkButton from './CopyLinkButton';
import { KpiTile, Card, Avi, Btn } from '@/app/components/design';
import type { CoreTone } from '@/app/components/design';

// Admin list buckets. Order matters — "Pending Review" is the action
// queue and lands first by default.
type Bucket =
  | 'PENDING_REVIEW' // isComplete + reviewStatus = PENDING
  | 'INVITATION_SENT' // !isComplete + reviewStatus = PENDING
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED';

const BUCKET_META: Record<
  Bucket,
  { label: string; tone: CoreTone; description: string }
> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    tone: 'amber',
    description: 'Candidate has submitted — needs your review.',
  },
  INVITATION_SENT: {
    label: 'Invitation Sent',
    tone: 'blue',
    description: 'Link generated, candidate has not yet filled the form.',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    tone: 'rose',
    description: 'You asked for changes. Waiting on candidate to resubmit.',
  },
  APPROVED: {
    label: 'Approved',
    tone: 'green',
    description: 'Hire complete — Employee record created.',
  },
  REJECTED: {
    label: 'Rejected',
    tone: 'violet',
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
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            People · Lifecycle
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Onboarding
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            {submissions.length} candidate{submissions.length === 1 ? '' : 's'} moving through your hiring pipeline
          </p>
        </div>
        <Link
          href="/onboarding-admin/new"
          className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14 M5 12h14" />
          </svg>
          Send Onboarding Form
        </Link>
      </div>

      {/* KPI / tab strip — clicking a tile filters the list below */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {BUCKET_ORDER.map((b) => {
          const meta = BUCKET_META[b];
          const count = grouped[b].length;
          const isActive = b === activeTab;
          return (
            <Link
              key={b}
              href={`/onboarding-admin?tab=${b}`}
              className={`block rounded-2xl transition focus:outline-none ${
                isActive
                  ? 'ring-2 ring-core-text/15 ring-offset-2 ring-offset-core-bg'
                  : 'hover:opacity-90'
              }`}
            >
              <KpiTile tone={meta.tone} label={meta.label} value={count} />
            </Link>
          );
        })}
      </div>

      <p className="mb-3 text-[12px] text-core-text3">
        {BUCKET_META[activeTab].description}
      </p>

      {activeRows.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-[13px] text-core-text3">
            Nothing in this bucket.
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-core-surface2">
                  {[
                    'Candidate',
                    'Position',
                    'Company',
                    activeTab === 'PENDING_REVIEW' || activeTab === 'INVITATION_SENT'
                      ? 'Created'
                      : activeTab === 'APPROVED'
                      ? 'Approved'
                      : 'Updated',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((submission: any, idx) => {
                  const isLast = idx === activeRows.length - 1;
                  const candidate = submission.candidateName || '—';
                  const initials =
                    submission.candidateName
                      ?.split(/\s+/)
                      .map((n: string) => n[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || '?';
                  return (
                    <tr
                      key={submission.id}
                      className="transition-colors hover:bg-core-surface2"
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                    >
                      <td className="px-[14px] py-3">
                        <div className="flex items-center gap-[10px]">
                          <Avi seed={submission.candidateEmail || candidate} initials={initials} size={28} />
                          <div className="min-w-0">
                            <div className="font-medium text-core-text">{candidate}</div>
                            {submission.candidateEmail && (
                              <div className="mt-[1px] text-[10.5px] text-core-text3">
                                {submission.candidateEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-[14px] py-3 text-core-text2">
                        {submission.position || <span className="text-core-text3">—</span>}
                      </td>
                      <td className="px-[14px] py-3 text-core-text2">
                        {submission.companyName || <span className="text-core-text3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                        {formatDate(
                          activeTab === 'PENDING_REVIEW' || activeTab === 'INVITATION_SENT'
                            ? submission.submittedAt || submission.createdAt
                            : submission.reviewedAt || submission.updatedAt,
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[14px] py-3">
                        {activeTab === 'INVITATION_SENT' ? (
                          <CopyLinkButton url={`${getAppUrl()}/onboarding/${submission.token}`} />
                        ) : activeTab === 'APPROVED' && submission.employee?.id ? (
                          <Btn as="a" href={`/employees/${submission.employee.id}`} tone="ghost">
                            View Employee
                          </Btn>
                        ) : activeTab === 'PENDING_REVIEW' || activeTab === 'NEEDS_REVISION' ? (
                          <div className="flex items-center gap-2">
                            <Btn as="a" href={`/onboarding-admin/${submission.id}`} tone="primary">
                              Review
                            </Btn>
                            {submission.token && (
                              <CopyLinkButton url={`${getAppUrl()}/onboarding/${submission.token}`} />
                            )}
                          </div>
                        ) : (
                          <Btn as="a" href={`/onboarding-admin/${submission.id}`} tone="ghost">
                            Review
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

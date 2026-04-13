import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PageHero from '@/app/components/PageHero';

export default async function OnboardingAdminPage() {
  const submissions = await (prisma.onboardingSubmission as any).findMany({
    orderBy: { createdAt: 'desc' },
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'badge-yellow';
      case 'APPROVED':
        return 'badge-green';
      case 'REJECTED':
        return 'badge-red';
      case 'NEEDS_REVISION':
        return 'badge-orange';
      default:
        return 'badge-gray';
    }
  };

  const formatDate = (date: Date | null) => {
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

      {submissions.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <p className="text-gray-500">No onboarding submissions yet.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Position</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td className="font-medium">{submission.candidateName || '-'}</td>
                    <td>{submission.position || '-'}</td>
                    <td>{submission.companyName || '-'}</td>
                    <td>
                      {submission.isComplete ? (
                        <span className={`badge ${getStatusBadgeColor(submission.reviewStatus)}`}>
                          {submission.reviewStatus === 'PENDING'
                            ? 'Pending Review'
                            : submission.reviewStatus === 'APPROVED'
                              ? 'Approved'
                              : submission.reviewStatus === 'REJECTED'
                                ? 'Rejected'
                                : 'Needs Revision'}
                        </span>
                      ) : (
                        <span className="badge badge-blue">Invitation Sent</span>
                      )}
                    </td>
                    <td>{formatDate(submission.submittedAt)}</td>
                    <td>
                      {submission.isComplete ? (
                        <Link
                          href={`/onboarding-admin/${submission.id}`}
                          className="text-brand-primary hover:text-brand-dark font-medium text-sm"
                        >
                          Review
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            const appUrl = getAppUrl();
                            const url = `${appUrl}/onboarding/${submission.token}`;
                            navigator.clipboard.writeText(url);
                            alert('Link copied to clipboard!');
                          }}
                          className="text-brand-primary hover:text-brand-dark font-medium text-sm"
                        >
                          Copy Link
                        </button>
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

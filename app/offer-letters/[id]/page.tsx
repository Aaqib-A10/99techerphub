import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OfferLetterDetailClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function OfferLetterDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const offerLetter = await prisma.offerLetter.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      employee: true,
    },
  });

  if (!offerLetter) return notFound();

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tableName: 'offer_letters',
      recordId: offerLetter.id,
    },
    include: {
      changedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    SENT: 'badge-blue',
    ACCEPTED: 'badge-green',
    DECLINED: 'badge-red',
  };

  const getDisplayName = () => {
    return offerLetter.candidateName || (offerLetter.employee ? `${offerLetter.employee.firstName} ${offerLetter.employee.lastName}` : 'N/A');
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      <div className="breadcrumb mb-6">
        <Link href="/offer-letters" className="breadcrumb-item">
          Offer Letters
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">{getDisplayName()}</span>
      </div>

      <PageHero
        eyebrow="People / Offers"
        title={getDisplayName()}
        description={`${offerLetter.templateType.charAt(0) + offerLetter.templateType.slice(1).toLowerCase()} offer`}
        actions={
          <div className="text-right" style={{ color: '#FFFFFF' }}>
            <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {offerLetter.currency} {offerLetter.salary.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
              {formatDate(offerLetter.offerDate)}
            </div>
          </div>
        }
      >
        <div className="flex gap-2 mt-3">
          <span className={`badge ${statusColors[offerLetter.status]}`}>
            {offerLetter.status}
          </span>
        </div>
      </PageHero>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Offer Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 text-sm">Position</span>
                  <div className="font-medium mt-1">{offerLetter.position}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Company</span>
                  <div className="font-medium mt-1">{offerLetter.companyName || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Department</span>
                  <div className="font-medium mt-1">{offerLetter.department || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Start Date</span>
                  <div className="font-medium mt-1">{formatDate(offerLetter.startDate)}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Reporting To</span>
                  <div className="font-medium mt-1">{offerLetter.reportingTo || '-'}</div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Contract Type</span>
                  <div className="font-medium mt-1">{offerLetter.contractType || '-'}</div>
                </div>
              </div>

              {offerLetter.candidateEmail && (
                <div className="pt-4 border-t">
                  <span className="text-gray-500 text-sm">Candidate Email</span>
                  <div className="font-medium mt-1">{offerLetter.candidateEmail}</div>
                </div>
              )}

              {offerLetter.templateType === 'PROBATION' && offerLetter.probationPeriod && (
                <div className="pt-2 border-t">
                  <span className="text-gray-500 text-sm">Probation Period</span>
                  <div className="font-medium mt-1">{offerLetter.probationPeriod}</div>
                </div>
              )}

              {offerLetter.benefits && (
                <div className="pt-4 border-t">
                  <span className="text-gray-500 text-sm">Benefits</span>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">{offerLetter.benefits}</p>
                </div>
              )}

              {offerLetter.workingHours && (
                <div className="pt-4 border-t">
                  <span className="text-gray-500 text-sm">Working Hours</span>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">{offerLetter.workingHours}</p>
                </div>
              )}

              {offerLetter.terms && (
                <div className="pt-4 border-t">
                  <span className="text-gray-500 text-sm">Terms & Conditions</span>
                  <p className="mt-2 text-gray-700 whitespace-pre-wrap">{offerLetter.terms}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="section-heading">Timeline</h2>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-primary"></div>
                    <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>
                  </div>
                  <div className="pb-4">
                    <div className="font-semibold">Created</div>
                    <div className="text-sm text-gray-600">
                      {new Date(offerLetter.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {offerLetter.sentAt && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <div className="w-0.5 h-16 bg-gray-200 mt-2"></div>
                    </div>
                    <div className="pb-4">
                      <div className="font-semibold">Sent</div>
                      <div className="text-sm text-gray-600">
                        {new Date(offerLetter.sentAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {offerLetter.acceptedDate && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div>
                      <div className="font-semibold">Accepted</div>
                      <div className="text-sm text-gray-600">
                        {new Date(offerLetter.acceptedDate).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {auditLogs.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="section-heading">Audit Trail</h2>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <OfferLetterDetailClient offerLetter={offerLetter} />
        </div>
      </div>
    </div>
  );
}

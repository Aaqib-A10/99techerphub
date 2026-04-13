'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface PersonalDetails {
  fullName: string;
  fatherName: string;
  cnic: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  bloodGroup: string;
  passportNumber: string;
  passportExpiry: string;
}

interface BankDetails {
  bankName: string;
  accountNumber: string;
  branch: string;
  accountTitle: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

interface Education {
  degree: string;
  institution: string;
  year: string;
  gpa: string;
}

interface WorkHistory {
  company: string;
  position: string;
  from: string;
  to: string;
  reasonForLeaving: string;
}

interface Reference {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface Submission {
  id: number;
  candidateName: string;
  candidateEmail: string;
  position: string;
  companyName: string;
  personalDetails: PersonalDetails;
  bankDetails: BankDetails;
  emergencyContact: EmergencyContact;
  educationHistory: Education[];
  workHistory: WorkHistory[];
  references: Reference[];
  reviewStatus: string;
  reviewNotes: string | null;
  submittedAt: string;
}

export default function ReviewOnboardingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await fetch(`/api/onboarding/review/${id}`);
        if (!response.ok) throw new Error('Failed to fetch submission');
        const data = await response.json();
        setSubmission(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      }
    };
    fetchSubmission();
  }, [id]);

  const handleApprove = async () => {
    const confirmed = confirm(
      `Are you sure you want to approve ${submission?.candidateName}'s onboarding? This will create an employee record and generate temporary credentials.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/onboarding/review/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve submission');
      }

      const result = await response.json();
      // Redirect to the newly created employee record
      router.push(`/employees/${result.employeeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      setError('Please provide revision notes');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/onboarding/review/${id}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: revisionNotes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request revision');
      }

      router.push('/onboarding-admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide rejection reason');
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to reject this submission? The candidate will be notified.'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/onboarding/review/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectionReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject submission');
      }

      router.push('/onboarding-admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  if (!submission) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'badge-green';
      case 'REJECTED':
        return 'badge-red';
      case 'NEEDS_REVISION':
        return 'badge-orange';
      default:
        return 'badge-yellow';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHero
        eyebrow="People / Onboarding"
        title={submission.candidateName}
        description={`${submission.position} at ${submission.companyName}`}
        actions={
          <span className={`badge ${getStatusColor(submission.reviewStatus)}`}>
            {submission.reviewStatus === 'PENDING'
              ? 'Pending Review'
              : submission.reviewStatus === 'APPROVED'
                ? 'Approved'
                : submission.reviewStatus === 'REJECTED'
                  ? 'Rejected'
                  : 'Needs Revision'}
          </span>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {submission.reviewStatus !== 'PENDING' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Reviewed:</span> {new Date(submission.submittedAt).toLocaleDateString()}
          </p>
          {submission.reviewNotes && (
            <p className="text-sm text-blue-800 mt-2">
              <span className="font-semibold">Notes:</span> {submission.reviewNotes}
            </p>
          )}
        </div>
      )}

      {/* Personal Details */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="section-heading">Personal Details</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Full Name</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">CNIC</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.cnic}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date of Birth</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gender</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Blood Group</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.bloodGroup}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Nationality</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.nationality}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact & Emergency */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="section-heading">Contact & Emergency Information</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold text-gray-900">{submission.candidateEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold text-gray-900">{submission.personalDetails?.phone || '-'}</p>
            </div>
          </div>

          <h3 className="font-semibold text-gray-900 mb-3">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold text-gray-900">{submission.emergencyContact?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold text-gray-900">{submission.emergencyContact?.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Relationship</p>
              <p className="font-semibold text-gray-900">
                {submission.emergencyContact?.relationship}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Banking Details */}
      {submission.bankDetails && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Banking Details</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Bank Name</p>
                <p className="font-semibold text-gray-900">{submission.bankDetails.bankName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account Number</p>
                <p className="font-semibold text-gray-900">
                  {submission.bankDetails.accountNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Branch</p>
                <p className="font-semibold text-gray-900">{submission.bankDetails.branch}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account Title</p>
                <p className="font-semibold text-gray-900">
                  {submission.bankDetails.accountTitle || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Education History */}
      {submission.educationHistory && submission.educationHistory.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Education History</h2>
          </div>
          <div className="card-body space-y-4">
            {submission.educationHistory.map((edu, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {edu.degree} from {edu.institution}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Year</p>
                    <p className="font-semibold">{edu.year}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">GPA</p>
                    <p className="font-semibold">{edu.gpa || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work History */}
      {submission.workHistory && submission.workHistory.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Work History</h2>
          </div>
          <div className="card-body space-y-4">
            {submission.workHistory.map((work, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {work.position} at {work.company}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Period</p>
                    <p className="font-semibold">
                      {work.from} - {work.to}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Reason for Leaving</p>
                    <p className="font-semibold">{work.reasonForLeaving || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* References */}
      {submission.references && submission.references.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">References</h2>
          </div>
          <div className="card-body space-y-4">
            {submission.references.map((ref, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">{ref.name}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Relationship</p>
                    <p className="font-semibold">{ref.relationship}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone</p>
                    <p className="font-semibold">{ref.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email</p>
                    <p className="font-semibold">{ref.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions - Show only if PENDING */}
      {submission.reviewStatus === 'PENDING' && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Review Actions</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Approve */}
            <div>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn btn-success w-full"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>

            {/* Request Revision */}
            <div>
              <label className="form-label">Request Revision</label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Describe what needs to be revised..."
                className="form-input"
                rows={3}
              />
              <button
                onClick={handleRequestRevision}
                disabled={actionLoading}
                className="btn btn-warning w-full mt-2"
              >
                {actionLoading ? 'Processing...' : 'Request Revision'}
              </button>
            </div>

            {/* Reject */}
            <div>
              <label className="form-label">Reject</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="form-input"
                rows={3}
              />
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="btn btn-danger w-full mt-2"
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Record Button - Show after approval */}
      {submission.reviewStatus === 'APPROVED' && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Next Steps</h2>
          </div>
          <div className="card-body">
            <p className="text-gray-600 mb-4">
              Create an employee record from this onboarding submission.
            </p>
            <Link
              href={`/employees/new?fromOnboardingId=${submission.id}`}
              className="btn btn-primary"
            >
              Create Employee Record
            </Link>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="flex justify-center">
        <Link href="/onboarding-admin" className="btn btn-secondary">
          Back to Onboarding
        </Link>
      </div>
    </div>
  );
}

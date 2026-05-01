'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

export default function ExpenseDetailClient({ expense }: { expense: any }) {
  const router = useRouter();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAction = async (action: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION') => {
    if (action === 'REJECTED' && !comments.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/expenses/${expense.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comments }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process action');
      }

      setSuccess(`Expense ${action === 'APPROVED' ? 'approved' : action === 'REJECTED' ? 'rejected' : 'sent for revision'} successfully`);
      setComments('');
      setShowApproveModal(false);
      setShowRejectModal(false);
      setShowRevisionModal(false);

      // Refresh after a short delay to show success message
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const canApprove =
    expense.status === 'PENDING' || expense.status === 'NEEDS_REVISION';

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {success && (
        <div className="p-4 bg-core-greenSoft border border-core-border rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-core-greenFg flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium text-core-greenFg text-sm">{success}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-core-roseSoft border border-core-border rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-core-roseFg flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium text-core-roseFg text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Actions */}
      {canApprove ? (
        <div className="card">
          <div className="card-header">
            <h3 className="section-heading flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Approval Actions
            </h3>
          </div>
          <div className="card-body space-y-2">
            <button
              onClick={() => setShowApproveModal(true)}
              className="btn btn-success w-full justify-center flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve
            </button>
            <button
              onClick={() => setShowRevisionModal(true)}
              className="btn btn-warning w-full justify-center flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request Revision
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="btn btn-danger w-full justify-center flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-core-text3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium text-core-text2 text-sm">Status Finalized</div>
                <div className="text-core-text2 text-sm mt-1">
                  This expense has been {expense.status.toLowerCase().replace(/_/g, ' ')} and cannot be modified.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Summary Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="section-heading">Summary</h3>
        </div>
        <div className="card-body space-y-3">
          <div>
            <div className="text-sm" style={{ color: '#5A6159' }}>Amount</div>
            <div className="text-2xl font-bold mono mt-1" style={{ color: '#1F2320' }}>
              {expense.currency} {Number(expense.amount).toLocaleString()}
            </div>
          </div>
          <div className="pt-3 border-t">
            <div className="text-sm text-core-text3">Status</div>
            <div className="mt-2">
              <span className={`badge ${
                expense.status === 'APPROVED'
                  ? 'badge-green'
                  : expense.status === 'REJECTED'
                  ? 'badge-red'
                  : expense.status === 'PENDING'
                  ? 'badge-yellow'
                  : expense.status === 'NEEDS_REVISION'
                  ? 'badge-blue'
                  : 'badge-gray'
              }`}>
                {expense.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="pt-3 border-t">
            <div className="text-sm text-core-text3">Submitted By</div>
            <div className="font-medium text-sm mt-1">
              {expense.submittedBy.firstName} {expense.submittedBy.lastName}
            </div>
            <div className="text-xs text-core-text3">{expense.submittedBy.email}</div>
          </div>
          <div className="pt-3 border-t">
            <div className="text-sm text-core-text3">Category</div>
            <div className="font-medium text-sm mt-1">{expense.category.name}</div>
          </div>
          <div className="pt-3 border-t">
            <div className="text-sm text-core-text3">Date Submitted</div>
            <div className="font-medium text-sm mt-1">
              {new Date(expense.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={showApproveModal}
        title="Approve Expense"
        onClose={() => {
          setShowApproveModal(false);
          setComments('');
          setError('');
        }}
        onSubmit={() => handleAction('APPROVED')}
        submitLabel="Approve"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-core-text2">
              Approve this expense of <span className="font-bold">{expense.currency} {Number(expense.amount).toLocaleString()}</span>?
            </p>
          </div>
          <div>
            <label className="form-label">Comments (Optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add approval notes..."
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        title="Reject Expense"
        onClose={() => {
          setShowRejectModal(false);
          setComments('');
          setError('');
        }}
        onSubmit={() => handleAction('REJECTED')}
        submitLabel="Reject"
        submitDisabled={loading || !comments.trim()}
      >
        <div className="space-y-4">
          <div className="p-3 bg-core-roseSoft border border-core-border rounded">
            <div className="text-sm text-core-roseFg">
              This action will reject the expense and notify the submitter.
            </div>
          </div>
          <div>
            <label className="form-label">
              Rejection Reason <span className="text-core-roseFg">*</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Explain why this expense is being rejected..."
              rows={4}
              className="form-textarea"
              required
            />
            <div className="text-xs text-core-text3 mt-1">
              This message will be visible to the submitter.
            </div>
          </div>
        </div>
      </Modal>

      {/* Revision Modal */}
      <Modal
        isOpen={showRevisionModal}
        title="Request Revision"
        onClose={() => {
          setShowRevisionModal(false);
          setComments('');
          setError('');
        }}
        onSubmit={() => handleAction('NEEDS_REVISION')}
        submitLabel="Send for Revision"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div className="p-3 bg-core-blueSoft border border-core-border rounded">
            <div className="text-sm text-core-blueFg">
              The expense will be sent back to the submitter for revisions.
            </div>
          </div>
          <div>
            <label className="form-label">
              Revision Notes <span className="text-core-text3">(Optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Describe what needs to be revised..."
              rows={4}
              className="form-textarea"
            />
            <div className="text-xs text-core-text3 mt-1">
              These notes will help the submitter understand what to fix.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

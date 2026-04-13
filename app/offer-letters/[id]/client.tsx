'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

export default function OfferLetterDetailClient({ offerLetter }: { offerLetter: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/offer-letters/${offerLetter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/offer-letters/${offerLetter.id}/pdf`, '_blank');
  };

  const handleSendEmail = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/offer-letters/${offerLetter.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send offer letter');
      }

      setShowSendModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">Actions</h2>
        </div>
        <div className="card-body space-y-3">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleDownloadPDF}
            className="w-full btn btn-secondary flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download PDF
          </button>

          {offerLetter.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setShowSendModal(true)}
                disabled={loading}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
                style={{ backgroundColor: '#00C853' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Send via Email
              </button>
            </>
          )}

          {offerLetter.status === 'SENT' && (
            <>
              <button
                onClick={() => handleStatusChange('ACCEPTED')}
                disabled={loading}
                className="w-full btn btn-primary"
              >
                {loading ? 'Updating...' : 'Mark as Accepted'}
              </button>
              <button
                onClick={() => handleStatusChange('DECLINED')}
                disabled={loading}
                className="w-full btn btn-secondary"
              >
                Mark as Declined
              </button>
            </>
          )}

          {offerLetter.status === 'ACCEPTED' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-center">
              <div className="text-green-700 font-semibold">Offer Accepted</div>
              <div className="text-sm text-green-600 mt-1">
                {offerLetter.acceptedDate &&
                  `on ${new Date(offerLetter.acceptedDate).toLocaleDateString()}`}
              </div>
            </div>
          )}

          {offerLetter.status === 'DECLINED' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-center">
              <div className="text-red-700 font-semibold">Offer Declined</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">Status Info</h2>
        </div>
        <div className="card-body text-sm space-y-2">
          <div>
            <span className="text-gray-500">Current Status</span>
            <div className="font-medium">{offerLetter.status}</div>
          </div>
          <div>
            <span className="text-gray-500">Template Type</span>
            <div className="font-medium">
              {offerLetter.templateType.charAt(0) + offerLetter.templateType.slice(1).toLowerCase()}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Created</span>
            <div className="font-medium">
              {new Date(offerLetter.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Send Email Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Send Offer Letter</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={offerLetter.candidateEmail || ''}
                    disabled
                    className="form-input bg-gray-50"
                  />
                </div>

                <div className="bg-gray-50 rounded p-4">
                  <h3 className="font-semibold text-sm mb-2">Email Preview</h3>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div>
                      <span className="font-medium">To:</span> {offerLetter.candidateEmail}
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span> Offer Letter - {offerLetter.position}
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-600">
                        The offer letter PDF will be attached to the email.
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowSendModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-brand-primary text-white rounded hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#00C853' }}
                  >
                    {loading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

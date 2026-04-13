'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface FormData {
  candidateName: string;
  candidateEmail: string;
  position: string;
  companyName: string;
  expiryDays: string;
}

export default function NewOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState('');

  const [formData, setFormData] = useState<FormData>({
    candidateName: '',
    candidateEmail: '',
    position: '',
    companyName: '',
    expiryDays: '7',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expiryDays: parseInt(formData.expiryDays),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create onboarding invitation');
      }

      const data = await response.json();
      setSuccess(true);
      setOnboardingUrl(data.onboardingUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(onboardingUrl);
    alert('Link copied to clipboard!');
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="card-header">
            <h2 className="section-heading">Onboarding Invitation Sent</h2>
          </div>
          <div className="card-body">
            <div className="text-center mb-6">
              <div className="text-5xl text-green-500 mb-4">✓</div>
              <p className="text-gray-600 mb-4">
                Onboarding invitation has been created successfully!
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600 mb-2">Onboarding Link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white p-3 rounded border border-gray-300 text-sm break-all">
                  {onboardingUrl}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="btn btn-primary btn-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This link will expire in {formData.expiryDays} days
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/onboarding-admin" className="btn btn-secondary">
                Back to Onboarding
              </Link>
              <button
                onClick={() => {
                  router.push('/onboarding-admin/new');
                  setSuccess(false);
                  setFormData({
                    candidateName: '',
                    candidateEmail: '',
                    position: '',
                    companyName: '',
                    expiryDays: '7',
                  });
                }}
                className="btn btn-primary"
              >
                Send Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHero
        eyebrow="People / Onboarding"
        title="Send Onboarding Form"
        description="Create a new candidate onboarding invitation"
      />

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="form-label">Candidate Name *</label>
                <input
                  name="candidateName"
                  value={formData.candidateName}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Enter candidate's full name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Candidate Email *</label>
                <input
                  name="candidateEmail"
                  type="email"
                  value={formData.candidateEmail}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="candidate@example.com"
                />
              </div>

              <div>
                <label className="form-label">Position *</label>
                <input
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="e.g. Software Engineer"
                />
              </div>

              <div>
                <label className="form-label">Company *</label>
                <select
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="form-select"
                >
                  <option value="">Select Company</option>
                  <option value="MNC">MNC</option>
                  <option value="SJ">SJ</option>
                  <option value="PCMART">PCMART</option>
                  <option value="RTI">RTI</option>
                  <option value="LRI">LRI</option>
                  <option value="Green Loop">Green Loop</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Link Expiry *</label>
                <select
                  name="expiryDays"
                  value={formData.expiryDays}
                  onChange={handleChange}
                  required
                  className="form-select"
                >
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The candidate will have this many days to complete the onboarding form
                </p>
              </div>
            </div>
          </div>

          <div className="card-footer flex justify-between">
            <Link href="/onboarding-admin" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create & Send'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

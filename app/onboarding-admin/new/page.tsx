'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface Company {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface Department {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface FormData {
  candidateName: string;
  candidateEmail: string;
  position: string;
  companyId: string;
  departmentId: string;
  expiryDays: string;
}

export default function NewOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState('');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    candidateName: '',
    candidateEmail: '',
    position: '',
    companyId: '',
    departmentId: '',
    expiryDays: '7',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/companies'),
          fetch('/api/departments'),
        ]);
        if (!cRes.ok || !dRes.ok) throw new Error('Failed to load options');
        const [c, d] = await Promise.all([cRes.json(), dRes.json()]);
        if (cancelled) return;
        setCompanies((c as Company[]).filter((x) => x.isActive));
        setDepartments((d as Department[]).filter((x) => x.isActive));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load options');
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
          candidateName: formData.candidateName,
          candidateEmail: formData.candidateEmail,
          position: formData.position,
          companyId: parseInt(formData.companyId),
          departmentId: formData.departmentId
            ? parseInt(formData.departmentId)
            : null,
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
                    companyId: '',
                    departmentId: '',
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
                  name="companyId"
                  value={formData.companyId}
                  onChange={handleChange}
                  required
                  disabled={optionsLoading}
                  className="form-select"
                >
                  <option value="">
                    {optionsLoading ? 'Loading...' : 'Select Company'}
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="form-label">Department</label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  disabled={optionsLoading}
                  className="form-select"
                >
                  <option value="">
                    {optionsLoading ? 'Loading...' : 'Select Department (optional)'}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Can be confirmed or changed at approval time
                </p>
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
              disabled={loading || optionsLoading}
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

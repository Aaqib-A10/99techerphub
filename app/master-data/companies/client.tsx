'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';

interface Company {
  id: number;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
}

interface CompaniesClientProps {
  initialCompanies: Company[];
  employeeCounts: Record<number, number>;
  assetCounts: Record<number, number>;
}

export default function CompaniesClient({
  initialCompanies,
  employeeCounts,
  assetCounts,
}: CompaniesClientProps) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    country: '',
  });

  const handleAdd = async () => {
    if (!formData.code || !formData.name || !formData.country) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || data.error || 'Failed to create company');
      }

      const newCompany = await res.json();
      setCompanies([newCompany, ...companies]);
      setFormData({ code: '', name: '', country: '' });
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating company');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this company? This action can be undone.')) return;

    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) throw new Error('Failed to deactivate company');

      setCompanies(
        companies.map((c) => (c.id === id ? { ...c, isActive: false } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deactivating company');
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Company
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Add New Company"
        onClose={() => {
          setIsModalOpen(false);
          setFormData({ code: '', name: '', country: '' });
          setError('');
        }}
        onSubmit={handleAdd}
        submitLabel="Create Company"
        submitDisabled={loading}
      >
        <div className="space-y-4">
          <div>
            <label className="form-label">Code (e.g. MNC, SJ) *</label>
            <input
              type="text"
              className="form-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Company Code"
              maxLength={10}
            />
          </div>
          <div>
            <label className="form-label">Company Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full Company Name"
            />
          </div>
          <div>
            <label className="form-label">Country *</label>
            <select
              className="form-input"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            >
              <option value="">Select Country</option>
              <option value="US">United States</option>
              <option value="AE">United Arab Emirates</option>
              <option value="PK">Pakistan</option>
            </select>
          </div>
        </div>
      </Modal>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Country</th>
                <th>Employees</th>
                <th>Assets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    No companies found
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <span className="badge badge-blue font-mono">{company.code}</span>
                    </td>
                    <td className="font-semibold">{company.name}</td>
                    <td>{company.country}</td>
                    <td className="text-center">{employeeCounts[company.id] || 0}</td>
                    <td className="text-center">{assetCounts[company.id] || 0}</td>
                    <td>
                      <span
                        className={`badge ${
                          company.isActive ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {company.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {company.isActive && (
                        <button
                          onClick={() => handleDeactivate(company.id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

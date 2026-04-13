'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    amount: '',
    currency: 'PKR',
    description: '',
    period: new Date().toISOString().slice(0, 7),
  });

  useEffect(() => {
    fetch('/api/finance/commission').then((r) => r.json()).then(setCommissions);
    fetch('/api/expenses?meta=true').then((r) => r.json()).then((d) => setEmployees(d.employees || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/finance/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to create commission');
      const commission = await res.json();
      setCommissions([commission, ...commissions]);
      setSuccess('Commission added successfully!');
      setShowForm(false);
      setFormData({ employeeId: '', amount: '', currency: 'PKR', description: '', period: new Date().toISOString().slice(0, 7) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Commissions"
        title="Commission Management"
        description="Track and manage employee commissions and bonuses"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            Add Commission
          </button>
        }
      />

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">{success}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="card-header"><h2 className="section-heading">Add Commission / Bonus</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Employee *</label>
                  <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} required className="form-select">
                    <option value="">Select Employee</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.empCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required className="form-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="form-select">
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Period *</label>
                  <input type="month" value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} required className="form-input" />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Description *</label>
                  <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required className="form-input" placeholder="Sales commission, project bonus, etc." />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Saving...' : 'Add Commission'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">No commissions recorded yet</td></tr>
              ) : (
                commissions.map((c: any) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.employee?.firstName} {c.employee?.lastName}</td>
                    <td>{c.period}</td>
                    <td className="font-semibold text-green-700">{c.currency} {c.amount.toLocaleString()}</td>
                    <td className="text-sm text-gray-600">{c.description}</td>
                    <td><span className={`badge ${c.isPaid ? 'badge-green' : 'badge-yellow'}`}>{c.isPaid ? 'Paid' : 'Pending'}</span></td>
                    <td className="text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
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

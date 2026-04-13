'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

export default function DeductionsPage() {
  const [deductions, setDeductions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    amount: '',
    currency: 'PKR',
    deductionType: '',
    description: '',
    period: new Date().toISOString().slice(0, 7),
  });

  useEffect(() => {
    fetch('/api/finance/deduction').then((r) => r.json()).then(setDeductions);
    fetch('/api/expenses?meta=true').then((r) => r.json()).then((d) => setEmployees(d.employees || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/finance/deduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to create deduction');
      const deduction = await res.json();
      setDeductions([deduction, ...deductions]);
      setSuccess('Deduction added successfully!');
      setShowForm(false);
      setFormData({ employeeId: '', amount: '', currency: 'PKR', deductionType: '', description: '', period: new Date().toISOString().slice(0, 7) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    TAX: 'Income Tax',
    LOAN: 'Loan Repayment',
    ADVANCE: 'Salary Advance',
    INSURANCE: 'Health Insurance',
    OTHER: 'Other',
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Deductions"
        title="Deduction Management"
        description="Track tax, loan, insurance, and other deductions"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            Add Deduction
          </button>
        }
      />

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">{success}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="card-header"><h2 className="section-heading">Add Deduction</h2></div>
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
                  <label className="form-label">Deduction Type *</label>
                  <select value={formData.deductionType} onChange={(e) => setFormData({ ...formData, deductionType: e.target.value })} required className="form-select">
                    <option value="">Select Type</option>
                    <option value="TAX">Income Tax</option>
                    <option value="LOAN">Loan Repayment</option>
                    <option value="ADVANCE">Salary Advance</option>
                    <option value="INSURANCE">Health Insurance</option>
                    <option value="OTHER">Other</option>
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
                <div>
                  <label className="form-label">Description</label>
                  <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="form-input" placeholder="Additional notes..." />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Saving...' : 'Add Deduction'}</button>
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
                <th>Type</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Date Added</th>
              </tr>
            </thead>
            <tbody>
              {deductions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">No deductions recorded yet</td></tr>
              ) : (
                deductions.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.employee?.firstName} {d.employee?.lastName}</td>
                    <td><span className="badge badge-blue">{typeLabels[d.deductionType] || d.deductionType}</span></td>
                    <td>{d.period}</td>
                    <td className="font-semibold text-red-600">{d.currency} {d.amount.toLocaleString()}</td>
                    <td className="text-sm text-gray-600">{d.description || '-'}</td>
                    <td className="text-sm text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
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

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import EmployeePicker from '@/app/components/EmployeePicker';
import { KpiTile } from '@/app/components/design';

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

  const kpis = useMemo(() => {
    const totalAmount = deductions.reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
    const taxTotal = deductions
      .filter((d: any) => d.deductionType === 'TAX')
      .reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
    const loanTotal = deductions
      .filter((d: any) => d.deductionType === 'LOAN')
      .reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
    const advanceTotal = deductions
      .filter((d: any) => d.deductionType === 'ADVANCE')
      .reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
    return {
      total: deductions.length,
      totalAmount,
      taxTotal,
      loanTotal,
      advanceTotal,
    };
  }, [deductions]);

  const fmt = (n: number) =>
    `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <PageHero
        eyebrow="Finance · Deductions"
        title="Deduction Management"
        description="Track tax, loan, insurance, and other deductions"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            Add Deduction
          </button>
        }
      />

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile tone="rose" label="Total Records" value={kpis.total} meta="All deductions" />
        <KpiTile tone="amber" label="Total Amount" value={fmt(kpis.totalAmount)} />
        <KpiTile tone="violet" label="Income Tax" value={fmt(kpis.taxTotal)} />
        <KpiTile tone="blue" label="Loans" value={fmt(kpis.loanTotal)} />
        <KpiTile tone="green" label="Advances" value={fmt(kpis.advanceTotal)} />
      </div>

      {error && <div className="mb-6 rounded-lg bg-core-roseSoft p-4 text-core-roseFg">{error}</div>}
      {success && <div className="mb-6 rounded-lg bg-core-greenSoft p-4 text-core-greenFg">{success}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="card-header"><h2 className="section-heading">Add Deduction</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Employee *</label>
                  <EmployeePicker
                    employees={employees}
                    value={formData.employeeId}
                    onChange={(id) => setFormData({ ...formData, employeeId: id ? String(id) : '' })}
                    required
                    showInactive={false}
                  />
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
                <tr><td colSpan={6} className="text-center py-12 text-core-text3">No deductions recorded yet</td></tr>
              ) : (
                deductions.map((d: any) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.employee?.firstName} {d.employee?.lastName}</td>
                    <td><span className="badge badge-blue">{typeLabels[d.deductionType] || d.deductionType}</span></td>
                    <td>{d.period}</td>
                    <td className="font-semibold text-core-roseFg">{d.currency} {Number(d.amount).toLocaleString()}</td>
                    <td className="text-sm text-core-text2">{d.description || '-'}</td>
                    <td className="text-sm text-core-text3">{new Date(d.createdAt).toLocaleDateString()}</td>
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

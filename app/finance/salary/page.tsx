'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

export default function SalaryManagementPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const [formData, setFormData] = useState({
    employeeId: '',
    baseSalary: '',
    currency: 'PKR',
    effectiveFrom: new Date().toISOString().split('T')[0],
    reason: '',
  });

  useEffect(() => {
    fetch('/api/expenses?meta=true')
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees || []));

    // Fetch salary history
    fetch('/api/finance/salary')
      .then((r) => r.json())
      .then((data) => setSalaryHistory(data || []))
      .catch(() => setSalaryHistory([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/finance/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update salary');
      }

      const newRecord = await res.json();
      setSalaryHistory([newRecord, ...salaryHistory]);
      setSuccess('Salary updated successfully!');
      setShowForm(false);
      setFormData({ employeeId: '', baseSalary: '', currency: 'PKR', effectiveFrom: new Date().toISOString().split('T')[0], reason: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Filter salary history
  const filteredHistory = salaryHistory.filter((record: any) => {
    const matchEmployee = !filterEmployee || record.employeeId?.toString() === filterEmployee;
    const matchYear = !filterYear || new Date(record.effectiveFrom).getFullYear().toString() === filterYear;
    return matchEmployee && matchYear;
  });

  return (
    <div>
      <PageHero
        eyebrow="Finance / Salary"
        title="Salary Management"
        description="Process salary increments and adjustments"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            New Salary Update
          </button>
        }
      />

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">{success}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Process Salary Update</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Employee *</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                    className="form-select"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.empCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">New Base Salary *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                    required
                    className="form-input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="form-select"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Effective From *</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Reason</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select Reason</option>
                    <option value="Annual Increment">Annual Increment</option>
                    <option value="Promotion">Promotion</option>
                    <option value="Performance Bonus">Performance Bonus</option>
                    <option value="Role Change">Role Change</option>
                    <option value="Market Adjustment">Market Adjustment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Processing...' : 'Update Salary'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary History Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">Salary History</h2>
        </div>
        <div className="card-body space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Filter by Employee</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="form-select"
              >
                <option value="">All Employees</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.empCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Filter by Year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="form-select"
              >
                <option value="">All Years</option>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base Salary</th>
                  <th>Currency</th>
                  <th>Effective From</th>
                  <th>Increment %</th>
                  <th>Reason</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No salary records found
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((record: any) => (
                    <tr key={record.id}>
                      <td className="font-semibold">
                        {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown'}
                      </td>
                      <td className="font-semibold text-green-700">
                        {record.baseSalary?.toLocaleString()}
                      </td>
                      <td>{record.currency}</td>
                      <td>{new Date(record.effectiveFrom).toLocaleDateString()}</td>
                      <td>
                        {record.incrementPct ? (
                          <span className="text-blue-600 font-medium">+{record.incrementPct}%</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-sm text-gray-600">{record.reason || '-'}</td>
                      <td className="text-sm text-gray-500">
                        {new Date(record.updatedAt || record.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card mt-6">
        <div className="card-header">
          <h2 className="section-heading">How Salary Updates Work</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Select Employee', desc: 'Choose the employee whose salary needs updating' },
              { step: '02', title: 'Enter New Salary', desc: 'The system auto-calculates the increment percentage' },
              { step: '03', title: 'Audit Trail', desc: 'Previous salary is closed and new record created with full history' },
            ].map((item) => (
              <div key={item.step} className="relative p-5 rounded-xl" style={{ backgroundColor: '#F8F9FF', border: '1px solid rgba(196, 198, 206, 0.25)' }}>
                <div
                  aria-hidden
                  style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 2, backgroundColor: '#14B8A6', borderRadius: '0 1px 1px 0' }}
                />
                <div className="mono text-[10px] font-bold uppercase mb-2" style={{ color: '#14B8A6', letterSpacing: '0.14em' }}>
                  Step {item.step}
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: '#0B1F3A' }}>{item.title}</h3>
                <p className="text-xs" style={{ color: '#44474D' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
}

interface Company {
  id: number;
  code: string;
  name: string;
}

interface BillingSplit {
  id: number;
  employeeId: number;
  companyId: number;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee: Employee;
  company: Company;
}

interface SalaryHistory {
  id: number;
  employeeId: number;
  baseSalary: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export default function BillingSplitPage() {
  const [billingSplits, setBillingSplits] = useState<BillingSplit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<Record<number, SalaryHistory>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    splits: [] as Array<{ companyId: string; percentage: string }>,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [splitsRes, empRes, compRes] = await Promise.all([
          fetch('/api/finance/billing'),
          fetch('/api/employees'),
          fetch('/api/settings'),
        ]);

        const splits = await splitsRes.json();
        const emps = await empRes.json();
        const compData = await compRes.json();

        setBillingSplits(splits);
        setEmployees(emps);
        setCompanies(compData.companies || []);

        // Fetch salary history for all employees
        const salaryMap: Record<number, SalaryHistory> = {};
        for (const emp of emps) {
          const salRes = await fetch(`/api/finance/salary?employeeId=${emp.id}`);
          if (salRes.ok) {
            const sal = await salRes.json();
            salaryMap[emp.id] = sal;
          }
        }
        setSalaryHistory(salaryMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const empId = e.target.value;
    const emp = employees.find((e) => e.id === parseInt(empId));

    setFormData({
      employeeId: empId,
      splits: companies.map((c) => ({ companyId: c.id.toString(), percentage: '' })),
    });
  };

  const handleSplitChange = (
    index: number,
    field: 'companyId' | 'percentage',
    value: string
  ) => {
    const newSplits = [...formData.splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setFormData({ ...formData, splits: newSplits });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Validate
      if (!formData.employeeId) {
        throw new Error('Please select an employee');
      }

      const validSplits = formData.splits.filter((s) => s.percentage && s.percentage.trim());
      if (validSplits.length === 0) {
        throw new Error('Please add at least one company split');
      }

      const total = validSplits.reduce(
        (sum, s) => sum + parseFloat(s.percentage),
        0
      );

      if (Math.abs(total - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100% (currently ${total.toFixed(1)}%)`);
      }

      const res = await fetch('/api/finance/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          splits: validSplits,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save billing splits');
      }

      // Refresh splits
      const splitsRes = await fetch('/api/finance/billing');
      const updatedSplits = await splitsRes.json();
      setBillingSplits(updatedSplits);

      setShowForm(false);
      setFormData({ employeeId: '', splits: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Group current splits by employee
  const currentSplits = billingSplits.filter((bs) => bs.effectiveTo === null);
  const splitsByEmployee: Record<number, BillingSplit[]> = {};

  currentSplits.forEach((split) => {
    if (!splitsByEmployee[split.employeeId]) {
      splitsByEmployee[split.employeeId] = [];
    }
    splitsByEmployee[split.employeeId].push(split);
  });

  // Calculate total salary cost per company
  const companyCosts: Record<number, number> = {};
  Object.entries(splitsByEmployee).forEach(([empId, splits]) => {
    const salary = salaryHistory[parseInt(empId)]?.baseSalary || 0;
    splits.forEach((split) => {
      if (!companyCosts[split.companyId]) {
        companyCosts[split.companyId] = 0;
      }
      companyCosts[split.companyId] += (salary * split.percentage) / 100;
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading billing splits...</p>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        eyebrow="Finance / Billing"
        title="Billing Split Management"
        description="Manage how employee costs are split across companies"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Billing Split
          </button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Summary Cards */}
      {companies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {companies.map((company) => (
            <div key={company.id} className="stat-card">
              <div className="stat-label">{company.name}</div>
              <div className="stat-value">
                PKR {Math.round(companyCosts[company.id] || 0).toLocaleString()}
              </div>
              <div className="stat-change">Total monthly cost</div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Add/Edit Billing Split</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="form-label">Select Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={handleEmployeeChange}
                  required
                  className="form-input"
                >
                  <option value="">Choose an employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.empCode})
                    </option>
                  ))}
                </select>
              </div>

              {formData.employeeId && formData.splits.length > 0 && (
                <div>
                  <label className="form-label mb-4">Set Billing Percentages *</label>
                  <div className="space-y-3 mb-6">
                    {formData.splits.map((split, idx) => {
                      const company = companies.find((c) => c.id === parseInt(split.companyId));
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1">
                            <span className="text-sm font-medium">{company?.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={split.percentage}
                              onChange={(e) => handleSplitChange(idx, 'percentage', e.target.value)}
                              className="form-input w-24 text-center"
                            />
                            <span className="text-sm text-gray-500 w-4">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Percentage Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Total</span>
                      <span
                        className={`text-sm font-semibold ${
                          formData.splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0) === 100
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {(
                          formData.splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0) || 0
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          formData.splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0) === 100
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            (formData.splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0) || 0),
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-primary"
                    >
                      {submitting ? 'Saving...' : 'Save Billing Split'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Employee Billing Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">Employee Billing Breakdown</h2>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Current Salary</th>
                <th>Billing Split</th>
                <th>Split Amount</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : employees.map((emp) => {
                const splits = splitsByEmployee[emp.id] || [];
                const salary = salaryHistory[emp.id]?.baseSalary || 0;
                const currency = salaryHistory[emp.id]?.currency || 'PKR';

                return (
                  <tr key={emp.id}>
                    <td className="font-semibold">
                      {emp.firstName} {emp.lastName}
                      <div className="text-xs text-gray-500">{emp.empCode}</div>
                    </td>
                    <td>
                      {salary > 0 ? (
                        <>
                          {currency} {salary.toLocaleString()}
                        </>
                      ) : (
                        <span className="text-gray-400">No salary data</span>
                      )}
                    </td>
                    <td>
                      {splits.length === 0 ? (
                        <span className="text-gray-400">No split defined</span>
                      ) : (
                        <div className="space-y-1">
                          {splits.map((split) => (
                            <div
                              key={split.id}
                              className="text-sm"
                            >
                              <span className="font-medium">{split.company.code}</span>
                              <span className="text-gray-500 ml-2">{split.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {splits.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="space-y-1">
                          {splits.map((split) => (
                            <div
                              key={split.id}
                              className="text-sm"
                            >
                              {currency} {Math.round((salary * split.percentage) / 100).toLocaleString()}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHero from '@/app/components/PageHero';
import { KpiTile } from '@/app/components/design';

export default function PayrollPage() {
  const router = useRouter();
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);

  const [newRun, setNewRun] = useState({
    period: '',
    companyId: '',
  });

  useEffect(() => {
    fetch('/api/finance/payroll')
      .then((r) => r.json())
      .then(setPayrollRuns);
    fetch('/api/companies')
      .then((r) => r.json())
      .then(setCompanies);
  }, []);

  const handleCreateRun = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/finance/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRun),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payroll run');
      }
      const run = await response.json();
      setPayrollRuns([run, ...payrollRuns]);
      setShowCreateForm(false);
      setNewRun({ period: '', companyId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeRun = async (id: number) => {
    try {
      await fetch(`/api/finance/payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' }),
      });
      // Refresh
      const runs = await fetch('/api/finance/payroll').then((r) => r.json());
      setPayrollRuns(runs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      await fetch(`/api/finance/payroll/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid' }),
      });
      const runs = await fetch('/api/finance/payroll').then((r) => r.json());
      setPayrollRuns(runs);
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    FINALIZED: 'badge-yellow',
    PAID: 'badge-green',
  };

  const kpis = useMemo(() => {
    const total = payrollRuns.length;
    const draft = payrollRuns.filter((p: any) => p.status === 'DRAFT').length;
    const finalized = payrollRuns.filter((p: any) => p.status === 'FINALIZED').length;
    const paid = payrollRuns.filter((p: any) => p.status === 'PAID').length;
    const totalNet = payrollRuns.reduce(
      (s: number, p: any) => s + Number(p.totalNet || 0),
      0,
    );
    return { total, draft, finalized, paid, totalNet };
  }, [payrollRuns]);

  const fmtPkr = (n: number) =>
    `PKR ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <PageHero
        eyebrow="Finance · Payroll"
        title="Payroll Management"
        description="Process monthly payroll for all employees"
        actions={
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-accent"
          >
            New Payroll Run
          </button>
        }
      />

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile tone="blue" label="Total Runs" value={kpis.total} />
        <KpiTile tone="amber" label="Draft" value={kpis.draft} meta="Need finalize" />
        <KpiTile tone="violet" label="Finalized" value={kpis.finalized} meta="Awaiting payout" />
        <KpiTile tone="green" label="Paid" value={kpis.paid} meta="Closed runs" />
        <KpiTile tone="rose" label="Total Net" value={fmtPkr(kpis.totalNet)} meta="Across all runs" />
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-core-roseSoft p-4 text-core-roseFg">{error}</div>
      )}

      {showCreateForm && (
        <div className="card mb-6">
          <div className="card-header"><h2 className="section-heading">Create Payroll Run</h2></div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Period (YYYY-MM) *</label>
                <input
                  type="month"
                  value={newRun.period}
                  onChange={(e) => setNewRun({ ...newRun, period: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Company (Optional)</label>
                <select
                  value={newRun.companyId}
                  onChange={(e) => setNewRun({ ...newRun, companyId: e.target.value })}
                  className="form-select"
                >
                  <option value="">All Companies</option>
                  {companies.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreateRun}
                  disabled={loading || !newRun.period}
                  className="btn btn-primary"
                >
                  {loading ? 'Processing...' : 'Generate Payroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payroll Runs Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="section-heading">Payroll Runs</h2>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Company</th>
                <th>Employees</th>
                <th>Total Gross</th>
                <th>Deductions</th>
                <th>Net Pay</th>
                <th>Status</th>
                <th className="col-sticky-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-core-text3">
                    No payroll runs yet. Create your first payroll run.
                  </td>
                </tr>
              ) : (
                payrollRuns.map((pr: any) => (
                  <tr key={pr.id}>
                    <td className="font-semibold">{pr.period}</td>
                    <td>{pr.company?.name || 'All'}</td>
                    <td>{pr.items?.length || 0}</td>
                    <td>PKR {Number(pr.totalGross).toLocaleString()}</td>
                    <td className="text-core-roseFg">PKR {Number(pr.totalDeductions).toLocaleString()}</td>
                    <td className="font-bold text-core-greenFg">PKR {Number(pr.totalNet).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${statusColors[pr.status]}`}>{pr.status}</span>
                    </td>
                    <td className="space-x-1 col-sticky-right">
                      {pr.status === 'DRAFT' && (
                        <button
                          onClick={() => handleFinalizeRun(pr.id)}
                          className="btn btn-sm btn-primary"
                        >
                          Finalize
                        </button>
                      )}
                      {pr.status === 'FINALIZED' && (
                        <button
                          onClick={() => handleMarkPaid(pr.id)}
                          className="btn btn-sm btn-primary"
                        >
                          Mark Paid
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

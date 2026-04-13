'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

export default function MonthlyReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    period: new Date().toISOString().slice(0, 7),
    companyId: '',
  });

  useEffect(() => {
    fetch('/api/finance/reports').then((r) => r.json()).then(setReports);
    fetch('/api/settings').then((r) => r.json()).then((d) => setCompanies(d.companies || []));
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/finance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to generate report');
      const report = await res.json();
      setReports([report, ...reports]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, action: string) => {
    try {
      const res = await fetch(`/api/finance/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReports(reports.map((r) => (r.id === id ? updated : r)));
      }
    } catch {}
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    UNDER_REVIEW: 'badge-yellow',
    SENT: 'badge-blue',
    ACKNOWLEDGED: 'badge-green',
  };

  const statusFlow: Record<string, { action: string; label: string }> = {
    DRAFT: { action: 'submit_review', label: 'Submit for Review' },
    UNDER_REVIEW: { action: 'send', label: 'Mark as Sent' },
    SENT: { action: 'acknowledge', label: 'Mark Acknowledged' },
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Reports"
        title="Monthly Reports"
        description="Generate and track monthly financial reports"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            Generate Report
          </button>
        }
      />

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      {showForm && (
        <div className="card mb-6">
          <div className="card-header"><h2 className="section-heading">Generate Monthly Report</h2></div>
          <div className="card-body">
            <form onSubmit={handleGenerate}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Period *</label>
                  <input type="month" value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} required className="form-input" />
                </div>
                <div>
                  <label className="form-label">Company (Optional)</label>
                  <select value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="form-select">
                    <option value="">All Companies</option>
                    {companies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Flow Legend */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-gray-700">Report Status Flow:</span>
            <span className="badge badge-gray">Draft</span>
            <span className="text-gray-400">→</span>
            <span className="badge badge-yellow">Under Review</span>
            <span className="text-gray-400">→</span>
            <span className="badge badge-blue">Sent</span>
            <span className="text-gray-400">→</span>
            <span className="badge badge-green">Acknowledged</span>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12 text-gray-500">
              No reports generated yet. Click "Generate Report" to create your first monthly report.
            </div>
          </div>
        ) : (
          reports.map((report: any) => {
            const summary = report.summary || {};
            const isExpanded = expandedReport === report.id;

            return (
              <div key={report.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="section-heading">{report.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Period: {report.period} &middot; Generated: {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge ${statusColors[report.status]}`}>{report.status.replace('_', ' ')}</span>
                      {statusFlow[report.status] && (
                        <button
                          onClick={() => handleStatusUpdate(report.id, statusFlow[report.status].action)}
                          className="btn btn-sm btn-primary"
                        >
                          {statusFlow[report.status].label}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggle Summary */}
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="mt-3 text-sm text-brand-primary hover:underline"
                  >
                    {isExpanded ? 'Hide Summary' : 'View Summary'}
                  </button>

                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Headcount', value: summary.headcount || 0 },
                        { label: 'New Hires', value: summary.newHires || 0, color: '#14B8A6' },
                        { label: 'Total Assets', value: summary.totalAssets || 0 },
                        { label: `Expenses (${summary.totalExpenseCount || 0})`, value: `PKR ${(summary.totalExpenseAmount || 0).toLocaleString()}` },
                        { label: 'Payroll Gross', value: `PKR ${(summary.payrollGross || 0).toLocaleString()}`, color: '#006B5F' },
                        { label: 'Payroll Deductions', value: `PKR ${(summary.payrollDeductions || 0).toLocaleString()}`, color: '#E11D48' },
                        { label: 'Net Payroll', value: `PKR ${(summary.payrollNet || 0).toLocaleString()}`, color: '#0B1F3A' },
                        { label: 'Pending Expenses', value: summary.pendingExpenses || 0, color: '#F59E0B' },
                      ].map((item) => (
                        <div key={item.label} className="quick-fact">
                          <div className="quick-fact-label">{item.label}</div>
                          <div className="quick-fact-value mono" style={item.color ? { color: item.color } : undefined}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {report.sentAt && (
                    <p className="mt-2 text-xs text-gray-400">Sent: {new Date(report.sentAt).toLocaleString()}</p>
                  )}
                  {report.acknowledgedAt && (
                    <p className="text-xs text-gray-400">Acknowledged: {new Date(report.acknowledgedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

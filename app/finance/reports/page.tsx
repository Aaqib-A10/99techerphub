'use client';

import { useState, useEffect, useMemo } from 'react';
import { KpiTile } from '@/app/components/design';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import MonthlyReportExportButton from './monthly/export-button';

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

  const kpis = useMemo(() => {
    const total = reports.length;
    const draft = reports.filter((r: any) => r.status === 'DRAFT').length;
    const review = reports.filter((r: any) => r.status === 'UNDER_REVIEW').length;
    const sent = reports.filter((r: any) => r.status === 'SENT').length;
    const acknowledged = reports.filter((r: any) => r.status === 'ACKNOWLEDGED').length;
    return { total, draft, review, sent, acknowledged };
  }, [reports]);

  return (
    <div>
      <PageHero
        eyebrow="Finance · Reports"
        title="Monthly Reports"
        description="Generate and track monthly financial reports"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-accent">
            Generate Report
          </button>
        }
      />

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile tone="blue" label="Total Reports" value={kpis.total} meta="All periods" />
        <KpiTile tone="amber" label="Draft" value={kpis.draft} meta="In progress" />
        <KpiTile tone="violet" label="Under Review" value={kpis.review} meta="Pending sign-off" />
        <KpiTile tone="green" label="Sent" value={kpis.sent} meta="Awaiting ack" />
        <KpiTile tone="rose" label="Acknowledged" value={kpis.acknowledged} meta="Closed" />
      </div>

      {error && <div className="mb-6 rounded-lg bg-core-roseSoft p-4 text-core-roseFg">{error}</div>}

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
            <span className="font-semibold text-core-text2">Report Status Flow:</span>
            <span className="badge badge-gray">Draft</span>
            <span className="text-core-text3">→</span>
            <span className="badge badge-yellow">Under Review</span>
            <span className="text-core-text3">→</span>
            <span className="badge badge-blue">Sent</span>
            <span className="text-core-text3">→</span>
            <span className="badge badge-green">Acknowledged</span>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12 text-core-text3">
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
                      <p className="text-sm text-core-text3 mt-1">
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

                  {/* Toggle Summary + Export */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                      className="text-sm text-core-text2 hover:underline"
                    >
                      {isExpanded ? 'Hide Summary' : 'View Summary'}
                    </button>
                    <MonthlyReportExportButton
                      reportId={report.id}
                      period={report.period}
                    />
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Headcount', value: summary.headcount || 0 },
                        { label: 'New Hires', value: summary.newHires || 0, color: '#8FBF3F' },
                        { label: 'Total Assets', value: summary.totalAssets || 0 },
                        { label: `Expenses (${summary.totalExpenseCount || 0})`, value: `PKR ${(summary.totalExpenseAmount || 0).toLocaleString()}` },
                        { label: 'Payroll Gross', value: `PKR ${(summary.payrollGross || 0).toLocaleString()}`, color: '#4A7014' },
                        { label: 'Payroll Deductions', value: `PKR ${(summary.payrollDeductions || 0).toLocaleString()}`, color: '#9E2A2A' },
                        { label: 'Net Payroll', value: `PKR ${(summary.payrollNet || 0).toLocaleString()}`, color: '#1F2320' },
                        { label: 'Pending Expenses', value: summary.pendingExpenses || 0, color: '#A66600' },
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
                    <p className="mt-2 text-xs text-core-text3">Sent: {new Date(report.sentAt).toLocaleString()}</p>
                  )}
                  {report.acknowledgedAt && (
                    <p className="text-xs text-core-text3">Acknowledged: {new Date(report.acknowledgedAt).toLocaleString()}</p>
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

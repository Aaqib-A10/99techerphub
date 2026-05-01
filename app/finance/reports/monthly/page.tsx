'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

interface ReportSummary {
  totalExpenseAmount: number;
  totalExpenseCount: number;
  approvedExpenseAmount: number;
  pendingExpenses: number;
  payrollGross: number;
  payrollNet: number;
  payrollDeductions: number;
  payrollEmployees: number;
  headcount: number;
  newHires: number;
  exits: number;
  totalAssets: number;
  newAssets: number;
}

interface MonthlyReport {
  id: number;
  period: string;
  companyId: number | null;
  title: string;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'SENT' | 'ACKNOWLEDGED';
  summary: ReportSummary;
  generatedBy: number | null;
  reviewedBy: number | null;
  sentAt: string | null;
  acknowledgedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Company {
  id: number;
  code: string;
  name: string;
}

const statusStages = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'UNDER_REVIEW', label: 'Finance Review' },
  { status: 'SENT', label: 'Sent to US Team' },
  { status: 'ACKNOWLEDGED', label: 'Acknowledged' },
];

export default function MonthlyReportsPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    period: new Date().toISOString().slice(0, 7),
    companyId: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [reportsRes, compRes] = await Promise.all([
          fetch('/api/finance/reports/monthly'),
          fetch('/api/settings'),
        ]);

        const reportsData = await reportsRes.json();
        const compData = await compRes.json();

        setReports(reportsData.reports || []);
        setCompanies(compData.companies || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/finance/reports/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate report');
      }

      const newReport = await res.json();
      setReports([newReport, ...reports]);
      setShowForm(false);
      setFormData({
        period: new Date().toISOString().slice(0, 7),
        companyId: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (
    id: number,
    action: string,
    notes?: string
  ) => {
    try {
      const res = await fetch('/api/finance/reports/monthly', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, action, notes }),
      });

      if (res.ok) {
        const updated = await res.json();
        setReports(reports.map((r) => (r.id === id ? updated : r)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    UNDER_REVIEW: 'badge-yellow',
    SENT: 'badge-blue',
    ACKNOWLEDGED: 'badge-green',
  };

  const statusFlow: Record<
    string,
    { action: string; label: string }
  > = {
    DRAFT: { action: 'submit_review', label: 'Submit for Review' },
    UNDER_REVIEW: { action: 'send', label: 'Send to US Team' },
    SENT: { action: 'acknowledge', label: 'Mark Acknowledged' },
  };

  const getStatusIndex = (status: string) => {
    return statusStages.findIndex((s) => s.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-core-text3">Loading reports...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">
        <Link href="/finance" className="breadcrumb-item">
          Finance
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item">Reports</span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item active">Monthly</span>
      </div>

      <PageHero
        eyebrow="Finance / Reports"
        title="Monthly Report Pipeline"
        description="Generate and track monthly financial and operational reports"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-accent"
          >
            + Generate Report
          </button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-core-roseSoft text-core-roseFg rounded-lg">
          {error}
        </div>
      )}

      {/* Generate Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="card-header">
            <h2 className="section-heading">Generate Monthly Report</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleGenerate}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Period *</label>
                  <input
                    type="month"
                    value={formData.period}
                    onChange={(e) =>
                      setFormData({ ...formData, period: e.target.value })
                    }
                    required
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Company (Optional)</label>
                  <select
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData({ ...formData, companyId: e.target.value })
                    }
                    className="form-input"
                  >
                    <option value="">All Companies</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    {submitting ? 'Generating...' : 'Generate'}
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
            </form>
          </div>
        </div>
      )}

      {/* Pipeline Status Legend */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-core-text2">Report Status Flow:</span>
            {statusStages.map((stage, idx) => (
              <div key={stage.status} className="flex items-center gap-2">
                <span className={`badge ${statusColors[stage.status]}`}>
                  {stage.label}
                </span>
                {idx < statusStages.length - 1 && (
                  <span className="text-core-text3">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12 text-core-text3">
              No reports generated yet. Click "Generate Report" to create your
              first monthly report.
            </div>
          </div>
        ) : (
          reports.map((report) => {
            const summary = report.summary || {};
            const isExpanded = expandedReport === report.id;
            const currentStatusIndex = getStatusIndex(report.status);

            return (
              <div key={report.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{report.title}</h3>
                      <p className="text-sm text-core-text3 mt-1">
                        Generated: {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`badge ${statusColors[report.status]}`}
                      >
                        {report.status.replace('_', ' ')}
                      </span>
                      {statusFlow[report.status] && (
                        <button
                          onClick={() =>
                            handleStatusUpdate(
                              report.id,
                              statusFlow[report.status].action
                            )
                          }
                          className="btn btn-sm btn-primary"
                        >
                          {statusFlow[report.status].label}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Pipeline Indicator */}
                  <div className="mb-4 p-3 bg-core-surface2 rounded">
                    <div className="flex items-center justify-between">
                      {statusStages.map((stage, idx) => (
                        <div
                          key={stage.status}
                          className="flex flex-col items-center flex-1"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx <= currentStatusIndex
                                ? 'bg-core-text text-white'
                                : 'bg-core-border text-core-text2'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <div className="text-xs text-core-text2 mt-2 text-center">
                            {stage.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Summary */}
                  <button
                    onClick={() =>
                      setExpandedReport(isExpanded ? null : report.id)
                    }
                    className="text-sm text-core-text2 hover:underline font-medium"
                  >
                    {isExpanded ? '▼ Hide Summary' : '▶ View Summary'}
                  </button>

                  {/* Summary Details */}
                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-core-surface2 rounded">
                        <div className="text-xs text-core-text3">Headcount</div>
                        <div className="text-xl font-bold">
                          {summary.headcount || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-core-blueSoft rounded">
                        <div className="text-xs text-core-text3">New Hires</div>
                        <div className="text-xl font-bold text-core-blueFg">
                          {summary.newHires || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-core-roseSoft rounded">
                        <div className="text-xs text-core-text3">Exits</div>
                        <div className="text-xl font-bold text-core-roseFg">
                          {summary.exits || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-core-greenSoft rounded">
                        <div className="text-xs text-core-text3">Total Assets</div>
                        <div className="text-xl font-bold text-core-greenFg">
                          {summary.totalAssets || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-core-violetSoft rounded">
                        <div className="text-xs text-core-text3">New Assets</div>
                        <div className="text-xl font-bold text-core-violetFg">
                          {summary.newAssets || 0}
                        </div>
                      </div>
                      <div className="p-3 bg-core-amberSoft rounded">
                        <div className="text-xs text-core-text3">
                          Expenses ({summary.totalExpenseCount || 0})
                        </div>
                        <div className="text-lg font-bold text-core-amberFg">
                          PKR{' '}
                          {Math.round(
                            summary.totalExpenseAmount || 0
                          ).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-core-greenSoft rounded">
                        <div className="text-xs text-core-text3">Payroll Gross</div>
                        <div className="text-lg font-bold text-core-greenFg">
                          PKR{' '}
                          {Math.round(
                            summary.payrollGross || 0
                          ).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-core-blueSoft rounded">
                        <div className="text-xs text-core-text3">Payroll Net</div>
                        <div className="text-lg font-bold text-core-blueFg">
                          PKR{' '}
                          {Math.round(
                            summary.payrollNet || 0
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="mt-4 pt-4 border-t border-core-border space-y-1 text-xs text-core-text3">
                    {report.sentAt && (
                      <p>
                        📤 Sent: {new Date(report.sentAt).toLocaleString()}
                      </p>
                    )}
                    {report.acknowledgedAt && (
                      <p>
                        ✓ Acknowledged:{' '}
                        {new Date(report.acknowledgedAt).toLocaleString()}
                      </p>
                    )}
                    {report.notes && (
                      <p className="text-core-text2 mt-2">
                        <strong>Notes:</strong> {report.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

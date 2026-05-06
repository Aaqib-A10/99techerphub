'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Tag } from '@/app/components/design';
import AttachmentInput, {
  AttachmentValue,
} from '../components/AttachmentInput';

interface Category {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LedgerEntry {
  id: number;
  serialNo: string;
  transDate: string;
  transDetail: string;
  category: { id: number; code: string; name: string };
  quantity: string;
  unitPrice: string;
  creditAmt: string;
  debitAmt: string;
  runningBal: string;
  currency: string;
  source: string;
  sourceId: number | null;
  attachmentUrl: string | null;
  reviewFlag: boolean;
  reversesEntryId: number | null;
  isReversed: boolean;
}

interface LedgerResponse {
  entries: LedgerEntry[];
  summary: {
    count: number;
    totalCredit: number;
    totalDebit: number;
    currentBalance: number;
  };
}

const SOURCE_TONE: Record<string, 'green' | 'blue' | 'violet' | 'amber' | 'rose' | 'gray'> = {
  MANUAL: 'gray',
  BILL: 'amber',
  CHEQUE: 'blue',
  OPEX: 'violet',
  EXPENSE: 'rose',
  PAYROLL: 'green',
  OPENING: 'green',
};

export default function LedgerAllTab({ categories }: { categories: Category[] }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerResponse['summary']>({
    count: 0,
    totalCredit: 0,
    totalDebit: 0,
    currentBalance: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    category: '',
    source: '',
    q: '',
  });
  const [reverseModal, setReverseModal] = useState<LedgerEntry | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseSubmitting, setReverseSubmitting] = useState(false);

  // Manual-entry modal state. Lets ADMIN/ACCOUNTANT post a one-off
  // correction that doesn't fit Bill / Cheque / OPEX. Same image
  // hard-stop applies to cash-out entries.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manual, setManual] = useState({
    transDate: new Date().toISOString().slice(0, 10),
    transDetail: '',
    categoryId: '',
    direction: 'debit' as 'debit' | 'credit',
    amount: '',
  });
  const [manualAttachment, setManualAttachment] = useState<AttachmentValue | null>(null);

  const resetManual = () => {
    setManual({
      transDate: new Date().toISOString().slice(0, 10),
      transDetail: '',
      categoryId: '',
      direction: 'debit',
      amount: '',
    });
    setManualAttachment(null);
    setManualError('');
  };

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(manual.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setManualError('Amount must be > 0.');
      return;
    }
    if (manual.direction === 'debit' && !manualAttachment) {
      setManualError('Cash-out entries require an attachment.');
      return;
    }
    setManualSubmitting(true);
    setManualError('');
    try {
      const res = await fetch('/api/finance/ledger/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transDate: new Date(manual.transDate).toISOString(),
          transDetail: manual.transDetail,
          categoryId: parseInt(manual.categoryId),
          creditAmt: manual.direction === 'credit' ? amt : 0,
          debitAmt: manual.direction === 'debit' ? amt : 0,
          attachmentUrl: manualAttachment?.url ?? null,
          attachmentMeta: manualAttachment?.meta ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to post entry');
      setManualOpen(false);
      resetManual();
      fetchEntries();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to post entry');
    } finally {
      setManualSubmitting(false);
    }
  }

  const fetchEntries = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.category) params.set('category', filters.category);
      if (filters.source) params.set('source', filters.source);
      if (filters.q) params.set('q', filters.q);
      const res = await fetch(`/api/finance/ledger?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setEntries(data.entries);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.category, filters.source]);

  // Search debounced
  useEffect(() => {
    const t = setTimeout(fetchEntries, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  async function submitReverse() {
    if (!reverseModal) return;
    setReverseSubmitting(true);
    try {
      const res = await fetch(`/api/finance/ledger/${reverseModal.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reverseReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Reversal failed');
      setReverseModal(null);
      setReverseReason('');
      fetchEntries();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reversal failed');
    } finally {
      setReverseSubmitting(false);
    }
  }

  const exportCsv = () => {
    const headers = [
      'Serial', 'Date', 'Description', 'Category', 'Source', 'Credit', 'Debit', 'Running Bal',
    ];
    const rows = entries.map((e) => [
      e.serialNo,
      new Date(e.transDate).toLocaleDateString(),
      e.transDetail.replace(/"/g, '""'),
      e.category.name,
      e.source,
      e.creditAmt,
      e.debitAmt,
      e.runningBal,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Filter strip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search serial or detail…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="h-9 w-full max-w-[260px] rounded-lg border border-core-border bg-core-surface px-3 text-[12.5px] text-core-text placeholder:text-core-text3 focus:border-core-text/30 focus:outline-none"
        />
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
          aria-label="From"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
          aria-label="To"
        />
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.source}
          onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          className="h-9 rounded-lg border border-core-border bg-core-surface px-2 text-[12.5px] text-core-text2"
        >
          <option value="">All sources</option>
          <option value="MANUAL">Manual</option>
          <option value="BILL">Bill</option>
          <option value="CHEQUE">Cheque</option>
          <option value="OPEX">OPEX</option>
          <option value="EXPENSE">Expense</option>
          <option value="PAYROLL">Payroll</option>
          <option value="OPENING">Opening</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              resetManual();
              setManualOpen(true);
            }}
            className="btn btn-sm btn-primary"
          >
            + Manual Entry
          </button>
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="btn btn-sm btn-secondary disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">{error}</div>
      )}

      <Card
        title="Ledger Entries"
        subtitle={`${summary.count} entries · Credits PKR ${summary.totalCredit.toLocaleString()} · Debits PKR ${summary.totalDebit.toLocaleString()}`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['SN', 'Date', 'Description', 'Category', 'Source', 'Credit', 'Debit', 'Balance', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-core-border px-[12px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-core-text3">Loading…</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-core-text3">
                    No entries match these filters.
                  </td>
                </tr>
              ) : (
                entries.map((e, idx) => {
                  const isLast = idx === entries.length - 1;
                  return (
                    <tr
                      key={e.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className={`hover:bg-core-surface2 ${e.isReversed ? 'opacity-60' : ''}`}
                    >
                      <td className="whitespace-nowrap px-[12px] py-[8px]"><Tag>{e.serialNo}</Tag></td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] tabular-nums text-core-text2">
                        {new Date(e.transDate).toLocaleDateString()}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text">
                        <div className="flex items-center gap-2">
                          {e.transDetail}
                          {e.attachmentUrl && (
                            <a
                              href={e.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Attachment"
                              className="text-core-text3 hover:text-core-text"
                            >
                              📎
                            </a>
                          )}
                          {e.reviewFlag && (
                            <span title="Flagged for review">⚠️</span>
                          )}
                          {e.isReversed && <Badge tone="rose">Reversed</Badge>}
                          {e.reversesEntryId && <Badge tone="amber">Contra</Badge>}
                        </div>
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">{e.category.name}</td>
                      <td className="px-[12px] py-[8px]">
                        <Badge tone={SOURCE_TONE[e.source] ?? 'gray'}>{e.source}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-greenFg tabular-nums">
                        {Number(e.creditAmt) > 0 ? Number(e.creditAmt).toLocaleString() : '—'}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-roseFg tabular-nums">
                        {Number(e.debitAmt) > 0 ? Number(e.debitAmt).toLocaleString() : '—'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-[12px] py-[8px] text-right font-mono font-semibold tabular-nums ${
                          Number(e.runningBal) < 0 ? 'text-core-roseFg' : 'text-core-text'
                        }`}
                      >
                        {Number(e.runningBal).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right">
                        {!e.isReversed && !e.reversesEntryId && (
                          <button
                            onClick={() => {
                              setReverseModal(e);
                              setReverseReason('');
                            }}
                            className="text-[11.5px] font-semibold text-core-text3 hover:text-core-roseFg"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reverse modal */}
      {reverseModal && (
        <div className="modal-overlay" onClick={() => !reverseSubmitting && setReverseModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reverse {reverseModal.serialNo}</h2>
              <button
                onClick={() => !reverseSubmitting && setReverseModal(null)}
                className="text-core-text3 hover:text-core-text"
              >×</button>
            </div>
            <div className="modal-body space-y-3">
              <p className="text-[12.5px] text-core-text2">
                This posts a contra entry that mirrors {reverseModal.serialNo}{' '}
                ({reverseModal.transDetail}). The original row stays in place
                with a "Reversed" badge — nothing is deleted.
              </p>
              <div className="rounded-lg bg-core-surface2 p-3 text-[12px]">
                <div><strong>Original:</strong> {reverseModal.transDetail}</div>
                <div className="mt-1 font-mono">
                  Credit {Number(reverseModal.creditAmt).toLocaleString()} · Debit {Number(reverseModal.debitAmt).toLocaleString()}
                </div>
              </div>
              <label className="form-label">Reason *</label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                rows={3}
                className="form-textarea"
                placeholder="Why is this entry being reversed? (e.g. duplicate post, wrong amount)"
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => !reverseSubmitting && setReverseModal(null)}
                className="btn btn-secondary"
                disabled={reverseSubmitting}
              >Cancel</button>
              <button
                onClick={submitReverse}
                disabled={reverseSubmitting || !reverseReason.trim()}
                className="btn btn-primary"
              >
                {reverseSubmitting ? 'Posting…' : 'Post Contra Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry modal — for one-off corrections that don't fit
          Bill / Cheque / OPEX. Cash-out entries still need an attachment. */}
      {manualOpen && (
        <div
          className="modal-overlay"
          onClick={() => !manualSubmitting && setManualOpen(false)}
        >
          <div
            className="modal max-w-[640px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Manual Ledger Entry</h2>
              <button
                onClick={() => !manualSubmitting && setManualOpen(false)}
                className="text-core-text3 hover:text-core-text"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitManual}>
              <div className="modal-body space-y-3">
                <p className="text-[12px] text-core-text3">
                  Use this for one-off corrections that don't have a Bill,
                  Cheque, or OPEX record behind them. Cash-out entries
                  require an attachment.
                </p>
                {manualError && (
                  <div className="rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
                    {manualError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={manual.transDate}
                      onChange={(e) =>
                        setManual({ ...manual, transDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Direction *</label>
                    <select
                      className="form-select"
                      value={manual.direction}
                      onChange={(e) =>
                        setManual({
                          ...manual,
                          direction: e.target.value as 'debit' | 'credit',
                        })
                      }
                    >
                      <option value="debit">Debit (cash out)</option>
                      <option value="credit">Credit (cash in)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Amount (PKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={manual.amount}
                      onChange={(e) =>
                        setManual({ ...manual, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={manual.categoryId}
                      onChange={(e) =>
                        setManual({ ...manual, categoryId: e.target.value })
                      }
                      required
                    >
                      <option value="">Select…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={manual.transDetail}
                    onChange={(e) =>
                      setManual({ ...manual, transDetail: e.target.value })
                    }
                    required
                    placeholder="What this entry covers"
                  />
                </div>
                <AttachmentInput
                  value={manualAttachment}
                  onChange={setManualAttachment}
                  required={manual.direction === 'debit'}
                  label={
                    manual.direction === 'debit'
                      ? 'Attachment (required for cash out)'
                      : 'Attachment (optional for cash in)'
                  }
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => !manualSubmitting && setManualOpen(false)}
                  className="btn btn-secondary"
                  disabled={manualSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    manualSubmitting ||
                    !manual.transDetail.trim() ||
                    !manual.amount ||
                    !manual.categoryId
                  }
                >
                  {manualSubmitting ? 'Posting…' : 'Post Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

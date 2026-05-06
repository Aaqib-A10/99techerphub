'use client';

import { useEffect, useState } from 'react';
import { Card, Badge, Tag } from '@/app/components/design';
import AttachmentInput, {
  AttachmentValue,
} from '../components/AttachmentInput';
import CategoryPicker, { combineDescription } from '../components/CategoryPicker';

interface Category {
  id: number;
  code: string;
  name: string;
  type?: string;
}

interface OpexEntry {
  id: number;
  type: 'RENTAL' | 'MAINTENANCE' | 'DONATION' | 'SALARY' | 'UTILITY' | 'OTHER';
  recipient: string;
  period: string | null;
  amount: string;
  currency: string;
  description: string | null;
  attachmentUrl: string;
  category: { id: number; name: string };
  ledgerEntry: { id: number; serialNo: string; runningBal: string } | null;
  paidAt: string;
}

const TYPE_TONE: Record<string, 'blue' | 'amber' | 'green' | 'violet' | 'rose' | 'gray'> = {
  RENTAL: 'blue',
  MAINTENANCE: 'amber',
  DONATION: 'green',
  SALARY: 'violet',
  UTILITY: 'rose',
  OTHER: 'gray',
};

export default function OpexTab({ categories }: { categories: Category[] }) {
  const [entries, setEntries] = useState<OpexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'RENTAL' as OpexEntry['type'],
    recipient: '',
    period: '',
    amount: '',
    categoryId: '',
    description: '',
    paidAt: new Date().toISOString().slice(0, 10),
  });
  const [customNote, setCustomNote] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/opex');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!attachment) {
      setError('A receipt/voucher is required.');
      return;
    }
    const selected = localCategories.find((c) => c.id === parseInt(form.categoryId));
    if (selected?.code === 'OTHER' && !customNote.trim()) {
      setError('Tell us what this is for when picking "Other".');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/finance/opex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          categoryId: parseInt(form.categoryId),
          paidAt: new Date(form.paidAt).toISOString(),
          description: combineDescription(selected?.code, form.description, customNote),
          attachmentUrl: attachment.url,
          attachmentMeta: attachment.meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setShowForm(false);
      resetForm();
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      type: 'RENTAL',
      recipient: '',
      period: '',
      amount: '',
      categoryId: '',
      description: '',
      paidAt: new Date().toISOString().slice(0, 10),
    });
    setCustomNote('');
    setAttachment(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => {
            setShowForm(!showForm);
            setError('');
          }}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'New OPEX Entry'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      {showForm && (
        <Card title="Add OPEX Entry" subtitle="Posts immediately as a debit. Receipt required.">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Type *</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                >
                  <option value="RENTAL">Rental</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DONATION">Donation</option>
                  <option value="SALARY">Salary (operational, non-payroll)</option>
                  <option value="UTILITY">Utility</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="form-label">Recipient *</label>
                <input
                  className="form-input"
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  placeholder="Who got paid"
                  required
                />
              </div>
              <div>
                <label className="form-label">Period</label>
                <input
                  className="form-input"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="e.g. April 2026 / Q2 2026"
                />
              </div>
              <div>
                <label className="form-label">Amount (PKR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Paid On *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                  required
                />
              </div>
              <div>
                <CategoryPicker
                  categories={localCategories}
                  value={form.categoryId ? parseInt(form.categoryId) : null}
                  onChange={(id) => setForm({ ...form, categoryId: String(id) })}
                  customNote={customNote}
                  onCustomNoteChange={setCustomNote}
                  mode="smart"
                  createEndpoint="/api/finance/ledger/categories"
                  onCategoryCreated={(c) =>
                    setLocalCategories((prev) =>
                      prev.find((p) => p.id === c.id) ? prev : [...prev, c],
                    )
                  }
                  required
                  label="Category (Account Head)"
                />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <AttachmentInput
                  value={attachment}
                  onChange={setAttachment}
                  required
                  label="Receipt / voucher"
                  hint="Required. Receipt, invoice, or signed disbursement slip."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn btn-secondary"
              >Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !attachment}
              >
                {submitting ? 'Posting…' : 'Save & Post to Ledger'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="OPEX Entries"
        subtitle={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
        padded={false}
        className={showForm ? 'mt-6' : ''}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Type', 'Recipient', 'Period', 'Amount', 'Category', 'Paid', 'Ledger SN', ''].map((h) => (
                  <th
                    key={h}
                    className="border-b border-core-border px-[12px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-core-text3">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-core-text3">No OPEX entries yet.</td></tr>
              ) : (
                entries.map((e, i) => {
                  const isLast = i === entries.length - 1;
                  return (
                    <tr
                      key={e.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className="hover:bg-core-surface2"
                    >
                      <td className="px-[12px] py-[8px]"><Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge></td>
                      <td className="px-[12px] py-[8px] text-core-text">
                        <div>{e.recipient}</div>
                        {e.description && <div className="mt-[1px] text-[11px] text-core-text3">{e.description}</div>}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">{e.period ?? '—'}</td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-text">
                        PKR {Number(e.amount).toLocaleString()}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">{e.category.name}</td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] tabular-nums text-core-text2">
                        {new Date(e.paidAt).toLocaleDateString()}
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {e.ledgerEntry ? <Tag>{e.ledgerEntry.serialNo}</Tag> : <span className="text-core-text3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px]">
                        {e.attachmentUrl && (
                          <a
                            href={e.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
                          >View</a>
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
    </div>
  );
}

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

interface Bill {
  id: number;
  billNumber: string;
  vendorName: string;
  amount: string;
  currency: string;
  billDate: string;
  dueDate: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  description: string | null;
  attachmentUrl: string;
  category: { id: number; name: string };
  ledgerEntry: { id: number; serialNo: string } | null;
  paidAt: string | null;
}

const STATUS_TONE: Record<string, 'amber' | 'green' | 'rose' | 'gray'> = {
  PENDING: 'amber',
  PAID: 'green',
  OVERDUE: 'rose',
  CANCELLED: 'gray',
};

export default function BillingTab({ categories }: { categories: Category[] }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    billNumber: '',
    vendorName: '',
    vendorContact: '',
    amount: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    categoryId: '',
    description: '',
  });
  const [customNote, setCustomNote] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/bills');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!attachment) {
      setError('A bill scan/photo is required.');
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
      const res = await fetch('/api/finance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          categoryId: parseInt(form.categoryId),
          billDate: new Date(form.billDate).toISOString(),
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
          description: combineDescription(selected?.code, form.description, customNote),
          attachmentUrl: attachment.url,
          attachmentMeta: attachment.meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setShowForm(false);
      resetForm();
      fetchBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function payBill(id: number) {
    if (!confirm('Mark this bill PAID and post a debit to the ledger?')) return;
    try {
      const res = await fetch(`/api/finance/bills/${id}/pay`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Pay failed');
      fetchBills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pay failed');
    }
  }

  function resetForm() {
    setForm({
      billNumber: '',
      vendorName: '',
      vendorContact: '',
      amount: '',
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      categoryId: '',
      description: '',
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
          {showForm ? 'Cancel' : 'New Bill'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      {showForm && (
        <Card title="Add Bill" subtitle="A scan or photo of the bill is required.">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Bill Number *</label>
                <input
                  className="form-input"
                  value={form.billNumber}
                  onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Vendor Name *</label>
                <input
                  className="form-input"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Vendor Contact</label>
                <input
                  className="form-input"
                  value={form.vendorContact}
                  onChange={(e) => setForm({ ...form, vendorContact: e.target.value })}
                  placeholder="Phone or email"
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
                <label className="form-label">Bill Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.billDate}
                  onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
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
                  placeholder="What this bill covers"
                />
              </div>
              <div className="md:col-span-2">
                <AttachmentInput
                  value={attachment}
                  onChange={setAttachment}
                  required
                  label="Bill scan / photo"
                  hint="Required. Image or PDF of the actual bill."
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
                {submitting ? 'Saving…' : 'Save Bill'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Bills"
        subtitle={`${bills.length} ${bills.length === 1 ? 'record' : 'records'}`}
        padded={false}
        className={showForm ? 'mt-6' : ''}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Bill #', 'Vendor', 'Amount', 'Bill Date', 'Due', 'Category', 'Status', 'Ledger SN', 'Actions'].map(
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
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-core-text3">Loading…</td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-core-text3">No bills yet.</td>
                </tr>
              ) : (
                bills.map((b, i) => {
                  const isLast = i === bills.length - 1;
                  return (
                    <tr
                      key={b.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className="hover:bg-core-surface2"
                    >
                      <td className="px-[12px] py-[8px] font-mono text-[11.5px]">{b.billNumber}</td>
                      <td className="px-[12px] py-[8px] text-core-text">
                        <div>{b.vendorName}</div>
                        {b.description && <div className="mt-[1px] text-[11px] text-core-text3">{b.description}</div>}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-text">
                        PKR {Number(b.amount).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] tabular-nums text-core-text2">
                        {new Date(b.billDate).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] tabular-nums text-core-text2">
                        {b.dueDate ? new Date(b.dueDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">{b.category.name}</td>
                      <td className="px-[12px] py-[8px]">
                        <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {b.ledgerEntry ? <Tag>{b.ledgerEntry.serialNo}</Tag> : <span className="text-core-text3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px]">
                        <div className="flex items-center gap-2">
                          {b.attachmentUrl && (
                            <a
                              href={b.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
                            >
                              View
                            </a>
                          )}
                          {b.status === 'PENDING' && (
                            <button
                              onClick={() => payBill(b.id)}
                              className="btn btn-sm btn-primary"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
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

'use client';

import { useEffect, useState } from 'react';
import { Card, Badge, Tag } from '@/app/components/design';
import AttachmentInput, {
  AttachmentValue,
} from '../components/AttachmentInput';

interface Cheque {
  id: number;
  instrumentNo: string;
  bankName: string;
  partyName: string;
  chequeDate: string;
  amount: string;
  currency: string;
  direction: 'RECEIVED' | 'ISSUED';
  status: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'CANCELLED';
  description: string | null;
  attachmentUrl: string;
  ledgerEntry: { id: number; serialNo: string } | null;
  clearedAt: string | null;
}

const STATUS_TONE: Record<string, 'amber' | 'green' | 'rose' | 'gray'> = {
  PENDING: 'amber',
  CLEARED: 'green',
  BOUNCED: 'rose',
  CANCELLED: 'gray',
};

export default function ChequesTab() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    instrumentNo: '',
    bankName: '',
    partyName: '',
    chequeDate: new Date().toISOString().slice(0, 10),
    amount: '',
    direction: 'RECEIVED' as 'RECEIVED' | 'ISSUED',
    description: '',
  });
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);

  const fetchCheques = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/cheques');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load');
      setCheques(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheques();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!attachment) {
      setError('A cheque scan/photo is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/finance/cheques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          chequeDate: new Date(form.chequeDate).toISOString(),
          attachmentUrl: attachment.url,
          attachmentMeta: attachment.meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setShowForm(false);
      resetForm();
      fetchCheques();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function clearCheque(id: number) {
    if (!confirm('Mark this cheque CLEARED and post to the ledger?')) return;
    try {
      const res = await fetch(`/api/finance/cheques/${id}/clear`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to clear');
      fetchCheques();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to clear');
    }
  }

  function resetForm() {
    setForm({
      instrumentNo: '',
      bankName: '',
      partyName: '',
      chequeDate: new Date().toISOString().slice(0, 10),
      amount: '',
      direction: 'RECEIVED',
      description: '',
    });
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
          {showForm ? 'Cancel' : 'New Cheque'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      {showForm && (
        <Card title="Add Cheque" subtitle="A scan/photo of the cheque is required.">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Direction *</label>
                <select
                  className="form-select"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as any })}
                >
                  <option value="RECEIVED">RECEIVED — money coming in</option>
                  <option value="ISSUED">ISSUED — money going out</option>
                </select>
              </div>
              <div>
                <label className="form-label">Bank Name *</label>
                <input
                  className="form-input"
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="e.g. Bank Al Habib Limited"
                  required
                />
              </div>
              <div>
                <label className="form-label">Instrument / Cheque No *</label>
                <input
                  className="form-input"
                  value={form.instrumentNo}
                  onChange={(e) => setForm({ ...form, instrumentNo: e.target.value })}
                  placeholder="e.g. 10081161"
                  required
                />
              </div>
              <div>
                <label className="form-label">{form.direction === 'RECEIVED' ? 'From (Payer)' : 'To (Payee)'} *</label>
                <input
                  className="form-input"
                  value={form.partyName}
                  onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Cheque Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.chequeDate}
                  onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                  required
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
                  label="Cheque scan / photo"
                  hint="Required. Front of the cheque ideally."
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
                {submitting ? 'Saving…' : 'Save Cheque'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Cheques"
        subtitle={`${cheques.length} ${cheques.length === 1 ? 'record' : 'records'}`}
        padded={false}
        className={showForm ? 'mt-6' : ''}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Bank · No', 'Direction', 'Party', 'Date', 'Amount', 'Status', 'Ledger SN', 'Actions'].map(
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
                  <td colSpan={8} className="py-8 text-center text-core-text3">Loading…</td>
                </tr>
              ) : cheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-core-text3">No cheques yet.</td>
                </tr>
              ) : (
                cheques.map((c, i) => {
                  const isLast = i === cheques.length - 1;
                  return (
                    <tr
                      key={c.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className="hover:bg-core-surface2"
                    >
                      <td className="px-[12px] py-[8px]">
                        <div className="text-core-text">{c.bankName}</div>
                        <div className="mt-[1px] font-mono text-[11px] text-core-text3">{c.instrumentNo}</div>
                      </td>
                      <td className="px-[12px] py-[8px]">
                        <Badge tone={c.direction === 'RECEIVED' ? 'green' : 'rose'}>{c.direction}</Badge>
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">{c.partyName}</td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] tabular-nums text-core-text2">
                        {new Date(c.chequeDate).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px] text-right font-mono text-core-text">
                        PKR {Number(c.amount).toLocaleString()}
                      </td>
                      <td className="px-[12px] py-[8px]">
                        <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {c.ledgerEntry ? <Tag>{c.ledgerEntry.serialNo}</Tag> : <span className="text-core-text3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px]">
                        <div className="flex items-center gap-2">
                          {c.attachmentUrl && (
                            <a
                              href={c.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
                            >View</a>
                          )}
                          {c.status === 'PENDING' && (
                            <button
                              onClick={() => clearCheque(c.id)}
                              className="btn btn-sm btn-primary"
                            >
                              Mark Cleared
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

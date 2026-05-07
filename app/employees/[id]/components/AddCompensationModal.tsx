'use client';

import { useState } from 'react';

/**
 * Single shared modal for the four "Add X" buttons on the
 * Compensation tab. The form shape switches based on `type`:
 *
 *   salary      — base salary (sets new BASE; previous one auto-end-dates)
 *   bonus       — one-time bonus
 *   commission  — period-scoped commission
 *   deduction   — period-scoped deduction (TAX/LOAN/ADVANCE/INSURANCE/OTHER)
 *
 * Each form posts to /api/compensation/<type>. Errors come back
 * as JSON {error}; we surface them inline in the modal body so the
 * user doesn't have to close it to read them.
 */

export type CompType = 'salary' | 'bonus' | 'commission' | 'deduction';

interface Props {
  employeeId: number;
  type: CompType;
  onClose: () => void;
  onSuccess: () => void;
}

const TITLES: Record<CompType, string> = {
  salary: 'Set New Salary',
  bonus: 'Add Bonus',
  commission: 'Add Commission',
  deduction: 'Add Deduction',
};

const DEDUCTION_TYPES = ['TAX', 'LOAN', 'ADVANCE', 'INSURANCE', 'OTHER'];

export default function AddCompensationModal({
  employeeId,
  type,
  onClose,
  onSuccess,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7); // YYYY-MM

  // Single form state covers all four shapes; only the relevant
  // fields are read on submit per type.
  const [form, setForm] = useState({
    amount: '',
    currency: 'PKR' as 'PKR' | 'USD',
    effectiveFrom: today,
    awardedDate: today,
    reason: '',
    description: '',
    period: currentPeriod,
    isPaid: false,
    deductionType: 'OTHER',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const upd = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be a positive number.');
      setSubmitting(false);
      return;
    }

    let body: any = { employeeId, amount, currency: form.currency };
    if (type === 'salary') {
      body.effectiveFrom = new Date(form.effectiveFrom).toISOString();
      body.baseSalary = amount;
      body.reason = form.reason || null;
      delete body.amount;
    } else if (type === 'bonus') {
      body.reason = form.reason;
      body.awardedDate = new Date(form.awardedDate).toISOString();
      body.period = form.period || null;
      body.isPaid = form.isPaid;
      body.notes = form.notes || null;
    } else if (type === 'commission') {
      body.description = form.description;
      body.period = form.period;
      body.isPaid = form.isPaid;
    } else if (type === 'deduction') {
      body.deductionType = form.deductionType;
      body.description = form.description || null;
      body.period = form.period;
    }

    try {
      const res = await fetch(`/api/compensation/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw.slice(0, 200) };
      }
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (HTTP ${res.status}).`);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div
        className="modal max-w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{TITLES[type]}</h2>
          <button
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="text-core-text3 hover:text-core-text"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body space-y-3">
            {error && (
              <div className="rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="form-label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => upd({ amount: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Currency *</label>
                <select
                  value={form.currency}
                  onChange={(e) => upd({ currency: e.target.value as any })}
                  className="form-select"
                >
                  <option value="PKR">PKR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {type === 'salary' && (
              <>
                <div>
                  <label className="form-label">Effective From *</label>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => upd({ effectiveFrom: e.target.value })}
                    className="form-input"
                    required
                  />
                  <p className="mt-1 text-[11px] text-core-text3">
                    Saving this auto-end-dates any previously active
                    salary one day before the new effective date.
                  </p>
                </div>
                <div>
                  <label className="form-label">Reason</label>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => upd({ reason: e.target.value })}
                    placeholder='e.g. "Annual review 2026", "Promotion to Senior"'
                    className="form-input"
                  />
                </div>
              </>
            )}

            {type === 'bonus' && (
              <>
                <div>
                  <label className="form-label">Reason *</label>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => upd({ reason: e.target.value })}
                    placeholder='e.g. "Eid bonus 2026", "Q1 performance"'
                    className="form-input"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Awarded On *</label>
                    <input
                      type="date"
                      value={form.awardedDate}
                      onChange={(e) => upd({ awardedDate: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Period (optional)</label>
                    <input
                      type="text"
                      value={form.period}
                      onChange={(e) => upd({ period: e.target.value })}
                      placeholder="e.g. 2026-Q1"
                      className="form-input"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-core-text2">
                  <input
                    type="checkbox"
                    checked={form.isPaid}
                    onChange={(e) => upd({ isPaid: e.target.checked })}
                  />
                  Paid out (otherwise tracked as unpaid)
                </label>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => upd({ notes: e.target.value })}
                    className="form-textarea"
                  />
                </div>
              </>
            )}

            {type === 'commission' && (
              <>
                <div>
                  <label className="form-label">Description *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => upd({ description: e.target.value })}
                    placeholder='e.g. "5% on May sales of $100K"'
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Period *</label>
                  <input
                    type="text"
                    value={form.period}
                    onChange={(e) => upd({ period: e.target.value })}
                    placeholder='e.g. "2026-05" or "Q1 2026"'
                    className="form-input"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-core-text2">
                  <input
                    type="checkbox"
                    checked={form.isPaid}
                    onChange={(e) => upd({ isPaid: e.target.checked })}
                  />
                  Paid out
                </label>
              </>
            )}

            {type === 'deduction' && (
              <>
                <div>
                  <label className="form-label">Type *</label>
                  <select
                    value={form.deductionType}
                    onChange={(e) => upd({ deductionType: e.target.value })}
                    className="form-select"
                  >
                    {DEDUCTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Period *</label>
                  <input
                    type="text"
                    value={form.period}
                    onChange={(e) => upd({ period: e.target.value })}
                    placeholder='e.g. "2026-05"'
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => upd({ description: e.target.value })}
                    placeholder='e.g. "Loan installment 3/12"'
                    className="form-input"
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

/**
 * Single shared modal for the four "Add X" / "Edit X" entry points
 * on the Compensation tab. The form shape switches based on `type`:
 *
 *   salary      — base salary (creating sets a new BASE; previous one
 *                 auto-end-dates. editing patches the row directly —
 *                 use carefully on the active row, since editing a
 *                 raise's amount in place erases the audit trail of
 *                 the original number)
 *   bonus       — one-time bonus
 *   commission  — period-scoped commission
 *   deduction   — period-scoped deduction (TAX/LOAN/ADVANCE/INSURANCE/OTHER)
 *
 * Pass `editing` to switch the modal into edit mode; the form
 * prefills from the existing row and the submit goes PATCH instead of
 * POST. Otherwise it's the original create flow.
 */

export type CompType = 'salary' | 'bonus' | 'commission' | 'deduction';

interface Props {
  employeeId: number;
  type: CompType;
  /**
   * Existing row to edit. When omitted the modal is in create mode.
   * The shape varies per type — we read whichever fields the current
   * type cares about and ignore the rest.
   */
  editing?: { id: number; data: any } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CREATE_TITLES: Record<CompType, string> = {
  salary: 'Set New Salary',
  bonus: 'Add Bonus',
  commission: 'Add Commission',
  deduction: 'Add Deduction',
};

const EDIT_TITLES: Record<CompType, string> = {
  salary: 'Edit Salary Entry',
  bonus: 'Edit Bonus',
  commission: 'Edit Commission',
  deduction: 'Edit Deduction',
};

const DEDUCTION_TYPES = ['TAX', 'LOAN', 'ADVANCE', 'INSURANCE', 'OTHER'];

// Pull a YYYY-MM-DD slice safely off either an ISO string or Date.
function toDateInput(v: any): string {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : (v as Date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function AddCompensationModal({
  employeeId,
  type,
  editing,
  onClose,
  onSuccess,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7); // YYYY-MM
  const isEdit = !!editing;

  // Initial form values — empty for create, prefilled from the
  // existing row when editing. The mapping is per-type because
  // salary stores the amount as `baseSalary` while everything else
  // uses `amount`.
  const initial = (() => {
    if (!editing) {
      return {
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
      };
    }
    const d = editing.data;
    if (type === 'salary') {
      return {
        amount: String(d.baseSalary ?? ''),
        currency: (d.currency === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD',
        effectiveFrom: toDateInput(d.effectiveFrom) || today,
        awardedDate: today,
        reason: d.reason ?? '',
        description: '',
        period: currentPeriod,
        isPaid: false,
        deductionType: 'OTHER',
        notes: '',
      };
    }
    if (type === 'bonus') {
      return {
        amount: String(d.amount ?? ''),
        currency: (d.currency === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD',
        effectiveFrom: today,
        awardedDate: toDateInput(d.awardedDate) || today,
        reason: d.reason ?? '',
        description: '',
        period: d.period ?? '',
        isPaid: !!d.isPaid,
        deductionType: 'OTHER',
        notes: d.notes ?? '',
      };
    }
    if (type === 'commission') {
      return {
        amount: String(d.amount ?? ''),
        currency: (d.currency === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD',
        effectiveFrom: today,
        awardedDate: today,
        reason: '',
        description: d.description ?? '',
        period: d.period ?? currentPeriod,
        isPaid: !!d.isPaid,
        deductionType: 'OTHER',
        notes: '',
      };
    }
    // deduction
    return {
      amount: String(d.amount ?? ''),
      currency: (d.currency === 'USD' ? 'USD' : 'PKR') as 'PKR' | 'USD',
      effectiveFrom: today,
      awardedDate: today,
      reason: '',
      description: d.description ?? '',
      period: d.period ?? currentPeriod,
      isPaid: false,
      deductionType: d.deductionType ?? 'OTHER',
      notes: '',
    };
  })();

  const [form, setForm] = useState(initial);
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

    // Edit mode patches the existing row; create posts a new one.
    // Both endpoints accept the same body shape per type, so the only
    // difference is method + URL.
    const url = isEdit
      ? `/api/compensation/${type}/${editing!.id}`
      : `/api/compensation/${type}`;
    const method = isEdit ? 'PATCH' : 'POST';
    // employeeId is locked at creation time and not editable; strip
    // it from PATCH bodies.
    if (isEdit) delete body.employeeId;

    try {
      const res = await fetch(url, {
        method,
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
          <h2>{(isEdit ? EDIT_TITLES : CREATE_TITLES)[type]}</h2>
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

'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Editable billing splits section. Drops into FinanceTab in place of
 * the old read-only block.
 *
 * Self-contained:
 *   - Receives initial split rows + the employee's current base
 *     salary (for the live "PKR 39,400" preview next to each %).
 *   - Fetches the company list on mount for the picker.
 *   - Manages its own CRUD state; calls /api/compensation/billing-split.
 *   - Shows a soft warning if active rows don't sum to 100% (per
 *     spec — splits change rarely so partial states during edits are
 *     fine, but flag for visibility).
 *
 * The 100% cap is server-enforced too — this UI's job is to make
 * the cap obvious before save.
 */

interface SplitRow {
  id: number;
  companyId: number;
  company?: { id: number; name: string; code: string } | null;
  percentage: number | string;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
}

interface CompanyOpt {
  id: number;
  name: string;
  code: string;
}

interface Props {
  employeeId: number;
  initialSplits: SplitRow[];
  /** Current base salary (number) + currency, for the per-row amount
   *  preview. Pass null when the employee has no salary on file. */
  baseSalary: { amount: number; currency: string } | null;
  /** HR / Admin only — non-editors see read-only rows. */
  canEdit: boolean;
}

function isActive(s: { effectiveTo: string | Date | null }) {
  return !s.effectiveTo || new Date(s.effectiveTo) > new Date();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BillingSplitsSection({
  employeeId,
  initialSplits,
  baseSalary,
  canEdit,
}: Props) {
  const [splits, setSplits] = useState<SplitRow[]>(initialSplits);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SplitRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    // Pulled from /api/settings (admin-only) — falls back to a
    // smaller endpoint readers can hit. We just need id/name/code.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/companies');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setCompanies(
            data.map((c: any) => ({ id: c.id, name: c.name, code: c.code })),
          );
        }
      } catch {
        // Non-fatal — the user just won't have a company picker.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSum = useMemo(() => {
    return splits
      .filter(isActive)
      .reduce((acc, s) => acc + Number(s.percentage), 0);
  }, [splits]);

  function calcAmount(pct: number): string {
    if (!baseSalary || !baseSalary.amount) return '';
    const v = (baseSalary.amount * pct) / 100;
    return `${baseSalary.currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  async function refresh() {
    // Cheap reload — re-read from the server-rendered employee bundle
    // would require a router.refresh(). For now we just push a soft
    // refresh by re-fetching the splits via the employee bundle.
    try {
      const res = await fetch(`/api/compensation/employee/${employeeId}`);
      if (!res.ok) return;
      // The employee bundle doesn't currently include billingSplits
      // (it focuses on Compensation), so we rely on the parent to
      // refresh. As a fallback, optimistic updates from the modal
      // already mutated `splits` locally.
    } catch {
      /* ignore */
    }
  }

  async function handleDelete(row: SplitRow) {
    if (!confirm(`Remove the ${Number(row.percentage).toFixed(2)}% split for ${row.company?.name ?? 'this company'}?`))
      return;
    try {
      const res = await fetch(`/api/compensation/billing-split/${row.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Delete failed');
      }
      setSplits((prev) => prev.filter((s) => s.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="card mt-6">
      <div className="card-header flex justify-between items-center">
        <div>
          <h3 className="section-heading">Billing Splits</h3>
          <p className="text-xs text-core-text3 mt-1">
            How this employee's salary is allocated across companies.
            Active rows should sum to 100%.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setShowAdd(true);
              setError('');
            }}
            className="btn btn-sm btn-primary"
          >
            + Add Split
          </button>
        )}
      </div>
      <div className="card-body">
        {error && (
          <div className="mb-3 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
            {error}
          </div>
        )}

        {splits.length === 0 ? (
          <p className="text-core-text3 text-center py-4">
            No billing splits configured.
            {canEdit ? ' Click "+ Add Split" to start.' : ''}
          </p>
        ) : (
          <div className="space-y-2">
            {splits.map((s) => {
              const active = isActive(s);
              const pct = Number(s.percentage);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-core-surface2 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-core-text">
                      {s.company?.name || `Company #${s.companyId}`}
                    </div>
                    <div className="mt-[1px] text-[11.5px] text-core-text3">
                      From {new Date(s.effectiveFrom).toLocaleDateString()}
                      {s.effectiveTo
                        ? ` → ${new Date(s.effectiveTo).toLocaleDateString()}`
                        : ' → present'}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-[15px] font-semibold tabular-nums text-core-text">
                        {pct.toFixed(2)}%
                      </div>
                      {baseSalary && (
                        <div className="text-[10.5px] text-core-text3">
                          {calcAmount(pct)}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        active
                          ? 'bg-core-greenSoft text-core-greenFg'
                          : 'bg-core-border text-core-text2'
                      }`}
                    >
                      {active ? 'ACTIVE' : 'ENDED'}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-2 text-[11.5px]">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setError('');
                          }}
                          className="text-core-text2 hover:text-core-text"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="text-core-text3 hover:text-core-roseFg"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active total — soft amber warning if not 100%, green tick at 100. */}
        {splits.some(isActive) && (
          <div
            className={`mt-3 flex items-center justify-between rounded-md px-3 py-2 text-[12.5px] ${
              Math.abs(activeSum - 100) < 0.01
                ? 'bg-core-greenSoft text-core-greenFg'
                : 'bg-core-amberSoft text-core-amberFg'
            }`}
          >
            <span className="font-semibold uppercase tracking-wider text-[10.5px]">
              Active total
            </span>
            <span className="font-mono tabular-nums">
              {activeSum.toFixed(2)}%{' '}
              {Math.abs(activeSum - 100) < 0.01
                ? '✓'
                : ` (${(100 - activeSum).toFixed(2)}% unallocated)`}
            </span>
          </div>
        )}
      </div>

      {editing && (
        <SplitFormModal
          employeeId={employeeId}
          companies={companies}
          baseSalary={baseSalary}
          editing={editing}
          existingSplits={splits}
          onClose={() => {
            setEditing(null);
            setError('');
          }}
          onSaved={(saved) => {
            setEditing(null);
            setError('');
            setSplits((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
          }}
        />
      )}
      {showAdd && (
        <AddSplitsBatchModal
          employeeId={employeeId}
          companies={companies}
          baseSalary={baseSalary}
          existingSplits={splits}
          onClose={() => {
            setShowAdd(false);
            setError('');
          }}
          onSaved={(rows) => {
            setShowAdd(false);
            setError('');
            setSplits((prev) => [...prev, ...rows]);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SplitFormModal({
  employeeId,
  companies,
  baseSalary,
  editing,
  existingSplits,
  onClose,
  onSaved,
}: {
  employeeId: number;
  companies: CompanyOpt[];
  baseSalary: { amount: number; currency: string } | null;
  editing: SplitRow | null;
  existingSplits: SplitRow[];
  onClose: () => void;
  onSaved: (saved: SplitRow, mode: 'create' | 'edit') => void;
}) {
  const isEdit = !!editing;
  const [companyId, setCompanyId] = useState<string>(
    editing ? String(editing.companyId) : '',
  );
  const [percentage, setPercentage] = useState<string>(
    editing ? String(editing.percentage) : '',
  );
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    editing
      ? new Date(editing.effectiveFrom).toISOString().slice(0, 10)
      : todayIso(),
  );
  const [effectiveTo, setEffectiveTo] = useState<string>(
    editing && editing.effectiveTo
      ? new Date(editing.effectiveTo).toISOString().slice(0, 10)
      : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Companies that already have an active split — disabled in the
  // picker so the user can't accidentally try to duplicate. The row
  // being edited is allowed.
  const lockedCompanyIds = useMemo(() => {
    const set = new Set<number>();
    for (const s of existingSplits) {
      if (!isActive(s)) continue;
      if (editing && s.id === editing.id) continue;
      set.add(s.companyId);
    }
    return set;
  }, [existingSplits, editing]);

  const pctNum = parseFloat(percentage);
  const previewAmount =
    baseSalary && Number.isFinite(pctNum) && pctNum > 0
      ? `${baseSalary.currency} ${((baseSalary.amount * pctNum) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body: any = {
        percentage: pctNum,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
      };
      if (!isEdit) {
        body.employeeId = employeeId;
        body.companyId = parseInt(companyId);
      } else {
        // Companies don't change on edit — keeps the data model
        // simple. To switch companies, delete + re-add.
      }

      const url = isEdit
        ? `/api/compensation/billing-split/${editing!.id}`
        : '/api/compensation/billing-split';
      const method = isEdit ? 'PATCH' : 'POST';

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
      if (!res.ok)
        throw new Error(
          data?.error || `Request failed (HTTP ${res.status})`,
        );
      onSaved(data, isEdit ? 'edit' : 'create');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="modal max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Billing Split' : 'Add Billing Split'}</h2>
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

            <div>
              <label className="form-label">Company *</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="form-select"
                disabled={isEdit}
                required
              >
                <option value="">Select…</option>
                {companies.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={lockedCompanyIds.has(c.id)}
                  >
                    {c.name} {lockedCompanyIds.has(c.id) ? '(already split)' : ''}
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-[11px] text-core-text3">
                  To switch companies, delete this row and add a new one.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Percentage *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="form-input"
                  required
                />
                {previewAmount && (
                  <p className="mt-1 text-[11px] text-core-text3">
                    ≈ {previewAmount}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Effective From *</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Effective To (optional)</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="form-input"
              />
              <p className="mt-1 text-[11px] text-core-text3">
                Leave blank for "ongoing." Set when the split should end.
              </p>
            </div>
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

// ---------------------------------------------------------------------------
// AddSplitsBatchModal — pick N companies and percentages in one go,
// save them atomically. Equal-divide button auto-fills percentages
// across the picked companies for the most common case (50/50 or
// 33/33/34).
// ---------------------------------------------------------------------------

interface BatchRow {
  // local row id, used for keyed list operations
  key: string;
  companyId: string; // stringified so empty == unselected
  percentage: string;
}

function freshRow(): BatchRow {
  return {
    key: Math.random().toString(36).slice(2, 9),
    companyId: '',
    percentage: '',
  };
}

function AddSplitsBatchModal({
  employeeId,
  companies,
  baseSalary,
  existingSplits,
  onClose,
  onSaved,
}: {
  employeeId: number;
  companies: CompanyOpt[];
  baseSalary: { amount: number; currency: string } | null;
  existingSplits: SplitRow[];
  onClose: () => void;
  onSaved: (rows: SplitRow[]) => void;
}) {
  const [rows, setRows] = useState<BatchRow[]>(() => [freshRow(), freshRow()]);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(todayIso());
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Companies that already have an active split for this employee
  // can't be picked again — disabled in every row's picker.
  const lockedCompanyIds = useMemo(() => {
    const set = new Set<number>();
    for (const s of existingSplits) {
      if (isActive(s)) set.add(s.companyId);
    }
    return set;
  }, [existingSplits]);

  // Companies already picked in OTHER rows of this batch — also
  // disabled per row to prevent a user from accidentally double-
  // selecting Company A across rows 1 and 3.
  function lockedFromBatch(currentRowKey: string): Set<number> {
    const set = new Set<number>();
    for (const r of rows) {
      if (r.key === currentRowKey) continue;
      const cid = parseInt(r.companyId);
      if (Number.isFinite(cid)) set.add(cid);
    }
    return set;
  }

  const existingActiveSum = useMemo(
    () =>
      existingSplits
        .filter(isActive)
        .reduce((acc, s) => acc + Number(s.percentage), 0),
    [existingSplits],
  );

  const batchSum = useMemo(
    () =>
      rows.reduce((acc, r) => {
        const n = parseFloat(r.percentage);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0),
    [rows],
  );

  const grandTotal = existingActiveSum + batchSum;
  const remaining = Math.max(0, 100 - existingActiveSum);

  function updateRow(key: string, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key),
    );
  }
  function addRow() {
    setRows((prev) => [...prev, freshRow()]);
  }

  // Equal-divide: takes whatever's currently unallocated (100% minus
  // existing active rows) and spreads it across rows that have a
  // company selected. Rows without a company picked are left alone.
  // Uses two-decimal arithmetic; last filled row absorbs the rounding
  // remainder so the sum always lands exactly on `remaining`.
  function equalDivide() {
    const eligible = rows.filter((r) => r.companyId);
    if (eligible.length === 0) {
      setError('Pick at least one company in a row before using Equal divide.');
      return;
    }
    if (remaining <= 0) {
      setError('No room to divide — existing splits already total 100%.');
      return;
    }
    setError('');
    const baseShare = Math.floor((remaining / eligible.length) * 100) / 100;
    const distributed = baseShare * eligible.length;
    const remainder = Math.round((remaining - distributed) * 100) / 100;
    const eligibleKeys = new Set(eligible.map((r) => r.key));
    const lastEligibleKey = eligible[eligible.length - 1].key;
    setRows((prev) =>
      prev.map((r) => {
        if (!eligibleKeys.has(r.key)) return r;
        const share = r.key === lastEligibleKey ? baseShare + remainder : baseShare;
        return { ...r, percentage: share.toFixed(2) };
      }),
    );
  }

  function calcAmount(pct: number): string {
    if (!baseSalary || !baseSalary.amount || !Number.isFinite(pct) || pct <= 0)
      return '';
    const v = (baseSalary.amount * pct) / 100;
    return `${baseSalary.currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation mirrors server-side so the user sees
    // the failure inline instead of hitting the API.
    const usable = rows
      .map((r) => ({
        companyId: parseInt(r.companyId),
        percentage: parseFloat(r.percentage),
      }))
      .filter((r) => Number.isFinite(r.companyId) && Number.isFinite(r.percentage));

    if (usable.length === 0) {
      setError('Add at least one row with a company and a percentage.');
      return;
    }
    for (const r of usable) {
      if (r.percentage <= 0 || r.percentage > 100) {
        setError('Each percentage must be between 0 and 100.');
        return;
      }
    }
    const sum = usable.reduce((a, r) => a + r.percentage, 0);
    if (existingActiveSum + sum > 100.0001) {
      setError(
        `Total would be ${(existingActiveSum + sum).toFixed(2)}% (max 100). Existing active: ${existingActiveSum.toFixed(2)}%.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/compensation/billing-split/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          splits: usable.map((r) => ({
            companyId: r.companyId,
            percentage: r.percentage,
            effectiveFrom: new Date(effectiveFrom).toISOString(),
            effectiveTo: effectiveTo
              ? new Date(effectiveTo).toISOString()
              : null,
          })),
        }),
      });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw.slice(0, 200) };
      }
      if (!res.ok)
        throw new Error(data?.error || `Failed (HTTP ${res.status})`);
      onSaved(data.splits ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Visual cue colour for the live total.
  const totalTone =
    Math.abs(grandTotal - 100) < 0.01
      ? 'bg-core-greenSoft text-core-greenFg'
      : grandTotal > 100
        ? 'bg-core-roseSoft text-core-roseFg'
        : 'bg-core-amberSoft text-core-amberFg';

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div
        className="modal max-w-[680px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Add Billing Splits</h2>
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

            {existingActiveSum > 0 && (
              <div className="rounded-lg border border-core-border bg-core-surface2 px-3 py-2 text-[12px] text-core-text2">
                Existing active splits total{' '}
                <strong className="text-core-text">
                  {existingActiveSum.toFixed(2)}%
                </strong>{' '}
                — you can allocate up to{' '}
                <strong className="text-core-text">
                  {remaining.toFixed(2)}%
                </strong>{' '}
                across the rows below.
              </div>
            )}

            {/* Effective date — applies to every row in this batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Effective From *</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Effective To (optional)</label>
                <input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            {/* Split rows */}
            <div className="rounded-lg border border-core-border bg-core-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-core-text3">
                  Companies & percentages
                </div>
                <button
                  type="button"
                  onClick={equalDivide}
                  className="text-[11.5px] font-semibold text-core-blueFg hover:opacity-80"
                  title="Spread the unallocated percentage equally across the rows that have a company picked"
                >
                  Equal divide
                </button>
              </div>

              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const lockedHere = new Set<number>([
                    ...lockedCompanyIds,
                    ...lockedFromBatch(r.key),
                  ]);
                  const preview = calcAmount(parseFloat(r.percentage));
                  return (
                    <div
                      key={r.key}
                      className="grid grid-cols-12 gap-2 items-start"
                    >
                      <div className="col-span-6">
                        <select
                          value={r.companyId}
                          onChange={(e) =>
                            updateRow(r.key, { companyId: e.target.value })
                          }
                          className="form-select"
                        >
                          <option value="">Select company…</option>
                          {companies.map((c) => (
                            <option
                              key={c.id}
                              value={c.id}
                              disabled={lockedHere.has(c.id)}
                            >
                              {c.name}
                              {lockedHere.has(c.id) ? ' (in use)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="100"
                            value={r.percentage}
                            onChange={(e) =>
                              updateRow(r.key, { percentage: e.target.value })
                            }
                            placeholder="%"
                            className="form-input"
                          />
                          <span className="text-[12px] text-core-text3">%</span>
                        </div>
                        {preview && (
                          <p className="mt-1 text-[11px] text-core-text3">
                            ≈ {preview}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeRow(r.key)}
                          disabled={rows.length <= 1}
                          className="text-[11.5px] text-core-text3 hover:text-core-roseFg disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove this row"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="mt-3 text-[12px] font-semibold text-core-greenFg hover:opacity-80"
              >
                + Add another company
              </button>
            </div>

            {/* Live total */}
            <div
              className={`flex items-center justify-between rounded-md px-3 py-2 text-[12.5px] ${totalTone}`}
            >
              <span className="font-semibold uppercase tracking-wider text-[10.5px]">
                Total after save
              </span>
              <span className="font-mono tabular-nums">
                {grandTotal.toFixed(2)}%{' '}
                {Math.abs(grandTotal - 100) < 0.01
                  ? '✓'
                  : grandTotal > 100
                    ? '✗ over allocation'
                    : `(${(100 - grandTotal).toFixed(2)}% unallocated)`}
              </span>
            </div>
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
              disabled={submitting || grandTotal > 100.0001}
            >
              {submitting ? 'Saving…' : 'Save splits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

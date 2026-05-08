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

      {(showAdd || editing) && (
        <SplitFormModal
          employeeId={employeeId}
          companies={companies}
          baseSalary={baseSalary}
          editing={editing}
          existingSplits={splits}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
            setError('');
          }}
          onSaved={(saved, mode) => {
            setShowAdd(false);
            setEditing(null);
            setError('');
            setSplits((prev) => {
              if (mode === 'create') return [...prev, saved];
              return prev.map((s) => (s.id === saved.id ? saved : s));
            });
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

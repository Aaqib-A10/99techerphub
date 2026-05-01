'use client';

import { useState } from 'react';

interface MarketplaceOption {
  id: number;
  name: string;
}

interface Props {
  employeeId: number;
  initialResponsibilities: string | null;
  initialMarketplaceIds: number[];
  marketplaceOptions: MarketplaceOption[];
  canEdit: boolean;
}

/**
 * Self-contained editor for an employee's free-form responsibilities
 * (markdown-friendly text) and the set of marketplaces they own.
 *
 * - Read-only for users who can't edit (anyone outside the employee's
 *   reporting chain that isn't ADMIN/HR). The API enforces this too.
 * - Save is two writes: PATCH /api/employees/:id for responsibilities,
 *   PUT /api/employees/:id/marketplaces for the M2M list. They run in
 *   parallel; the form unblocks when both settle.
 */
export default function RolesEditor({
  employeeId,
  initialResponsibilities,
  initialMarketplaceIds,
  marketplaceOptions,
  canEdit,
}: Props) {
  const [responsibilities, setResponsibilities] = useState(initialResponsibilities ?? '');
  const [selected, setSelected] = useState<Set<number>>(new Set(initialMarketplaceIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty =
    responsibilities !== (initialResponsibilities ?? '') ||
    !setsEqual(selected, new Set(initialMarketplaceIds));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const [respRes, mpRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', responsibilities: responsibilities || null }),
        }),
        fetch(`/api/employees/${employeeId}/marketplaces`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketplaceIds: Array.from(selected) }),
        }),
      ]);
      if (!respRes.ok) {
        const j = await respRes.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save responsibilities');
      }
      if (!mpRes.ok) {
        const j = await mpRes.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to save marketplaces');
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl bg-core-surface ring-1 ring-[rgba(228,228,231,0.85)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-core-text">Responsibility</h2>
          <p className="text-[12px] text-core-text3 mt-0.5">
            What this person is accountable for, and which marketplaces they own.
          </p>
        </div>
        {!canEdit && (
          <span className="text-[11px] text-core-text3 italic">read-only</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-core-roseSoft ring-1 ring-red-200 text-core-roseFg text-[12px] px-3 py-2">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="mb-3 rounded-md bg-core-greenSoft ring-1 ring-core-greenFg text-core-greenFg text-[12px] px-3 py-2">
          ✓ Saved at {savedAt}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Responsibilities textarea */}
        <div className="md:col-span-2">
          <label className="text-[11px] uppercase tracking-wide text-core-text3 font-semibold">
            Responsibilities
          </label>
          <textarea
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            disabled={!canEdit || saving}
            placeholder={canEdit ? 'e.g. Owns daily Amazon FBA replenishment for the perfume catalog. Approves CSR refunds up to $200. Reports weekly P&L to Hammad.' : 'No responsibilities recorded.'}
            rows={6}
            className="mt-1 w-full rounded-md bg-core-surface px-3 py-2 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-core-surface2 disabled:text-core-text2 disabled:cursor-not-allowed"
          />
          <p className="text-[11px] text-core-text3 mt-1">
            Plain text or simple markdown. Visible to anyone in People → Responsibility.
          </p>
        </div>

        {/* Marketplaces multi-select */}
        <div>
          <label className="text-[11px] uppercase tracking-wide text-core-text3 font-semibold">
            Marketplaces
          </label>
          {marketplaceOptions.length === 0 ? (
            <p className="text-[12px] text-core-text3 mt-2">
              No marketplaces in catalog yet. Admins can add them in Master Data.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
              {marketplaceOptions.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] ${
                      canEdit ? 'cursor-pointer hover:bg-core-surface2' : 'cursor-default'
                    } ${checked ? 'bg-core-blueSoft ring-1 ring-blue-200' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canEdit || saving}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4"
                    />
                    <span className={checked ? 'text-core-blueFg font-medium' : 'text-core-text2'}>
                      {m.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="h-9 px-4 rounded-md text-[13px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-core-border disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && !saving && (
            <button
              type="button"
              onClick={() => {
                setResponsibilities(initialResponsibilities ?? '');
                setSelected(new Set(initialMarketplaceIds));
                setError('');
                setSavedAt(null);
              }}
              className="h-9 px-3 rounded-md text-[13px] text-core-text2 ring-1 ring-core-border hover:bg-core-surface2"
            >
              Discard
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

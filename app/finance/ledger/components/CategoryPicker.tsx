'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface Category {
  id: number;
  code: string;
  name: string;
  // Some callers (e.g. /expenses/new) pass categories from the
  // ExpenseCategory table which doesn't carry a `type`. Optional here
  // so both shapes are accepted; the picker doesn't read it anyway.
  type?: string;
}

interface Props {
  categories: Category[];
  value: number | null;
  onChange: (id: number) => void;
  /** Free-text custom note shown when "Other" is picked. */
  customNote: string;
  onCustomNoteChange: (next: string) => void;
  /**
   * 'simple' = plain select dropdown (employees on /expenses/new).
   * 'smart'  = typeahead with inline "+ Create category" (admin/accountant
   *            on the ledger forms).
   */
  mode?: 'simple' | 'smart';
  /** Endpoint hit when the user clicks "+ Create" in smart mode. */
  createEndpoint?: string;
  /** Called after a new category is successfully created so the parent can refresh. */
  onCategoryCreated?: (created: Category) => void;
  required?: boolean;
  label?: string;
}

const OTHER_CODE = 'OTHER';

/**
 * Category picker shared by every ledger / expense form.
 *
 * Always pins "Other" to the bottom of the list. When picked, a small
 * "What is this for?" text input appears next to the dropdown so the
 * user can capture context. The form layer is responsible for
 * prepending that note to the description on submit — this component
 * just collects it.
 *
 * In smart mode, typing in the picker filters the list; if no exact
 * match exists and the user has permission, a "+ Create category"
 * affordance is shown that POSTs to the configured endpoint and then
 * selects the newly-created row.
 */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  customNote,
  onCustomNoteChange,
  mode = 'simple',
  createEndpoint,
  onCategoryCreated,
  required,
  label = 'Category',
}: Props) {
  // OTHER pinned to bottom regardless of sortOrder issues.
  const sorted = useMemo(() => {
    const others = categories.filter((c) => c.code === OTHER_CODE);
    const rest = categories.filter((c) => c.code !== OTHER_CODE);
    return [...rest, ...others];
  }, [categories]);

  const selected = sorted.find((c) => c.id === value) ?? null;
  const isOther = selected?.code === OTHER_CODE;

  if (mode === 'simple') {
    return (
      <SimplePicker
        sorted={sorted}
        value={value}
        onChange={onChange}
        isOther={isOther}
        customNote={customNote}
        onCustomNoteChange={onCustomNoteChange}
        required={required}
        label={label}
      />
    );
  }

  return (
    <SmartPicker
      sorted={sorted}
      value={value}
      onChange={onChange}
      isOther={isOther}
      customNote={customNote}
      onCustomNoteChange={onCustomNoteChange}
      createEndpoint={createEndpoint}
      onCategoryCreated={onCategoryCreated}
      required={required}
      label={label}
    />
  );
}

// ───────────────────────────── Simple ─────────────────────────────

function SimplePicker({
  sorted,
  value,
  onChange,
  isOther,
  customNote,
  onCustomNoteChange,
  required,
  label,
}: {
  sorted: Category[];
  value: number | null;
  onChange: (id: number) => void;
  isOther: boolean;
  customNote: string;
  onCustomNoteChange: (next: string) => void;
  required?: boolean;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="form-label">
          {label} {required && <span className="text-core-roseFg">*</span>}
        </label>
        <select
          className="form-select"
          value={value ?? ''}
          onChange={(e) => {
            const id = parseInt(e.target.value);
            if (Number.isFinite(id)) onChange(id);
          }}
          required={required}
        >
          <option value="">Select…</option>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {isOther && (
        <OtherNote value={customNote} onChange={onCustomNoteChange} />
      )}
    </div>
  );
}

// ───────────────────────────── Smart ──────────────────────────────

function SmartPicker({
  sorted,
  value,
  onChange,
  isOther,
  customNote,
  onCustomNoteChange,
  createEndpoint,
  onCategoryCreated,
  required,
  label,
}: {
  sorted: Category[];
  value: number | null;
  onChange: (id: number) => void;
  isOther: boolean;
  customNote: string;
  onCustomNoteChange: (next: string) => void;
  createEndpoint?: string;
  onCategoryCreated?: (created: Category) => void;
  required?: boolean;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = sorted.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.find((c) => c.name.toLowerCase() === q) ?? null : null;
  }, [sorted, query]);

  const canCreate = !!createEndpoint && query.trim().length > 0 && !exactMatch;

  async function createCategory() {
    if (!createEndpoint) return;
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(createEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create category');
      onCategoryCreated?.(data);
      onChange(data.id);
      setQuery('');
      setOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="relative">
        <label className="form-label">
          {label} {required && <span className="text-core-roseFg">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="form-input flex w-full items-center justify-between text-left"
        >
          <span className={selected ? 'text-core-text' : 'text-core-text3'}>
            {selected ? selected.name : 'Select or type to search…'}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="text-core-text3">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-core-border bg-core-surface shadow-[0_8px_24px_-4px_rgba(0,0,0,0.10)]">
            <div className="border-b border-core-border p-2">
              <input
                autoFocus
                type="text"
                placeholder="Type to filter or create…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-[12px] text-core-text3">
                  No matching category.
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-[8px] text-left text-[12.5px] transition hover:bg-core-surface2 ${
                      c.id === value ? 'bg-core-surface2 font-semibold text-core-text' : 'text-core-text2'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="font-mono text-[10.5px] text-core-text3">{c.code}</span>
                  </button>
                ))
              )}
              {canCreate && (
                <button
                  type="button"
                  onClick={createCategory}
                  disabled={creating}
                  className="flex w-full items-center gap-2 border-t border-core-border bg-core-surface2 px-3 py-[10px] text-left text-[12.5px] font-semibold text-core-text transition hover:opacity-90 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {creating ? 'Creating…' : `Create category "${query.trim()}"`}
                </button>
              )}
            </div>
            {createError && (
              <div className="border-t border-core-border bg-core-roseSoft px-3 py-2 text-[11.5px] text-core-roseFg">
                {createError}
              </div>
            )}
          </div>
        )}
      </div>
      {isOther && (
        <OtherNote value={customNote} onChange={onCustomNoteChange} />
      )}
    </div>
  );
}

// ───────────────────────────── Other note ─────────────────────────

function OtherNote({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-core-amberFg/30 bg-core-amberSoft/40 p-3">
      <label className="form-label text-core-amberFg">
        What is this for? <span className="text-core-roseFg">*</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
        placeholder="Briefly describe — e.g. office cleaning supplies"
        required
      />
      <p className="mt-1 text-[11px] text-core-amberFg/80">
        Saved under "Other" with this note prepended to the description so reports stay consistent.
      </p>
    </div>
  );
}

/**
 * Helper used by form submit handlers to combine the user's typed
 * description with the custom-Other note. Returns the description as
 * it should be persisted.
 */
export function combineDescription(
  selectedCategoryCode: string | undefined | null,
  description: string,
  customNote: string,
): string {
  const desc = (description ?? '').trim();
  const note = (customNote ?? '').trim();
  if (selectedCategoryCode === OTHER_CODE && note) {
    return desc ? `[Custom: ${note}] ${desc}` : `[Custom: ${note}]`;
  }
  return desc;
}

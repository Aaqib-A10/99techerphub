'use client';

import { useMemo, useState } from 'react';
import EmployeePicker from '@/app/components/EmployeePicker';
import { Card, Badge } from '@/app/components/design';

/**
 * Admin UI for the DigitalService catalog. Owners are picked via the
 * shared EmployeePicker (typeahead) so a 100-employee company doesn't
 * scroll a 100-option dropdown.
 *
 * The "Owner" matters: when an employee submits an Access Request,
 * the Send-to picker on that modal defaults to this owner. Without
 * it, requests fall through to admin and clog the queue.
 */

interface ServiceRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  defaultPlan: string | null;
  iconUrl: string | null;
  isActive: boolean;
  ownerEmployeeId: number | null;
  owner: {
    id: number;
    firstName: string;
    lastName: string;
    empCode: string;
  } | null;
  usage: { requests: number; grants: number };
}

interface EmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
  empCode: string;
  designation: string | null;
}

export default function DigitalServicesClient({
  initial,
  employees,
}: {
  initial: ServiceRow[];
  employees: EmployeeOption[];
}) {
  const [rows, setRows] = useState<ServiceRow[]>(initial);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort();
  }, [rows]);

  async function handleToggleActive(row: ServiceRow) {
    const next = !row.isActive;
    if (
      !next &&
      (row.usage.grants > 0 || row.usage.requests > 0) &&
      !confirm(
        `Deactivate "${row.name}"? It will hide from the access catalog but existing grants (${row.usage.grants}) and request history (${row.usage.requests}) are preserved.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/digital-services/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: next } : r)),
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(row: ServiceRow) {
    if (row.usage.grants > 0 || row.usage.requests > 0) {
      alert(
        `"${row.name}" has history (${row.usage.requests} requests, ${row.usage.grants} grants). Toggle Active off instead of deleting.`,
      );
      return;
    }
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/digital-services/${row.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            System · Master Data · Digital Services
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Digital Services
          </h1>
          <p className="mt-[2px] max-w-[680px] text-[13px] text-core-text2">
            The catalog of software tools employees can request access to.
            Setting an Owner is recommended — requests auto-route to them.
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setError('');
          }}
          className="btn btn-primary"
        >
          + Add Service
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
          {error}
        </div>
      )}

      <Card
        title="Services"
        subtitle={`${rows.length} ${rows.length === 1 ? 'service' : 'services'}`}
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-core-surface2">
                {['Service', 'Category', 'Default Plan', 'Owner', 'Usage', 'Status', 'Actions'].map(
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-core-text3">
                    No services yet. Click "+ Add Service" to start.
                  </td>
                </tr>
              ) : (
                rows.map((s, i) => {
                  const isLast = i === rows.length - 1;
                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid #E5E8DD' }}
                      className="hover:bg-core-surface2"
                    >
                      <td className="px-[12px] py-[8px]">
                        <div className="font-medium text-core-text">{s.name}</div>
                        {s.description && (
                          <div className="mt-[1px] text-[11px] text-core-text3">
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">
                        {s.category ?? <span className="text-core-text3">—</span>}
                      </td>
                      <td className="px-[12px] py-[8px] text-core-text2">
                        {s.defaultPlan ?? <span className="text-core-text3">—</span>}
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {s.owner ? (
                          <div>
                            <div className="text-core-text">
                              {s.owner.firstName} {s.owner.lastName}
                            </div>
                            <div className="text-[10.5px] font-mono text-core-text3">
                              {s.owner.empCode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-core-text3">No owner</span>
                        )}
                      </td>
                      <td className="px-[12px] py-[8px] text-[11.5px] text-core-text3">
                        {s.usage.grants} active · {s.usage.requests} requests
                      </td>
                      <td className="px-[12px] py-[8px]">
                        {s.isActive ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge tone="gray">Hidden</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-[12px] py-[8px]">
                        <div className="flex items-center gap-3 text-[11.5px]">
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
                            onClick={() => handleToggleActive(s)}
                            className="text-core-text2 hover:text-core-text"
                          >
                            {s.isActive ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-core-text3 hover:text-core-roseFg"
                          >
                            Delete
                          </button>
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

      {(showAdd || editing) && (
        <ServiceFormModal
          employees={employees}
          existingCategories={categories}
          editing={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={(saved, mode) => {
            setShowAdd(false);
            setEditing(null);
            setRows((prev) => {
              if (mode === 'create') {
                return [
                  ...prev,
                  { ...saved, usage: { requests: 0, grants: 0 } },
                ].sort((a, b) => a.name.localeCompare(b.name));
              }
              return prev.map((r) =>
                r.id === saved.id ? { ...saved, usage: r.usage } : r,
              );
            });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ServiceFormModal({
  employees,
  existingCategories,
  editing,
  onClose,
  onSaved,
}: {
  employees: EmployeeOption[];
  existingCategories: string[];
  editing: ServiceRow | null;
  onClose: () => void;
  onSaved: (saved: any, mode: 'create' | 'edit') => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    description: editing?.description ?? '',
    category: editing?.category ?? '',
    defaultPlan: editing?.defaultPlan ?? '',
    ownerEmployeeId: editing?.ownerEmployeeId ?? null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const url = isEdit
        ? `/api/digital-services/${editing!.id}`
        : '/api/digital-services';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          defaultPlan: form.defaultPlan.trim() || null,
          ownerEmployeeId: form.ownerEmployeeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (HTTP ${res.status})`);
      onSaved(data, isEdit ? 'edit' : 'create');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="modal max-w-[520px]" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? `Edit ${editing!.name}` : 'Add Digital Service'}</h2>
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
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='e.g. "Notion", "Linear", "Jira"'
                className="form-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Communication, Design"
                  list="category-suggestions"
                  className="form-input"
                />
                <datalist id="category-suggestions">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="form-label">Default Plan</label>
                <input
                  type="text"
                  value={form.defaultPlan}
                  onChange={(e) => setForm({ ...form, defaultPlan: e.target.value })}
                  placeholder='e.g. "Business Standard"'
                  className="form-input"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief blurb shown on the access catalog card"
                className="form-textarea"
              />
            </div>

            <div>
              <label className="form-label">Owner (auto-route approvals here)</label>
              <EmployeePicker
                employees={employees as any}
                value={form.ownerEmployeeId}
                onChange={(id) => setForm({ ...form, ownerEmployeeId: id })}
                placeholder="Pick the person who manages this service…"
                showInactive={false}
              />
              <p className="mt-1 text-[11px] text-core-text3">
                Recommended — when an employee requests access, the
                Send-to picker on the modal defaults to this person.
                Leave blank to fall back to admin.
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

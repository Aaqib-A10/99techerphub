'use client';

import { useState } from 'react';

interface Row {
  id: number;
  name: string;
  isActive: boolean;
  employeeCount: number;
}

export default function MarketplacesClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add marketplace');
      setRows((prev) => [...prev, { id: data.id, name: data.name, isActive: data.isActive, employeeCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (row: Row) => {
    const next = !row.isActive;
    if (!next && row.employeeCount > 0) {
      if (!confirm(`Deactivate "${row.name}"? ${row.employeeCount} employee${row.employeeCount === 1 ? '' : 's'} currently assigned will keep the assignment but the option will hide from new assignments.`)) return;
    }
    try {
      const res = await fetch(`/api/marketplaces/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, isActive: next } : r));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const renameInline = async (row: Row, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === row.name) return;
    try {
      const res = await fetch(`/api/marketplaces/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename');
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, name: data.name } : r).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add row */}
      <div className="rounded-lg bg-core-surface ring-1 ring-[rgba(228,228,231,0.85)] p-3 flex flex-wrap gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Add marketplace (e.g. Etsy, Newegg)"
          className="h-9 flex-1 min-w-[220px] rounded-md bg-core-surface px-3 text-[13px] ring-1 ring-[rgba(228,228,231,0.85)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          disabled={adding}
        />
        <button
          type="button"
          onClick={add}
          disabled={adding || !name.trim()}
          className="h-9 px-4 rounded-md text-[13px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-core-border disabled:cursor-not-allowed"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
        {error && <span className="text-[12px] text-core-roseFg w-full">{error}</span>}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-core-surface ring-1 ring-[rgba(228,228,231,0.85)]">
        <table className="min-w-full text-[13px]">
          <thead className="bg-core-surface2 text-[11px] uppercase tracking-wide text-core-text3">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Name</th>
              <th className="text-left font-semibold px-3 py-2">Employees</th>
              <th className="text-left font-semibold px-3 py-2">Status</th>
              <th className="text-left font-semibold px-3 py-2 col-sticky-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-core-border">
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-core-text3">No marketplaces yet — add your first above.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={r.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-2">
                  <EditableName value={r.name} onSave={(v) => renameInline(r, v)} />
                </td>
                <td className="px-3 py-2 tabular-nums">{r.employeeCount}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    r.isActive
                      ? 'bg-core-greenSoft text-core-greenFg ring-1 ring-core-greenFg'
                      : 'bg-core-surface2 text-core-text3 ring-1 ring-core-border'
                  }`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 col-sticky-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    className="text-[12px] text-core-blueFg hover:underline"
                  >
                    {r.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button type="button" className="text-core-text hover:text-core-blueFg" onClick={() => { setDraft(value); setEditing(true); }}>
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(draft); setEditing(false); }
        if (e.key === 'Escape') { setEditing(false); }
      }}
      className="h-7 px-2 text-[13px] rounded ring-1 ring-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    />
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';
import { runBulk, summarizeBulk } from '@/app/components/bulkRunner';

interface AccessRecord {
  id: number;
  employeeId: number;
  serviceName: string;
  accountEmail: string | null;
  accessLevel: string | null;
  grantedDate: Date | string;
  revokedDate: Date | string | null;
  isActive: boolean;
  notes: string | null;
  employee?: {
    id: number;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department?: { name: string } | null;
  };
}

interface Props {
  initialRecords: AccessRecord[];
  services: string[];
}

export default function DigitalAccessClient({ initialRecords, services }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'revoked'>('');
  const [revoking, setRevoking] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  // Modal state. The modal opens in 'view' mode showing read-only fields
  // (you wouldn't want a row click to drop you into edit mode by accident);
  // an explicit pencil button flips to 'edit'. Closing the modal resets
  // the mode back to 'view' for next time.
  const [editing, setEditing] = useState<AccessRecord | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [editForm, setEditForm] = useState({
    serviceName: '',
    accountId: '',
    notes: '',
    isActive: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const openEdit = (r: AccessRecord) => {
    setEditing(r);
    setModalMode('view');
    setEditForm({
      serviceName: r.serviceName,
      accountId: (r as any).accountId ?? r.accountEmail ?? '',
      notes: r.notes ?? '',
      isActive: r.isActive,
    });
    setEditError('');
  };

  const closeModal = () => {
    if (editSaving) return;
    setEditing(null);
    setModalMode('view');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/digital-access/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }
      // Reflect the saved values in the local snapshot, switch back to
      // view mode so the user sees what they just saved, and refresh
      // the server-rendered table in the background.
      setEditing((prev) =>
        prev
          ? {
              ...prev,
              serviceName: editForm.serviceName,
              notes: editForm.notes,
              isActive: editForm.isActive,
              accountEmail: editForm.accountId,
            }
          : prev,
      );
      setModalMode('view');
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return initialRecords.filter((r) => {
      if (serviceFilter && r.serviceName !== serviceFilter) return false;
      if (statusFilter === 'active' && !r.isActive) return false;
      if (statusFilter === 'revoked' && r.isActive) return false;
      if (search) {
        const s = search.toLowerCase();
        const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase() : '';
        const empCode = r.employee?.employeeCode?.toLowerCase() || '';
        const email = r.accountEmail?.toLowerCase() || '';
        if (!empName.includes(s) && !empCode.includes(s) && !email.includes(s)) return false;
      }
      return true;
    });
  }, [initialRecords, search, serviceFilter, statusFilter]);

  // Reset page when filters change
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const handleRevoke = async (id: number) => {
    if (!confirm('Revoke this access record? This cannot be undone.')) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/digital-access/${id}/revoke`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to revoke');
      } else {
        router.refresh();
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setRevoking(null);
    }
  };

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedRecords.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const togglePageSelect = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };
  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected records
        const selected = filtered.filter((e) => selectedIds.has(e.id));
        const header = ['Employee', 'Employee Code', 'Department', 'Service', 'Account Email', 'Access Level', 'Granted Date', 'Status'];
        const rows = selected.map((e) => [
          e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : '—',
          e.employee?.employeeCode || '',
          e.employee?.department?.name || '—',
          e.serviceName,
          e.accountEmail || '—',
          e.accessLevel || '—',
          new Date(e.grantedDate).toLocaleDateString(),
          e.isActive ? 'Active' : 'Revoked',
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `digital-access-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'revoke') {
        const result = await runBulk({
          ids,
          request: (id) => fetch(`/api/digital-access/${id}/revoke`, { method: 'POST' }),
        });
        router.refresh();
        setSelectedIds(new Set(ids.filter((id) => !result.succeededIds.has(id))));
        const msg = summarizeBulk(result, ids.length, 'revoke');
        if (msg) alert(msg);
        return;
      }
      setSelectedIds(new Set());
    } catch (err) {
      alert('Bulk action failed. Please try again.');
    } finally {
      setBulkLoading(null);
    }
  };

  const bulkActions = [
    { key: 'export', label: 'Export Selected', variant: 'default' as const },
    { key: 'revoke', label: 'Revoke Access', variant: 'danger' as const, confirm: 'Revoke access for {count} record(s)? This cannot be undone.' },
  ];

  return (
    <div className="card">
      <div className="card-header flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee, code, or email..."
          className="form-input flex-1 min-w-[220px]"
        />
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="form-input"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="form-input"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelect}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#8FBF3F' }}
                />
              </th>
              <th>Employee</th>
              <th>Department</th>
              <th>Service</th>
              <th>Account Email</th>
              <th>Access Level</th>
              <th>Granted</th>
              <th>Status</th>
              <th className="col-sticky-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-core-text3">
                  No access records found.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className="cursor-pointer transition-colors hover:bg-core-surface2"
                  style={selectedIds.has(r.id) ? { backgroundColor: 'rgba(143, 191, 63, 0.06)' } : undefined}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#8FBF3F' }}
                    />
                  </td>
                  <td>
                    <div className="font-medium">
                      {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#5A6159', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{r.employee?.employeeCode || ''}</div>
                  </td>
                  <td>{r.employee?.department?.name || '—'}</td>
                  <td>
                    <span className="badge badge-blue">{r.serviceName}</span>
                  </td>
                  <td>{r.accountEmail || '—'}</td>
                  <td>{r.accessLevel || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.grantedDate).toLocaleDateString()}</td>
                  <td>
                    {r.isActive ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-red">Revoked</span>
                    )}
                  </td>
                  <td className="col-sticky-right" onClick={(e) => e.stopPropagation()}>
                    {/* Row click opens the details modal which has its own
                        Edit pencil — no inline Edit button needed. Revoke
                        stays as a quick action for active records. */}
                    {r.isActive ? (
                      <button
                        onClick={() => handleRevoke(r.id)}
                        disabled={revoking === r.id}
                        className="btn btn-sm btn-outline-danger disabled:opacity-50"
                      >
                        {revoking === r.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    ) : (
                      <span className="text-[12px] text-core-text3">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalItems={filtered.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filtered.length}
        allSelected={selectedIds.size === filtered.length}
        onSelectAll={selectAllFiltered}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />

      {/* Detail modal — opens in view mode; pencil flips to edit. */}
      {editing && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'view' ? 'Digital Access Details' : 'Edit Digital Access'}</h2>
              <div className="flex items-center gap-2">
                {modalMode === 'view' && (
                  <button
                    onClick={() => setModalMode('edit')}
                    className="inline-flex items-center gap-[5px] rounded-lg border border-core-border bg-core-surface px-[10px] py-[5px] text-[12px] font-semibold text-core-text2 transition hover:bg-core-surface2 hover:text-core-text"
                    title="Edit record"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                  </button>
                )}
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="text-core-text3 transition hover:text-core-text"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {modalMode === 'view' ? (
              <>
                <div className="modal-body">
                  {editing.employee && (
                    <div className="mb-4 flex items-center gap-3 rounded-xl border border-core-border bg-core-surface2 p-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-core-text text-[12px] font-bold text-core-surface">
                        {(editing.employee.firstName?.[0] ?? '') + (editing.employee.lastName?.[0] ?? '')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-core-text">
                          {editing.employee.firstName} {editing.employee.lastName}
                        </div>
                        <div className="mt-[1px] text-[11.5px] text-core-text3">
                          {editing.employee.employeeCode ?? ''}
                          {editing.employee.department?.name ? ` · ${editing.employee.department.name}` : ''}
                        </div>
                      </div>
                    </div>
                  )}
                  <DetailRow label="Service" value={editing.serviceName} />
                  <DetailRow
                    label="Account ID"
                    value={(editing as any).accountId ?? editing.accountEmail ?? ''}
                  />
                  <DetailRow
                    label="Status"
                    value={editing.isActive ? 'Active' : 'Revoked'}
                    tone={editing.isActive ? 'green' : 'rose'}
                  />
                  <DetailRow
                    label="Granted"
                    value={new Date(editing.grantedDate).toLocaleString()}
                  />
                  {editing.revokedDate && (
                    <DetailRow
                      label="Revoked"
                      value={new Date(editing.revokedDate).toLocaleString()}
                    />
                  )}
                  <DetailRow label="Notes" value={editing.notes ?? ''} multiline />
                </div>
                <div className="modal-footer">
                  <button onClick={closeModal} className="btn btn-secondary">
                    Close
                  </button>
                  {editing.isActive && (
                    <button
                      onClick={() => {
                        closeModal();
                        // Defer slightly so the modal-close transition runs first.
                        setTimeout(() => handleRevoke(editing.id), 0);
                      }}
                      className="btn btn-sm btn-outline-danger"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="modal-body space-y-3">
                  {editError && (
                    <div className="rounded-lg bg-core-roseSoft p-3 text-[12.5px] text-core-roseFg">
                      {editError}
                    </div>
                  )}
                  <div>
                    <label className="form-label">Service Name *</label>
                    <input
                      type="text"
                      value={editForm.serviceName}
                      onChange={(e) =>
                        setEditForm({ ...editForm, serviceName: e.target.value })
                      }
                      className="form-input"
                      placeholder="Google Workspace, GitHub, Slack…"
                    />
                  </div>
                  <div>
                    <label className="form-label">Account ID</label>
                    <input
                      type="text"
                      value={editForm.accountId}
                      onChange={(e) =>
                        setEditForm({ ...editForm, accountId: e.target.value })
                      }
                      className="form-input"
                      placeholder="email or username on the service"
                    />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm({ ...editForm, notes: e.target.value })
                      }
                      rows={2}
                      className="form-textarea"
                      placeholder="License tier, billing notes, etc."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[12.5px] text-core-text2">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) =>
                        setEditForm({ ...editForm, isActive: e.target.checked })
                      }
                      className="h-4 w-4"
                      style={{ accentColor: '#1F2320' }}
                    />
                    Active (uncheck to revoke; re-check to restore a revoked record)
                  </label>
                </div>
                <div className="modal-footer">
                  <button
                    onClick={() => setModalMode('view')}
                    className="btn btn-secondary"
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving || !editForm.serviceName.trim()}
                    className="btn btn-primary"
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailRow — small read-only K/V used by the digital-access view modal.
// Tiny here rather than in the design package because it doesn't appear
// elsewhere yet.
function DetailRow({
  label,
  value,
  tone,
  multiline,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'rose';
  multiline?: boolean;
}) {
  const toneClass =
    tone === 'green'
      ? 'text-core-greenFg'
      : tone === 'rose'
      ? 'text-core-roseFg'
      : 'text-core-text';
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'items-baseline justify-between gap-3'} border-b border-core-border last:border-0 py-[7px]`}>
      <span className="text-[12px] text-core-text3">{label}</span>
      <span className={`text-[12.5px] font-medium ${toneClass} ${multiline ? '' : 'text-right'}`}>
        {value || <span className="text-core-text3">—</span>}
      </span>
    </div>
  );
}

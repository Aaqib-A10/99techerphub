'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

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
        for (const id of ids) {
          await fetch(`/api/digital-access/${id}/revoke`, { method: 'POST' });
        }
        router.refresh();
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
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                />
              </th>
              <th>Employee</th>
              <th>Department</th>
              <th>Service</th>
              <th>Account Email</th>
              <th>Access Level</th>
              <th>Granted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500">
                  No access records found.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r) => (
                <tr
                  key={r.id}
                  style={selectedIds.has(r.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                    />
                  </td>
                  <td>
                    <div className="font-medium">
                      {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#75777E', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{r.employee?.employeeCode || ''}</div>
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
                  <td>
                    {r.isActive && (
                      <button
                        onClick={() => handleRevoke(r.id)}
                        disabled={revoking === r.id}
                        className="btn btn-sm btn-outline-danger disabled:opacity-50"
                      >
                        {revoking === r.id ? 'Revoking…' : 'Revoke'}
                      </button>
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
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AssetCondition } from '@prisma/client';
import StatusBadge from '@/components/StatusBadge';
import BulkActionBar from '@/app/components/BulkActionBar';

interface AssetRow {
  id: number;
  assetTag: string;
  model: string;
  manufacturer: string | null;
  condition: string;
  assignedToName: string | null;
  _ram: string;
  _storage: string;
  _cpu: string;
  _gpu: string;
  category: { name: string };
  company: { code: string | null; name: string } | null;
  assignments: {
    employee: { firstName: string; lastName: string };
  }[];
}

export default function AssetTable({ assets }: { assets: AssetRow[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = assets.map((a) => a.id);
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
  const selectAllPage = () => {
    setSelectedIds(new Set(pageIds));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        const selected = assets.filter((a) => selectedIds.has(a.id));
        const header = ['Asset Tag', 'Category', 'Model', 'Manufacturer', 'RAM', 'Storage', 'Processor', 'GPU', 'Company', 'Condition', 'Assigned To'];
        const rows = selected.map((a) => [
          a.assetTag,
          a.category.name,
          a.model,
          a.manufacturer || '',
          a._ram || '',
          a._storage || '',
          a._cpu || '',
          a._gpu || '',
          a.company ? (a.company.code || a.company.name) : '',
          a.condition,
          a.assignments?.length > 0
            ? `${a.assignments[0].employee.firstName} ${a.assignments[0].employee.lastName}`
            : a.assignedToName || '',
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assets-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'delete') {
        for (const id of ids) {
          await fetch(`/api/assets/${id}`, { method: 'DELETE' });
        }
        router.refresh();
      } else if (actionKey === 'unassign') {
        for (const id of ids) {
          const asset = assets.find((a) => a.id === id);
          if (asset && asset.assignments?.length > 0) {
            await fetch(`/api/assets/${id}/return`, { method: 'POST' });
          }
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
    { key: 'unassign', label: 'Return / Unassign', variant: 'warning' as const, confirm: 'Return {count} asset(s) to inventory? This marks them as unassigned.' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} asset(s)? This cannot be undone.' },
  ];

  if (assets.length === 0) {
    return (
      <div className="empty-state py-16 text-center">
        <p className="text-sm" style={{ color: '#75777E' }}>
          No assets match your filters. Try clearing some filters or adding a new asset.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="table w-full">
          <thead
            className="sticky top-0 z-10"
            style={{ backgroundColor: '#EFF4FF' }}
          >
            <tr>
              <th
                className="text-left px-4 py-3"
                style={{ width: 40 }}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelect}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                />
              </th>
              {[
                'Asset Tag',
                'Category',
                'Model',
                'RAM',
                'Storage',
                'Processor',
                'GPU',
                'Company',
                'Condition',
                'Status',
                'Assigned To',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[10px] font-bold uppercase"
                  style={{
                    color: '#75777E',
                    letterSpacing: '0.08em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, idx) => (
              <tr
                key={asset.id}
                style={{
                  backgroundColor: selectedIds.has(asset.id)
                    ? 'rgba(20, 184, 166, 0.06)'
                    : idx % 2 === 0
                      ? '#FFFFFF'
                      : '#F8F9FF',
                }}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(asset.id)}
                    onChange={() => toggleSelect(asset.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                  />
                </td>
                <td
                  className="px-4 py-3 font-bold"
                  style={{
                    color: '#006B5F',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {asset.assetTag}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#44474D' }}>
                  {asset.category.name}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm" style={{ color: '#0B1C30' }}>
                    {asset.model}
                  </div>
                  <div className="text-xs" style={{ color: '#75777E' }}>
                    {asset.manufacturer}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#44474D', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  {asset._ram || <span style={{ color: '#C4C6CE' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#44474D', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  {asset._storage || <span style={{ color: '#C4C6CE' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#44474D' }}>
                  {asset._cpu || <span style={{ color: '#C4C6CE' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#44474D' }}>
                  {asset._gpu || <span style={{ color: '#C4C6CE' }}>—</span>}
                </td>
                <td className="px-4 py-3">
                  {asset.company ? (
                    <span
                      className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'rgba(11, 31, 58, 0.08)',
                        color: '#0B1F3A',
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                      }}
                    >
                      {asset.company.code || asset.company.name}
                    </span>
                  ) : (
                    <span style={{ color: '#C4C6CE' }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge condition={asset.condition as AssetCondition} />
                </td>
                <td className="px-4 py-3">
                  {(asset.assignments && asset.assignments.length > 0) ||
                   (asset.assignedToName && asset.assignedToName !== '' && asset.assignedToName.toLowerCase() !== 'available') ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: 'rgba(20, 184, 166, 0.12)',
                        color: '#006B5F',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#14B8A6' }} />
                      In Use
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: '#EFF4FF',
                        color: '#75777E',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#C4C6CE' }} />
                      Available
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: '#0B1C30' }}>
                  {asset.assignments && asset.assignments.length > 0
                    ? `${asset.assignments[0].employee.firstName} ${asset.assignments[0].employee.lastName}`
                    : asset.assignedToName || <span style={{ color: '#C4C6CE' }}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/assets/${asset.id}`}
                    className="btn btn-sm btn-outline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={assets.length}
        allSelected={selectedIds.size === assets.length}
        onSelectAll={selectAllPage}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />
    </>
  );
}

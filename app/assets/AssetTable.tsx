'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BulkActionBar from '@/app/components/BulkActionBar';
import { runBulk, summarizeBulk } from '@/app/components/bulkRunner';
import { Avi, Badge, Tag, Btn } from '@/app/components/design';
import type { BadgeTone } from '@/app/components/design';

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
    employee: { firstName: string; lastName: string; empCode?: string };
  }[];
}

// Condition colour map matches the design's status palette: working/new
// is a quiet green, damaged/repair is amber, lost is rose, retired is gray.
const CONDITION_TONE: Record<string, BadgeTone> = {
  NEW: 'green',
  WORKING: 'green',
  DAMAGED: 'rose',
  IN_REPAIR: 'amber',
  LOST: 'rose',
  RETIRED: 'gray',
};

const CONDITION_LABEL: Record<string, string> = {
  NEW: 'NEW',
  WORKING: 'WORKING',
  DAMAGED: 'DAMAGED',
  IN_REPAIR: 'IN REPAIR',
  LOST: 'LOST',
  RETIRED: 'RETIRED',
};

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
        const result = await runBulk({
          ids,
          request: (id) => fetch(`/api/assets/${id}`, { method: 'DELETE' }),
        });
        router.refresh();
        setSelectedIds(new Set(ids.filter((id) => !result.succeededIds.has(id))));
        const msg = summarizeBulk(result, ids.length, 'delete');
        if (msg) alert(msg);
        return;
      } else if (actionKey === 'unassign') {
        const idsToUnassign = ids.filter((id) => {
          const asset = assets.find((a) => a.id === id);
          return asset && asset.assignments?.length > 0;
        });
        const result = await runBulk({
          ids: idsToUnassign,
          request: (id) => fetch(`/api/assets/${id}/return`, { method: 'POST' }),
        });
        router.refresh();
        setSelectedIds(new Set(ids.filter((id) => !result.succeededIds.has(id))));
        const msg = summarizeBulk(result, idsToUnassign.length, 'unassign');
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
    { key: 'unassign', label: 'Return / Unassign', variant: 'warning' as const, confirm: 'Return {count} asset(s) to inventory? This marks them as unassigned.' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} asset(s)? This cannot be undone.' },
  ];

  if (assets.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-[12.5px] text-core-text3">
        No assets match your filters. Try clearing some filters or adding a new asset.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead className="sticky top-0 z-10 bg-core-surface2">
            <tr>
              <th
                className="border-b border-core-border px-[14px] py-[10px] text-left"
                style={{ width: 40 }}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelect}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
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
                  className="border-b border-core-border px-[14px] py-[10px] text-left text-[10px] font-bold uppercase text-core-text3"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, idx) => {
              const isLast = idx === assets.length - 1;
              const isSelected = selectedIds.has(asset.id);
              const assignedEmployee =
                asset.assignments && asset.assignments.length > 0
                  ? asset.assignments[0].employee
                  : null;
              const legacyName =
                !assignedEmployee && asset.assignedToName &&
                asset.assignedToName !== '' &&
                asset.assignedToName.toLowerCase() !== 'available'
                  ? asset.assignedToName
                  : null;
              const inUse = !!(assignedEmployee || legacyName);
              const conditionTone = CONDITION_TONE[asset.condition] ?? 'gray';
              const conditionLabel = CONDITION_LABEL[asset.condition] ?? asset.condition;
              const assigneeFullName = assignedEmployee
                ? `${assignedEmployee.firstName} ${assignedEmployee.lastName}`
                : legacyName ?? '';
              const assigneeInitials = assigneeFullName
                ? assigneeFullName
                    .split(/\s+/)
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : '';
              const aviSeed =
                assignedEmployee?.empCode || assignedEmployee?.firstName || legacyName || asset.assetTag;

              return (
                <tr
                  key={asset.id}
                  className="transition-colors hover:bg-core-surface2"
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #E5E8DD',
                    ...(isSelected ? { backgroundColor: 'rgba(143, 191, 63, 0.06)' } : {}),
                  }}
                >
                  <td
                    className="px-[14px] py-3"
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 40 }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(asset.id)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-[14px] py-3">
                    <Tag>{asset.assetTag}</Tag>
                  </td>
                  <td className="px-[14px] py-3 text-core-text2">{asset.category.name}</td>
                  <td className="px-[14px] py-3">
                    <div className="font-medium text-core-text">{asset.model}</div>
                    {asset.manufacturer && (
                      <div className="mt-[1px] text-[10.5px] text-core-text3">
                        {asset.manufacturer}
                      </div>
                    )}
                  </td>
                  <td className="px-[14px] py-3 font-mono text-[11.5px] text-core-text2">
                    {asset._ram || <span className="text-core-text3">—</span>}
                  </td>
                  <td className="px-[14px] py-3 font-mono text-[11.5px] text-core-text2">
                    {asset._storage || <span className="text-core-text3">—</span>}
                  </td>
                  <td className="px-[14px] py-3 text-core-text2">
                    {asset._cpu || <span className="text-core-text3">—</span>}
                  </td>
                  <td className="px-[14px] py-3 text-core-text2">
                    {asset._gpu || <span className="text-core-text3">—</span>}
                  </td>
                  <td className="px-[14px] py-3">
                    {asset.company ? (
                      <Tag>{asset.company.code || asset.company.name}</Tag>
                    ) : (
                      <span className="text-core-text3">—</span>
                    )}
                  </td>
                  <td className="px-[14px] py-3">
                    <Badge tone={conditionTone}>{conditionLabel}</Badge>
                  </td>
                  <td className="px-[14px] py-3">
                    {inUse ? (
                      <Badge tone="blue">IN USE</Badge>
                    ) : (
                      <Badge tone="gray">AVAILABLE</Badge>
                    )}
                  </td>
                  <td className="px-[14px] py-3">
                    {assigneeFullName ? (
                      <div className="flex items-center gap-[9px]">
                        <Avi
                          seed={aviSeed}
                          initials={assigneeInitials || '?'}
                          size={24}
                        />
                        <span className="text-core-text">{assigneeFullName}</span>
                      </div>
                    ) : (
                      <span className="text-core-text3">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-[14px] py-3">
                    <Btn as="a" href={`/assets/${asset.id}`} tone="ghost">
                      Manage
                    </Btn>
                  </td>
                </tr>
              );
            })}
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

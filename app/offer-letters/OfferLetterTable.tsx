'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';
import { runBulk, summarizeBulk } from '@/app/components/bulkRunner';
import { Avi, Badge, Btn } from '@/app/components/design';
import type { BadgeTone } from '@/app/components/design';

interface OfferLetter {
  id: number;
  candidateName: string | null;
  position: string;
  companyName: string | null;
  salary: number;
  currency: string;
  templateType: string;
  status: string;
  offerDate: string;
  employee: { firstName: string; lastName: string } | null;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'gray',
  SENT: 'blue',
  ACCEPTED: 'green',
  DECLINED: 'rose',
};

export default function OfferLetterTable({ offerLetters }: { offerLetters: OfferLetter[] }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return offerLetters.slice(start, start + itemsPerPage);
  }, [offerLetters, currentPage, itemsPerPage]);

  const getDisplayName = (letter: OfferLetter) => {
    return letter.candidateName || (letter.employee ? `${letter.employee.firstName} ${letter.employee.lastName}` : 'N/A');
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

  const pageIds = paginated.map((e) => e.id);
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
    setSelectedIds(new Set(offerLetters.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected offer letters
        const selected = offerLetters.filter((e) => selectedIds.has(e.id));
        const header = ['Candidate Name', 'Position', 'Company', 'Salary', 'Template Type', 'Status', 'Offer Date'];
        const rows = selected.map((e) => [
          getDisplayName(e), e.position, e.companyName || '-',
          `${e.currency} ${Number(e.salary).toLocaleString()}`,
          e.templateType.charAt(0) + e.templateType.slice(1).toLowerCase(),
          e.status, new Date(e.offerDate).toLocaleDateString(),
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offer-letters-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'delete') {
        const result = await runBulk({
          ids,
          request: (id) => fetch(`/api/offer-letters/${id}`, { method: 'DELETE' }),
        });
        router.refresh();
        setSelectedIds(new Set(ids.filter((id) => !result.succeededIds.has(id))));
        const msg = summarizeBulk(result, ids.length, 'delete');
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
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} offer letter(s)? This cannot be undone.' },
  ];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-core-surface2">
              <th className="border-b border-core-border px-[14px] py-[10px] text-left" style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelect}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
                />
              </th>
              {['Candidate', 'Position', 'Company', 'Salary', 'Template', 'Status', 'Offer Date', 'Actions'].map((h) => (
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-[14px] py-12 text-center text-core-text3">
                  No offer letters created yet.
                </td>
              </tr>
            ) : (
              paginated.map((letter, idx) => {
                const isLast = idx === paginated.length - 1;
                const isSelected = selectedIds.has(letter.id);
                const displayName = getDisplayName(letter);
                const initials = displayName
                  .split(/\s+/)
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || '?';
                const tone: BadgeTone = STATUS_TONE[letter.status] ?? 'gray';
                return (
                  <tr
                    key={letter.id}
                    onClick={() => router.push(`/offer-letters/${letter.id}`)}
                    className="cursor-pointer transition-colors hover:bg-core-surface2"
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid #E5E8DD',
                      ...(isSelected ? { backgroundColor: 'rgba(143, 191, 63, 0.06)' } : {}),
                    }}
                  >
                    <td className="px-[14px] py-3" onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(letter.id)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1F2320' }}
                      />
                    </td>
                    <td className="px-[14px] py-3">
                      <div className="flex items-center gap-[10px]">
                        <Avi seed={displayName} initials={initials} size={28} />
                        <span className="font-medium text-core-text">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-[14px] py-3 text-core-text2">{letter.position}</td>
                    <td className="px-[14px] py-3 text-core-text2">
                      {letter.companyName || <span className="text-core-text3">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-[14px] py-3 font-mono text-[12px] font-semibold text-core-text">
                      {letter.currency} {Number(letter.salary).toLocaleString()}
                    </td>
                    <td className="px-[14px] py-3 text-core-text2">
                      {letter.templateType.charAt(0) + letter.templateType.slice(1).toLowerCase()}
                    </td>
                    <td className="px-[14px] py-3">
                      <Badge tone={tone}>{letter.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-[14px] py-3 text-core-text2 tabular-nums">
                      {new Date(letter.offerDate).toLocaleDateString()}
                    </td>
                    <td
                      className="whitespace-nowrap px-[14px] py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Btn as="a" href={`/offer-letters/${letter.id}`} tone="ghost">
                        View
                      </Btn>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalItems={offerLetters.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={offerLetters.length}
        allSelected={selectedIds.size === offerLetters.length}
        onSelectAll={selectAllFiltered}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />
    </>
  );
}

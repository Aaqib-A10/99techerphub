'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

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

const statusColors: Record<string, string> = {
  DRAFT: 'badge-gray',
  SENT: 'badge-blue',
  ACCEPTED: 'badge-green',
  DECLINED: 'badge-red',
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
        for (const id of ids) {
          await fetch(`/api/offer-letters/${id}`, { method: 'DELETE' });
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
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} offer letter(s)? This cannot be undone.' },
  ];

  return (
    <>
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
              <th>Candidate Name</th>
              <th>Position</th>
              <th>Company</th>
              <th>Salary</th>
              <th>Template Type</th>
              <th>Status</th>
              <th>Offer Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500">
                  No offer letters created yet.
                </td>
              </tr>
            ) : (
              paginated.map((letter) => (
                <tr
                  key={letter.id}
                  style={selectedIds.has(letter.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(letter.id)}
                      onChange={() => toggleSelect(letter.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                    />
                  </td>
                  <td className="font-medium">
                    {getDisplayName(letter)}
                  </td>
                  <td>{letter.position}</td>
                  <td>{letter.companyName || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                    {letter.currency} {Number(letter.salary).toLocaleString()}
                  </td>
                  <td>
                    <span className="text-sm">
                      {letter.templateType.charAt(0) + letter.templateType.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusColors[letter.status]}`}>
                      {letter.status}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(letter.offerDate).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        href={`/offer-letters/${letter.id}`}
                        className="btn btn-sm btn-outline"
                      >
                        View
                      </Link>
                      {letter.status === 'DRAFT' && (
                        <Link
                          href={`/offer-letters/${letter.id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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

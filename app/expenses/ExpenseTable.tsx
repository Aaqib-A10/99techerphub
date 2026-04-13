'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ExpenseRowActions from './ExpenseRowActions';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';

interface Expense {
  id: number;
  expenseNumber: string;
  expenseDate: string;
  currency: string;
  amount: number;
  status: string;
  category: { name: string };
  company: { name: string };
  department: { name: string } | null;
  submittedBy: { firstName: string; lastName: string };
}

const statusColors: Record<string, string> = {
  DRAFT: 'badge-gray',
  PENDING: 'badge-yellow',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  NEEDS_REVISION: 'badge-blue',
};

export default function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return expenses.slice(start, start + itemsPerPage);
  }, [expenses, currentPage, itemsPerPage]);

  // Bulk selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageIds = paginatedExpenses.map((e) => e.id);
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
    setSelectedIds(new Set(expenses.map((e) => e.id)));
  };

  const handleBulkAction = async (actionKey: string) => {
    const ids = Array.from(selectedIds);
    setBulkLoading(actionKey);
    try {
      if (actionKey === 'export') {
        // Build CSV from selected expenses
        const selected = expenses.filter((e) => selectedIds.has(e.id));
        const header = ['Expense #', 'Date', 'Category', 'Company', 'Submitted By', 'Amount', 'Status'];
        const rows = selected.map((e) => [
          e.expenseNumber, new Date(e.expenseDate).toLocaleDateString(), e.category.name,
          e.company.name, `${e.submittedBy.firstName} ${e.submittedBy.lastName}`,
          `${e.currency} ${Number(e.amount).toLocaleString()}`, e.status.replace(/_/g, ' '),
        ]);
        const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (actionKey === 'approve') {
        for (const id of ids) {
          await fetch(`/api/expenses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          });
        }
        router.refresh();
      } else if (actionKey === 'reject') {
        for (const id of ids) {
          await fetch(`/api/expenses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REJECTED' }),
          });
        }
        router.refresh();
      } else if (actionKey === 'delete') {
        for (const id of ids) {
          await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
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
    { key: 'approve', label: 'Approve', variant: 'success' as const, confirm: 'Approve {count} expense(s)?' },
    { key: 'reject', label: 'Reject', variant: 'danger' as const, confirm: 'Reject {count} expense(s)?' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} expense(s)? This cannot be undone.' },
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
              <th>Expense #</th>
              <th>Date</th>
              <th>Category</th>
              <th>Company</th>
              <th>Submitted By</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedExpenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500">
                  No expenses submitted yet.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((exp) => (
                <tr
                  key={exp.id}
                  style={selectedIds.has(exp.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(exp.id)}
                      onChange={() => toggleSelect(exp.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#14B8A6' }}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 600, color: '#0B1F3A' }}>
                    {exp.expenseNumber}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(exp.expenseDate).toLocaleDateString()}</td>
                  <td>{exp.category.name}</td>
                  <td>{exp.company.name}</td>
                  <td>
                    {exp.submittedBy.firstName} {exp.submittedBy.lastName}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                    {exp.currency} {Number(exp.amount).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${statusColors[exp.status]}`}>
                      {exp.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <ExpenseRowActions
                      expenseId={exp.id}
                      expenseNumber={exp.expenseNumber}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        currentPage={currentPage}
        totalItems={expenses.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={expenses.length}
        allSelected={selectedIds.size === expenses.length}
        onSelectAll={selectAllFiltered}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ExpenseRowActions from './ExpenseRowActions';
import TablePagination from '@/app/components/TablePagination';
import BulkActionBar from '@/app/components/BulkActionBar';
import { runBulk, summarizeBulk } from '@/app/components/bulkRunner';
import ReportToolbar from '@/app/components/ReportToolbar';
import {
  ColumnDef,
  downloadCsv,
  formatPeriod,
  inDateRange,
  openPrintReport,
  thisMonthRange,
} from '@/lib/reportExport';

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
  // Period filter — defaults to this month so the export buttons hit
  // the right slice without extra clicks.
  const [{ from: defaultFrom, to: defaultTo }] = useState(thisMonthRange);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  // The date filter narrows the existing dataset; pagination then runs
  // off the filtered view so page-counts and bulk-selects stay
  // consistent with what's on screen.
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inDateRange(e.expenseDate, dateFrom, dateTo)),
    [expenses, dateFrom, dateTo],
  );

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  const exportColumns: ColumnDef<Expense>[] = [
    { header: 'Expense #', value: (e) => e.expenseNumber },
    {
      header: 'Date',
      value: (e) => new Date(e.expenseDate).toLocaleDateString(),
    },
    { header: 'Category', value: (e) => e.category.name },
    { header: 'Company', value: (e) => e.company.name },
    { header: 'Department', value: (e) => e.department?.name ?? '' },
    {
      header: 'Submitted By',
      value: (e) => `${e.submittedBy.firstName} ${e.submittedBy.lastName}`,
    },
    { header: 'Currency', value: (e) => e.currency },
    {
      header: 'Amount',
      value: (e) => Number(e.amount).toLocaleString(),
      align: 'right',
    },
    { header: 'Status', value: (e) => e.status.replace(/_/g, ' ') },
  ];

  const exportTotals = () => {
    const sum = filteredExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const approved = filteredExpenses
      .filter((e) => e.status === 'APPROVED')
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const pending = filteredExpenses
      .filter((e) => e.status === 'PENDING')
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const rejected = filteredExpenses
      .filter((e) => e.status === 'REJECTED')
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    return [
      { label: 'Total submitted', value: `PKR ${sum.toLocaleString()}` },
      { label: 'Approved', value: `PKR ${approved.toLocaleString()}` },
      { label: 'Pending', value: `PKR ${pending.toLocaleString()}` },
      { label: 'Rejected', value: `PKR ${rejected.toLocaleString()}` },
    ];
  };

  const periodLabel = formatPeriod(dateFrom, dateTo);
  const periodSlug = (dateFrom || 'all') + '_to_' + (dateTo || 'now');

  const handleExportCsv = () => {
    downloadCsv(`expenses_${periodSlug}.csv`, filteredExpenses, exportColumns);
  };

  const handleExportPdf = () => {
    openPrintReport({
      title: 'Expense Register',
      period: periodLabel,
      rows: filteredExpenses,
      columns: exportColumns,
      totals: exportTotals(),
    });
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
    // "All" within the period filter, not the underlying dataset.
    setSelectedIds(new Set(filteredExpenses.map((e) => e.id)));
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
      } else if (actionKey === 'approve' || actionKey === 'reject' || actionKey === 'delete') {
        const result = await runBulk({
          ids,
          request: (id) =>
            actionKey === 'delete'
              ? fetch(`/api/expenses/${id}`, { method: 'DELETE' })
              : fetch(`/api/expenses/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: actionKey === 'approve' ? 'APPROVED' : 'REJECTED',
                  }),
                }),
        });
        router.refresh();
        setSelectedIds(new Set(ids.filter((id) => !result.succeededIds.has(id))));
        const msg = summarizeBulk(result, ids.length, actionKey);
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
    { key: 'approve', label: 'Approve', variant: 'success' as const, confirm: 'Approve {count} expense(s)?' },
    { key: 'reject', label: 'Reject', variant: 'danger' as const, confirm: 'Reject {count} expense(s)?' },
    { key: 'delete', label: 'Delete', variant: 'danger' as const, confirm: 'Permanently delete {count} expense(s)? This cannot be undone.' },
  ];

  return (
    <>
      <ReportToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => {
          setDateFrom(v);
          setCurrentPage(1);
        }}
        onDateToChange={(v) => {
          setDateTo(v);
          setCurrentPage(1);
        }}
        onReset={() => {
          setDateFrom('');
          setDateTo('');
          setCurrentPage(1);
        }}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />
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
              <th>Expense #</th>
              <th>Date</th>
              <th>Category</th>
              <th>Company</th>
              <th>Submitted By</th>
              <th>Amount</th>
              <th>Status</th>
              <th className="col-sticky-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedExpenses.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-core-text3">
                  No expenses submitted yet.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((exp) => (
                <tr
                  key={exp.id}
                  onClick={() => router.push(`/expenses/${exp.id}`)}
                  className="cursor-pointer transition-colors hover:bg-core-surface2"
                  style={selectedIds.has(exp.id) ? { backgroundColor: 'rgba(20, 184, 166, 0.06)' } : undefined}
                >
                  <td onClick={(e) => e.stopPropagation()} style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(exp.id)}
                      onChange={() => toggleSelect(exp.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#8FBF3F' }}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 600, color: '#1F2320' }}>
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
                  <td
                    className="col-sticky-right"
                    onClick={(e) => e.stopPropagation()}
                  >
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
        totalItems={filteredExpenses.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Bulk Action Bar — counts reflect the period filter so "Select
          all" doesn't grab rows the user can't see. */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredExpenses.length}
        allSelected={
          selectedIds.size > 0 && selectedIds.size === filteredExpenses.length
        }
        onSelectAll={selectAllFiltered}
        onDeselectAll={() => setSelectedIds(new Set())}
        actions={bulkActions}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />
    </>
  );
}

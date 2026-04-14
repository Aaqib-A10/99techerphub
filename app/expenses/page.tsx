export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ExportButton from '@/components/ExportButton';
import ExpenseTable from './ExpenseTable';
import PageHero from '@/app/components/PageHero';
import DateFilter from '@/app/components/DateFilter';

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    include: {
      category: true,
      company: true,
      department: true,
      submittedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const [totalExpenses, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.expense.count({ where: { status: 'PENDING' } }),
    prisma.expense.count({ where: { status: 'APPROVED' } }),
    prisma.expense.count({ where: { status: 'REJECTED' } }),
  ]);

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    PENDING: 'badge-yellow',
    APPROVED: 'badge-green',
    REJECTED: 'badge-red',
    NEEDS_REVISION: 'badge-blue',
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Expense Vault"
        title="Expenses"
        description="Track and manage all company expenses"
        actions={
          <>
            <Link href="/expenses/capture" className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Quick Capture
            </Link>
            <Link href="/expenses/new" className="btn btn-accent">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit Expense
            </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">
            {(totalExpenses._sum.amount || 0).toLocaleString()}
          </div>
          <div className="stat-change">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-value text-yellow-600">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value text-green-600">{approvedCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value text-red-600">{rejectedCount}</div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-6 flex justify-end">
        <DateFilter />
      </div>

      {/* Expense Table */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="section-heading">All Expenses</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{expenses.length} records</span>
            <ExportButton
              module="expenses"
              filters={{}}
            />
          </div>
        </div>
        <ExpenseTable expenses={JSON.parse(JSON.stringify(expenses))} />
      </div>
    </div>
  );
}

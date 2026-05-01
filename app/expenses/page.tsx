export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ExportButton from '@/components/ExportButton';
import ExpenseTable from './ExpenseTable';
import PageHero from '@/app/components/PageHero';
import DateFilter from '@/app/components/DateFilter';
import { KpiTile } from '@/app/components/design';

const VALID_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVISION'] as const;
type ExpenseStatusFilter = (typeof VALID_STATUSES)[number];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { status?: string; from?: string; to?: string };
}) {
  const rawStatus = searchParams.status?.toUpperCase();
  const activeStatus: ExpenseStatusFilter | null =
    rawStatus && (VALID_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as ExpenseStatusFilter)
      : null;

  const dateFrom = searchParams.from ? new Date(searchParams.from) : null;
  const dateTo = searchParams.to ? new Date(searchParams.to) : null;
  const dateRange =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        }
      : undefined;

  const tableWhere = {
    ...(activeStatus ? { status: activeStatus } : {}),
    ...(dateRange ? { expenseDate: dateRange } : {}),
  };

  const cardsWhere = dateRange ? { expenseDate: dateRange } : {};

  const expenses = await prisma.expense.findMany({
    where: tableWhere,
    include: {
      category: true,
      company: true,
      department: true,
      submittedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const [totalExpenses, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.expense.aggregate({ _sum: { amount: true }, where: cardsWhere }),
    prisma.expense.count({ where: { ...cardsWhere, status: 'PENDING' } }),
    prisma.expense.count({ where: { ...cardsWhere, status: 'APPROVED' } }),
    prisma.expense.count({ where: { ...cardsWhere, status: 'REJECTED' } }),
  ]);

  const buildHref = (status?: ExpenseStatusFilter) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (searchParams.from) params.set('from', searchParams.from);
    if (searchParams.to) params.set('to', searchParams.to);
    const qs = params.toString();
    return qs ? `/expenses?${qs}` : '/expenses';
  };

  const cardActiveClass =
    'rounded-2xl ring-2 ring-core-text/15 ring-offset-2 ring-offset-core-bg';

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

      {/* KPI strip — clickable, deep-link to filter view */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link
          href={buildHref()}
          className={`block transition focus:outline-none ${
            activeStatus === null ? cardActiveClass : 'hover:opacity-90'
          }`}
        >
          <KpiTile
            tone="blue"
            label="Total Expenses"
            value={(totalExpenses._sum.amount || 0).toLocaleString()}
            meta={dateRange ? 'In selected range' : 'All time'}
          />
        </Link>
        <Link
          href={buildHref('PENDING')}
          className={`block transition focus:outline-none ${
            activeStatus === 'PENDING' ? cardActiveClass : 'hover:opacity-90'
          }`}
        >
          <KpiTile tone="amber" label="Pending Approval" value={pendingCount} />
        </Link>
        <Link
          href={buildHref('APPROVED')}
          className={`block transition focus:outline-none ${
            activeStatus === 'APPROVED' ? cardActiveClass : 'hover:opacity-90'
          }`}
        >
          <KpiTile tone="green" label="Approved" value={approvedCount} />
        </Link>
        <Link
          href={buildHref('REJECTED')}
          className={`block transition focus:outline-none ${
            activeStatus === 'REJECTED' ? cardActiveClass : 'hover:opacity-90'
          }`}
        >
          <KpiTile tone="rose" label="Rejected" value={rejectedCount} />
        </Link>
      </div>

      {/* Date Filter */}
      <div className="mb-6 flex justify-end">
        <DateFilter />
      </div>

      {/* Expense Table */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h2 className="section-heading">
            {activeStatus
              ? `${activeStatus.charAt(0)}${activeStatus.slice(1).toLowerCase().replace('_', ' ')} Expenses`
              : 'All Expenses'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-core-text3">{expenses.length} records</span>
            <ExportButton
              module="expenses"
              filters={{
                ...(activeStatus ? { status: activeStatus } : {}),
                ...(searchParams.from ? { from: searchParams.from } : {}),
                ...(searchParams.to ? { to: searchParams.to } : {}),
              }}
            />
          </div>
        </div>
        <ExpenseTable expenses={JSON.parse(JSON.stringify(expenses))} />
      </div>
    </div>
  );
}

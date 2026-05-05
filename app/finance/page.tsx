export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DateFilter from '@/app/components/DateFilter';
import { KpiTile, Card, Badge, Btn } from '@/app/components/design';

export default async function FinancePage() {
  // Slimmed Finance overview — leads with the Master Ledger as the
  // single source of truth. The Salary / Commission / Deduction /
  // Payroll / Cost-Split routes still exist but are hidden from the
  // sidebar for v1; their code is untouched and can be re-surfaced
  // later by re-adding the children to Sidebar.tsx.
  const [
    activeEmployees,
    pendingExpenses,
    approvedExpenseSum,
    rejectedExpenseCount,
    latestLedger,
    recentLedgerEntries,
    pendingBills,
    pendingCheques,
  ] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.expense.count({ where: { status: 'PENDING' } }),
    prisma.expense.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    }),
    prisma.expense.count({ where: { status: 'REJECTED' } }),
    // Most recent ledger row gives us the live balance.
    prisma.ledgerEntry.findFirst({
      orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
      select: { runningBal: true },
    }),
    // A short recent-activity strip on the overview.
    prisma.ledgerEntry.findMany({
      orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
      take: 6,
      include: {
        category: { select: { name: true } },
      },
    }),
    prisma.bill.count({ where: { status: 'PENDING' } }),
    prisma.cheque.count({ where: { status: 'PENDING' } }),
  ]);

  const balance = Number(latestLedger?.runningBal ?? 0);
  const approvedAmt = Number(approvedExpenseSum._sum.amount || 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            Finance · Command Deck
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Finance
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            Your master cash ledger, expense queue, and reports — at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn as="a" href="/finance/reports" tone="ghost">
            Monthly Reports
          </Btn>
          <Btn as="a" href="/finance/ledger" tone="primary">
            Open Master Ledger
          </Btn>
        </div>
      </div>

      {/* KPI strip — five tiles that match the new slim Finance shape */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          tone={balance >= 0 ? 'green' : 'rose'}
          label="Current Balance"
          value={`PKR ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          meta={balance < 0 ? 'Liquidity shortfall' : 'Live ledger'}
        />
        <KpiTile
          tone="blue"
          label="Active Employees"
          value={activeEmployees.toLocaleString()}
        />
        <KpiTile
          tone="amber"
          label="Pending Expenses"
          value={pendingExpenses.toLocaleString()}
          meta="Awaiting approval"
        />
        <KpiTile
          tone="violet"
          label="Approved Expenses"
          value={`PKR ${approvedAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          meta="All time"
        />
        <KpiTile
          tone="rose"
          label="Open Items"
          value={(pendingBills + pendingCheques).toLocaleString()}
          meta={`${pendingBills} bills · ${pendingCheques} cheques`}
        />
      </div>

      {/* Date filter */}
      <div className="mb-4 flex justify-end">
        <DateFilter />
      </div>

      {/* Quick actions — only the four slim entries */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { href: '/finance/ledger?tab=billing', title: 'Add Bill', sub: 'Vendor invoice + scan' },
          { href: '/finance/ledger?tab=cheques', title: 'Log Cheque', sub: 'Bank instrument tracker' },
          { href: '/finance/ledger?tab=opex', title: 'Post OPEX', sub: 'Rental / maintenance / donation' },
          { href: '/expenses', title: 'Expenses Queue', sub: 'Review pending submissions' },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex flex-col rounded-2xl border border-core-border bg-core-surface p-4 transition hover:bg-core-surface2"
          >
            <p
              className="text-[10px] font-semibold uppercase text-core-text3"
              style={{ letterSpacing: '0.09em' }}
            >
              Quick action
            </p>
            <h3
              className="mt-[6px] text-[14px] font-semibold text-core-text"
              style={{ letterSpacing: '-0.01em' }}
            >
              {q.title}
            </h3>
            <p className="mt-[2px] text-[12px] text-core-text3">{q.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent ledger activity */}
        <Card
          title="Recent Ledger Activity"
          action={
            <Link
              href="/finance/ledger"
              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
            >
              View ledger →
            </Link>
          }
        >
          {recentLedgerEntries.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-core-text3">
              No ledger entries yet. Post your first bill, cheque, or OPEX from the
              quick actions above.
            </p>
          ) : (
            <div className="space-y-2">
              {recentLedgerEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-core-text3">
                      {e.serialNo}
                    </div>
                    <div className="mt-[1px] truncate font-semibold text-core-text">
                      {e.transDetail}
                    </div>
                    <div className="mt-[2px] text-[11px] text-core-text3">
                      {e.category.name} · {new Date(e.transDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    {Number(e.creditAmt) > 0 ? (
                      <div className="font-mono text-[12.5px] font-semibold text-core-greenFg">
                        + PKR {Number(e.creditAmt).toLocaleString()}
                      </div>
                    ) : (
                      <div className="font-mono text-[12.5px] font-semibold text-core-roseFg">
                        − PKR {Number(e.debitAmt).toLocaleString()}
                      </div>
                    )}
                    <Badge tone="gray">{e.source}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending review queue */}
        <Card
          title="Awaiting Action"
          action={
            <Link
              href="/expenses?status=PENDING"
              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
            >
              View expenses →
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-3">
            <Link
              href="/expenses?status=PENDING"
              className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px] transition hover:bg-core-surface"
            >
              <div>
                <div className="font-semibold text-core-text">Expenses pending approval</div>
                <div className="mt-[2px] text-[11.5px] text-core-text3">
                  Review and approve submitted expenses
                </div>
              </div>
              <div className="font-mono text-[18px] font-semibold text-core-amberFg">
                {pendingExpenses}
              </div>
            </Link>
            <Link
              href="/finance/ledger?tab=billing"
              className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px] transition hover:bg-core-surface"
            >
              <div>
                <div className="font-semibold text-core-text">Bills pending payment</div>
                <div className="mt-[2px] text-[11.5px] text-core-text3">
                  Mark paid to post the debit to the ledger
                </div>
              </div>
              <div className="font-mono text-[18px] font-semibold text-core-amberFg">
                {pendingBills}
              </div>
            </Link>
            <Link
              href="/finance/ledger?tab=cheques"
              className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px] transition hover:bg-core-surface"
            >
              <div>
                <div className="font-semibold text-core-text">Cheques pending clearance</div>
                <div className="mt-[2px] text-[11.5px] text-core-text3">
                  Mark cleared to commit to the ledger
                </div>
              </div>
              <div className="font-mono text-[18px] font-semibold text-core-amberFg">
                {pendingCheques}
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

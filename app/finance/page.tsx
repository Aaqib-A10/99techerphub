export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DateFilter from '@/app/components/DateFilter';
import { KpiTile, Card, Badge, Btn } from '@/app/components/design';
import type { BadgeTone } from '@/app/components/design';

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'gray',
  FINALIZED: 'amber',
  PAID: 'green',
};

export default async function FinancePage() {
  const [
    totalEmployees,
    payrollRuns,
    totalExpensesApproved,
    recentSalaryChanges,
    commissionCount,
    deductionCount,
  ] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.payrollRun.findMany({
      include: { company: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.expense.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    }),
    prisma.salaryHistory.findMany({
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.commission.count(),
    prisma.deduction.count(),
  ]);

  const approvedExpenseAmount = Number(totalExpensesApproved._sum.amount || 0);

  return (
    <div>
      {/* Page header */}
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
            Finance &amp; Payroll
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            Manage salaries, payroll runs, and financial reporting
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn as="a" href="/finance/reports" tone="ghost">
            Monthly Reports
          </Btn>
          <Btn as="a" href="/finance/payroll" tone="primary">
            Payroll Runs
          </Btn>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile tone="blue" label="Active Employees" value={totalEmployees.toLocaleString()} />
        <KpiTile tone="violet" label="Payroll Runs" value={payrollRuns.length} meta="Last 10 visible" />
        <KpiTile
          tone="green"
          label="Approved Expenses"
          value={`PKR ${approvedExpenseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiTile tone="amber" label="Commissions" value={commissionCount.toLocaleString()} />
        <KpiTile tone="rose" label="Deductions" value={deductionCount.toLocaleString()} />
      </div>

      {/* Date filter */}
      <div className="mb-4 flex justify-end">
        <DateFilter />
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { href: '/finance/payroll', title: 'Payroll Runs', sub: 'Process monthly payroll' },
          { href: '/finance/salary', title: 'Salary Management', sub: 'Increments & adjustments' },
          { href: '/finance/commissions', title: 'Commissions', sub: 'Bonuses & commissions' },
          { href: '/finance/deductions', title: 'Deductions', sub: 'Tax, loans, advances' },
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
        {/* Payroll Runs */}
        <Card
          title="Recent Payroll Runs"
          action={
            <Link
              href="/finance/payroll"
              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
            >
              View All →
            </Link>
          }
        >
          {payrollRuns.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-core-text3">No payroll runs yet</p>
          ) : (
            <div className="space-y-2">
              {payrollRuns.slice(0, 5).map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px]"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-core-text">{pr.period}</div>
                    <div className="mt-[2px] text-[11.5px] text-core-text3">
                      {pr.company?.name || 'All Companies'} · {pr.items.length} employees
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <div className="font-mono text-[12.5px] font-semibold text-core-text">
                      PKR {Number(pr.totalNet).toLocaleString()}
                    </div>
                    <Badge tone={STATUS_TONE[pr.status] ?? 'gray'}>{pr.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Salary Changes */}
        <Card
          title="Recent Salary Changes"
          action={
            <Link
              href="/finance/salary"
              className="text-[12px] font-semibold text-core-text2 hover:text-core-text"
            >
              Manage →
            </Link>
          }
        >
          {recentSalaryChanges.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-core-text3">
              No salary changes recorded
            </p>
          ) : (
            <div className="space-y-2">
              {recentSalaryChanges.map((sh) => (
                <div
                  key={sh.id}
                  className="flex items-center justify-between rounded-xl border border-core-border bg-core-surface2 p-[14px]"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-core-text">
                      {sh.employee.firstName} {sh.employee.lastName}
                    </div>
                    <div className="mt-[2px] text-[11.5px] text-core-text3">
                      Effective: {new Date(sh.effectiveFrom).toLocaleDateString()}
                      {sh.reason && ` — ${sh.reason}`}
                    </div>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <div className="font-mono text-[12.5px] font-semibold text-core-text">
                      {sh.currency} {Number(sh.baseSalary).toLocaleString()}
                    </div>
                    {sh.incrementPct && (
                      <Badge tone="green">+{Number(sh.incrementPct)}%</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

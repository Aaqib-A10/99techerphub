export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import DateFilter from '@/app/components/DateFilter';

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

  const statusColors: Record<string, string> = {
    DRAFT: 'badge-gray',
    FINALIZED: 'badge-yellow',
    PAID: 'badge-green',
  };

  return (
    <div>
      <PageHero
        eyebrow="Finance / Command Deck"
        title="Finance & Payroll"
        description="Manage salaries, payroll runs, and financial reporting"
        actions={
          <>
            <Link href="/finance/reports" className="btn btn-secondary">
              Monthly Reports
            </Link>
            <Link href="/finance/payroll" className="btn btn-accent">
              Payroll Runs
            </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="stat-card">
          <div className="stat-label">Active Employees</div>
          <div className="stat-value">{totalEmployees}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Payroll Runs</div>
          <div className="stat-value">{payrollRuns.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Expenses</div>
          <div className="stat-value text-green-600">
            {(totalExpensesApproved._sum.amount || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Commissions</div>
          <div className="stat-value">{commissionCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deductions</div>
          <div className="stat-value">{deductionCount}</div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-6 flex justify-end">
        <DateFilter />
      </div>

      {/* Quick Actions */}
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
            className="group flex flex-col rounded-lg border border-zinc-200/85 bg-white p-4 transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]"
          >
            <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
              Quick action
            </p>
            <h3 className="mt-1 text-[14px] font-semibold tracking-tight text-zinc-900">
              {q.title}
            </h3>
            <p className="mt-0.5 text-[12px] text-zinc-500">{q.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll Runs */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h2 className="section-heading">Recent Payroll Runs</h2>
            <Link href="/finance/payroll" className="text-sm text-brand-primary hover:underline">View All</Link>
          </div>
          <div className="card-body">
            {payrollRuns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No payroll runs yet</p>
            ) : (
              <div className="space-y-3">
                {payrollRuns.slice(0, 5).map((pr) => (
                  <div key={pr.id} className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#F8F9FF', border: '1px solid rgba(196, 198, 206, 0.2)' }}>
                    <div>
                      <div className="font-semibold" style={{ color: '#0B1F3A' }}>{pr.period}</div>
                      <div className="text-xs" style={{ color: '#75777E' }}>
                        {pr.company?.name || 'All Companies'} &middot; {pr.items.length} employees
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold mono" style={{ color: '#0B1F3A' }}>PKR {Number(pr.totalNet).toLocaleString()}</div>
                      <span className={`badge ${statusColors[pr.status]}`}>{pr.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Salary Changes */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h2 className="section-heading">Recent Salary Changes</h2>
            <Link href="/finance/salary" className="text-sm text-brand-primary hover:underline">Manage</Link>
          </div>
          <div className="card-body">
            {recentSalaryChanges.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No salary changes recorded</p>
            ) : (
              <div className="space-y-3">
                {recentSalaryChanges.map((sh) => (
                  <div key={sh.id} className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#F8F9FF', border: '1px solid rgba(196, 198, 206, 0.2)' }}>
                    <div>
                      <div className="font-semibold" style={{ color: '#0B1F3A' }}>{sh.employee.firstName} {sh.employee.lastName}</div>
                      <div className="text-xs" style={{ color: '#75777E' }}>
                        Effective: {new Date(sh.effectiveFrom).toLocaleDateString()}
                        {sh.reason && ` — ${sh.reason}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold mono" style={{ color: '#0B1F3A' }}>{sh.currency} {Number(sh.baseSalary).toLocaleString()}</div>
                      {sh.incrementPct && (
                        <span className="badge badge-green text-xs">+{Number(sh.incrementPct)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

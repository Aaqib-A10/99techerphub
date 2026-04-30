import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// ============================================================================
// 99 Hub ERP — Ledger Dashboard
// Architectural Ledger design — 4-up KPI strip, recent activity feed,
// and a right rail with Asset Distribution + Monthly Burn cards.
// Uses inline styles for navy/teal so it renders without waiting for
// tailwind.config.ts to be picked up.
// ============================================================================

const NAVY = '#0B1F3A';
const TEAL = '#14B8A6';
const TEAL_LIGHT = '#6df5e1';
const SURFACE = '#F8F9FF';
const SURFACE_LOW = '#EFF4FF';
const INK = '#0B1C30';
const INK_MUTED = '#44474D';
const OUTLINE = '#75777E';
const AMBER = '#F59E0B';
const ROSE = '#E11D48';
const EMERALD = '#059669';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';

interface Props {
  selectedCompany: string;
  selectedDepartment: string;
  dateFrom: string;
  dateTo: string;
}

export default async function LedgerDashboard({
  selectedCompany,
  selectedDepartment,
  dateFrom,
  dateTo,
}: Props) {
  const companyId =
    selectedCompany !== 'all' && !isNaN(Number(selectedCompany)) ? Number(selectedCompany) : null;
  const departmentId =
    selectedDepartment !== 'all' && !isNaN(Number(selectedDepartment))
      ? Number(selectedDepartment)
      : null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Date filter range
  const dateFilter: any = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }
  const hasDateFilter = dateFrom || dateTo;

  const employeeBase: any = {};
  if (companyId != null) employeeBase.companyId = companyId;
  if (departmentId != null) employeeBase.departmentId = departmentId;
  if (hasDateFilter) employeeBase.dateOfJoining = dateFilter;

  const assetBase: any = { isRetired: false };
  if (companyId != null) assetBase.companyId = companyId;
  if (hasDateFilter) assetBase.purchaseDate = dateFilter;

  const expenseBase: any = {};
  if (companyId != null) expenseBase.companyId = companyId;
  if (departmentId != null) expenseBase.departmentId = departmentId;
  if (hasDateFilter) expenseBase.createdAt = dateFilter;

  // -------- KPI DATA --------
  const [
    totalEmployees,
    exitedEmployees,
    assetsCount,
    assetsValueAgg,
    pendingApprovalsCount,
    pendingApprovalsSumAgg,
    overdueReturnsCount,
    // Company names (for header pill)
    companyRows,
    // Recent activity — pull recent expenses + assignments
    recentExpenses,
    recentAssetAssignments,
    // Burn by category this month
    burnByCategory,
  ] = await Promise.all([
    prisma.employee.count({ where: employeeBase }),
    prisma.employee.count({ where: { ...employeeBase, isActive: false } }),
    prisma.asset.count({ where: assetBase }),
    prisma.asset.aggregate({ _sum: { purchasePrice: true }, where: assetBase }),
    prisma.expense.count({ where: { ...expenseBase, status: 'PENDING' } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { ...expenseBase, status: 'PENDING' },
    }),
    // "Overdue" = open assignment (not returned) older than 180 days.
    // Schema has no expectedReturnDate field, so we approximate with age.
    prisma.assetAssignment.count({
      where: {
        returnedDate: null,
        assignedDate: {
          lt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.expense.findMany({
      where: expenseBase,
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        company: { select: { name: true, code: true } },
        submittedBy: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.assetAssignment.findMany({
      where: {},
      orderBy: { assignedDate: 'desc' },
      take: 4,
      include: {
        asset: { select: { assetTag: true, model: true, manufacturer: true } },
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: {
        ...expenseBase,
        status: 'APPROVED',
        expenseDate: { gte: monthStart },
      },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    }),
  ]);

  const assetsValue = Number(assetsValueAgg._sum.purchasePrice) || 0;
  const pendingApprovalsSum = Number(pendingApprovalsSumAgg._sum.amount) || 0;

  // Resolve category names for the burn card
  const catIds = burnByCategory.map((b) => b.categoryId).filter(Boolean) as number[];
  const categories =
    catIds.length > 0
      ? await prisma.expenseCategory.findMany({
          where: { id: { in: catIds } },
          select: { id: true, name: true },
        })
      : [];
  const catName = (id: number | null) =>
    categories.find((c) => c.id === id)?.name || 'Other';

  // Expense status breakdown for the dashboard card
  const [expApproved, expPendingAgg, expRejected, expDraft] = await Promise.all([
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { ...expenseBase, status: 'APPROVED' } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { ...expenseBase, status: 'PENDING' } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { ...expenseBase, status: 'REJECTED' } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true, where: { ...expenseBase, status: 'DRAFT' } }),
  ]);
  const expenseStatusData = [
    { label: 'Approved', count: expApproved._count, amount: Number(expApproved._sum.amount) || 0, color: EMERALD },
    { label: 'Pending', count: expPendingAgg._count, amount: Number(expPendingAgg._sum.amount) || 0, color: AMBER },
    { label: 'Rejected', count: expRejected._count, amount: Number(expRejected._sum.amount) || 0, color: ROSE },
    { label: 'Draft', count: expDraft._count, amount: Number(expDraft._sum.amount) || 0, color: OUTLINE },
  ];
  const expenseTotalAmount = expenseStatusData.reduce((a, e) => a + e.amount, 0) || 1;

  // Burn by category totals
  const burnTotal = burnByCategory.reduce((a, b) => a + (Number(b._sum.amount) || 0), 0);

  // Merge recent expenses + assignments into a unified activity feed
  type Activity = {
    key: string;
    kind: 'EXPENSE' | 'ASSIGNMENT';
    who: string;
    verb: string;
    what: string;
    meta: string;
    time: Date;
    accent?: string;
  };
  const activity: Activity[] = [
    ...recentExpenses.map<Activity>((e) => ({
      key: `exp-${e.id}`,
      kind: 'EXPENSE',
      who: e.submittedBy
        ? `${e.submittedBy.firstName} ${e.submittedBy.lastName}`
        : 'Someone',
      verb: 'submitted expense for',
      what: e.category?.name || 'Expense',
      meta: `${e.company?.code || '—'} · ${fmtMoney(Number(e.amount))}`,
      time: e.createdAt,
    })),
    ...recentAssetAssignments.map<Activity>((a) => ({
      key: `asg-${a.id}`,
      kind: 'ASSIGNMENT',
      who: a.employee
        ? `${a.employee.firstName} ${a.employee.lastName}`
        : 'Someone',
      verb: a.returnedDate ? 'returned' : 'checked out',
      what: a.asset ? `${a.asset.manufacturer || ''} ${a.asset.model || ''}`.trim() : 'an asset',
      meta: a.asset ? `Tag: ${a.asset.assetTag}` : '',
      time: a.assignedDate || a.createdAt,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 5);

  const today = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const scopeLabel =
    selectedCompany === 'all'
      ? 'All companies'
      : companyRows.find((c) => c.id === companyId)?.name || 'All';

  const expenseTotal = expenseStatusData.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="font-sans text-zinc-900 antialiased">
      {/* Hero — quiet greeting + scope chip */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
            {greeting}
          </h1>
          <p className="mt-1 text-[13px] text-zinc-500">{today}</p>
        </div>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-zinc-200/85 bg-white px-3 text-[11.5px] font-medium text-zinc-700">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#14B8A6' }}
          />
          Viewing · {scopeLabel}
        </span>
      </div>

      {/* KPI strip */}
      {/* Forward the dashboard's active company/department filter onto each
          tile's destination so a user filtering by "99 Tech" doesn't lose
          their scope when they click into the list view. */}
      {(() => {
        const employeeFilter = new URLSearchParams();
        if (selectedCompany !== 'all') employeeFilter.set('company', selectedCompany);
        if (selectedDepartment !== 'all') employeeFilter.set('department', selectedDepartment);
        const employeeFilterQs = employeeFilter.toString();
        const withEmployeeFilters = (base: string) => {
          if (!employeeFilterQs) return base;
          return base.includes('?') ? `${base}&${employeeFilterQs}` : `${base}?${employeeFilterQs}`;
        };

        const assetFilter = new URLSearchParams();
        if (selectedCompany !== 'all') assetFilter.set('companyId', selectedCompany);
        const assetFilterQs = assetFilter.toString();
        const withAssetFilters = (base: string) => {
          if (!assetFilterQs) return base;
          return base.includes('?') ? `${base}&${assetFilterQs}` : `${base}?${assetFilterQs}`;
        };

        return (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiTile
              href={withEmployeeFilters('/employees')}
              label="Total employees"
              value={totalEmployees}
              delta={`${totalEmployees - exitedEmployees} active`}
              deltaTone="neutral"
            />
            <KpiTile
              href={withEmployeeFilters('/employees?status=exited')}
              label="Exited"
              value={exitedEmployees}
              delta={`${totalEmployees > 0 ? Math.round((exitedEmployees / totalEmployees) * 100) : 0}% of total`}
              deltaTone="negative"
            />
            <KpiTile
              href={withAssetFilters('/assets')}
              label="Assets under custody"
              value={assetsCount}
              delta={fmtMoney(assetsValue)}
              deltaTone="neutral"
            />
            <KpiTile
              href="/expenses?status=PENDING"
              label="Pending approvals"
              value={pendingApprovalsCount}
              delta={fmtMoney(pendingApprovalsSum)}
              deltaTone={pendingApprovalsCount > 0 ? 'warning' : 'neutral'}
            />
            <KpiTile
              href={withAssetFilters('/assets?overdue=1')}
              label="Overdue returns"
              value={overdueReturnsCount}
              delta={overdueReturnsCount > 0 ? 'Action needed' : 'All clear'}
              deltaTone={overdueReturnsCount > 0 ? 'negative' : 'positive'}
            />
          </div>
        );
      })()}

      {/* Recent activity + right rail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Recent Activity */}
        <SurfaceCard className="lg:col-span-7">
          <SurfaceHeader
            title="Recent activity"
            action={
              <Link
                href="/audit"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
              >
                View all
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14 M12 5l7 7-7 7" />
                </svg>
              </Link>
            }
          />
          <div>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4 M12 16h.01" />
                  </svg>
                </div>
                <p className="mt-2 text-[12.5px] text-zinc-500">
                  No recent activity yet.
                </p>
              </div>
            ) : (
              <ul>
                {activity.map((item, i) => (
                  <li
                    key={item.key}
                    className={`flex items-start gap-3 px-4 py-3 ${
                      i > 0 ? 'border-t border-zinc-100' : ''
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        item.kind === 'EXPENSE'
                          ? 'bg-amber-50 text-amber-700'
                          : item.verb === 'returned'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {initialsOf(item.who)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] text-zinc-800">
                          <span className="font-medium text-zinc-900">{item.who}</span>{' '}
                          <span className="text-zinc-500">{item.verb}</span>{' '}
                          <span className="text-zinc-800">{item.what}</span>
                        </p>
                        <span className="flex-shrink-0 text-[10.5px] tabular-nums text-zinc-400">
                          {fmtRelative(item.time)}
                        </span>
                      </div>
                      {item.meta && (
                        <p className="mt-0.5 text-[11.5px] text-zinc-500 tabular-nums">
                          {item.meta}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SurfaceCard>

        {/* Right rail */}
        <div className="space-y-4 lg:col-span-5">
          {/* Expenses overview */}
          <SurfaceCard>
            <SurfaceHeader title="Expenses overview" />
            <div className="px-4 pb-4">
              {/* Stacked bar */}
              <div className="mb-4 flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                {expenseStatusData.map((s) => {
                  const pct = (s.amount / (expenseTotalAmount || 1)) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={s.label}
                      className={EXPENSE_TINT_BAR[s.label] || 'bg-zinc-300'}
                      style={{ width: `${pct}%` }}
                      title={`${s.label}: ${fmtMoney(s.amount)}`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {expenseStatusData.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between text-[12.5px]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${EXPENSE_TINT_DOT[s.label] || 'bg-zinc-400'}`}
                      />
                      <span className="font-medium text-zinc-800">{s.label}</span>
                      <span className="text-[10.5px] tabular-nums text-zinc-400">
                        {s.count}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums text-zinc-900">
                      {fmtMoney(s.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  Total
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-zinc-900">
                  {fmtMoney(expenseTotal)}
                </span>
              </div>
            </div>
          </SurfaceCard>

          {/* Burn by category */}
          <SurfaceCard>
            <SurfaceHeader
              title="Burn this month"
              action={
                <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
                  {now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </span>
              }
            />
            <div className="flex items-center gap-5 px-4 pb-4">
              <BurnDonut total={burnTotal} slices={burnByCategory} />
              <div className="flex-1 space-y-2">
                {burnByCategory.length === 0 ? (
                  <p className="text-[12px] text-zinc-500">
                    No approved expenses this month yet.
                  </p>
                ) : (
                  burnByCategory.map((b, i) => {
                    const amount = Number(b._sum.amount) || 0;
                    const pct = burnTotal > 0 ? Math.round((amount / burnTotal) * 100) : 0;
                    return (
                      <div
                        key={b.categoryId || i}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          />
                          <span className="text-zinc-700">{catName(b.categoryId)}</span>
                        </div>
                        <span className="font-medium tabular-nums text-zinc-900">
                          {pct}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Local helpers (new aesthetic)
// ============================================================================
const EXPENSE_TINT_BAR: Record<string, string> = {
  Approved: 'bg-emerald-500',
  Pending: 'bg-amber-500',
  Rejected: 'bg-rose-500',
  Draft: 'bg-zinc-400',
};
const EXPENSE_TINT_DOT: Record<string, string> = {
  Approved: 'bg-emerald-500',
  Pending: 'bg-amber-500',
  Rejected: 'bg-rose-500',
  Draft: 'bg-zinc-400',
};
const DONUT_COLORS = ['#0B1F3A', '#71717A', '#14B8A6', '#F59E0B', '#A1A1AA'];

function SurfaceCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200/85 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function SurfaceHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
      <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>
      {action}
    </div>
  );
}

function KpiTile({
  href,
  label,
  value,
  delta,
  deltaTone = 'neutral',
}: {
  href: string;
  label: string;
  value: number | string;
  delta?: string;
  deltaTone?: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  const toneClass =
    deltaTone === 'positive'
      ? 'text-emerald-600'
      : deltaTone === 'negative'
        ? 'text-rose-600'
        : deltaTone === 'warning'
          ? 'text-amber-700'
          : 'text-zinc-500';
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-zinc-200/85 bg-white p-4 transition-all duration-200 hover:border-zinc-300 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]"
    >
      <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        {label}
      </p>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-[24px] font-semibold tracking-tight tabular-nums text-zinc-900 leading-none">
          {value}
        </span>
        {delta && (
          <span className={`text-[11px] font-medium ${toneClass}`}>{delta}</span>
        )}
      </div>
    </Link>
  );
}

// ============================================================================
// Helper components
// ============================================================================

function BurnDonut({
  total,
  slices,
}: {
  total: number;
  slices: { categoryId: number | null; _sum: { amount: any } }[];
}) {
  const colors = DONUT_COLORS;
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center">
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#F4F4F5"
          strokeWidth="3"
        />
        {total > 0 &&
          slices.map((s, i) => {
            const amount = Number(s._sum.amount) || 0;
            const pct = (amount / total) * 100;
            const dash = (pct / 100) * circ;
            const gap = circ - dash;
            const circle = (
              <circle
                key={i}
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="3"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return circle;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[12px] font-semibold tabular-nums text-zinc-900">
          {fmtMoney(total)}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-zinc-500">
          Total
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function fmtMoney(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function fmtRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

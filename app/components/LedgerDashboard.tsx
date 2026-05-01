import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  KpiTile,
  Card,
  Avi,
  Glyph,
} from './design';

// ============================================================================
// 99 Hub ERP — Dashboard (Phase 2 design system)
// Calm, spacious, hairline-bordered. 5-up tinted KPI strip + recent
// activity feed + right rail (expenses overview + burn-this-month).
// Data fetching block is unchanged from the previous version — only
// the rendering layer was swapped.
// ============================================================================

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
    selectedCompany !== 'all' && !isNaN(Number(selectedCompany))
      ? Number(selectedCompany)
      : null;
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
    companyRows,
    recentExpenses,
    recentAssetAssignments,
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
    { label: 'Approved', count: expApproved._count, amount: Number(expApproved._sum.amount) || 0, dot: 'bg-core-greenFg' as const },
    { label: 'Pending',  count: expPendingAgg._count, amount: Number(expPendingAgg._sum.amount) || 0, dot: 'bg-core-amberFg' as const },
    { label: 'Rejected', count: expRejected._count, amount: Number(expRejected._sum.amount) || 0, dot: 'bg-core-roseFg' as const },
    { label: 'Draft',    count: expDraft._count, amount: Number(expDraft._sum.amount) || 0, dot: 'bg-core-text3' as const },
  ];
  const expenseTotal = expenseStatusData.reduce((a, e) => a + e.amount, 0);

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
      what: a.asset
        ? `${a.asset.manufacturer || ''} ${a.asset.model || ''}`.trim()
        : 'an asset',
      meta: a.asset ? a.asset.assetTag : '',
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

  // -------- KPI tile hrefs (preserve dashboard filter scope) --------
  const employeeFilter = new URLSearchParams();
  if (selectedCompany !== 'all') employeeFilter.set('company', selectedCompany);
  if (selectedDepartment !== 'all')
    employeeFilter.set('department', selectedDepartment);
  const employeeFilterQs = employeeFilter.toString();
  const employeeHref = (base: string) => {
    if (!employeeFilterQs) return base;
    return base.includes('?') ? `${base}&${employeeFilterQs}` : `${base}?${employeeFilterQs}`;
  };

  const assetFilter = new URLSearchParams();
  if (selectedCompany !== 'all') assetFilter.set('companyId', selectedCompany);
  const assetFilterQs = assetFilter.toString();
  const assetHref = (base: string) => {
    if (!assetFilterQs) return base;
    return base.includes('?') ? `${base}&${assetFilterQs}` : `${base}?${assetFilterQs}`;
  };

  return (
    <div className="font-sans text-core-text antialiased">
      {/* Hero — h1 + date subtitle. The scope dropdowns live above this
          component (see DashboardFilterBar in app/page.tsx); a second scope
          chip here would be visual duplication. */}
      <div className="mb-9">
        <h1
          className="text-[28px] font-semibold text-core-text leading-[1.1]"
          style={{ letterSpacing: '-0.025em' }}
        >
          {greeting}
        </h1>
        <p className="mt-2 text-[14px] text-core-text2">
          {today} · Viewing {scopeLabel.toLowerCase()}
        </p>
      </div>

      {/* KPI strip — 5 tiles, varied tones for visual rhythm */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          tone="green"
          href={employeeHref('/employees')}
          label="Total employees"
          value={totalEmployees}
          meta={`${totalEmployees - exitedEmployees} active`}
        />
        <KpiTile
          tone="rose"
          href={employeeHref('/employees?status=exited')}
          label="Exited"
          value={exitedEmployees}
          meta={`${
            totalEmployees > 0
              ? Math.round((exitedEmployees / totalEmployees) * 100)
              : 0
          }% of total`}
        />
        <KpiTile
          tone="blue"
          href={assetHref('/assets')}
          label="Assets under custody"
          value={assetsCount}
          meta={fmtMoney(assetsValue)}
        />
        <KpiTile
          tone="amber"
          href="/expenses?status=PENDING"
          label="Pending approvals"
          value={pendingApprovalsCount}
          meta={fmtMoney(pendingApprovalsSum)}
        />
        <KpiTile
          tone="violet"
          href={assetHref('/assets?overdue=1')}
          label="Overdue returns"
          value={overdueReturnsCount}
          meta={overdueReturnsCount > 0 ? 'Action needed' : 'All clear'}
        />
      </div>

      {/* Recent activity + right rail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Recent Activity */}
        <div className="lg:col-span-7">
          <Card
            title="Recent activity"
            subtitle="Last 7 days"
            action={
              <Link
                href="/audit"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-core-greenFg transition hover:opacity-80"
              >
                View all
                <Glyph name="arrowRight" size={12} />
              </Link>
            }
            padded={false}
          >
            {activity.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-core-surface2 text-core-text3">
                  <Glyph name="bell" size={14} />
                </div>
                <p className="mt-2 text-[12.5px] text-core-text2">
                  No recent activity yet.
                </p>
              </div>
            ) : (
              <ul>
                {activity.map((item, i) => (
                  <li
                    key={item.key}
                    className={`flex items-start gap-[14px] px-5 py-[14px] ${
                      i > 0 ? 'border-t border-core-border' : ''
                    }`}
                  >
                    <Avi
                      seed={item.who}
                      initials={initialsOf(item.who)}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px]">
                          <span className="font-semibold text-core-text">
                            {item.who}
                          </span>{' '}
                          <span className="text-core-text2">{item.verb}</span>{' '}
                          <span className="font-medium text-core-text">
                            {item.what}
                          </span>
                        </p>
                        <span className="flex-shrink-0 text-[11.5px] tabular-nums text-core-text3">
                          {fmtRelative(item.time)}
                        </span>
                      </div>
                      {item.meta && (
                        <div
                          className="mt-[3px] font-mono text-[11px] text-core-text3"
                          style={{ letterSpacing: '0.02em' }}
                        >
                          {item.meta}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4 lg:col-span-5">
          {/* Expenses overview — rows + total. The design doesn't carry a
              stacked bar at the top; it's just the dot legend + amounts. */}
          <Card title="Expenses overview" padded>
            <div className="space-y-[10px]">
              {expenseStatusData.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between text-[13px]"
                >
                  <div className="flex items-center gap-[10px]">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="font-medium text-core-text">
                      {s.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-core-text3">
                      {s.count}
                    </span>
                  </div>
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-core-text">
                    {fmtMoney(s.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-[14px] flex items-center justify-between border-t border-core-border pt-[14px]">
              <span className="text-[13px] font-semibold text-core-text">
                Total
              </span>
              <span className="font-mono text-[14px] font-bold tabular-nums text-core-text">
                {fmtMoney(expenseTotal)}
              </span>
            </div>
          </Card>

          {/* Burn this month */}
          <Card
            title="Burn this month"
            action={
              <span className="font-mono text-[11px] font-medium uppercase text-core-text3" style={{ letterSpacing: '0.04em' }}>
                {now.toLocaleDateString('en-US', {
                  month: 'short',
                  year: '2-digit',
                })}
              </span>
            }
            padded
          >
            <div className="flex items-center gap-[18px]">
              <BurnDonut total={burnTotal} slices={burnByCategory} />
              <div className="flex-1 space-y-2">
                {burnByCategory.length === 0 ? (
                  <p className="text-[12.5px] text-core-text2">
                    No approved expenses this month yet.
                  </p>
                ) : (
                  burnByCategory.map((b, i) => {
                    const amount = Number(b._sum.amount) || 0;
                    const pct =
                      burnTotal > 0
                        ? Math.round((amount / burnTotal) * 100)
                        : 0;
                    return (
                      <div
                        key={b.categoryId || i}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <div className="flex items-center gap-[10px]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                DONUT_COLORS[i % DONUT_COLORS.length],
                            }}
                          />
                          <span className="text-core-text2">
                            {catName(b.categoryId)}
                          </span>
                        </div>
                        <span className="font-medium tabular-nums text-core-text">
                          {pct}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Local helpers
// ============================================================================

const DONUT_COLORS = ['#8FBF3F', '#2C6FBA', '#A66600', '#6B4CBF', '#B84477'];

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
          stroke="#F0F2EC"
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
        <span className="font-mono text-[12px] font-semibold tabular-nums text-core-text">
          {fmtMoney(total)}
        </span>
        <span
          className="text-[9px] font-semibold uppercase text-core-text3"
          style={{ letterSpacing: '0.06em' }}
        >
          Total
        </span>
      </div>
    </div>
  );
}

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
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

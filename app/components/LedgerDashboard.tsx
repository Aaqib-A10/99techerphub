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

  const assetsValue = assetsValueAgg._sum.purchasePrice || 0;
  const pendingApprovalsSum = pendingApprovalsSumAgg._sum.amount || 0;

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
    { label: 'Approved', count: expApproved._count, amount: expApproved._sum.amount || 0, color: EMERALD },
    { label: 'Pending', count: expPendingAgg._count, amount: expPendingAgg._sum.amount || 0, color: AMBER },
    { label: 'Rejected', count: expRejected._count, amount: expRejected._sum.amount || 0, color: ROSE },
    { label: 'Draft', count: expDraft._count, amount: expDraft._sum.amount || 0, color: OUTLINE },
  ];
  const expenseTotalAmount = expenseStatusData.reduce((a, e) => a + e.amount, 0) || 1;

  // Burn by category totals
  const burnTotal = burnByCategory.reduce((a, b) => a + (b._sum.amount || 0), 0);

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
      meta: `${e.company?.code || '—'} · ${fmtMoney(e.amount)}`,
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

  return (
    <div style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      {/* ============ HERO HEADER ============ */}
      <div
        className="flex flex-col sm:flex-row items-start sm:justify-between gap-4 mb-10 pb-6"
        style={{ borderBottom: '1px solid rgba(196,198,206,0.3)' }}
      >
        <div className="flex items-start gap-4">
          <div style={{ width: 2, height: 40, backgroundColor: TEAL }} />
          <div>
            <h1
              className="text-[22px] sm:text-[28px] font-black tracking-tight leading-none"
              style={{ color: NAVY }}
            >
              {(() => {
                const h = new Date().getHours();
                return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
              })()}
            </h1>
            <p
              className="text-[11px] font-bold uppercase mt-2"
              style={{ color: OUTLINE, fontFamily: MONO, letterSpacing: '0.12em' }}
            >
              {today}
            </p>
          </div>
        </div>
        <div
          className="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"
          style={{ backgroundColor: NAVY, color: '#FFFFFF' }}
        >
          <span>Viewing: {selectedCompany === 'all' ? 'All Companies' : companyRows.find((c) => c.id === companyId)?.name || 'All'}</span>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </div>
      </div>

      {/* ============ KPI STRIP (5-up) ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
        <KpiCard
          href="/employees"
          label="Total Employees"
          value={totalEmployees.toString().padStart(3, '0')}
          chip={<span style={{ color: TEAL }}>{(totalEmployees - exitedEmployees)} active</span>}
          chipBg="rgba(20, 184, 166, 0.1)"
        />
        <KpiCard
          href="/employees?status=exited"
          label="Exited"
          value={exitedEmployees.toString().padStart(3, '0')}
          valueColor={ROSE}
          chip={<span style={{ color: ROSE }}>{totalEmployees > 0 ? Math.round((exitedEmployees / totalEmployees) * 100) : 0}%</span>}
          chipBg="rgba(225, 29, 72, 0.08)"
        />
        <KpiCard
          href="/assets"
          label="Assets Under Custody"
          value={assetsCount.toString().padStart(3, '0')}
          chip={<span style={{ color: OUTLINE, fontFamily: MONO }}>{fmtMoney(assetsValue)}</span>}
          chipBg="transparent"
          noBg
        />
        <KpiCard
          href="/expenses?status=PENDING"
          label="Pending Approvals"
          value={pendingApprovalsCount.toString().padStart(2, '0')}
          chip={<span style={{ color: ROSE, fontFamily: MONO }}>{fmtMoney(pendingApprovalsSum)}</span>}
          chipBg="rgba(225, 29, 72, 0.08)"
        />
        <KpiCard
          href="/assets"
          label="Overdue Returns"
          value={overdueReturnsCount.toString().padStart(2, '0')}
          valueColor={overdueReturnsCount > 0 ? ROSE : NAVY}
          chip={
            <div
              className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{
                backgroundColor: overdueReturnsCount > 0 ? 'rgba(225,29,72,0.1)' : SURFACE_LOW,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={overdueReturnsCount > 0 ? ROSE : OUTLINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          }
          chipBg="transparent"
          noBg
        />
      </div>

      {/* ============ RECENT ACTIVITY + RIGHT RAIL ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Recent Activity */}
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black flex items-center gap-2" style={{ color: NAVY }}>
              Recent activity
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: TEAL }}
              />
            </h2>
            <Link
              href="/audit"
              className="text-xs font-bold hover:underline"
              style={{ color: TEAL }}
            >
              View All
            </Link>
          </div>
          <div className="space-y-2">
            {activity.length === 0 && (
              <p className="text-sm" style={{ color: OUTLINE }}>
                No recent activity yet.
              </p>
            )}
            {activity.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-4 p-4 rounded-xl transition-all group"
                style={{
                  ...(item.kind === 'ASSIGNMENT' && item.verb === 'returned'
                    ? { borderLeft: `3px solid ${TEAL}` }
                    : {}),
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                  style={{
                    backgroundColor:
                      item.kind === 'EXPENSE'
                        ? 'rgba(20, 184, 166, 0.12)'
                        : 'rgba(11, 31, 58, 0.08)',
                    color: item.kind === 'EXPENSE' ? TEAL : NAVY,
                    fontFamily: MONO,
                    fontSize: 12,
                  }}
                >
                  {initialsOf(item.who)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm font-bold truncate" style={{ color: INK }}>
                      {item.who}{' '}
                      <span className="font-normal" style={{ color: INK_MUTED }}>
                        {item.verb}
                      </span>{' '}
                      {item.what}
                    </p>
                    <span
                      className="text-[10px] uppercase whitespace-nowrap"
                      style={{
                        color: OUTLINE,
                        fontFamily: MONO,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {fmtRelative(item.time)}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: INK_MUTED, fontFamily: MONO }}>
                    {item.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* RIGHT RAIL */}
        <div className="lg:col-span-5 space-y-8">
          {/* Expenses Overview */}
          <Card>
            <h3
              className="text-sm font-black uppercase mb-6"
              style={{ color: NAVY, letterSpacing: '0.08em' }}
            >
              Expenses Overview
            </h3>

            {/* Stacked bar */}
            <div className="h-6 w-full flex rounded-full overflow-hidden mb-6">
              {expenseStatusData.map((s) => {
                const pct = (s.amount / expenseTotalAmount) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={s.label}
                    style={{
                      backgroundColor: s.color,
                      width: `${pct}%`,
                    }}
                    title={`${s.label}: ${fmtMoney(s.amount)}`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {expenseStatusData.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-[11px] font-bold" style={{ color: INK }}>
                      {s.label}
                    </span>
                    <span className="text-[10px]" style={{ color: OUTLINE, fontFamily: MONO }}>
                      ({s.count})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold" style={{ fontFamily: MONO, color: INK }}>
                    {fmtMoney(s.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div
              className="mt-4 pt-4 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(196,198,206,0.3)' }}
            >
              <span className="text-xs font-bold uppercase" style={{ color: OUTLINE, letterSpacing: '0.08em' }}>
                Total
              </span>
              <span className="text-sm font-black" style={{ fontFamily: MONO, color: NAVY }}>
                {fmtMoney(expenseStatusData.reduce((a, e) => a + e.amount, 0))}
              </span>
            </div>
          </Card>

          {/* Burn by category */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3
                className="text-sm font-black uppercase"
                style={{ color: NAVY, letterSpacing: '0.08em' }}
              >
                This month&apos;s burn by category
              </h3>
              <span
                className="text-[10px] px-2 py-1 rounded-full font-bold"
                style={{
                  backgroundColor: SURFACE_LOW,
                  color: OUTLINE,
                  fontFamily: MONO,
                }}
              >
                {now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-8">
              {/* Donut */}
              <BurnDonut total={burnTotal} slices={burnByCategory} />

              {/* Legend */}
              <div className="flex-1 space-y-3">
                {burnByCategory.length === 0 && (
                  <p className="text-xs" style={{ color: OUTLINE }}>
                    No approved expenses this month yet.
                  </p>
                )}
                {burnByCategory.map((b, i) => {
                  const amount = b._sum.amount || 0;
                  const pct = burnTotal > 0 ? Math.round((amount / burnTotal) * 100) : 0;
                  return (
                    <div key={b.categoryId || i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: [NAVY, TEAL, AMBER, '#364764', OUTLINE][i % 5],
                          }}
                        />
                        <span className="text-[11px]" style={{ color: INK_MUTED }}>
                          {catName(b.categoryId)}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ fontFamily: MONO, color: INK }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper components
// ============================================================================

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-8 ${className}`}
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 8px 16px -6px rgba(11, 31, 58, 0.06)',
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  href,
  label,
  value,
  chip,
  chipBg,
  valueColor,
  noBg,
}: {
  href: string;
  label: string;
  value: string;
  chip: React.ReactNode;
  chipBg: string;
  valueColor?: string;
  noBg?: boolean;
}) {
  const inner = (
    <div
      className="p-6 rounded-xl transition-all hover:scale-[1.01] h-full"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 4px 10px -4px rgba(11, 31, 58, 0.06)',
      }}
    >
      <p
        className="text-[10px] uppercase font-bold mb-3"
        style={{ color: '#75777E', letterSpacing: '0.14em' }}
      >
        {label}
      </p>
      <div className="flex items-end justify-between">
        <span
          className="text-4xl font-black"
          style={{
            color: valueColor || '#0B1F3A',
            fontFamily: MONO,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full mb-1 flex items-center ${noBg ? '' : ''}`}
          style={{ backgroundColor: noBg ? 'transparent' : chipBg }}
        >
          {chip}
        </span>
      </div>
    </div>
  );
  return <Link href={href} className="block h-full">{inner}</Link>;
}

function BurnDonut({
  total,
  slices,
}: {
  total: number;
  slices: { categoryId: number | null; _sum: { amount: number | null } }[];
}) {
  const colors = [NAVY, TEAL, AMBER, '#364764', OUTLINE];
  const radius = 16;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={SURFACE_LOW}
          strokeWidth="4"
        />
        {total > 0 &&
          slices.map((s, i) => {
            const amount = s._sum.amount || 0;
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
                strokeWidth="4"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xs font-black"
          style={{ color: NAVY, fontFamily: MONO }}
        >
          {fmtMoney(total)}
        </span>
        <span
          className="text-[8px] font-bold uppercase"
          style={{ color: OUTLINE, letterSpacing: '0.1em' }}
        >
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
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M AGO`;
  if (hrs < 24) return `${hrs}H AGO`;
  if (days === 1) return 'YESTERDAY';
  if (days < 7) return `${days}D AGO`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// ---- KPI tile ----
type KpiColor = 'emerald' | 'blue' | 'amber' | 'rose' | 'yellow' | 'indigo' | 'violet' | 'slate';

const KPI_STYLES: Record<KpiColor, { border: string; value: string; chip: string }> = {
  emerald: { border: 'border-emerald-200', value: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700' },
  blue:    { border: 'border-blue-200',    value: 'text-blue-700',    chip: 'bg-blue-50 text-blue-700' },
  amber:   { border: 'border-amber-200',   value: 'text-amber-700',   chip: 'bg-amber-50 text-amber-700' },
  rose:    { border: 'border-rose-200',    value: 'text-rose-700',    chip: 'bg-rose-50 text-rose-700' },
  yellow:  { border: 'border-yellow-200',  value: 'text-yellow-700',  chip: 'bg-yellow-50 text-yellow-700' },
  indigo:  { border: 'border-indigo-200',  value: 'text-indigo-700',  chip: 'bg-indigo-50 text-indigo-700' },
  violet:  { border: 'border-violet-200',  value: 'text-violet-700',  chip: 'bg-violet-50 text-violet-700' },
  slate:   { border: 'border-slate-200',   value: 'text-slate-700',   chip: 'bg-slate-100 text-slate-700' },
};

function KpiTile({
  label,
  value,
  sub,
  color,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: KpiColor;
  href?: string;
}) {
  const s = KPI_STYLES[color];
  const inner = (
    <div className={`rounded-xl border ${s.border} bg-white p-5 shadow-sm transition-all hover:shadow-md h-full`}>
      <div className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.chip}`}>
        {label}
      </div>
      <div className={`mt-3 text-3xl font-bold tabular-nums ${s.value}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

function SectionHeader({
  title,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <div>
        <h2 className="section-heading">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---- Date range helpers ----
function resolveDateRange(dateRange: string): { gte?: Date; lte?: Date } {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  switch (dateRange) {
    case 'today':
      return { gte: startOfToday, lte: endOfToday };
    case 'last7': {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - 7);
      return { gte: d, lte: endOfToday };
    }
    case 'last30': {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - 30);
      return { gte: d, lte: endOfToday };
    }
    case 'thisMonth': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { gte: d, lte: endOfToday };
    }
    case 'last90': {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - 90);
      return { gte: d, lte: endOfToday };
    }
    case 'thisYear': {
      const d = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { gte: d, lte: endOfToday };
    }
    default:
      return {};
  }
}

function monthStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

interface DashboardContentProps {
  selectedCompany: string;
  selectedDepartment: string;
  selectedDateRange: string;
}

export default async function DashboardContent({
  selectedCompany,
  selectedDepartment,
  selectedDateRange,
}: DashboardContentProps) {
  const companyId =
    selectedCompany !== 'all' && !isNaN(Number(selectedCompany)) ? Number(selectedCompany) : null;
  const departmentId =
    selectedDepartment !== 'all' && !isNaN(Number(selectedDepartment))
      ? Number(selectedDepartment)
      : null;

  const dateFilter = resolveDateRange(selectedDateRange);
  const hasDateFilter = !!(dateFilter.gte || dateFilter.lte);

  // ---- Reusable where clauses ----
  const employeeBase: any = {};
  if (companyId != null) employeeBase.companyId = companyId;
  if (departmentId != null) employeeBase.departmentId = departmentId;

  const assetBase: any = { isRetired: false };
  if (companyId != null) assetBase.companyId = companyId;

  const expenseBase: any = {};
  if (companyId != null) expenseBase.companyId = companyId;
  if (departmentId != null) expenseBase.departmentId = departmentId;

  // Expense date filter (defaults to this month for "month to date" tiles)
  const mStart = monthStart();
  const expenseDateThisMonth: any = { gte: mStart };
  // When a date range is selected, use it instead for MTD-style tiles
  const expenseDateSelected = hasDateFilter ? dateFilter : expenseDateThisMonth;

  // ---- MAIN SECTION ----
  const [
    mainTotalEmployees,
    mainTotalAssets,
    mainPendingApprovals,
    mainExpensesThisPeriodAgg,
  ] = await Promise.all([
    prisma.employee.count({ where: { ...employeeBase, isActive: true } }),
    prisma.asset.count({ where: assetBase }),
    prisma.expense.count({ where: { ...expenseBase, status: 'PENDING' } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        ...expenseBase,
        status: 'APPROVED',
        expenseDate: expenseDateSelected,
      },
    }),
  ]);
  const mainExpensesThisPeriod = Number(mainExpensesThisPeriodAgg._sum.amount) || 0;

  // ---- EMPLOYEES SECTION ----
  const last30d = {
    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    lte: new Date(),
  };
  const joinDateFilter = hasDateFilter ? dateFilter : last30d;

  const [empActive, empNewHires, empOnboarding, empExits] = await Promise.all([
    prisma.employee.count({ where: { ...employeeBase, isActive: true } }),
    prisma.employee.count({
      where: { ...employeeBase, dateOfJoining: joinDateFilter },
    }),
    prisma.employee.count({
      where: { ...employeeBase, lifecycleStage: { in: ['OFFER_SENT', 'ONBOARDING', 'PROVISIONING'] } },
    }),
    prisma.employee.count({
      where: {
        ...employeeBase,
        lifecycleStage: { in: ['EXIT_INITIATED', 'EXITED'] },
        ...(hasDateFilter ? { dateOfLeaving: dateFilter } : {}),
      },
    }),
  ]);

  // ---- ASSETS SECTION ----
  const [assetTotal, assetAssigned, assetUnassigned, assetDamagedLost] = await Promise.all([
    prisma.asset.count({ where: assetBase }),
    prisma.asset.count({ where: { ...assetBase, isAssigned: true } }),
    prisma.asset.count({ where: { ...assetBase, isAssigned: false } }),
    prisma.asset.count({
      where: { ...assetBase, condition: { in: ['DAMAGED', 'LOST'] } },
    }),
  ]);
  const assignedPct = assetTotal > 0 ? Math.round((assetAssigned / assetTotal) * 100) : 0;

  // ---- FINANCE SECTION ----
  // Monthly payroll is approximated from current employees × avg latest base salary.
  const activeEmployeesWithSalary = await prisma.employee.findMany({
    where: { ...employeeBase, isActive: true },
    select: { id: true },
  });
  const activeIds = activeEmployeesWithSalary.map((e) => e.id);

  let payrollEstimate = 0;
  if (activeIds.length > 0) {
    // Get the most recent active salary per employee (effectiveTo null means current)
    const salaries = await prisma.salaryHistory.findMany({
      where: {
        employeeId: { in: activeIds },
        effectiveTo: null,
      },
      select: { baseSalary: true },
    });
    payrollEstimate = salaries.reduce((acc, s) => acc + (Number(s.baseSalary) || 0), 0);
  }

  const [financeMtdSpendAgg, financePendingReimAgg, financeApprovedMtdAgg] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        ...expenseBase,
        status: { in: ['APPROVED', 'PENDING'] },
        expenseDate: expenseDateSelected,
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { ...expenseBase, status: 'PENDING' },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        ...expenseBase,
        status: 'APPROVED',
        expenseDate: expenseDateSelected,
      },
    }),
  ]);

  // ---- EXPENSES SECTION ----
  const [expPending, expApprovedMtd, expRejected, expTopCategory] = await Promise.all([
    prisma.expense.count({ where: { ...expenseBase, status: 'PENDING' } }),
    prisma.expense.count({
      where: { ...expenseBase, status: 'APPROVED', expenseDate: expenseDateSelected },
    }),
    prisma.expense.count({
      where: {
        ...expenseBase,
        status: 'REJECTED',
        ...(hasDateFilter ? { expenseDate: dateFilter } : {}),
      },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: { ...expenseBase, expenseDate: expenseDateSelected },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    }),
  ]);

  let topCategoryName = 'None';
  if (expTopCategory.length > 0) {
    const cat = await prisma.expenseCategory.findUnique({
      where: { id: expTopCategory[0].categoryId },
      select: { name: true },
    });
    if (cat) topCategoryName = cat.name;
  }

  // ---- Formatting helpers ----
  const fmtMoney = (n: number) => {
    if (n >= 1_000_000) return `PKR ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `PKR ${(n / 1_000).toFixed(0)}K`;
    return `PKR ${n.toLocaleString()}`;
  };

  const dateRangeLabel =
    selectedDateRange === 'all' ? 'this month' : 'selected period';

  return (
    <div className="space-y-8">
      {/* ============ MAIN ============ */}
      <section>
        <SectionHeader
          title="Main"
          subtitle="Top-level summary across the organization"
          icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          accent="bg-slate-100 text-slate-700"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Active Employees" value={mainTotalEmployees} sub="Currently employed" color="emerald" href="/employees" />
          <KpiTile label="Total Assets" value={mainTotalAssets} sub="Active (not retired)" color="blue" href="/assets" />
          <KpiTile label="Pending Approvals" value={mainPendingApprovals} sub="Expenses awaiting review" color="amber" href="/expenses?status=PENDING" />
          <KpiTile label={`Expenses (${dateRangeLabel})`} value={fmtMoney(mainExpensesThisPeriod)} sub="Approved spend" color="violet" href="/expenses" />
        </div>
      </section>

      {/* ============ EMPLOYEES ============ */}
      <section>
        <SectionHeader
          title="Employees"
          subtitle="Headcount, hiring, and lifecycle"
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          accent="bg-emerald-100 text-emerald-700"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Active" value={empActive} sub="Currently employed" color="emerald" href="/employees" />
          <KpiTile
            label="New Hires"
            value={empNewHires}
            sub={hasDateFilter ? 'Joined in period' : 'Last 30 days'}
            color="indigo"
            href="/employees"
          />
          <KpiTile label="Onboarding" value={empOnboarding} sub="In pre-active stages" color="blue" href="/employees?stage=ONBOARDING" />
          <KpiTile label="Exits" value={empExits} sub="Initiated or completed" color="rose" href="/employees?stage=EXITED" />
        </div>
      </section>

      {/* ============ ASSETS ============ */}
      <section>
        <SectionHeader
          title="Assets"
          subtitle="Hardware inventory and assignment"
          icon="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          accent="bg-blue-100 text-blue-700"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Total Hardware" value={assetTotal} sub="Active inventory" color="blue" href="/assets" />
          <KpiTile label="Assigned" value={assetAssigned} sub={`${assignedPct}% of total`} color="emerald" href="/assets?isAssigned=true" />
          <KpiTile label="Unassigned" value={assetUnassigned} sub="Ready to deploy" color="amber" href="/assets?isAssigned=false" />
          <KpiTile label="Damaged / Lost" value={assetDamagedLost} sub="Needs attention" color="rose" href="/assets?condition=DAMAGED" />
        </div>
      </section>

      {/* ============ FINANCE ============ */}
      <section>
        <SectionHeader
          title="Finance"
          subtitle="Payroll obligations and spend"
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          accent="bg-violet-100 text-violet-700"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Monthly Payroll" value={fmtMoney(payrollEstimate)} sub={`${activeIds.length} active employees`} color="violet" href="/finance/payroll" />
          <KpiTile label={`MTD Spend`} value={fmtMoney(Number(financeMtdSpendAgg._sum.amount) || 0)} sub="Approved + pending" color="blue" href="/expenses" />
          <KpiTile label="Pending Reimbursements" value={fmtMoney(Number(financePendingReimAgg._sum.amount) || 0)} sub="Awaiting approval" color="amber" href="/expenses?status=PENDING" />
          <KpiTile label="Approved (period)" value={fmtMoney(Number(financeApprovedMtdAgg._sum.amount) || 0)} sub="Cleared spend" color="emerald" href="/expenses?status=APPROVED" />
        </div>
      </section>

      {/* ============ EXPENSES ============ */}
      <section>
        <SectionHeader
          title="Expenses"
          subtitle="Submissions and approvals"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          accent="bg-amber-100 text-amber-700"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile label="Pending" value={expPending} sub="Awaiting approval" color="yellow" href="/expenses?status=PENDING" />
          <KpiTile label="Approved (period)" value={expApprovedMtd} sub="Count in period" color="emerald" href="/expenses?status=APPROVED" />
          <KpiTile label="Rejected" value={expRejected} sub={hasDateFilter ? 'In period' : 'All time'} color="rose" href="/expenses?status=REJECTED" />
          <KpiTile label="Top Category" value={topCategoryName} sub="Most submissions" color="indigo" href="/expenses" />
        </div>
      </section>
    </div>
  );
}

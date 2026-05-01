import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelativeTime from './RelativeTime';
import { formatTenureMonthsFirst } from '@/lib/tenure';
import { Avi, Badge } from './design';

const REQUIRED_DOC_TYPES = ['CNIC_FRONT', 'CNIC_BACK', 'PHOTO', 'RESUME'];

/**
 * Personal dashboard shown to non-admin users.
 * Shows the signed-in user's own data: profile snapshot, assigned
 * assets, document completeness, recent activity affecting them.
 */
export default async function EmployeeDashboard({
  employeeId,
  userId,
}: {
  employeeId: number;
  userId: number;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      company: true,
      location: true,
      reportingManager: {
        select: { id: true, firstName: true, lastName: true, empCode: true, designation: true },
      },
      documents: { select: { id: true, documentType: true, fileName: true, uploadedAt: true } },
      assetAssignments: {
        where: { returnedDate: null },
        include: { asset: { include: { category: true } } },
        orderBy: { assignedDate: 'desc' },
      },
      digitalAccess: {
        where: { isActive: true },
        select: { id: true, serviceName: true, accountId: true, grantedDate: true },
        orderBy: { serviceName: 'asc' },
      },
      directReports: {
        where: { isActive: true },
        select: {
          id: true,
          empCode: true,
          firstName: true,
          lastName: true,
          designation: true,
        },
        orderBy: { firstName: 'asc' },
      },
    },
  });

  if (!employee) {
    return (
      <div className="text-center py-16 text-core-text2">
        We can't find your employee record. Contact an administrator.
      </div>
    );
  }

  // Department colleagues (excluding self), capped to 6 for the snapshot card
  const teamColleagues = await prisma.employee.findMany({
    where: {
      departmentId: employee.departmentId,
      isActive: true,
      id: { not: employee.id },
    },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
    },
    orderBy: { firstName: 'asc' },
    take: 6,
  });

  const teamSize = await prisma.employee.count({
    where: {
      departmentId: employee.departmentId,
      isActive: true,
      id: { not: employee.id },
    },
  });

  // Birthdays + work anniversaries in the next 7 days, scoped to the same department
  const todayMd = monthDayKey(new Date());
  const window: string[] = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d);
    window.push(monthDayKey(day));
  }
  const deptPeople = await prisma.employee.findMany({
    where: {
      departmentId: employee.departmentId,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      empCode: true,
      designation: true,
      dateOfBirth: true,
      dateOfJoining: true,
    },
  });
  const upcomingEvents: Array<{
    type: 'BIRTHDAY' | 'ANNIVERSARY';
    employeeId: number;
    name: string;
    empCode: string;
    when: Date;
    yearsLabel?: string;
  }> = [];
  for (const p of deptPeople) {
    if (p.dateOfBirth) {
      const md = monthDayKey(p.dateOfBirth);
      if (window.includes(md)) {
        upcomingEvents.push({
          type: 'BIRTHDAY',
          employeeId: p.id,
          name: `${p.firstName} ${p.lastName}`,
          empCode: p.empCode,
          when: nextOccurrence(p.dateOfBirth),
        });
      }
    }
    if (p.dateOfJoining) {
      const md = monthDayKey(p.dateOfJoining);
      if (window.includes(md)) {
        const years = new Date().getFullYear() - new Date(p.dateOfJoining).getFullYear();
        if (years >= 1) {
          upcomingEvents.push({
            type: 'ANNIVERSARY',
            employeeId: p.id,
            name: `${p.firstName} ${p.lastName}`,
            empCode: p.empCode,
            when: nextOccurrence(p.dateOfJoining),
            yearsLabel: `${years}y`,
          });
        }
      }
    }
  }
  upcomingEvents.sort((a, b) => a.when.getTime() - b.when.getTime());

  const requiredUploaded = REQUIRED_DOC_TYPES.filter((t) =>
    employee.documents.some((d) => d.documentType === t)
  ).length;
  const missingDocs = REQUIRED_DOC_TYPES.filter(
    (t) => !employee.documents.some((d) => d.documentType === t)
  );

  // Recent activity: audit logs that affected the user OR that the user performed
  const recentActivity = await prisma.auditLog.findMany({
    where: {
      OR: [
        { changedById: userId },
        { tableName: 'employees', recordId: employeeId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      tableName: true,
      action: true,
      module: true,
      createdAt: true,
    },
  });

  const joinDate = employee.dateOfJoining ? new Date(employee.dateOfJoining) : null;
  const tenureDays = joinDate
    ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const tenureLabel = formatTenureMonthsFirst(tenureDays);

  return (
    <div className="space-y-6">
      {/* Hero — personalized, design system aesthetic */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            Welcome back
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            <span className="font-mono font-semibold text-core-text">{employee.empCode}</span>
            {employee.designation ? ` · ${employee.designation}` : ''}
            {employee.department?.name ? ` · ${employee.department.name}` : ''}
          </p>
        </div>
        <Link
          href={`/employees/${employee.id}`}
          className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90"
        >
          View My Profile
        </Link>
      </div>

      {/* KPI strip — Apple Wallet tinted tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-core-greenSoft px-[18px] pt-4 pb-[14px]">
          <div className="mb-[10px] text-[10px] font-semibold uppercase text-core-greenFg" style={{ letterSpacing: '0.1em' }}>
            Tenure
          </div>
          <div className="text-[26px] font-semibold leading-none text-core-greenFg tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {tenureLabel}
          </div>
          <div className="mt-[6px] text-[11.5px] text-core-greenFg/70">
            {joinDate ? `Joined ${joinDate.toLocaleDateString()}` : 'No join date'}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-core-blueSoft px-[18px] pt-4 pb-[14px]">
          <div className="mb-[10px] text-[10px] font-semibold uppercase text-core-blueFg" style={{ letterSpacing: '0.1em' }}>
            Active Assets
          </div>
          <div className="text-[26px] font-semibold leading-none text-core-blueFg tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {employee.assetAssignments.length}
          </div>
          <div className="mt-[6px] text-[11.5px] text-core-blueFg/70">In your custody</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-core-amberSoft px-[18px] pt-4 pb-[14px]">
          <div className="mb-[10px] text-[10px] font-semibold uppercase text-core-amberFg" style={{ letterSpacing: '0.1em' }}>
            Required Docs
          </div>
          <div className="text-[26px] font-semibold leading-none text-core-amberFg tabular-nums" style={{ letterSpacing: '-0.02em' }}>
            {requiredUploaded}/{REQUIRED_DOC_TYPES.length}
          </div>
          <div className="mt-[6px] text-[11.5px] text-core-amberFg/70">
            {missingDocs.length === 0 ? 'Complete' : `${missingDocs.length} missing`}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-core-violetSoft px-[18px] pt-4 pb-[14px]">
          <div className="mb-[10px] text-[10px] font-semibold uppercase text-core-violetFg" style={{ letterSpacing: '0.1em' }}>
            Manager
          </div>
          <div className="truncate text-[16px] font-semibold leading-tight text-core-violetFg" style={{ letterSpacing: '-0.01em' }}>
            {employee.reportingManager
              ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
              : '—'}
          </div>
          <div className="mt-[6px] text-[11.5px] text-core-violetFg/70">
            {employee.reportingManager?.empCode || 'No manager set'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* My Assets */}
        <div className="rounded-2xl border border-core-border bg-core-surface lg:col-span-2">
          <div className="flex items-center justify-between border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              My Assets
            </h2>
            <span className="text-[11.5px] text-core-text3">
              {employee.assetAssignments.length} active
            </span>
          </div>
          <div className="px-5 py-3">
            {employee.assetAssignments.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-core-text3">
                No assets are currently assigned to you.
              </p>
            ) : (
              <ul className="divide-y divide-core-border">
                {employee.assetAssignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-4 py-[10px]">
                    <div className="min-w-0">
                      <Link
                        href={`/assets/${a.asset.id}`}
                        className="block truncate font-mono text-[12px] font-semibold text-core-text hover:underline"
                      >
                        {a.asset.assetTag}
                      </Link>
                      <p className="mt-[2px] truncate text-[11.5px] text-core-text3">
                        {a.asset.category.name}
                        {a.asset.manufacturer && a.asset.model && a.asset.manufacturer !== 'Unknown'
                          ? ` · ${a.asset.manufacturer} ${a.asset.model}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[11.5px] tabular-nums text-core-text2">
                        Since{' '}
                        {a.assignedDate
                          ? new Date(a.assignedDate).toLocaleDateString()
                          : '—'}
                      </p>
                      <p
                        className="mt-[2px] text-[10px] font-semibold uppercase text-core-text3"
                        style={{ letterSpacing: '0.08em' }}
                      >
                        {a.conditionAtAssignment}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Document checklist */}
        <div className="rounded-2xl border border-core-border bg-core-surface">
          <div className="border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              My Documents
            </h2>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-[10px]">
              {REQUIRED_DOC_TYPES.map((t) => {
                const has = employee.documents.some((d) => d.documentType === t);
                const label = t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={t} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-core-text2">{label}</span>
                    {has ? <Badge tone="green">Uploaded</Badge> : <Badge tone="amber">Missing</Badge>}
                  </div>
                );
              })}
            </div>
            {missingDocs.length > 0 && (
              <Link
                href={`/employees/${employee.id}#documents`}
                className="mt-4 block text-center text-[12px] font-semibold text-core-text2 hover:text-core-text"
              >
                Upload missing documents →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Direct reports — only shown when there are any */}
      {employee.directReports.length > 0 && (
        <div className="rounded-2xl border border-core-border bg-core-surface">
          <div className="flex items-center justify-between border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              Your Direct Reports
            </h2>
            <span className="text-[11.5px] text-core-text3">{employee.directReports.length} people</span>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {employee.directReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/employees/${r.id}`}
                  className="flex items-center gap-3 rounded-xl border border-core-border p-3 transition hover:bg-core-surface2"
                >
                  <Avi
                    seed={r.empCode}
                    initials={`${r.firstName[0]}${r.lastName[0]}`}
                    size={32}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-core-text">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="mt-[1px] truncate text-[11px] text-core-text3">
                      <span className="font-mono">{r.empCode}</span>
                      {r.designation ? ` · ${r.designation}` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Three-up: Digital Access | My Team | Birthdays + Anniversaries */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Digital Access */}
        <div className="rounded-2xl border border-core-border bg-core-surface">
          <div className="flex items-center justify-between border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              My Digital Access
            </h2>
            <span className="text-[11.5px] text-core-text3">{employee.digitalAccess.length}</span>
          </div>
          <div className="px-5 py-4">
            {employee.digitalAccess.length === 0 ? (
              <p className="py-2 text-[13px] text-core-text3">
                No services granted yet. Ask IT if something is missing.
              </p>
            ) : (
              <ul className="space-y-[10px]">
                {employee.digitalAccess.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-[12.5px]">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-core-text">{d.serviceName}</p>
                      {d.accountId && (
                        <p className="mt-[1px] truncate text-[11px] text-core-text3">{d.accountId}</p>
                      )}
                    </div>
                    <Badge tone="green">Active</Badge>
                  </li>
                ))}
                {employee.digitalAccess.length > 8 && (
                  <li className="pt-1 text-[11.5px] text-core-text3">
                    + {employee.digitalAccess.length - 8} more
                  </li>
                )}
                <li>
                  <Link
                    href={`/employees/${employee.id}#digital`}
                    className="mt-2 block text-[12px] font-semibold text-core-text2 hover:text-core-text"
                  >
                    Manage access →
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* My Team */}
        <div className="rounded-2xl border border-core-border bg-core-surface">
          <div className="flex items-center justify-between border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              My Team
            </h2>
            <span className="text-[11.5px] text-core-text3">
              {teamSize} {employee.department?.name ? `in ${employee.department.name}` : ''}
            </span>
          </div>
          <div className="px-5 py-4">
            {teamColleagues.length === 0 ? (
              <p className="py-2 text-[13px] text-core-text3">
                No other active members in your department yet.
              </p>
            ) : (
              <ul className="space-y-[10px]">
                {teamColleagues.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/employees/${c.id}`}
                      className="flex items-center gap-[10px] text-[12.5px] hover:opacity-90"
                    >
                      <Avi
                        seed={c.empCode}
                        initials={`${c.firstName[0]}${c.lastName[0]}`}
                        size={28}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-core-text">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="mt-[1px] truncate text-[11px] text-core-text3">
                          {c.designation || '—'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
                {teamSize > teamColleagues.length && (
                  <li>
                    <Link
                      href={`/employees?departmentId=${employee.departmentId}`}
                      className="mt-2 block text-[12px] font-semibold text-core-text2 hover:text-core-text"
                    >
                      View all {teamSize} →
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Birthdays + Anniversaries */}
        <div className="rounded-2xl border border-core-border bg-core-surface">
          <div className="border-b border-core-border px-5 py-4">
            <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
              This Week
            </h2>
          </div>
          <div className="px-5 py-4">
            {upcomingEvents.length === 0 ? (
              <p className="py-2 text-[13px] text-core-text3">
                No birthdays or anniversaries in the next 7 days.
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingEvents.slice(0, 6).map((e, idx) => (
                  <li key={`${e.employeeId}-${e.type}-${idx}`} className="flex items-center gap-3">
                    <span className="flex-shrink-0 text-lg">
                      {e.type === 'BIRTHDAY' ? '🎂' : '🎉'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/employees/${e.employeeId}`}
                        className="block truncate text-[12.5px] font-medium text-core-text hover:underline"
                      >
                        {e.name}
                      </Link>
                      <p className="mt-[1px] text-[11px] text-core-text3">
                        {e.type === 'BIRTHDAY'
                          ? 'Birthday'
                          : `${e.yearsLabel} work anniversary`}{' '}
                        · {formatEventDate(e.when)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-core-border bg-core-surface">
        <div className="border-b border-core-border px-5 py-4">
          <h2 className="text-[14.5px] font-semibold text-core-text" style={{ letterSpacing: '-0.01em' }}>
            Recent Activity
          </h2>
        </div>
        <div className="px-5 py-4">
          {recentActivity.length === 0 ? (
            <p className="py-2 text-[13px] text-core-text3">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-core-border">
              {recentActivity.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between py-[10px] text-[12.5px]"
                >
                  <div>
                    <span className="font-medium text-core-text">{log.module || log.tableName}</span>{' '}
                    <span className="text-[11.5px] text-core-text3">{log.action.toLowerCase()}</span>
                  </div>
                  <span className="text-[11px] text-core-text3">
                    <RelativeTime iso={log.createdAt.toISOString()} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function monthDayKey(d: Date | string): string {
  const date = new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Next occurrence (today or future) of a recurring date like a birthday. */
function nextOccurrence(d: Date | string): Date {
  const src = new Date(d);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), src.getMonth(), src.getDate());
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

function formatEventDate(d: Date): string {
  const today = new Date();
  const todayKey = monthDayKey(today);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (monthDayKey(d) === todayKey) return 'Today';
  if (monthDayKey(d) === monthDayKey(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}


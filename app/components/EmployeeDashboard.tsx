import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelativeTime from './RelativeTime';
import { formatTenureMonthsFirst } from '@/lib/tenure';

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
      <div className="text-center py-16 text-gray-600">
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
      {/* Hero — personalized, light theme matching the rest of the ERP */}
      <div className="page-hero">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <span className="eyebrow">Welcome back</span>
            <h1>
              {employee.firstName} {employee.lastName}
            </h1>
            <p>
              <span className="mono text-emerald-600">{employee.empCode}</span>
              {employee.designation ? ` · ${employee.designation}` : ''}
              {employee.department?.name ? ` · ${employee.department.name}` : ''}
            </p>
          </div>
          <Link
            href={`/employees/${employee.id}`}
            className="btn btn-primary"
            style={{ backgroundColor: '#0B1F3A' }}
          >
            View My Profile
          </Link>
        </div>
      </div>

      {/* KPI strip — same stat-card pattern as /expenses, /employees, employee detail */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-label">Tenure</div>
          <div className="stat-value">{tenureLabel}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {joinDate ? `Joined ${joinDate.toLocaleDateString()}` : 'No join date'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Assets</div>
          <div className="stat-value">{employee.assetAssignments.length}</div>
          <div className="text-[11px] text-zinc-500 mt-1">In your custody</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Required Docs</div>
          <div className="stat-value">
            {requiredUploaded}/{REQUIRED_DOC_TYPES.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {missingDocs.length === 0 ? 'Complete' : `${missingDocs.length} missing`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Manager</div>
          <div className="stat-value text-[1.05rem] truncate">
            {employee.reportingManager
              ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
              : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {employee.reportingManager?.empCode || 'No manager set'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Assets */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-bold">My Assets</h2>
            <span className="text-xs text-gray-500">{employee.assetAssignments.length} active</span>
          </div>
          <div className="card-body">
            {employee.assetAssignments.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No assets are currently assigned to you.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {employee.assetAssignments.map((a) => (
                  <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/assets/${a.asset.id}`}
                        className="font-medium text-gray-900 hover:text-brand-primary truncate block"
                      >
                        {a.asset.assetTag}
                      </Link>
                      <p className="text-xs text-gray-500 truncate">
                        {a.asset.category.name}
                        {a.asset.manufacturer && a.asset.model && a.asset.manufacturer !== 'Unknown'
                          ? ` · ${a.asset.manufacturer} ${a.asset.model}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-500">
                        Since{' '}
                        {a.assignedDate
                          ? new Date(a.assignedDate).toLocaleDateString()
                          : '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide">
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
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-bold">My Documents</h2>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {REQUIRED_DOC_TYPES.map((t) => {
                const has = employee.documents.some((d) => d.documentType === t);
                const label = t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={t} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{label}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        has ? 'text-green-600' : 'text-amber-600'
                      }`}
                    >
                      {has ? '✓ Uploaded' : '! Missing'}
                    </span>
                  </div>
                );
              })}
            </div>
            {missingDocs.length > 0 && (
              <Link
                href={`/employees/${employee.id}#documents`}
                className="mt-4 block text-center text-xs font-medium text-brand-primary hover:text-brand-dark"
              >
                Upload missing documents →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Direct reports — only shown when there are any */}
      {employee.directReports.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-bold">Your Direct Reports</h2>
            <span className="text-xs text-gray-500">{employee.directReports.length} people</span>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employee.directReports.map((r) => (
                <Link
                  key={r.id}
                  href={`/employees/${r.id}`}
                  className="flex items-center gap-3 p-3 rounded border border-gray-100 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-sm font-bold text-brand-primary flex-shrink-0">
                    {r.firstName[0]}
                    {r.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      <span className="mono">{r.empCode}</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital Access */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-bold">My Digital Access</h2>
            <span className="text-xs text-gray-500">{employee.digitalAccess.length}</span>
          </div>
          <div className="card-body">
            {employee.digitalAccess.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">
                No services granted yet. Ask IT if something is missing.
              </p>
            ) : (
              <ul className="space-y-2">
                {employee.digitalAccess.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{d.serviceName}</p>
                      {d.accountId && (
                        <p className="text-[11px] text-gray-500 truncate">{d.accountId}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-green-600 font-semibold flex-shrink-0 ml-2">
                      ACTIVE
                    </span>
                  </li>
                ))}
                {employee.digitalAccess.length > 8 && (
                  <li className="text-xs text-gray-500 pt-1">
                    + {employee.digitalAccess.length - 8} more
                  </li>
                )}
                <li>
                  <Link
                    href={`/employees/${employee.id}#digital`}
                    className="text-xs font-medium text-brand-primary hover:text-brand-dark mt-2 block"
                  >
                    Manage access →
                  </Link>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* My Team */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-bold">My Team</h2>
            <span className="text-xs text-gray-500">
              {teamSize} {employee.department?.name ? `in ${employee.department.name}` : ''}
            </span>
          </div>
          <div className="card-body">
            {teamColleagues.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">
                No other active members in your department yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {teamColleagues.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/employees/${c.id}`}
                      className="flex items-center gap-2 text-sm hover:text-brand-primary"
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0">
                        {c.firstName[0]}
                        {c.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">{c.designation || '—'}</p>
                      </div>
                    </Link>
                  </li>
                ))}
                {teamSize > teamColleagues.length && (
                  <li>
                    <Link
                      href={`/employees?departmentId=${employee.departmentId}`}
                      className="text-xs font-medium text-brand-primary hover:text-brand-dark mt-2 block"
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
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-bold">This Week</h2>
          </div>
          <div className="card-body">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">
                No birthdays or anniversaries in the next 7 days.
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingEvents.slice(0, 6).map((e, idx) => (
                  <li key={`${e.employeeId}-${e.type}-${idx}`} className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">
                      {e.type === 'BIRTHDAY' ? '🎂' : '🎉'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/employees/${e.employeeId}`}
                        className="text-sm font-medium text-gray-800 hover:text-brand-primary truncate block"
                      >
                        {e.name}
                      </Link>
                      <p className="text-[11px] text-gray-500">
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
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-bold">Recent Activity</h2>
        </div>
        <div className="card-body">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0"
                >
                  <div>
                    <span className="font-medium text-gray-700">{log.module || log.tableName}</span>{' '}
                    <span className="text-gray-500 text-xs">{log.action.toLowerCase()}</span>
                  </div>
                  <span className="text-xs text-gray-400">
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


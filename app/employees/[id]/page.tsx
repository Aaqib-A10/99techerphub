import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import EmployeeDetailClient from './client';
import ProfilePhotoUpload from './ProfilePhotoUpload';
import RelativeTime from '@/app/components/RelativeTime';
import { getSessionUser } from '@/lib/auth';
import { employeeDetailInclude } from './types';
import { formatTenureMonthsFirst } from '@/lib/tenure';

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const employeeId = parseInt(params.id);

  // Shape lives in ./types — keep server include + client prop type in sync.
  // Per-relation orderBy/take stay here because they only matter at fetch.
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      ...employeeDetailInclude,
      assetAssignments: {
        ...employeeDetailInclude.assetAssignments,
        orderBy: { assignedDate: 'desc' },
      },
      documents: { orderBy: { uploadedAt: 'desc' } },
      digitalAccess: { orderBy: { grantedDate: 'desc' } },
      salaryHistory: { orderBy: { effectiveFrom: 'desc' } },
      commissions: { orderBy: { createdAt: 'desc' } },
      deductions: { orderBy: { createdAt: 'desc' } },
      billingSplits: {
        ...employeeDetailInclude.billingSplits,
        orderBy: { effectiveFrom: 'desc' },
      },
      offerLetters: { orderBy: { offerDate: 'desc' } },
      expenses: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!employee) return notFound();

  // Catalog of active marketplaces for the multi-select
  const marketplaceCatalog = await prisma.marketplace.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  // canEdit: ADMIN/HR always; otherwise user must be in this employee's
  // reporting chain (manager, manager-of-manager, etc.). Mirrors the API.
  const sessionUser = await getSessionUser();

  // Roles that are allowed to browse other employees' profiles via cross-links
  // (the Reports To tile, the Direct Reports list, etc.). Plain EMPLOYEEs see
  // those fields as static text — they can read who their manager is, but
  // can't click through into that person's full profile.
  const BROWSE_ROLES = new Set(['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'ACCOUNTANT']);
  const canBrowseEmployees = !!sessionUser && BROWSE_ROLES.has(sessionUser.role);

  // Page-level RBAC: a non-admin-class viewer may only see their own profile.
  // Without this, an EMPLOYEE could paste any /employees/N URL and read a
  // colleague's full record (CNIC, salary, addresses, etc.). Redirect them
  // to their own profile (or root if they have no linked employee record).
  if (!canBrowseEmployees && sessionUser?.employeeId !== employeeId) {
    redirect(sessionUser?.employeeId ? `/employees/${sessionUser.employeeId}` : '/');
  }

  let canEditRoles = false;
  if (sessionUser) {
    if (sessionUser.role === 'ADMIN' || sessionUser.role === 'HR') {
      canEditRoles = true;
    } else if (sessionUser.employeeId) {
      let curr: number | null = employee.reportingManagerId;
      for (let i = 0; i < 20 && curr; i++) {
        if (curr === sessionUser.employeeId) { canEditRoles = true; break; }
        const m: { reportingManagerId: number | null } | null = await prisma.employee.findUnique({
          where: { id: curr },
          select: { reportingManagerId: true },
        });
        curr = m?.reportingManagerId ?? null;
      }
    }
  }

  const allEmployees = await prisma.employee.findMany({
    where: { isActive: true, id: { not: employeeId } },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });

  // Direct reports (people whose reportingManagerId = this employee)
  const directReports = await prisma.employee.findMany({
    where: { reportingManagerId: employeeId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      empCode: true,
      designation: true,
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: 'asc' }],
  });

  // Tenure calculation — compared against dateOfLeaving if exited, else today
  const joinDate = new Date(employee.dateOfJoining);
  const endDate = employee.dateOfLeaving ? new Date(employee.dateOfLeaving) : new Date();
  const tenureMs = endDate.getTime() - joinDate.getTime();
  const tenureDays = Math.max(0, Math.floor(tenureMs / (1000 * 60 * 60 * 24)));
  // Standardized "<n> Months" / "<n> Years" / "<n> Days" format. Used here on
  // the hero KPI tile and (via the helper in lib/tenure) anywhere else.
  const tenureLabel = formatTenureMonthsFirst(tenureDays);

  // Asset summary
  const activeAssets = employee.assetAssignments.filter((a: any) => !a.returnedDate).length;
  const returnedAssets = employee.assetAssignments.filter((a: any) => a.returnedDate).length;

  // Fetch multi-company assignments from join table
  const employeeCompanyRows: { companyId: number; companyCode: string; companyName: string }[] =
    await prisma.$queryRawUnsafe(`
      SELECT ec."companyId" as "companyId", c.code as "companyCode", c.name as "companyName"
      FROM employee_companies ec
      JOIN companies c ON c.id = ec."companyId"
      WHERE ec."employeeId" = ${employeeId}
      ORDER BY ec."assignedAt" ASC
    `);
  const employeeCompanies = employeeCompanyRows.map((r) => ({ id: r.companyId, code: r.companyCode, name: r.companyName }));

  const [departments, companies, locations, lastEdit] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Most recent audit entry for this employee (excluding the initial CREATE).
    // Used by the "last edited by" chip in the header.
    prisma.auditLog.findFirst({
      where: {
        tableName: 'employees',
        recordId: employeeId,
        action: { in: ['UPDATE', 'DELETE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        changedBy: {
          select: {
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  const lastEditInfo = lastEdit
    ? {
        action: lastEdit.action,
        at: lastEdit.createdAt.toISOString(),
        byName: lastEdit.changedBy?.employee
          ? `${lastEdit.changedBy.employee.firstName} ${lastEdit.changedBy.employee.lastName}`
          : lastEdit.changedBy?.email || 'system',
      }
    : null;

  const activeDigitalAccess = (employee.digitalAccess || []).filter(
    (d: any) => d.isActive,
  ).length;

  return (
    <div>
      {/* Page hero — light, matches the rest of the ERP */}
      <div className="page-hero">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1 flex items-start gap-4">
            <ProfilePhotoUpload
              employeeId={employee.id}
              photoUrl={employee.photoUrl}
              initials={`${employee.firstName[0]}${employee.lastName[0]}`}
            />
            <div className="min-w-0">
              <span className="eyebrow">
                People / {employee.department.name}
              </span>
              <h1>
                {employee.firstName} {employee.lastName}
              </h1>
              <p>
                <span className="mono text-emerald-600">{employee.empCode}</span>
                {employee.designation ? ` · ${employee.designation}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                    employee.isActive
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-rose-50 text-rose-700 ring-rose-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      employee.isActive ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {employee.lifecycleStage.replace(/_/g, ' ')}
                </span>
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-200">
                  {employee.employmentStatus}
                </span>
                {(employeeCompanies.length > 0
                  ? employeeCompanies
                  : employee.company?.name
                  ? [{ id: employee.company.id, code: (employee.company as any).code, name: employee.company.name }]
                  : []
                ).map((c: any) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
                  >
                    {c.code || c.name}
                  </span>
                ))}
              </div>
              {lastEditInfo && (
                <p
                  className="mt-2 text-[11px] text-zinc-400"
                  title={new Date(lastEditInfo.at).toLocaleString()}
                >
                  Last edited <RelativeTime iso={lastEditInfo.at} /> by{' '}
                  <span className="text-zinc-600">{lastEditInfo.byName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Contact column */}
          <div className="flex flex-col items-end gap-1 text-[12.5px] text-zinc-500">
            {employee.email && (
              <a
                href={`mailto:${employee.email}`}
                className="truncate hover:text-zinc-800"
                title="Send email"
              >
                ✉ {employee.email}
              </a>
            )}
            {employee.phone && (
              <a href={`tel:${employee.phone}`} className="hover:text-zinc-800" title="Call">
                ☎ {employee.phone}
              </a>
            )}
            {employee.location?.name && (
              <span className="text-zinc-400">📍 {employee.location.name}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip — same stat-card pattern as /expenses and /employees */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-label">Tenure</div>
          <div className="stat-value">{tenureLabel}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            since {joinDate.toLocaleDateString()}
          </div>
        </div>
        {employee.reportingManager ? (
          canBrowseEmployees ? (
            <Link
              href={`/employees/${employee.reportingManager.id}`}
              className="stat-card block hover:shadow-md transition cursor-pointer"
              title={`Open ${employee.reportingManager.firstName} ${employee.reportingManager.lastName}'s profile`}
            >
              <div className="stat-label">Reports To</div>
              <div className="stat-value text-[1.05rem] truncate">
                {employee.reportingManager.firstName} {employee.reportingManager.lastName}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {employee.reportingManager.empCode}
              </div>
            </Link>
          ) : (
            // EMPLOYEE viewers see the manager as static text — no link out.
            <div className="stat-card">
              <div className="stat-label">Reports To</div>
              <div className="stat-value text-[1.05rem] truncate">
                {employee.reportingManager.firstName} {employee.reportingManager.lastName}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {employee.reportingManager.empCode}
              </div>
            </div>
          )
        ) : (
          <div className="stat-card">
            <div className="stat-label">Reports To</div>
            <div className="stat-value text-[1.05rem]">—</div>
            <div className="text-[11px] text-zinc-500 mt-1">No manager set</div>
          </div>
        )}
        {directReports.length > 0 ? (
          <a
            href="#direct-reports"
            className="stat-card block hover:shadow-md transition cursor-pointer"
            title={`See ${directReports.length} direct report${directReports.length === 1 ? '' : 's'}`}
          >
            <div className="stat-label">Direct Reports</div>
            <div className="stat-value">{directReports.length}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Active employees</div>
          </a>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Direct Reports</div>
            <div className="stat-value">0</div>
            <div className="text-[11px] text-zinc-500 mt-1">No reports</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Active Assets</div>
          <div className="stat-value">{activeAssets}</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {returnedAssets} returned
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Digital Access</div>
          <div className="stat-value">{activeDigitalAccess}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Active services</div>
        </div>
      </div>

      <EmployeeDetailClient
        employee={employee}
        allEmployees={allEmployees}
        departments={departments}
        companies={companies}
        locations={locations}
        directReports={directReports}
        employeeCompanies={employeeCompanies}
        canBrowseEmployees={canBrowseEmployees}
        rolesProps={{
          responsibilities: employee.responsibilities,
          marketplaceIds: employee.marketplaces.map((em: any) => em.marketplaceId),
          marketplaceCatalog,
          canEdit: canEditRoles,
        }}
      />
    </div>
  );
}

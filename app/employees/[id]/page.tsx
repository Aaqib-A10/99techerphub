import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EmployeeDetailClient from './client';

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const employeeId = parseInt(params.id);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      department: true,
      company: true,
      location: true,
      reportingManager: true,
      assetAssignments: {
        include: {
          asset: { include: { category: true } },
        },
        orderBy: { assignedDate: 'desc' },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
      },
      digitalAccess: {
        orderBy: { grantedDate: 'desc' },
      },
      salaryHistory: {
        orderBy: { effectiveFrom: 'desc' },
      },
      offerLetters: {
        orderBy: { offerDate: 'desc' },
      },
      onboardingSubmission: true,
      exitRecord: true,
      expenses: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!employee) return notFound();

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
  const tenureYears = Math.floor(tenureDays / 365);
  const tenureMonths = Math.floor((tenureDays % 365) / 30);
  const tenureLabel =
    tenureYears > 0
      ? `${tenureYears}y ${tenureMonths}m`
      : tenureMonths > 0
      ? `${tenureMonths}m`
      : `${tenureDays}d`;

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

  const [departments, companies, locations] = await Promise.all([
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
  ]);

  return (
    <div>
      {/* Header — Architectural Ledger profile card */}
      <div className="relative rounded-xl overflow-hidden p-6 mb-6" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #152B4C 100%)', boxShadow: '0 32px 64px -12px rgba(11,31,58,0.12)' }}>
        {/* Ledger Line accent */}
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 2, background: '#14B8A6', borderRadius: '0 1px 1px 0' }} />
        {/* Ambient teal glow */}
        <div aria-hidden style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0) 65%)', pointerEvents: 'none' }} />

        <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(20,184,166,0.15)', border: '2px solid rgba(20,184,166,0.3)' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14B8A6' }}>
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
            <div className="min-w-0">
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }} className="truncate">
                {employee.firstName} {employee.lastName}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', marginTop: 4 }}>
                <span className="mono" style={{ color: '#14B8A6' }}>{employee.empCode}</span> &middot; {employee.designation} &middot; {employee.department.name}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {/* Badges on dark header need light text + semi-transparent backgrounds */}
                <span
                  className="badge"
                  style={{
                    color: employee.isActive ? '#6EE7B7' : '#FCA5A5',
                    backgroundColor: employee.isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                    borderColor: employee.isActive ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
                  }}
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
                <span
                  className="badge"
                  style={{
                    color: '#93C5FD',
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    borderColor: 'rgba(59,130,246,0.35)',
                  }}
                >
                  {employee.lifecycleStage.replace(/_/g, ' ')}
                </span>
                <span
                  className="badge"
                  style={{
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderColor: 'rgba(255,255,255,0.3)',
                    fontWeight: 600,
                  }}
                >
                  {employee.employmentStatus}
                </span>
                {employeeCompanies.length > 0 ? (
                  employeeCompanies.map((c) => (
                    <span
                      key={c.id}
                      className="badge"
                      style={{
                        color: '#FDE68A',
                        backgroundColor: 'rgba(245,158,11,0.15)',
                        borderColor: 'rgba(245,158,11,0.35)',
                      }}
                    >
                      {c.code || c.name}
                    </span>
                  ))
                ) : employee.company?.name ? (
                  <span
                    className="badge"
                    style={{
                      color: '#FDE68A',
                      backgroundColor: 'rgba(245,158,11,0.15)',
                      borderColor: 'rgba(245,158,11,0.35)',
                    }}
                  >
                    {employee.company.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Contact shortcuts */}
          <div className="flex flex-col gap-1.5 md:text-right" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            {employee.email && (
              <a href={`mailto:${employee.email}`} className="truncate" style={{ color: 'rgba(255,255,255,0.7)', transition: 'color 0.15s' }} title="Send email">
                ✉ {employee.email}
              </a>
            )}
            {employee.phone && (
              <a href={`tel:${employee.phone}`} style={{ color: 'rgba(255,255,255,0.7)', transition: 'color 0.15s' }} title="Call">
                ☎ {employee.phone}
              </a>
            )}
            {employee.location?.name && (
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>📍 {employee.location.name}</span>
            )}
          </div>
        </div>

        {/* Quick-facts strip */}
        <div className="quick-facts relative z-10" style={{ marginTop: 24 }}>
          <div className="quick-fact" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="quick-fact-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Tenure</div>
            <div className="quick-fact-value" style={{ color: '#FFFFFF' }}>{tenureLabel}</div>
            <div className="quick-fact-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>since {joinDate.toLocaleDateString()}</div>
          </div>
          <div className="quick-fact" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="quick-fact-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Manager</div>
            <div className="quick-fact-value truncate" style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>
              {employee.reportingManager
                ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
                : '—'}
            </div>
            <div className="quick-fact-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {employee.reportingManager?.empCode || 'No manager set'}
            </div>
          </div>
          <div className="quick-fact" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="quick-fact-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Direct Reports</div>
            <div className="quick-fact-value" style={{ color: '#FFFFFF' }}>{directReports.length}</div>
            <div className="quick-fact-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {directReports.length === 0 ? 'No reports' : 'Active employees'}
            </div>
          </div>
          <div className="quick-fact" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="quick-fact-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Active Assets</div>
            <div className="quick-fact-value" style={{ color: '#FFFFFF' }}>{activeAssets}</div>
            <div className="quick-fact-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {returnedAssets} returned
            </div>
          </div>
          <div className="quick-fact" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="quick-fact-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Digital Access</div>
            <div className="quick-fact-value" style={{ color: '#FFFFFF' }}>
              {(employee.digitalAccess || []).filter((d: any) => d.isActive).length}
            </div>
            <div className="quick-fact-sub" style={{ color: 'rgba(255,255,255,0.4)' }}>Active services</div>
          </div>
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
      />
    </div>
  );
}

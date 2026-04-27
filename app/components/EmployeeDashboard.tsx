import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelativeTime from './RelativeTime';

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
    },
  });

  if (!employee) {
    return (
      <div className="text-center py-16 text-gray-600">
        We can't find your employee record. Contact an administrator.
      </div>
    );
  }

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
  const tenureLabel =
    tenureDays >= 365
      ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}m`
      : tenureDays >= 30
      ? `${Math.floor(tenureDays / 30)}m`
      : `${tenureDays}d`;

  return (
    <div className="space-y-6">
      {/* Hero — personalized */}
      <div
        className="relative rounded-xl overflow-hidden p-6"
        style={{
          background: 'linear-gradient(135deg, #0B1F3A 0%, #152B4C 100%)',
          boxShadow: '0 32px 64px -12px rgba(11,31,58,0.12)',
        }}
      >
        <div
          aria-hidden
          style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 2, background: '#14B8A6', borderRadius: '0 1px 1px 0' }}
        />
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Welcome back
            </p>
            <h1
              className="mt-1 truncate"
              style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em' }}
            >
              {employee.firstName} {employee.lastName}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginTop: 4 }}>
              <span className="mono" style={{ color: '#14B8A6' }}>{employee.empCode}</span>
              {employee.designation ? ` · ${employee.designation}` : ''}
              {employee.department?.name ? ` · ${employee.department.name}` : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/employees/${employee.id}`}
              className="px-4 py-2 rounded-md text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              View My Profile
            </Link>
          </div>
        </div>

        {/* Quick facts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="Tenure" value={tenureLabel} sub={joinDate ? `Joined ${joinDate.toLocaleDateString()}` : 'No join date'} />
          <Stat label="Active Assets" value={String(employee.assetAssignments.length)} sub="In your custody" />
          <Stat
            label="Required Docs"
            value={`${requiredUploaded}/${REQUIRED_DOC_TYPES.length}`}
            sub={missingDocs.length === 0 ? 'Complete' : `${missingDocs.length} missing`}
          />
          <Stat
            label="Manager"
            value={
              employee.reportingManager
                ? `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`
                : '—'
            }
            sub={employee.reportingManager?.empCode || 'No manager set'}
          />
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
                href={`/employees/${employee.id}?tab=documents`}
                className="mt-4 block text-center text-xs font-medium text-brand-primary hover:text-brand-dark"
              >
                Upload missing documents →
              </Link>
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </div>
      <div className="mt-1 truncate" style={{ color: '#FFFFFF', fontSize: '1rem', fontWeight: 700 }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

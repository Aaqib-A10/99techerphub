import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import LedgerDashboard from './components/LedgerDashboard';
import DashboardFilterBar from './components/DashboardFilterBar';
import EmployeeDashboard from './components/EmployeeDashboard';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Roles that should see the org-wide ledger dashboard. Everyone else
// (e.g. EMPLOYEE) gets the personal EmployeeDashboard.
const ORG_VIEW_ROLES = new Set(['ADMIN', 'HR', 'MANAGER', 'FINANCE']);

export default async function Dashboard({
  searchParams,
}: {
  searchParams: {
    company?: string;
    department?: string;
    from?: string;
    to?: string;
  };
}) {
  const user = await getSessionUser();

  // Personal dashboard for non-admin roles linked to an Employee record
  if (user && user.employeeId && !ORG_VIEW_ROLES.has(user.role)) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <div className="w-full px-6 py-6">
          <Suspense
            fallback={
              <div
                className="text-center py-16"
                style={{ color: '#5A6159', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
              >
                LOADING DASHBOARD…
              </div>
            }
          >
            <EmployeeDashboard employeeId={user.employeeId} userId={user.id} />
          </Suspense>
        </div>
      </div>
    );
  }

  // Org-wide ledger dashboard for admin / HR / manager / finance
  const selectedCompany = searchParams.company || 'all';
  const selectedDepartment = searchParams.department || 'all';
  const dateFrom = searchParams.from || '';
  const dateTo = searchParams.to || '';

  const [companies, departments] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="w-full px-6 py-6">
        <div className="mb-4 flex justify-end">
          <DashboardFilterBar
            companies={companies}
            departments={departments}
            selectedCompany={selectedCompany}
            selectedDepartment={selectedDepartment}
          />
        </div>

        <Suspense
          fallback={
            <div
              className="text-center py-16"
              style={{ color: '#5A6159', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
            >
              LOADING DASHBOARD…
            </div>
          }
        >
          <LedgerDashboard
            selectedCompany={selectedCompany}
            selectedDepartment={selectedDepartment}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </Suspense>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import LedgerDashboard from './components/LedgerDashboard';
import DashboardFilterBar from './components/DashboardFilterBar';

export const dynamic = 'force-dynamic';

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
    <div style={{ backgroundColor: '#F8F9FF', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 py-6">
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
              style={{ color: '#75777E', fontFamily: 'var(--font-jetbrains-mono), monospace' }}
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

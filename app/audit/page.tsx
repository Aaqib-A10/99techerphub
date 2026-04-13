import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import AuditFilters from './audit-filters';
import AuditTable from './audit-table';
import AuditExportButton from './audit-export-button';
import PageHero from '@/app/components/PageHero';

interface AuditPageProps {
  searchParams: {
    page?: string;
    module?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  };
}

async function AuditStats() {
  try {
    const [totalEntries, entriesCount, moduleStats] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 1,
      }),
    ]);

    const mostActiveModule = moduleStats[0]?.module || 'None';

    return (
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value">{totalEntries.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Entries Today</div>
          <div className="stat-value" style={{ color: '#14B8A6' }}>{entriesCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Most Active Module</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{mostActiveModule}</div>
        </div>
      </div>
    );
  } catch (error) {
    return null;
  }
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const page = parseInt(searchParams.page || '1');
  const module = searchParams.module || 'ALL';
  const action = searchParams.action || 'ALL';
  const fromDate = searchParams.fromDate || '';
  const toDate = searchParams.toDate || '';
  const search = searchParams.search || '';

  return (
    <div>
      <PageHero
        eyebrow="System / Audit Trail"
        title="Audit Trail"
        description="Complete history of all system changes"
        actions={<AuditExportButton fromDate={fromDate} toDate={toDate} />}
      />

      <Suspense fallback={<div className="text-gray-500">Loading statistics...</div>}>
        <AuditStats />
      </Suspense>

      <div className="card mb-6">
        <div className="card-header">
          <h2 className="section-heading">Filters</h2>
        </div>
        <div className="p-4">
          <AuditFilters
            initialModule={module}
            initialAction={action}
            initialFromDate={fromDate}
            initialToDate={toDate}
            initialSearch={search}
          />
        </div>
      </div>

      <Suspense fallback={<div className="text-gray-500">Loading audit logs...</div>}>
        <AuditTable
          page={page}
          module={module}
          action={action}
          fromDate={fromDate}
          toDate={toDate}
          search={search}
        />
      </Suspense>
    </div>
  );
}

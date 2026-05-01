import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DigitalAccessClient from './client';
import { KpiTile } from '@/app/components/design';

export default async function DigitalAccessPage() {
  const accessRecords = await prisma.digitalAccess.findMany({
    include: { employee: { include: { department: true } } },
    orderBy: { grantedDate: 'desc' },
  });
  const services = Array.from(new Set(accessRecords.map((record) => record.serviceName)));
  const activeCount = accessRecords.filter((r) => r.isActive).length;
  const revokedCount = accessRecords.filter((r) => !r.isActive).length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            Inventory · SaaS
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Digital Access
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            Manage employee access to digital services and tools
          </p>
        </div>
        <Link
          href="/digital-access/new"
          className="inline-flex items-center gap-[6px] rounded-lg border border-core-text bg-core-text px-[13px] py-2 text-[12.5px] font-semibold text-core-surface transition hover:opacity-90"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14 M5 12h14" />
          </svg>
          Grant Access
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-[18px] grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile tone="violet" label="Total Records" value={accessRecords.length} />
        <KpiTile tone="green" label="Active Access" value={activeCount} />
        <KpiTile tone="rose" label="Revoked" value={revokedCount} />
        <KpiTile tone="blue" label="Services" value={services.length} meta="Distinct apps" />
      </div>

      <DigitalAccessClient initialRecords={accessRecords as any[]} services={services} />
    </div>
  );
}

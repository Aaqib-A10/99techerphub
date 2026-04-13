import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DigitalAccessClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function DigitalAccessPage() {
  const accessRecords = await prisma.digitalAccess.findMany({
    include: { employee: { include: { department: true } } },
    orderBy: { grantedDate: 'desc' },
  });
  const services = Array.from(new Set(accessRecords.map((record) => record.serviceName)));

  return (
    <div>
      <PageHero
        eyebrow="Assets / Digital"
        title="Digital Access"
        description="Manage employee access to digital services and tools"
        actions={
          <Link href="/digital-access/new" className="btn btn-accent">
            + Grant Access
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{accessRecords.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Access</div>
          <div className="stat-value">{accessRecords.filter((r) => r.isActive).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revoked</div>
          <div className="stat-value">{accessRecords.filter((r) => !r.isActive).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Services</div>
          <div className="stat-value">{services.length}</div>
        </div>
      </div>
      <DigitalAccessClient initialRecords={accessRecords} services={services} />
    </div>
  );
}
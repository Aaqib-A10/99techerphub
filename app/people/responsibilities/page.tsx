import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PageHero from '@/app/components/PageHero';
import ResponsibilitiesClient from './client';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['ADMIN', 'HR', 'MANAGER', 'FINANCE']);

export default async function ResponsibilitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!ALLOWED_ROLES.has(user.role)) {
    return (
      <div className="text-center py-16 text-gray-600">
        You don&apos;t have permission to view roles &amp; responsibilities.
      </div>
    );
  }

  // Pull every active employee with their dept + responsibilities + marketplaces
  const [employees, marketplaces, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        empCode: true,
        firstName: true,
        lastName: true,
        designation: true,
        responsibilities: true,
        photoUrl: true,
        department: { select: { id: true, name: true } },
        marketplaces: {
          include: { marketplace: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.marketplace.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  // Flatten marketplaces for easier filtering on the client
  const rows = employees.map((e) => ({
    id: e.id,
    empCode: e.empCode,
    name: `${e.firstName} ${e.lastName}`.trim(),
    designation: e.designation,
    responsibilities: e.responsibilities,
    photoUrl: e.photoUrl,
    departmentId: e.department?.id ?? null,
    departmentName: e.department?.name ?? null,
    marketplaceIds: e.marketplaces.map((m) => m.marketplace.id),
    marketplaceNames: e.marketplaces.map((m) => m.marketplace.name),
  }));

  return (
    <div>
      <PageHero
        eyebrow="People"
        title="Roles & Responsibilities"
        description="What every active employee is accountable for, and which marketplaces they own. Filter by department or marketplace to find subject-matter owners fast."
      />
      <ResponsibilitiesClient
        rows={rows}
        marketplaces={marketplaces}
        departments={departments}
      />
    </div>
  );
}

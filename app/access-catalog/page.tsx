import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AccessCatalogClient from './client';

export const dynamic = 'force-dynamic';

export default async function AccessCatalogPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const services = await prisma.digitalService.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // Per-employee snapshot so the UI knows which services to mark as
  // "Granted" vs "Pending" vs "Request Access".
  let myAccess: { serviceName: string; isActive: boolean }[] = [];
  let myRequests: { serviceId: number; status: string; requestedAt: Date }[] = [];
  if (user.employeeId) {
    [myAccess, myRequests] = await Promise.all([
      prisma.digitalAccess.findMany({
        where: { employeeId: user.employeeId },
        select: { serviceName: true, isActive: true },
      }),
      prisma.digitalAccessRequest.findMany({
        where: { employeeId: user.employeeId },
        select: { id: true, serviceId: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);
  }

  return (
    <AccessCatalogClient
      services={JSON.parse(JSON.stringify(services))}
      myAccess={myAccess}
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      hasEmployeeRecord={!!user.employeeId}
    />
  );
}

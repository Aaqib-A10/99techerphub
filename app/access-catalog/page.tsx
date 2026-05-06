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
    include: {
      // Owner info gets surfaced to the client so the modal can default
      // the "Send to" picker to whoever actually owns the service. If
      // unset, the picker falls back to the user's manager / any admin.
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empCode: true,
          designation: true,
        },
      },
    },
  });

  // Per-employee snapshot so the UI knows which services to mark as
  // "Granted" vs "Pending" vs "Request Access".
  let myAccess: { serviceName: string; isActive: boolean }[] = [];
  let myRequests: { serviceId: number; status: string; requestedAt: Date }[] = [];
  let reportingManager: {
    id: number;
    firstName: string;
    lastName: string;
    empCode: string;
    designation: string | null;
  } | null = null;

  if (user.employeeId) {
    const [accessRows, requestRows, employeeRow] = await Promise.all([
      prisma.digitalAccess.findMany({
        where: { employeeId: user.employeeId },
        select: { serviceName: true, isActive: true },
      }),
      prisma.digitalAccessRequest.findMany({
        where: { employeeId: user.employeeId },
        select: { id: true, serviceId: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      }),
      prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: {
          reportingManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              empCode: true,
              designation: true,
            },
          },
        },
      }),
    ]);
    myAccess = accessRows;
    myRequests = requestRows;
    reportingManager = employeeRow?.reportingManager ?? null;
  }

  // The picker shows every active employee — small-org reality is that
  // roles are fluid (a senior dev might own AWS without being ADMIN).
  // The actual approve/reject endpoint still enforces real permissions
  // server-side, so a wide picker is safe; it's a routing hint, not a
  // grant of authority. Excludes the requester so users can't pick
  // themselves.
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(user.employeeId ? { id: { not: user.employeeId } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      empCode: true,
      designation: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return (
    <AccessCatalogClient
      services={JSON.parse(JSON.stringify(services))}
      myAccess={myAccess}
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      hasEmployeeRecord={!!user.employeeId}
      employees={employees}
      reportingManager={reportingManager}
    />
  );
}

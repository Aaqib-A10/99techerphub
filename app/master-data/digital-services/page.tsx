export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import DigitalServicesClient from './client';

export default async function DigitalServicesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  const [services, employees] = await Promise.all([
    prisma.digitalService.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, empCode: true },
        },
      },
    }),
    // Employee picker source — used to set / change the service owner.
    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        empCode: true,
        designation: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ]);

  // Count usage per service so the table can show "in use" warnings
  // and the soft-delete decision is informed.
  const usage = await Promise.all(
    services.map(async (s) => {
      const [requests, grants] = await Promise.all([
        prisma.digitalAccessRequest.count({ where: { serviceId: s.id } }),
        prisma.digitalAccess.count({ where: { serviceName: s.name } }),
      ]);
      return { id: s.id, requests, grants };
    }),
  );

  return (
    <DigitalServicesClient
      initial={JSON.parse(
        JSON.stringify(
          services.map((s) => ({
            ...s,
            usage: usage.find((u) => u.id === s.id) ?? { requests: 0, grants: 0 },
          })),
        ),
      )}
      employees={employees}
    />
  );
}

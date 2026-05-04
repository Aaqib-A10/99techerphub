import { prisma } from '@/lib/prisma';
import AccessRequestsClient from './client';

export const dynamic = 'force-dynamic';

export default async function AccessRequestsPage() {
  const requests = await prisma.digitalAccessRequest.findMany({
    orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empCode: true,
          email: true,
          designation: true,
          department: { select: { id: true, name: true } },
          photoUrl: true,
        },
      },
      service: {
        select: { id: true, name: true, category: true, defaultPlan: true },
      },
      reviewer: { select: { id: true, email: true } },
    },
  });

  return <AccessRequestsClient initialRequests={JSON.parse(JSON.stringify(requests))} />;
}

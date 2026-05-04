import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET — any logged-in user can read the service catalog (employees
// browse it from /access-catalog). Returns active services + the
// caller's existing access + their pending requests so the UI can
// render correct CTAs without three round-trips.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const services = await prisma.digitalService.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, empCode: true } },
    },
  });

  // Compute per-service status for the caller (so the UI knows whether
  // to show "Request Access" vs "Pending" vs "Granted"). Only meaningful
  // when the user is linked to an Employee record.
  let myAccess: Array<{ serviceName: string; isActive: boolean }> = [];
  let myRequests: Array<{ serviceId: number; status: string }> = [];
  if (user.employeeId) {
    [myAccess, myRequests] = await Promise.all([
      prisma.digitalAccess.findMany({
        where: { employeeId: user.employeeId },
        select: { serviceName: true, isActive: true },
      }),
      prisma.digitalAccessRequest.findMany({
        where: {
          employeeId: user.employeeId,
          status: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
        },
        select: { serviceId: true, status: true },
        orderBy: { requestedAt: 'desc' },
      }),
    ]);
  }

  return NextResponse.json({ services, myAccess, myRequests });
}

// POST — admin creates a new catalog entry.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const created = await prisma.digitalService.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        category: body.category ?? null,
        defaultPlan: body.defaultPlan ?? null,
        ownerEmployeeId: body.ownerEmployeeId ?? null,
        iconUrl: body.iconUrl ?? null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A service with that name already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { createNotificationsForRole } from '@/lib/services/notificationService';

// GET — admin/HR view returns all requests; employees see only their own.
// Filter by ?status=PENDING|APPROVED|REJECTED|CANCELLED.
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  const isAdminView = ['ADMIN', 'HR'].includes(user.role);
  const where: any = {};
  if (statusFilter) where.status = statusFilter;
  if (!isAdminView) {
    if (!user.employeeId) {
      return NextResponse.json([]);
    }
    where.employeeId = user.employeeId;
  }

  const requests = await prisma.digitalAccessRequest.findMany({
    where,
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
        },
      },
      service: {
        select: { id: true, name: true, category: true, defaultPlan: true },
      },
      reviewer: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json(requests);
}

// POST — employee submits a request. Hard-wires the requesting
// employeeId to the caller's session so a malicious payload can't pin
// the request on someone else.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json(
      { error: 'Your user account is not linked to an employee record.' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const serviceId = parseInt(body?.serviceId);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  }
  const notes: string | null = typeof body?.notes === 'string' ? body.notes.trim() || null : null;

  // Block duplicate pending requests against the same service.
  const existing = await prisma.digitalAccessRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      serviceId,
      status: 'PENDING',
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending request for this service.' },
      { status: 409 },
    );
  }

  // Block requests for services the employee already has active access to.
  const service = await prisma.digitalService.findUnique({ where: { id: serviceId } });
  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }
  const alreadyHas = await prisma.digitalAccess.findFirst({
    where: { employeeId: user.employeeId, serviceName: service.name, isActive: true },
  });
  if (alreadyHas) {
    return NextResponse.json(
      { error: 'You already have active access to this service.' },
      { status: 409 },
    );
  }

  const created = await prisma.digitalAccessRequest.create({
    data: {
      employeeId: user.employeeId,
      serviceId,
      notes,
    },
    include: {
      employee: { select: { firstName: true, lastName: true, empCode: true } },
      service: { select: { name: true } },
    },
  });

  // Fire admin notification so the queue doesn't sit unattended. The
  // service-owner-specific path is left as a follow-up; for now any
  // ADMIN can review.
  try {
    await createNotificationsForRole('ADMIN', {
      type: 'GENERAL',
      title: 'New Digital Access Request',
      message: `${created.employee.firstName} ${created.employee.lastName} (${created.employee.empCode}) requested access to ${created.service.name}.`,
      link: '/access-requests',
    });
  } catch (err) {
    console.warn('[access-requests/POST] notification fan-out failed:', err);
  }

  return NextResponse.json(created, { status: 201 });
}

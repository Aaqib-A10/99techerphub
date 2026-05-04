import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { createNotification } from '@/lib/services/notificationService';

// Approve an access request → flips the request to APPROVED and
// creates the corresponding DigitalAccess record so the employee
// immediately shows up as having access. Optional accountId/notes
// from the body are stored on the new DigitalAccess row.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'HR'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const accountId: string | null =
    typeof body?.accountId === 'string' ? body.accountId.trim() || null : null;
  const reviewNotes: string | null =
    typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim() || null : null;

  const existing = await prisma.digitalAccessRequest.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          user: { select: { id: true } },
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Request is already ${existing.status.toLowerCase()}.` },
      { status: 409 },
    );
  }

  // Approve + grant access in one transaction so we never leave the
  // request approved without the corresponding DigitalAccess row.
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.digitalAccessRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: user.id,
        reviewNotes,
      },
    });
    const access = await tx.digitalAccess.create({
      data: {
        employeeId: existing.employeeId,
        serviceName: existing.service.name,
        accountId,
        notes: reviewNotes,
      },
    });
    return { updated, access };
  });

  // Notify the requester. The employee may not have a User account
  // (e.g. SSO not yet linked), so this is a best-effort fanout.
  try {
    if (existing.employee.user) {
      await createNotification({
        userId: existing.employee.user.id,
        type: 'GENERAL',
        title: 'Access request approved',
        message: `Your request for ${existing.service.name} was approved. Check your dashboard for the credentials.`,
        link: '/access-catalog',
      });
    }
  } catch (err) {
    console.warn('[access-requests/approve] notification failed:', err);
  }

  return NextResponse.json(result);
}

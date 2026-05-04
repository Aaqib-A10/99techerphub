import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { createNotification } from '@/lib/services/notificationService';

// Reject an access request. The reviewNotes field is required so the
// requester gets context — "no, you don't need this" without a reason
// generates more support tickets than it saves.
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
  const reviewNotes: string | null =
    typeof body?.reviewNotes === 'string' ? body.reviewNotes.trim() || null : null;
  if (!reviewNotes) {
    return NextResponse.json(
      { error: 'A short reason is required when rejecting.' },
      { status: 400 },
    );
  }

  const existing = await prisma.digitalAccessRequest.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      employee: { select: { user: { select: { id: true } } } },
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

  const updated = await prisma.digitalAccessRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedById: user.id,
      reviewNotes,
    },
  });

  try {
    if (existing.employee.user) {
      await createNotification({
        userId: existing.employee.user.id,
        type: 'GENERAL',
        title: 'Access request rejected',
        message: `Your request for ${existing.service.name} was not approved: ${reviewNotes}`,
        link: '/access-catalog',
      });
    }
  } catch (err) {
    console.warn('[access-requests/reject] notification failed:', err);
  }

  return NextResponse.json(updated);
}

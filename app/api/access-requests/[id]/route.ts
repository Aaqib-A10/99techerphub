import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// DELETE — employee withdraws their own pending request, OR admin/HR
// removes any request. We use status=CANCELLED rather than a hard
// delete so the audit trail survives.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const existing = await prisma.digitalAccessRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  const isAdmin = ['ADMIN', 'HR'].includes(user.role);
  const isOwner = existing.employeeId === user.employeeId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Only pending requests can be cancelled.' },
      { status: 409 },
    );
  }

  const updated = await prisma.digitalAccessRequest.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      reviewedAt: new Date(),
      reviewedById: user.id,
    },
  });
  return NextResponse.json(updated);
}

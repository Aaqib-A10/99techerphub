import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { id: parseInt(id) },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(submission, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching onboarding submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding submission' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { action, notes } = body;

    // Validate action
    if (!['APPROVE', 'REJECT', 'REVISION'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be APPROVE, REJECT, or REVISION.' },
        { status: 400 }
      );
    }

    // Map action to review status
    const reviewStatusMap = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      REVISION: 'NEEDS_REVISION',
    };

    const reviewStatus = reviewStatusMap[action as keyof typeof reviewStatusMap];

    // Update the submission
    const updated = await (prisma.onboardingSubmission as any).update({
      where: { id: parseInt(id) },
      data: {
        reviewStatus,
        reviewedAt: new Date(),
        reviewedBy: 1, // In production, get from session
        reviewNotes: notes || null,
      },
    });

    // Create notification
    try {
      const messages = {
        APPROVE: `Your onboarding submission has been approved!`,
        REJECT: `Your onboarding submission has been rejected. Please contact HR for more details.`,
        REVISION: `Your onboarding submission needs revision. Please review the notes and resubmit.`,
      };

      await prisma.notification.create({
        data: {
          userId: 1,
          type: 'GENERAL',
          title: `Onboarding ${action}ed`,
          message: messages[action as keyof typeof messages],
          link: `/onboarding-admin/${updated.id}`,
        },
      });
    } catch {}

    // Log to audit trail
    try {
      await prisma.auditLog.create({
        data: {
          tableName: 'onboarding_submissions',
          recordId: updated.id,
          action: 'UPDATE',
          module: 'ONBOARDING',
          newValues: updated as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error reviewing onboarding submission:', error);
    return NextResponse.json(
      { error: 'Failed to review onboarding submission' },
      { status: 500 }
    );
  }
}

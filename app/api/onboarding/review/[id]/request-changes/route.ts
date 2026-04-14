import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submissionId = parseInt(params.id);
    const body = await request.json();
    const { notes } = body;

    if (!notes || !notes.trim()) {
      return NextResponse.json(
        { error: 'Revision notes are required' },
        { status: 400 }
      );
    }

    // Fetch the onboarding submission
    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Onboarding submission not found' },
        { status: 404 }
      );
    }

    // Update the submission
    const updated = await (prisma.onboardingSubmission as any).update({
      where: { id: submissionId },
      data: {
        reviewStatus: 'NEEDS_REVISION',
        reviewedAt: new Date(),
        reviewedBy: 1, // In production, get from session
        reviewNotes: notes,
      },
    });

    // Create notification for the candidate
    try {
      await prisma.notification.create({
        data: {
          userId: 1,
          type: 'GENERAL',
          title: 'Onboarding Revision Requested',
          message: `Your onboarding submission requires revision. Please review the feedback and resubmit.`,
          link: `/onboarding/${submission.token}`,
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
          newValues: { reviewStatus: 'NEEDS_REVISION', reviewNotes: notes } as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error requesting revision:', error);
    return NextResponse.json(
      { error: 'Failed to request revision' },
      { status: 500 }
    );
  }
}

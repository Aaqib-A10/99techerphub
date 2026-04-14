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
        { error: 'Rejection reason is required' },
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
        reviewStatus: 'REJECTED',
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
          title: 'Onboarding Rejected',
          message: `Your onboarding submission has been rejected. Please contact HR for more information.`,
          link: `/onboarding-admin/${submission.id}`,
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
          newValues: { reviewStatus: 'REJECTED', reviewNotes: notes } as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error rejecting submission:', error);
    return NextResponse.json(
      { error: 'Failed to reject submission' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();

    // Verify token exists and is not expired
    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { token },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Onboarding submission not found' },
        { status: 404 }
      );
    }

    if (submission.tokenExpiresAt && new Date() > submission.tokenExpiresAt) {
      return NextResponse.json(
        { error: 'Onboarding link has expired' },
        { status: 410 }
      );
    }

    // Update the submission with submitted data
    const updated = await (prisma.onboardingSubmission as any).update({
      where: { token },
      data: {
        personalDetails: body.personalDetails || {},
        bankDetails: body.bankDetails || {},
        emergencyContact: body.emergencyContact || {},
        educationHistory: body.educationHistory || [],
        workHistory: body.workHistory || [],
        references: body.references || [],
        isComplete: true,
        submittedAt: new Date(),
        reviewStatus: 'PENDING',
      },
    });

    // Create notification for HR
    try {
      await prisma.notification.create({
        data: {
          userId: 1, // Admin user - in production, get from session
          type: 'GENERAL',
          title: 'New Onboarding Submission',
          message: `${submission.candidateName} has submitted their onboarding form for position ${submission.position}.`,
          link: `/onboarding-admin/${submission.id}`,
        },
      });
    } catch {}

    // Log to audit trail
    try {
      await prisma.auditLog.create({
        data: {
          tableName: 'onboarding_submissions',
          recordId: submission.id,
          action: 'UPDATE',
          module: 'ONBOARDING',
          newValues: updated as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error submitting onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to submit onboarding' },
      { status: 500 }
    );
  }
}

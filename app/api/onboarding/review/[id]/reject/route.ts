import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { sendEmail } from '@/lib/services/emailService';

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

    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Onboarding submission not found' }, { status: 404 });
    }

    const updated = await (prisma.onboardingSubmission as any).update({
      where: { id: submissionId },
      data: {
        reviewStatus: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
        reviewNotes: notes,
      },
    });

    // Email the candidate (no User account yet — in-app notification useless)
    if (submission.candidateEmail) {
      try {
        const candidateName = submission.candidateName || 'Candidate';
        const position = submission.position ? ` for the ${submission.position} role` : '';
        const company = submission.companyName || '99 Technologies';
        await sendEmail({
          to: submission.candidateEmail,
          subject: `Update on your application${position} at ${company}`,
          templateKey: 'ONBOARDING_REJECTED',
          bodyHtml: `
            <p>Hi ${candidateName},</p>
            <p>Thank you for your interest in joining ${company}${position}.</p>
            <p>After careful review, we are not able to progress your application at this time.</p>
            <p><strong>Reason:</strong></p>
            <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #444;">
              ${String(notes).replace(/\n/g, '<br/>')}
            </blockquote>
            <p>We appreciate the time you put into your application and wish you the best in your search.</p>
            <p>— ${company} HR</p>
          `,
        });
      } catch (e) {
        console.error('[onboarding/reject] email failed', e);
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          tableName: 'onboarding_submissions',
          recordId: updated.id,
          action: 'UPDATE',
          module: 'ONBOARDING',
          changedById: currentUser.id,
          newValues: { reviewStatus: 'REJECTED', reviewNotes: notes } as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error rejecting submission:', error);
    return NextResponse.json({ error: 'Failed to reject submission' }, { status: 500 });
  }
}

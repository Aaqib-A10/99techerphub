import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { sendEmail } from '@/lib/services/emailService';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://99techerp.com';

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

    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return NextResponse.json({ error: 'Onboarding submission not found' }, { status: 404 });
    }

    const updated = await (prisma.onboardingSubmission as any).update({
      where: { id: submissionId },
      data: {
        reviewStatus: 'NEEDS_REVISION',
        reviewedAt: new Date(),
        reviewedBy: currentUser.id,
        reviewNotes: notes,
      },
    });

    // Email the candidate with the resubmit link
    if (submission.candidateEmail) {
      try {
        const candidateName = submission.candidateName || 'Candidate';
        const company = submission.companyName || '99 Technologies';
        const resubmitUrl = submission.token ? `${APP_URL}/onboarding/${submission.token}` : null;
        await sendEmail({
          to: submission.candidateEmail,
          subject: `Action needed: please update your onboarding form for ${company}`,
          templateKey: 'ONBOARDING_NEEDS_REVISION',
          bodyHtml: `
            <p>Hi ${candidateName},</p>
            <p>Thanks for completing the onboarding form. Before we can finalize, the team has asked for a few updates.</p>
            <p><strong>What to update:</strong></p>
            <blockquote style="border-left: 3px solid #ddd; padding-left: 12px; color: #444;">
              ${String(notes).replace(/\n/g, '<br/>')}
            </blockquote>
            ${
              resubmitUrl
                ? `<p>Click below to open the form (your previous answers are saved — just edit what's flagged):</p>
                   <p><a href="${resubmitUrl}" style="display:inline-block;padding:10px 18px;background:#0B1F3A;color:#fff;text-decoration:none;border-radius:6px">Update my onboarding form</a></p>`
                : '<p>Please contact HR for next steps.</p>'
            }
            <p>— ${company} HR</p>
          `,
        });
      } catch (e) {
        console.error('[onboarding/request-changes] email failed', e);
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
          newValues: { reviewStatus: 'NEEDS_REVISION', reviewNotes: notes } as any,
        },
      });
    } catch {}

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error requesting revision:', error);
    return NextResponse.json({ error: 'Failed to request revision' }, { status: 500 });
  }
}

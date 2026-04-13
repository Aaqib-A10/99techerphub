import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, renderTemplate } from '@/lib/services/emailService';
import { createNotification } from '@/lib/services/notificationService';
import { UserRole, NotificationType } from '@prisma/client';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.HR]);

    const submissionId = parseInt(params.id);
    if (!submissionId) {
      return NextResponse.json(
        { error: 'Invalid submission ID' },
        { status: 400 }
      );
    }

    // Fetch onboarding submission
    const submission = await prisma.onboardingSubmission.findUnique({
      where: { id: submissionId },
      include: { employee: { include: { user: true } } },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Onboarding submission not found' },
        { status: 404 }
      );
    }

    // Determine recipient email
    const recipientEmail = submission.candidateEmail || submission.employee?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No email address found for this submission' },
        { status: 400 }
      );
    }

    // Generate or use existing token
    let token = submission.token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      // Update submission with token (expires in 30 days)
      await prisma.onboardingSubmission.update({
        where: { id: submissionId },
        data: {
          token,
          tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Build onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const onboardingLink = `${baseUrl}/onboarding/${token}`;

    // Prepare merge data
    const mergeData = {
      candidateName: submission.candidateName || submission.employee?.firstName,
      position: submission.position,
      companyName: submission.companyName,
      onboardingLink,
    };

    // Render template
    let subject = 'Onboarding Invitation';
    let html = '';

    try {
      const rendered = await renderTemplate('ONBOARDING_INVITE', mergeData);
      subject = rendered.subject;
      html = rendered.html;
    } catch {
      // Fallback if template doesn't exist
      subject = 'Welcome to 99 Technologies - Complete Your Onboarding';
      html = `
        <h1>Welcome!</h1>
        <p>Dear ${mergeData.candidateName},</p>
        <p>We're excited to have you join our team!</p>
        <p>Please complete your onboarding form by clicking the link below:</p>
        <p><a href="${onboardingLink}" style="background-color: #00C853; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Onboarding Form</a></p>
        <p>This link expires in 30 days.</p>
        <p>Best regards,<br/>99 Technologies Team</p>
      `;
    }

    // Send email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject,
      bodyHtml: html,
      templateKey: 'ONBOARDING_INVITE',
      mergeData,
    });

    // Create notification for employee if they exist
    if (submission.employee?.user?.id) {
      await createNotification({
        userId: submission.employee.user.id,
        type: 'EMPLOYEE_ONBOARDED' as NotificationType,
        title: 'Onboarding Invitation Sent',
        message: 'You have received an onboarding invitation. Please check your email.',
        link: `/onboarding/${token}`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding invitation sent successfully',
        emailId: emailResult.id,
        onboardingLink,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Onboarding/SendInvite]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

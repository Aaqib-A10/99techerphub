import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, renderTemplate } from '@/lib/services/emailService';
import { createNotification } from '@/lib/services/notificationService';
import { UserRole, NotificationType } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.HR]);

    const offerId = parseInt(params.id);
    if (!offerId) {
      return NextResponse.json(
        { error: 'Invalid offer letter ID' },
        { status: 400 }
      );
    }

    // Fetch offer letter
    const offerLetter = await prisma.offerLetter.findUnique({
      where: { id: offerId },
    });

    if (!offerLetter) {
      return NextResponse.json(
        { error: 'Offer letter not found' },
        { status: 404 }
      );
    }

    if (offerLetter.status === 'SENT' || offerLetter.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'This offer letter has already been sent' },
        { status: 400 }
      );
    }

    // Determine recipient email
    const recipientEmail = offerLetter.candidateEmail || offerLetter.employee?.user?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No email address found for this offer letter' },
        { status: 400 }
      );
    }

    // Determine template key based on templateType
    const templateKey = `OFFER_${offerLetter.templateType || 'PERMANENT'}`;

    // Prepare merge data
    const mergeData = {
      candidateName: offerLetter.candidateName || offerLetter.employee?.firstName,
      position: offerLetter.position,
      companyName: offerLetter.companyName,
      salary: offerLetter.salary,
      currency: offerLetter.currency,
      startDate: offerLetter.startDate?.toLocaleDateString(),
      probationPeriod: offerLetter.probationPeriod,
      reportingTo: offerLetter.reportingTo,
      contractType: offerLetter.contractType,
      benefits: offerLetter.benefits,
      workingHours: offerLetter.workingHours,
    };

    // Render template
    let subject = 'Offer Letter';
    let html = offerLetter.customBody || '';

    try {
      const rendered = await renderTemplate(templateKey, mergeData);
      subject = rendered.subject;
      html = rendered.html;
    } catch {
      // If template doesn't exist, use custom body or default
      subject = `Offer Letter - ${offerLetter.position}`;
      html = offerLetter.customBody || '<p>See attached offer letter</p>';
    }

    // Send email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject,
      bodyHtml: html,
      templateKey,
      mergeData,
    });

    // Update offer letter status
    const updated = await prisma.offerLetter.update({
      where: { id: offerId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Create notification for admin
    if (offerLetter.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: offerLetter.employeeId },
      });

      if (employee?.user?.id) {
        await createNotification({
          userId: employee.user.id,
          type: 'GENERAL' as NotificationType,
          title: 'Offer Letter Sent',
          message: `Your offer letter for ${offerLetter.position} has been sent to your email.`,
          link: `/offer-letters/${offerId}`,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Offer letter sent successfully',
        offerLetter: updated,
        emailId: emailResult.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[OfferLetters/Send]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

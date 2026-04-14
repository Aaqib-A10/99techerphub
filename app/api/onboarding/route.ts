import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? { reviewStatus: status } : {};

    const submissions = await (prisma.onboardingSubmission as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error('Error fetching onboarding submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding submissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { candidateName, candidateEmail, position, companyName, expiryDays = 7 } = body;

    // Validate required fields
    if (!candidateName || !candidateEmail || !position || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields: candidateName, candidateEmail, position, companyName' },
        { status: 400 }
      );
    }

    // Generate a random 32-char token
    const token = randomBytes(24).toString('hex');

    // Calculate token expiry
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + expiryDays);

    // Create the submission
    const submission = await (prisma.onboardingSubmission as any).create({
      data: {
        candidateName,
        candidateEmail,
        position,
        companyName,
        token,
        tokenExpiresAt,
        reviewStatus: 'PENDING',
      },
    });

    // Get the app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const onboardingUrl = `${appUrl}/onboarding/${token}`;

    // Create notification for admin
    try {
      await prisma.notification.create({
        data: {
          userId: 1, // Admin user
          type: 'GENERAL',
          title: 'Onboarding Invitation Sent',
          message: `Onboarding invitation sent to ${candidateName} for position ${position}.`,
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
          action: 'CREATE',
          module: 'ONBOARDING',
          newValues: submission as any,
        },
      });
    } catch {}

    return NextResponse.json(
      {
        ...submission,
        onboardingUrl,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating onboarding submission:', error);
    return NextResponse.json(
      { error: 'Failed to create onboarding submission' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    const submission = await (prisma.onboardingSubmission as any).findUnique({
      where: { token },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            empCode: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Onboarding submission not found' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (submission.tokenExpiresAt && new Date() > submission.tokenExpiresAt) {
      return NextResponse.json(
        { error: 'Onboarding link has expired' },
        { status: 410 }
      );
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error('Error fetching onboarding submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding submission' },
      { status: 500 }
    );
  }
}

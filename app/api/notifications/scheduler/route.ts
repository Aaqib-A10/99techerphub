import { NextResponse } from 'next/server';
import { runAllChecks } from '@/lib/services/notificationService';
import { getSessionUser } from '@/lib/auth';
import { UserRole } from '@prisma/client';

/**
 * Notification scheduler endpoint
 * Runs all notification checks and creates system notifications
 * Only accessible by ADMIN
 */
export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN can access scheduler' },
        { status: 403 }
      );
    }

    // Run all notification checks
    const results = await runAllChecks();

    return NextResponse.json(
      {
        success: true,
        message: 'Notification scheduler completed',
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Notification Scheduler]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

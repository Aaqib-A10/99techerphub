import { NextRequest, NextResponse } from 'next/server';
import { updateOnboardingTaskStatus } from '@/lib/services/onboardingService';
import { prisma } from '@/lib/prisma';

/**
 * PATCH — update a single onboarding task's status or notes.
 * Body: { status?: 'PENDING'|'DONE'|'SKIPPED', notes?: string, completedBy?: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const taskId = parseInt(params.taskId);
    const body = await request.json();

    const status = body.status as 'PENDING' | 'DONE' | 'SKIPPED' | undefined;
    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    await updateOnboardingTaskStatus(
      taskId,
      status,
      body.completedBy ? parseInt(body.completedBy) : undefined,
      body.notes
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'onboarding_tasks',
        recordId: taskId,
        action: 'UPDATE',
        newValues: { status, notes: body.notes },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/onboarding-tasks/:taskId]', error);
    return NextResponse.json(
      { error: 'Failed to update task', details: error?.message },
      { status: 500 }
    );
  }
}

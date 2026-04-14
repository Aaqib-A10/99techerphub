import { NextRequest, NextResponse } from 'next/server';
import {
  getOnboardingTasksForEmployee,
  seedOnboardingTasksForEmployee,
} from '@/lib/services/onboardingService';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(params.id);
    const tasks = await getOnboardingTasksForEmployee(employeeId);
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error('[GET /api/employees/:id/onboarding-tasks]', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST — manually seed (or re-seed if missing) the default checklist for an
 * employee. Useful for backfilling employees created before auto-seeding
 * was enabled.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(params.id);

    // Skip if tasks already exist for this employee.
    const existing = await getOnboardingTasksForEmployee(employeeId);
    if (existing.length > 0) {
      return NextResponse.json(
        { message: 'Checklist already exists', count: existing.length },
        { status: 200 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { dateOfJoining: true },
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const seeded = await seedOnboardingTasksForEmployee(
      employeeId,
      employee.dateOfJoining
    );
    return NextResponse.json({ seeded }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/employees/:id/onboarding-tasks]', error);
    return NextResponse.json(
      { error: 'Failed to seed onboarding tasks' },
      { status: 500 }
    );
  }
}

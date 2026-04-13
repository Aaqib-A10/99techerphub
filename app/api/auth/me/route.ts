import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch linked employee for display name / photo
    let employee = null;
    if (user.employeeId) {
      employee = await prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empCode: true,
          designation: true,
          photoUrl: true,
        },
      });
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          employee,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Auth/Me]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

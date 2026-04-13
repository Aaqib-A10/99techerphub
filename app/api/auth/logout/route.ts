import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, destroySession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Get current user for audit log
    const user = await getSessionUser();

    if (user) {
      // Log logout
      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'UPDATE',
          module: 'AUTH',
          changedById: user.id,
          newValues: { event: 'LOGOUT' },
        },
      });
    }

    // Destroy the DB session
    const token = req.cookies.get('99tech_session')?.value;
    if (token) {
      await destroySession(token);
    }

    // Create response and clear cookie
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );

    response.cookies.set('99tech_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Auth/Logout]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

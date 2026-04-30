import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, getSessionUser } from '@/lib/auth';

const MIN_PASSWORD_LEN = 8;
const SESSION_COOKIE = '99tech_session';

/**
 * POST /api/auth/set-password
 *
 * Self-service password change for the currently signed-in user.
 *
 * Two cases:
 *   1. User has a real bcrypt password — must supply `currentPassword`.
 *   2. User was auto-provisioned via SSO (`!sso_<random>` placeholder
 *      hash) — `currentPassword` is not required because there isn't one
 *      yet. After this, they can sign in with either Microsoft OR
 *      email + password.
 *
 * Side effects: revokes all OTHER active sessions for this user (forces
 * re-login on any other device) but keeps the current session valid so
 * the user doesn't get bounced to /login mid-flow.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;
    if (!newPassword || newPassword.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LEN} characters.` },
        { status: 400 },
      );
    }

    const isSsoPlaceholder = user.passwordHash.startsWith('!sso_');

    if (!isSsoPlaceholder) {
      // Existing real password — verify the caller knows it.
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change your password.' },
          { status: 400 },
        );
      }
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        await prisma.auditLog.create({
          data: {
            tableName: 'users',
            recordId: user.id,
            action: 'UPDATE',
            module: 'AUTH',
            changedById: user.id,
            newValues: { event: 'SET_PASSWORD_FAILED', reason: 'WRONG_CURRENT' },
          },
        });
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 400 },
        );
      }
    }

    const newHash = await hashPassword(newPassword);
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE)?.value ?? '__never_match__';

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      // Drop everyone else's sessions for this user — keep the current
      // session so the page that called us doesn't blow up on the next
      // request.
      prisma.session.deleteMany({
        where: { userId: user.id, NOT: { token: currentToken } },
      }),
      prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'UPDATE',
          module: 'AUTH',
          changedById: user.id,
          newValues: {
            event: isSsoPlaceholder ? 'PASSWORD_FIRST_SET' : 'PASSWORD_CHANGED',
            email: user.email,
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      // Helpful hint the UI can use to swap the messaging after success.
      wasSsoOnly: isSsoPlaceholder,
    });
  } catch (err: any) {
    console.error('[set-password]', err?.message ?? err);
    return NextResponse.json(
      { error: 'Could not update password. Try again in a moment.' },
      { status: 500 },
    );
  }
}

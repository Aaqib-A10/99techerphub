import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const CONFIRM_RATE_LIMIT = { maxAttempts: 10, windowMs: 60_000 };
const MIN_PASSWORD_LEN = 8;

/**
 * POST /api/auth/password-reset/confirm — set a new password using a token.
 *
 * On success: replaces passwordHash (including SSO-only `!sso_*` hashes,
 * which is how SSO-provisioned users can opt into email/password sign-in
 * after the fact). Clears the reset token and revokes all active sessions
 * for that user, forcing a fresh login with the new password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const rl = checkRateLimit(`reset-confirm:${ip}`, CONFIRM_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    let body: { token?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { token, password } = body;
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` },
        { status: 400 },
      );
    }

    const user = await (prisma.user as any).findUnique({
      where: { passwordResetToken: token },
      select: {
        id: true,
        email: true,
        isActive: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Request a new one.' },
        { status: 400 },
      );
    }
    if (!user.isActive) {
      return NextResponse.json({ error: 'This account is inactive.' }, { status: 400 });
    }

    const newHash = await hashPassword(password);

    await prisma.$transaction([
      (prisma.user as any).update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'UPDATE',
          module: 'AUTH',
          changedById: user.id,
          newValues: { event: 'PASSWORD_RESET_CONFIRM', email: user.email },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[password-reset/confirm]', err?.message ?? err);
    return NextResponse.json(
      { error: 'Could not reset password. Try requesting a new link.' },
      { status: 500 },
    );
  }
}

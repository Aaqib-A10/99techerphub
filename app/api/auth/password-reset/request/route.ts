import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/services/emailService';
import { checkRateLimit } from '@/lib/rate-limit';

const RESET_RATE_LIMIT = { maxAttempts: 3, windowMs: 15 * 60_000 }; // 3 / 15 min per IP
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/auth/password-reset/request — start a password reset.
 *
 * Returns 200 on every "valid-shaped" request, regardless of whether the
 * email matches a real user. This prevents email-enumeration attacks
 * (an attacker probing which emails are registered). The audit log keeps
 * the real outcome for ops.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const rl = checkRateLimit(`reset:${ip}`, RESET_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many reset attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const email = (body.email ?? '').toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always log the attempt — useful for ops, doesn't leak to caller.
  await prisma.auditLog
    .create({
      data: {
        tableName: 'users',
        recordId: user?.id ?? 0,
        action: 'CREATE',
        module: 'AUTH',
        newValues: {
          event: 'PASSWORD_RESET_REQUEST',
          email,
          status: !user ? 'NO_USER' : !user.isActive ? 'INACTIVE' : 'SENT',
        },
      },
    })
    .catch(() => {});

  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Reset your 99 Tech ERP password',
        templateKey: 'PASSWORD_RESET',
        bodyHtml: `
          <p>Hi,</p>
          <p>Someone requested a password reset for your 99 Tech ERP account
          (<strong>${email}</strong>). If that was you, click the link below
          to set a new password — it's good for one hour.</p>
          <p><a href="${resetUrl}" style="display:inline-block;background:#0B1F3A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Set new password</a></p>
          <p>Or paste this URL into your browser:<br/><code>${resetUrl}</code></p>
          <p>If you didn't request this, you can safely ignore this email — no changes will be made to your account.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">— 99 Technologies</p>
        `,
      });
    } catch (e: any) {
      console.error('[password-reset/request] email send failed:', e?.message ?? e);
      // Still return 200 — don't surface email infra issues to the caller.
    }
  }

  return NextResponse.json({ ok: true });
}

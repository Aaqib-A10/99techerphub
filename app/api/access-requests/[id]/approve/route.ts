import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { createNotification } from '@/lib/services/notificationService';
import { sendEmail } from '@/lib/services/emailService';

// Approve an access request → flips the request to APPROVED and
// creates the corresponding DigitalAccess record so the employee
// immediately shows up as having access. Optional accountId/notes
// from the body are stored on the new DigitalAccess row.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'HR'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const accountId: string | null =
    typeof body?.accountId === 'string' ? body.accountId.trim() || null : null;
  // Two distinct fields now:
  //   internalNotes   — admin-only context, stored on DigitalAccess.notes
  //   credentialMessage — what the requester reads in the approval email,
  //                        stored on DigitalAccessRequest.reviewNotes
  // Old `reviewNotes` keys are still accepted as a fallback so older
  // clients (or anyone calling the API directly) don't break.
  const internalNotes: string | null =
    typeof body?.internalNotes === 'string'
      ? body.internalNotes.trim() || null
      : typeof body?.reviewNotes === 'string'
        ? body.reviewNotes.trim() || null
        : null;
  const credentialMessage: string | null =
    typeof body?.credentialMessage === 'string'
      ? body.credentialMessage.trim() || null
      : null;

  const existing = await prisma.digitalAccessRequest.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          user: { select: { id: true, email: true } },
        },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Request is already ${existing.status.toLowerCase()}.` },
      { status: 409 },
    );
  }

  // Approve + grant access in one transaction so we never leave the
  // request approved without the corresponding DigitalAccess row.
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.digitalAccessRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: user.id,
        // The requester-facing message is what we keep on the request
        // row so the audit trail shows what the employee was told.
        reviewNotes: credentialMessage,
      },
    });
    const access = await tx.digitalAccess.create({
      data: {
        employeeId: existing.employeeId,
        serviceName: existing.service.name,
        accountId,
        // Admin-only context lives here — never shown to the requester.
        notes: internalNotes,
      },
    });
    return { updated, access };
  });

  // Notify the requester via in-app + email. Both are best-effort —
  // failures here don't undo the approval.
  try {
    if (existing.employee.user) {
      await createNotification({
        userId: existing.employee.user.id,
        type: 'GENERAL',
        title: 'Access request approved',
        message: `Your request for ${existing.service.name} was approved. Check your dashboard for the credentials.`,
        link: '/access-catalog',
      });
    }
  } catch (err) {
    console.warn('[access-requests/approve] notification failed:', err);
  }

  const inboxAddress = existing.employee.user?.email ?? existing.employee.email;
  if (inboxAddress) {
    try {
      // Email body uses ONLY the credential-sharing message (what the
      // admin chose to tell the requester). Internal notes never leak.
      // newlines → <br> so the admin's bullet-style text formats nicely.
      const credentialBlock = credentialMessage
        ? `<p style="color:#5A6159;margin:12px 0 0;font-size:13px"><strong>How to get in:</strong><br>${escapeHtml(credentialMessage).replace(/\n/g, '<br>')}</p>`
        : '';
      const accountBlock = accountId
        ? `<p style="color:#5A6159;margin:12px 0 0;font-size:13px"><strong>Account ID:</strong> ${escapeHtml(accountId)}</p>`
        : '';
      await sendEmail({
        to: inboxAddress,
        subject: `Access approved: ${existing.service.name}`,
        bodyHtml: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1F2320;font-size:14px;line-height:1.5;max-width:560px">
            <p style="margin:0 0 12px">Hi ${escapeHtml(existing.employee.firstName)},</p>
            <p style="margin:0 0 12px">Your request for access to <strong>${escapeHtml(existing.service.name)}</strong> has been approved.</p>
            ${accountBlock}
            ${credentialBlock}
            <p style="margin:18px 0 0">
              <a href="${publicAppUrl(request)}/access-catalog" style="background:#1F2320;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;display:inline-block">View in catalog</a>
            </p>
            <p style="color:#8B918A;font-size:11.5px;margin-top:24px">— 99Core</p>
          </div>
        `,
        templateKey: 'ACCESS_REQUEST_APPROVED',
      });
    } catch (err) {
      console.warn('[access-requests/approve] email failed:', err);
    }
  }

  return NextResponse.json(result);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicAppUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const xfh = req.headers.get('x-forwarded-host');
  if (xfh) return `${proto}://${xfh}`;
  const host = req.headers.get('host');
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

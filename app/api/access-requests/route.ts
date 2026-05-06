import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  createNotification,
  createNotificationsForRole,
} from '@/lib/services/notificationService';
import { sendEmail } from '@/lib/services/emailService';

// GET — admin/HR view returns all requests; employees see only their own.
// Filter by ?status=PENDING|APPROVED|REJECTED|CANCELLED.
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  const isAdminView = ['ADMIN', 'HR'].includes(user.role);
  const where: any = {};
  if (statusFilter) where.status = statusFilter;
  if (!isAdminView) {
    if (!user.employeeId) {
      return NextResponse.json([]);
    }
    where.employeeId = user.employeeId;
  }

  const requests = await prisma.digitalAccessRequest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empCode: true,
          email: true,
          designation: true,
          department: { select: { id: true, name: true } },
        },
      },
      service: {
        select: { id: true, name: true, category: true, defaultPlan: true },
      },
      reviewer: { select: { id: true, email: true } },
      sendTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          empCode: true,
          designation: true,
        },
      },
    },
  });

  return NextResponse.json(requests);
}

// POST — employee submits a request. Hard-wires the requesting
// employeeId to the caller's session so a malicious payload can't pin
// the request on someone else.
export async function POST(request: NextRequest) {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json(
      { error: 'Your user account is not linked to an employee record.' },
      { status: 400 },
    );
  }

  const body = await request.json();
  const serviceId = parseInt(body?.serviceId);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  }
  const notes: string | null = typeof body?.notes === 'string' ? body.notes.trim() || null : null;
  // Optional explicit approver from the modal's "Send to" picker.
  // Null = use the standard fan-out (admins + service owner + manager).
  const sendToEmployeeId =
    body?.sendToEmployeeId == null
      ? null
      : Number.isFinite(parseInt(body.sendToEmployeeId))
        ? parseInt(body.sendToEmployeeId)
        : null;

  // Block duplicate pending requests against the same service.
  const existing = await prisma.digitalAccessRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      serviceId,
      status: 'PENDING',
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a pending request for this service.' },
      { status: 409 },
    );
  }

  // Block requests for services the employee already has active access to.
  const service = await prisma.digitalService.findUnique({
    where: { id: serviceId },
    include: {
      owner: {
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
  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }
  const alreadyHas = await prisma.digitalAccess.findFirst({
    where: { employeeId: user.employeeId, serviceName: service.name, isActive: true },
  });
  if (alreadyHas) {
    return NextResponse.json(
      { error: 'You already have active access to this service.' },
      { status: 409 },
    );
  }

  const requesterEmployee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: {
      firstName: true,
      lastName: true,
      empCode: true,
      email: true,
      designation: true,
      department: { select: { name: true } },
      reportingManager: {
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
  if (!requesterEmployee) {
    return NextResponse.json(
      { error: 'Could not find your employee record.' },
      { status: 400 },
    );
  }

  // If the requester picked an explicit approver, look them up so we
  // can include them in notifications. Soft-validate — if the picked
  // employee no longer exists or has no user account, fall back to
  // standard fan-out rather than 4xx'ing the requester.
  let sendToEmployee: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    user: { id: number; email: string } | null;
  } | null = null;
  if (sendToEmployeeId != null && sendToEmployeeId !== user.employeeId) {
    sendToEmployee = await prisma.employee.findUnique({
      where: { id: sendToEmployeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        user: { select: { id: true, email: true } },
      },
    });
  }

  const created = await prisma.digitalAccessRequest.create({
    data: {
      employeeId: user.employeeId,
      serviceId,
      notes,
      sendToEmployeeId: sendToEmployee?.id ?? null,
    },
  });

  // -- Recipients ---------------------------------------------------------
  // Service owner > reporting manager > all admins. We collect each set
  // separately so we can deduplicate before sending and so the email
  // greeting can be tailored.
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, email: true },
  });

  const ownerUser = service.owner?.user ?? null;
  const managerUser = requesterEmployee.reportingManager?.user ?? null;
  const sendToUser = sendToEmployee?.user ?? null;

  const inAppRecipientIds = new Set<number>();
  // The picked approver always takes the primary slot. Admins remain
  // CC'd for oversight — they were getting the original fan-out and
  // removing them would silently break audit visibility.
  if (sendToUser?.id) inAppRecipientIds.add(sendToUser.id);
  for (const u of adminUsers) inAppRecipientIds.add(u.id);
  if (ownerUser?.id) inAppRecipientIds.add(ownerUser.id);
  if (managerUser?.id) inAppRecipientIds.add(managerUser.id);

  const emailRecipients = new Set<string>();
  if (sendToUser?.email) emailRecipients.add(sendToUser.email);
  else if (sendToEmployee?.email) emailRecipients.add(sendToEmployee.email);
  for (const u of adminUsers) if (u.email) emailRecipients.add(u.email);
  if (ownerUser?.email) emailRecipients.add(ownerUser.email);
  else if (service.owner?.email) emailRecipients.add(service.owner.email);
  if (managerUser?.email) emailRecipients.add(managerUser.email);
  else if (requesterEmployee.reportingManager?.email)
    emailRecipients.add(requesterEmployee.reportingManager.email);

  // -- In-app notifications ----------------------------------------------
  try {
    const title = 'New Digital Access Request';
    const message = `${requesterEmployee.firstName} ${requesterEmployee.lastName} (${requesterEmployee.empCode}) requested access to ${service.name}.`;
    const link = '/access-requests';
    if (inAppRecipientIds.size === 0) {
      // Fallback: at least all admins
      await createNotificationsForRole('ADMIN', {
        type: 'GENERAL',
        title,
        message,
        link,
      });
    } else {
      await Promise.all(
        Array.from(inAppRecipientIds).map((userId) =>
          createNotification({
            userId,
            type: 'GENERAL',
            title,
            message,
            link,
          }),
        ),
      );
    }
  } catch (err) {
    console.warn('[access-requests/POST] in-app fan-out failed:', err);
  }

  // -- Email --------------------------------------------------------------
  // Best-effort. If SMTP is misconfigured we still log to the email log
  // file via the stub transport — the request itself is unaffected.
  if (emailRecipients.size > 0) {
    try {
      const requesterName = `${requesterEmployee.firstName} ${requesterEmployee.lastName}`;
      const subject = `[Access Request] ${requesterName} wants ${service.name}`;
      const reasonBlock = notes
        ? `<p style="color:#5A6159;margin:8px 0 0;font-size:13px"><strong>Reason given:</strong><br>${escapeHtml(notes)}</p>`
        : '';
      const bodyHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1F2320;font-size:14px;line-height:1.5;max-width:560px">
          <p style="margin:0 0 12px"><strong>${escapeHtml(requesterName)}</strong> (${escapeHtml(requesterEmployee.empCode)}) has requested access to <strong>${escapeHtml(service.name)}</strong>.</p>
          <table style="border-collapse:collapse;font-size:13px;margin:8px 0">
            <tr><td style="padding:2px 12px 2px 0;color:#5A6159">Department</td><td>${escapeHtml(requesterEmployee.department?.name ?? '—')}</td></tr>
            <tr><td style="padding:2px 12px 2px 0;color:#5A6159">Designation</td><td>${escapeHtml(requesterEmployee.designation ?? '—')}</td></tr>
            <tr><td style="padding:2px 12px 2px 0;color:#5A6159">Service</td><td>${escapeHtml(service.name)}${service.defaultPlan ? ` · ${escapeHtml(service.defaultPlan)}` : ''}</td></tr>
          </table>
          ${reasonBlock}
          <p style="margin:18px 0 0">
            <a href="${escapeHtml(publicAppUrl(request))}/access-requests" style="background:#1F2320;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;display:inline-block">Review request</a>
          </p>
          <p style="color:#8B918A;font-size:11.5px;margin-top:24px">Sent by 99Core. You're getting this because you are an admin, the service owner, or the requester's reporting manager.</p>
        </div>
      `;
      await sendEmail({
        to: Array.from(emailRecipients),
        subject,
        bodyHtml,
        templateKey: 'ACCESS_REQUEST_SUBMITTED',
      });
    } catch (err) {
      console.warn('[access-requests/POST] email fan-out failed:', err);
    }
  }

  return NextResponse.json(
    {
      ...created,
      employee: {
        firstName: requesterEmployee.firstName,
        lastName: requesterEmployee.lastName,
        empCode: requesterEmployee.empCode,
      },
      service: { name: service.name },
    },
    { status: 201 },
  );
  } catch (err: any) {
    // Without this catch a Prisma / runtime error returns an empty body
    // and the modal shows "Unexpected end of JSON input" instead of the
    // real cause. Surface a useful message instead.
    console.error('[access-requests/POST]', err);
    const msg = err?.message ?? 'Unexpected error';
    // Hint for the most common deploy-step gotcha — missing column from
    // the latest schema push.
    const hint = /Unknown\s+arg|column .* does not exist|sendToEmployeeId/i.test(
      String(msg),
    )
      ? ' (Run `npx prisma db push && pm2 restart 99tech-erp` on the server.)'
      : '';
    return NextResponse.json(
      { error: `Submit failed: ${msg}${hint}` },
      { status: 500 },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicAppUrl(request: NextRequest): string {
  // Same prefer-explicit-then-headers pattern the QR endpoint uses, so
  // CTA buttons in emails always land on the public domain.
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return fromEnv;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const xfh = request.headers.get('x-forwarded-host');
  if (xfh) return `${proto}://${xfh}`;
  const host = request.headers.get('host');
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

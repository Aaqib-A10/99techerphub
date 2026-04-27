import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import {
  OAuthProvider,
  exchangeCodeForToken,
  getUserProfile,
  canAutoProvision,
  isSsoEnabled,
} from '@/lib/oauth';

const STATE_COOKIE = 'oauth_state';
const VALID_PROVIDERS: OAuthProvider[] = ['google', 'microsoft'];

const FALLBACK_FAILURE_URL = '/login?error=sso_failed';

/**
 * Compute the public-facing origin (e.g. https://99techerp.com) so any
 * redirects we emit don't leak the internal localhost:3000 that nginx
 * proxies to. Prefers OAUTH_REDIRECT_BASE_URL, then x-forwarded-host,
 * and only falls back to req.nextUrl as a last resort.
 */
function publicOrigin(req: NextRequest): string {
  const envBase = process.env.OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, '');
  if (envBase) return envBase;
  const xfHost = req.headers.get('x-forwarded-host');
  const xfProto = req.headers.get('x-forwarded-proto') || 'https';
  if (xfHost) return `${xfProto}://${xfHost}`;
  return req.nextUrl.origin;
}

/**
 * Build a redirect to the login page with a specific error code in the URL.
 * The login page can map known codes to friendlier messages.
 */
function loginError(req: NextRequest, code: string) {
  const url = new URL('/login', publicOrigin(req));
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
}

/**
 * Audit-log a login event without breaking the response if it fails.
 */
async function audit(
  event: string,
  email: string | null,
  userId: number | null,
  reason?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: 'users',
        recordId: userId ?? 0,
        action: userId ? 'UPDATE' : 'CREATE',
        module: 'AUTH',
        changedById: userId ?? null,
        newValues: { event, email, reason: reason ?? null },
      },
    });
  } catch {
    // never throw from audit
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  if (!isSsoEnabled()) {
    return NextResponse.redirect(new URL(FALLBACK_FAILURE_URL, req.url));
  }

  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return loginError(req, 'sso_unknown_provider');
  }

  // 1. Validate state (CSRF)
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (errorParam) {
    return loginError(req, 'sso_provider_denied');
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return loginError(req, 'sso_state_mismatch');
  }

  // 2. Exchange code -> access token
  let accessToken: string;
  try {
    const tokens = await exchangeCodeForToken(provider, code);
    accessToken = tokens.accessToken;
  } catch (err) {
    console.error('[SSO/callback] token exchange failed', err);
    return loginError(req, 'sso_token_exchange_failed');
  }

  // 3. Fetch user profile
  let profile;
  try {
    profile = await getUserProfile(provider, accessToken);
  } catch (err) {
    console.error('[SSO/callback] profile fetch failed', err);
    return loginError(req, 'sso_profile_failed');
  }

  const email = profile.email.toLowerCase();

  // 4. Find or create User
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Need to auto-provision — only allowed if email is in the work domain
    if (!canAutoProvision(email)) {
      await audit('FAILED_LOGIN', email, null, 'NO_USER_AND_DOMAIN_NOT_ALLOWED');
      return loginError(req, 'sso_no_account');
    }
    // Match to an Employee record by email
    const employee = await prisma.employee.findFirst({
      where: { email },
      select: { id: true, isActive: true },
    });
    if (!employee || !employee.isActive) {
      await audit('FAILED_LOGIN', email, null, 'NO_MATCHING_EMPLOYEE');
      return loginError(req, 'sso_no_employee');
    }
    // Create the user. passwordHash gets a random un-loginable value.
    const randomHash = '!sso_' + Math.random().toString(36).slice(2)
      + Math.random().toString(36).slice(2);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: randomHash, // intentionally not a valid bcrypt hash
        role: 'EMPLOYEE',
        employeeId: employee.id,
        isActive: true,
      },
    });
    await audit('USER_PROVISIONED', email, user.id, `via_${provider}`);
  }

  if (!user.isActive) {
    await audit('FAILED_LOGIN', email, user.id, 'INACTIVE_USER');
    return loginError(req, 'sso_inactive');
  }

  // 5. Create session
  const token = await createSession(user.id);

  // 6. Update lastLoginAt + audit
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await audit('LOGIN', email, user.id, `via_${provider}`);

  // 7. Redirect home with session cookie set
  const isHttps = req.headers.get('x-forwarded-proto') === 'https'
    || req.nextUrl.protocol === 'https:';
  const response = NextResponse.redirect(new URL('/', publicOrigin(req)));
  response.cookies.set('99tech_session', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  // Clear the state cookie
  response.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  OAuthProvider,
  buildAuthorizationUrl,
  isSsoEnabled,
} from '@/lib/oauth';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_SECONDS = 600; // 10 minutes

const VALID_PROVIDERS: OAuthProvider[] = ['google', 'microsoft'];

/**
 * GET /api/auth/oauth/[provider]/start
 *
 * Generates a CSRF state, stores it in an httpOnly cookie, and redirects
 * the user to the provider's authorization URL.
 *
 * 404s if SSO_ENABLED != '1' so the route can be deployed dark.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  if (!isSsoEnabled()) {
    return NextResponse.json({ error: 'SSO not enabled' }, { status: 404 });
  }

  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  let url: string;
  let state: string;
  try {
    state = crypto.randomBytes(24).toString('hex');
    url = buildAuthorizationUrl(provider, state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OAuth misconfigured' },
      { status: 500 }
    );
  }

  const isHttps = req.headers.get('x-forwarded-proto') === 'https'
    || req.nextUrl.protocol === 'https:';

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: '/',
  });
  return response;
}

import { NextResponse } from 'next/server';
import { isSsoEnabled } from '@/lib/oauth';

/**
 * Public endpoint — returns whether SSO is currently enabled and which
 * providers are configured. The login page reads this to decide whether
 * to render SSO buttons. No secrets are exposed.
 */
export async function GET() {
  const enabled = isSsoEnabled();
  return NextResponse.json({
    enabled,
    providers: enabled
      ? {
          google: Boolean(process.env.GOOGLE_CLIENT_ID),
          microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID),
        }
      : { google: false, microsoft: false },
  });
}

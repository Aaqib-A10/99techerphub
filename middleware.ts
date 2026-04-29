import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware for route protection
 * Runs at the edge before requests reach the app
 *
 * Note: We can't import Prisma here (runs in Edge runtime).
 * We do lightweight cookie parsing to protect routes,
 * and let server components do full verification.
 */

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/onboarding', // Onboarding form (token-based)
  '/api/auth', // Auth endpoints
];

// Cloudflare's Rocket Loader and Auto Minify rewrite script tags in ways
// that break React's synthetic-event delegation — mouse clicks reach the
// DOM but never fire React handlers, so the entire app feels frozen on
// production behind CF. We can't reach the CF dashboard, so we send
// no-transform via three headers belt-and-suspenders style:
//   - CDN-Cache-Control: CF-specific, never overwritten by Next.js
//   - Cloudflare-CDN-Cache-Control: legacy CF header, still honored
//   - Cache-Control append: kept for completeness even though the page-
//     level `dynamic = 'force-dynamic'` directive will replace it
function withNoTransform(res: NextResponse): NextResponse {
  res.headers.set('CDN-Cache-Control', 'no-transform');
  res.headers.set('Cloudflare-CDN-Cache-Control', 'no-transform');
  res.headers.append('Cache-Control', 'no-transform');
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return withNoTransform(NextResponse.next());
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('99tech_session')?.value;

  if (!sessionToken) {
    // No session, redirect to login for web pages
    if (!pathname.startsWith('/api/')) {
      return withNoTransform(NextResponse.redirect(new URL('/login', request.url)));
    }
    // For API routes, return 401
    return withNoTransform(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  // Session exists, allow request
  // Server components will verify the session is valid and user has permissions
  return withNoTransform(NextResponse.next());
}

export const config = {
  matcher: [
    // Protect all routes except public ones
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

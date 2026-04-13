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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth enforcement is OPT-IN via env variable during development.
  // Set AUTH_ENFORCE=1 in .env to enable strict route protection.
  // While disabled, all routes are accessible without a session cookie so
  // existing pages continue to work and the auth system can be tested incrementally.
  if (process.env.AUTH_ENFORCE !== '1') {
    return NextResponse.next();
  }

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('99tech_session')?.value;

  if (!sessionToken) {
    // No session, redirect to login for web pages
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // For API routes, return 401
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Session exists, allow request
  // Server components will verify the session is valid and user has permissions
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all routes except public ones
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

import { prisma } from '@/lib/prisma';
import { User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = '99tech_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Password Helpers ───────────────────────────────

/**
 * Hash a password using bcryptjs (12 rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Session Helpers ────────────────────────────────

/**
 * Generate a cryptographically secure session token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session in the database and return the token.
 * The DB write is awaited so the caller never receives a token
 * that doesn't exist in the database.
 */
export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({ data: { userId, token, expiresAt } });

  return token;
}

/**
 * Get the current user from the session cookie.
 *
 * Dev fallback: when AUTH_ENFORCE is not '1', returns the first active
 * ADMIN user so API routes work without a real login.
 */
export async function getSessionUser(): Promise<(User & { role: UserRole }) | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    // Look up session in DB
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (session) {
      // Check expiry
      if (session.expiresAt < new Date()) {
        // Expired — clean up
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      } else if (session.user.isActive) {
        return session.user;
      } else {
        // Inactive user — clean up session
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    }
  }

  // Dev fallback — return first ADMIN when auth enforcement is off
  // ONLY allowed in development mode to prevent accidental production bypass
  if (process.env.NODE_ENV === 'development' && process.env.AUTH_ENFORCE !== '1') {
    const fallback = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { id: 'asc' },
    });
    if (fallback) return fallback;
  }

  return null;
}

/**
 * Require the current user to have one of the specified roles.
 * Throws if not authenticated or role doesn't match.
 */
export async function requireRole(roles: UserRole[]): Promise<User & { role: UserRole }> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error('Unauthorized: No session');
  }

  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: Required roles: ${roles.join(', ')}`);
  }

  return user;
}

/**
 * Set the session cookie on the response
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Destroy a session by token (used at logout)
 */
export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } }).catch(() => {});
}

/**
 * Destroy all sessions for a given user
 */
export async function destroyAllUserSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

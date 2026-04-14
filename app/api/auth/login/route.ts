import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

// 5 login attempts per IP per 60-second window
const LOGIN_RATE_LIMIT = { maxAttempts: 5, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  try {
    // Rate-limit by IP address
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const rateLimitResult = checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rateLimitResult.retryAfterMs / 1000)) },
        }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Log failed login attempt
      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: 0,
          action: 'CREATE',
          module: 'AUTH',
          newValues: { event: 'FAILED_LOGIN', email, reason: 'USER_NOT_FOUND' },
        },
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      // Log failed login for inactive user
      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'CREATE',
          module: 'AUTH',
          changedById: user.id,
          newValues: { event: 'FAILED_LOGIN', email, reason: 'INACTIVE_USER' },
        },
      });

      return NextResponse.json(
        { error: 'This account is inactive' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      // Log failed login attempt
      await prisma.auditLog.create({
        data: {
          tableName: 'users',
          recordId: user.id,
          action: 'CREATE',
          module: 'AUTH',
          changedById: user.id,
          newValues: { event: 'FAILED_LOGIN', email, reason: 'INVALID_PASSWORD' },
        },
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session (persisted to DB via lib/auth)
    const token = await createSession(user.id);

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login
    await prisma.auditLog.create({
      data: {
        tableName: 'users',
        recordId: user.id,
        action: 'UPDATE',
        module: 'AUTH',
        changedById: user.id,
        newValues: { event: 'LOGIN', email, role: user.role },
      },
    });

    // Set session cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );

    // Set the session cookie
    // Only set Secure flag when served over HTTPS (not just production mode)
    const isHttps = req.headers.get('x-forwarded-proto') === 'https'
      || req.nextUrl.protocol === 'https:';
    response.cookies.set('99tech_session', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Auth/Login]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

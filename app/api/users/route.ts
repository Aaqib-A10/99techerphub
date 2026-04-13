import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, hashPassword } from '@/lib/auth';
import { UserRole } from '@prisma/client';

/**
 * GET /api/users — List all users (ADMIN only)
 */
export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        employeeId: true,
        createdAt: true,
        employee: {
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

    return NextResponse.json(users);
  } catch (error: any) {
    if (error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[Users/GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/users — Create a new user (ADMIN only)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole([UserRole.ADMIN]);

    const body = await req.json();
    const { email, password, role, employeeId } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // If employeeId provided, validate it exists and isn't already linked
    if (employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      const linkedUser = await prisma.user.findUnique({ where: { employeeId } });
      if (linkedUser) {
        return NextResponse.json(
          { error: 'This employee is already linked to another user account' },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role,
        employeeId: employeeId || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        createdAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, empCode: true },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'users',
        recordId: newUser.id,
        action: 'CREATE',
        module: 'AUTH',
        changedById: admin.id,
        newValues: { email: newUser.email, role: newUser.role, employeeId: newUser.employeeId },
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    if (error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[Users/POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

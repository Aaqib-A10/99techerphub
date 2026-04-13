import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, hashPassword, destroyAllUserSessions } from '@/lib/auth';
import { UserRole } from '@prisma/client';

/**
 * PATCH /api/users/:id — Update a user (ADMIN only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireRole([UserRole.ADMIN]);
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { role, isActive, password, employeeId } = body;

    const updateData: any = {};
    const oldValues: any = {};

    // Update role
    if (role && role !== user.role) {
      const validRoles: UserRole[] = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'ACCOUNTANT'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      oldValues.role = user.role;
      updateData.role = role;
    }

    // Toggle active status
    if (typeof isActive === 'boolean' && isActive !== user.isActive) {
      oldValues.isActive = user.isActive;
      updateData.isActive = isActive;

      // If deactivating, destroy all sessions
      if (!isActive) {
        await destroyAllUserSessions(userId);
      }
    }

    // Reset password
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(password);
      // Destroy all sessions so user must re-login with new password
      await destroyAllUserSessions(userId);
    }

    // Link/unlink employee
    if (employeeId !== undefined) {
      if (employeeId === null) {
        oldValues.employeeId = user.employeeId;
        updateData.employeeId = null;
      } else {
        const empId = parseInt(employeeId);
        // Check employee exists
        const emp = await prisma.employee.findUnique({ where: { id: empId } });
        if (!emp) {
          return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        // Check not linked to another user
        const linkedUser = await prisma.user.findUnique({ where: { employeeId: empId } });
        if (linkedUser && linkedUser.id !== userId) {
          return NextResponse.json(
            { error: 'Employee already linked to another user' },
            { status: 409 }
          );
        }
        oldValues.employeeId = user.employeeId;
        updateData.employeeId = empId;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        employeeId: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, empCode: true, designation: true },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'users',
        recordId: userId,
        action: 'UPDATE',
        module: 'AUTH',
        changedById: admin.id,
        oldValues,
        newValues: updateData,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[Users/PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

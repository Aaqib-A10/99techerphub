import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    const data = await request.json();

    const oldDepartment = await prisma.department.findUnique({
      where: { id },
    });

    if (!oldDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: {
        isActive: data.isActive !== undefined ? data.isActive : oldDepartment.isActive,
        name: data.name || oldDepartment.name,
        code: data.code || oldDepartment.code,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'departments',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: oldDepartment,
        newValues: updatedDepartment,
      },
    });

    return NextResponse.json(updatedDepartment);
  } catch (error: any) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);

    const department = await prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Soft delete - mark as inactive instead of deleting
    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'departments',
        recordId: id,
        action: 'DELETE',
        module: 'MASTER_DATA',
        oldValues: department,
      },
    });

    return NextResponse.json(updatedDepartment);
  } catch (error: any) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}

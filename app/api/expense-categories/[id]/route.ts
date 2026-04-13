import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();

    const oldCategory = await prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!oldCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updatedCategory = await prisma.expenseCategory.update({
      where: { id },
      data: {
        code: data.code || oldCategory.code,
        name: data.name || oldCategory.name,
        description: data.description !== undefined ? data.description : oldCategory.description,
        isGlobal: data.isGlobal !== undefined ? data.isGlobal : oldCategory.isGlobal,
        departmentId: data.departmentId !== undefined ? data.departmentId : oldCategory.departmentId,
        isActive: data.isActive !== undefined ? data.isActive : oldCategory.isActive,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'expense_categories',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: oldCategory,
        newValues: updatedCategory,
      },
    });

    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    console.error('Error updating expense category:', error);
    return NextResponse.json(
      { error: 'Failed to update expense category', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    const category = await prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Soft delete - mark as inactive
    const updatedCategory = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'expense_categories',
        recordId: id,
        action: 'DELETE',
        module: 'MASTER_DATA',
        oldValues: category,
      },
    });

    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    console.error('Error deleting expense category:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense category', details: error?.message },
      { status: 500 }
    );
  }
}

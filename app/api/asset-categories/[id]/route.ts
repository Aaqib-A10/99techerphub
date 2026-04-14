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

    const oldCategory = await prisma.assetCategory.findUnique({
      where: { id },
    });

    if (!oldCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updatedCategory = await prisma.assetCategory.update({
      where: { id },
      data: {
        code: data.code || oldCategory.code,
        name: data.name || oldCategory.name,
        description: data.description !== undefined ? data.description : oldCategory.description,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'asset_categories',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: oldCategory,
        newValues: updatedCategory,
      },
    });

    return NextResponse.json(updatedCategory);
  } catch (error: any) {
    console.error('Error updating asset category:', error);
    return NextResponse.json(
      { error: 'Failed to update asset category' },
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

    const category = await prisma.assetCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Hard delete category
    await prisma.assetCategory.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'asset_categories',
        recordId: id,
        action: 'DELETE',
        module: 'MASTER_DATA',
        oldValues: category,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting asset category:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset category' },
      { status: 500 }
    );
  }
}

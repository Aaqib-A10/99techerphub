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

    const oldCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!oldCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: {
        isActive: data.isActive !== undefined ? data.isActive : oldCompany.isActive,
        name: data.name || oldCompany.name,
        country: data.country || oldCompany.country,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'companies',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: oldCompany,
        newValues: updatedCompany,
      },
    });

    return NextResponse.json(updatedCompany);
  } catch (error: any) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { error: 'Failed to update company' },
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

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Soft delete - mark as inactive instead of deleting
    const updatedCompany = await prisma.company.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'companies',
        recordId: id,
        action: 'DELETE',
        module: 'MASTER_DATA',
        oldValues: company,
      },
    });

    return NextResponse.json(updatedCompany);
  } catch (error: any) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    );
  }
}

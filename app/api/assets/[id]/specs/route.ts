import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = parseInt(params.id);
    const { specs } = await request.json();

    // Fetch old values for audit
    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { specs: true },
    });

    if (!oldAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { specs },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'assets',
        recordId: assetId,
        action: 'UPDATE',
        oldValues: { specs: oldAsset.specs },
        newValues: { specs },
      },
    });

    return NextResponse.json(updatedAsset);
  } catch (error: any) {
    console.error('Error updating specs:', error);
    return NextResponse.json(
      { error: 'Failed to update specifications', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

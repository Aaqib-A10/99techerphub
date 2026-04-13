import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = parseInt(params.id);
    const data = await request.json();

    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!oldAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Update asset to retired status
    const retiredAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        isRetired: true,
        retiredDate: new Date(),
        isAssigned: false,
        condition: 'RETIRED',
        notes: (oldAsset.notes || '') + `\n[RETIRED: ${data.reason || 'No reason provided'}]`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'assets',
        recordId: assetId,
        action: 'UPDATE',
        oldValues: oldAsset,
        newValues: retiredAsset,
      },
    });

    return NextResponse.json(retiredAsset);
  } catch (error) {
    console.error('Error retiring asset:', error);
    return NextResponse.json(
      { error: 'Failed to retire asset' },
      { status: 500 }
    );
  }
}

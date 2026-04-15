import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (oldAsset.companyId && !ctx.companyIds.includes(oldAsset.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Wrap core mutations in a transaction
    const retiredAsset = await prisma.$transaction(async (tx) => {
      // Update asset to retired status
      const retiredAsset = await tx.asset.update({
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
      await tx.auditLog.create({
        data: {
          tableName: 'assets',
          recordId: assetId,
          action: 'UPDATE',
          oldValues: oldAsset,
          newValues: retiredAsset,
        },
      });

      return retiredAsset;
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

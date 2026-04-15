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

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (asset.companyId && !ctx.companyIds.includes(asset.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Wrap core mutations in a transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Create transfer record
      const transfer = await tx.assetTransfer.create({
        data: {
          assetId,
          fromCompanyId: asset.companyId || 0,
          toCompanyId: data.toCompanyId,
          transferredBy: data.transferredBy || null,
          reason: data.reason,
        },
      });

      // Update asset
      await tx.asset.update({
        where: { id: assetId },
        data: { companyId: data.toCompanyId },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          tableName: 'asset_transfers',
          recordId: transfer.id,
          action: 'CREATE',
          newValues: transfer,
        },
      });

      return transfer;
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error('Error transferring asset:', error);
    return NextResponse.json(
      { error: 'Failed to transfer asset' },
      { status: 500 }
    );
  }
}

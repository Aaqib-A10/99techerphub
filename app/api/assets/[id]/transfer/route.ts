import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // Create transfer record
    const transfer = await prisma.assetTransfer.create({
      data: {
        assetId,
        fromCompanyId: asset.companyId,
        toCompanyId: data.toCompanyId,
        transferredBy: data.transferredBy || null,
        reason: data.reason,
      },
    });

    // Update asset
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { companyId: data.toCompanyId },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'asset_transfers',
        recordId: transfer.id,
        action: 'CREATE',
        newValues: transfer,
      },
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

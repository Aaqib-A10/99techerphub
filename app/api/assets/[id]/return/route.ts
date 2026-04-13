import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotificationsForRole } from '@/lib/services/notificationService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assetId = parseInt(params.id);
    const data = await request.json();

    // Find the active assignment
    const activeAssignment = await prisma.assetAssignment.findFirst({
      where: {
        assetId,
        returnedDate: null,
      },
    });

    if (!activeAssignment) {
      return NextResponse.json(
        { error: 'No active assignment found' },
        { status: 400 }
      );
    }

    // Update assignment with return info
    const updatedAssignment = await prisma.assetAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        returnedDate: new Date(),
        conditionAtReturn: data.conditionAtReturn,
        notes: data.notes,
      },
    });

    // Update asset
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        isAssigned: false,
        condition: data.conditionAtReturn,
      },
    });

    // Notify IT admins that an asset was returned and needs processing
    try {
      const assetWithTag = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { assetTag: true, model: true, manufacturer: true },
      });
      if (assetWithTag) {
        const damaged = data.conditionAtReturn === 'DAMAGED' || data.conditionAtReturn === 'LOST';
        await createNotificationsForRole('HR', {
          type: 'ASSET_RETURNED',
          title: damaged ? `Asset Returned (${data.conditionAtReturn})` : 'Asset Returned',
          message: `${assetWithTag.assetTag} — ${assetWithTag.manufacturer} ${assetWithTag.model} returned in ${data.conditionAtReturn} condition.`,
          link: `/assets/${assetId}`,
        });
      }
    } catch (err) {
      console.warn('[assets/return] failed to notify IT:', err);
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'asset_assignments',
        recordId: activeAssignment.id,
        action: 'UPDATE',
        newValues: updatedAssignment,
      },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error returning asset:', error);
    return NextResponse.json(
      { error: 'Failed to return asset' },
      { status: 500 }
    );
  }
}

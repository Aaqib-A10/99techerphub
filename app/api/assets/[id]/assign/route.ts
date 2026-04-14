import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';
import { getSessionUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
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

    // Wrap core mutations in a transaction
    const assignment = await prisma.$transaction(async (tx) => {
      // Lock the asset row to prevent concurrent assignments
      const [lockedAsset] = await tx.$queryRaw<any[]>`SELECT * FROM assets WHERE id = ${assetId} FOR UPDATE`;

      if (!lockedAsset) {
        throw new Error('Asset not found');
      }

      if (lockedAsset.is_assigned) {
        throw new Error('Asset is already assigned');
      }

      // Create assignment
      const assignment = await tx.assetAssignment.create({
        data: {
          assetId,
          employeeId: parseInt(data.employeeId),
          assignedById: data.assignedById ? parseInt(data.assignedById) : null,
          conditionAtAssignment: asset.condition,
          notes: data.notes || null,
        },
      });

      // Update asset to mark as assigned
      await tx.asset.update({
        where: { id: assetId },
        data: { isAssigned: true },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          tableName: 'asset_assignments',
          recordId: assignment.id,
          action: 'CREATE',
          newValues: assignment,
        },
      });

      return assignment;
    });

    // Notify the employee who received the asset (via their linked user)
    try {
      const employeeWithUser = await prisma.employee.findUnique({
        where: { id: parseInt(data.employeeId) },
        select: { firstName: true, lastName: true, user: true },
      });
      if (employeeWithUser?.user?.id) {
        await createNotification({
          userId: employeeWithUser.user.id,
          type: 'ASSET_ASSIGNED',
          title: 'Asset Assigned To You',
          message: `${asset.assetTag} — ${asset.manufacturer} ${asset.model} (S/N ${asset.serialNumber}) has been assigned to you.`,
          link: `/assets/${assetId}`,
        });
      }
    } catch (err) {
      console.warn('[assets/assign] failed to notify employee:', err);
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning asset:', error);
    return NextResponse.json(
      { error: 'Failed to assign asset' },
      { status: 500 }
    );
  }
}

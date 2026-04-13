import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/services/notificationService';

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

    // Create assignment
    const assignment = await prisma.assetAssignment.create({
      data: {
        assetId,
        employeeId: parseInt(data.employeeId),
        assignedById: data.assignedById ? parseInt(data.assignedById) : null,
        conditionAtAssignment: asset.condition,
        notes: data.notes || null,
      },
    });

    // Update asset to mark as assigned
    await prisma.asset.update({
      where: { id: assetId },
      data: { isAssigned: true },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'asset_assignments',
        recordId: assignment.id,
        action: 'CREATE',
        newValues: assignment,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning asset:', error);
    return NextResponse.json(
      { error: 'Failed to assign asset' },
      { status: 500 }
    );
  }
}

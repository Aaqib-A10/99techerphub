import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const data = await request.json();

    const oldLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!oldLocation) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name: data.name || oldLocation.name,
        address: data.address !== undefined ? data.address : oldLocation.address,
        country: data.country || oldLocation.country,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'locations',
        recordId: id,
        action: 'UPDATE',
        module: 'MASTER_DATA',
        oldValues: oldLocation,
        newValues: updatedLocation,
      },
    });

    return NextResponse.json(updatedLocation);
  } catch (error: any) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Hard delete location
    await prisma.location.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'locations',
        recordId: id,
        action: 'DELETE',
        module: 'MASTER_DATA',
        oldValues: location,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location', details: error?.message },
      { status: 500 }
    );
  }
}

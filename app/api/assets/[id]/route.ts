import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { parseCurrency } from '@/lib/currency';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assetId = parseInt(params.id);

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        category: true,
        company: true,
        location: true,
        assignments: {
          include: {
            employee: true,
            assignedBy: true,
          },
          orderBy: { assignedDate: 'desc' },
        },
        transfers: {
          include: {
            fromCompany: true,
            toCompany: true,
            transferredByEmployee: true,
          },
          orderBy: { transferDate: 'desc' },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const oldAsset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!oldAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Build an explicit update payload. Only fields actually present in
    // the request body are written — `undefined` keys are dropped.
    const update: any = {};

    if (data.assetTag !== undefined) update.assetTag = data.assetTag;
    if (data.serialNumber !== undefined) update.serialNumber = data.serialNumber;
    if (data.manufacturer !== undefined) update.manufacturer = data.manufacturer;
    if (data.model !== undefined) update.model = data.model;
    if (data.categoryId !== undefined) update.categoryId = parseInt(data.categoryId);
    if (data.companyId !== undefined) update.companyId = parseInt(data.companyId);
    if (data.locationId !== undefined) update.locationId = parseInt(data.locationId);

    if (data.condition !== undefined) update.condition = data.condition;

    if (data.purchaseDate !== undefined)
      update.purchaseDate = new Date(data.purchaseDate);
    if (data.purchasePrice !== undefined)
      update.purchasePrice = parseCurrency(data.purchasePrice);
    if (data.currency !== undefined) update.currency = data.currency;
    if (data.warrantyExpiry !== undefined)
      update.warrantyExpiry = data.warrantyExpiry
        ? new Date(data.warrantyExpiry)
        : null;
    if (data.batchId !== undefined) update.batchId = data.batchId || null;

    if (data.photoUrl !== undefined) update.photoUrl = data.photoUrl || null;
    if (data.notes !== undefined) update.notes = data.notes || null;

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: update,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          tableName: 'assets',
          recordId: assetId,
          action: 'UPDATE',
          oldValues: oldAsset as any,
          newValues: updatedAsset as any,
        },
      });
    } catch (e) {
      console.warn('Audit log write failed (non-fatal):', e);
    }

    return NextResponse.json(updatedAsset);
  } catch (error: any) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

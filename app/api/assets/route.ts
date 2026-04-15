import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { parseCurrency } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const categoryId = searchParams.get('categoryId');
    const condition = searchParams.get('condition');
    const employeeId = searchParams.get('employeeId');
    const assignment = (searchParams.get('assignment') || '').toLowerCase();
    const q = (searchParams.get('q') || '').trim();
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');

    const where: any = {};
    if (companyId) where.companyId = parseInt(companyId);
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (condition) where.condition = condition;

    // Assignment / employee filters
    if (employeeId) {
      where.assignments = { some: { employeeId: parseInt(employeeId), returnedDate: null } };
    } else if (assignment === 'assigned') {
      if (!where.AND) where.AND = [];
      where.AND.push({
        OR: [
          { assignments: { some: { returnedDate: null } } },
          { assignedToName: { not: null, notIn: ['', 'Available', 'available'] } },
        ],
      });
    } else if (assignment === 'unassigned') {
      if (!where.AND) where.AND = [];
      where.AND.push(
        { assignments: { none: { returnedDate: null } } },
        {
          OR: [
            { assignedToName: null },
            { assignedToName: { in: ['', 'Available', 'available'] } },
          ],
        },
      );
    }

    // Full-text search across multiple fields
    if (q) {
      where.OR = [
        { assetTag: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
        { assignedToName: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          category: true,
          company: true,
          location: true,
          assignments: {
            where: { returnedDate: null },
            include: { employee: true },
            take: 1,
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({ assets, total });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Generate asset tag
    const catId = typeof data.categoryId === 'string' ? parseInt(data.categoryId) : data.categoryId;
    const category = await prisma.assetCategory.findUnique({
      where: { id: catId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 400 }
      );
    }

    const lastAsset = await prisma.asset.findFirst({
      where: { categoryId: catId },
      orderBy: { createdAt: 'desc' },
    });

    const sequence = (lastAsset?.assetTag?.split('-').pop() || '0').padStart(4, '0');
    const nextSequence = (parseInt(sequence) + 1).toString().padStart(4, '0');
    const assetTag = `99T-${category.code}-${nextSequence}`;

    // Auto-set purchase date to now, default company/location to first available
    const defaultCompany = await prisma.company.findFirst({ where: { isActive: true } });
    const defaultLocation = await prisma.location.findFirst();

    const asset = await prisma.asset.create({
      data: {
        assetTag,
        serialNumber: data.serialNumber,
        categoryId: catId,
        manufacturer: data.manufacturer,
        model: data.model,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
        purchasePrice: data.purchasePrice ? parseCurrency(data.purchasePrice) : 0,
        currency: data.currency || 'PKR',
        warrantyExpiry: data.warrantyExpiry
          ? new Date(data.warrantyExpiry)
          : null,
        condition: data.condition || 'WORKING',
        companyId: data.companyId ? parseInt(data.companyId) : defaultCompany!.id,
        locationId: data.locationId ? parseInt(data.locationId) : defaultLocation!.id,
        notes: data.notes || null,
        batchId: data.batchId || null,
        photoUrl: data.photoUrl || null,
        isAssigned: false,
        isRetired: false,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'assets',
        recordId: asset.id,
        action: 'CREATE',
        newValues: asset,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}

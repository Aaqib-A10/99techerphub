import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

interface ImportRow {
  [key: string]: string;
}

interface ImportRequest {
  rows: ImportRow[];
  mapping: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows, mapping }: ImportRequest = await request.json();

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows to import' },
        { status: 400 }
      );
    }

    const errors: Array<{ row: number; message: string }> = [];
    let successCount = 0;

    // Get metadata for lookups
    const categories = await prisma.assetCategory.findMany();
    const companies = await prisma.company.findMany({ where: { isActive: true } });
    const locations = await prisma.location.findMany();

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // Map values using the provided mapping
        const getMappedValue = (columnHeader: string) => {
          const standardKey = mapping[columnHeader];
          return row[columnHeader] || '';
        };

        const serialNumber = Object.entries(mapping)
          .find(([_, v]) => v === 'serial_number')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'serial_number')![0])
          : '';

        const model = Object.entries(mapping)
          .find(([_, v]) => v === 'model')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'model')![0])
          : '';

        const manufacturer = Object.entries(mapping)
          .find(([_, v]) => v === 'manufacturer')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'manufacturer')![0])
          : '';

        const categoryName = Object.entries(mapping)
          .find(([_, v]) => v === 'category')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'category')![0])
          : '';

        const companyName = Object.entries(mapping)
          .find(([_, v]) => v === 'company')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'company')![0])
          : '';

        const locationName = Object.entries(mapping)
          .find(([_, v]) => v === 'location')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'location')![0])
          : '';

        // Validate required fields
        if (!serialNumber || !model || !manufacturer) {
          errors.push({
            row: i + 2,
            message: 'Missing required fields (Serial Number, Model, or Manufacturer)',
          });
          continue;
        }

        // Find category
        const category = categories.find(
          (c) =>
            c.name.toLowerCase() === categoryName.toLowerCase() ||
            c.code.toLowerCase() === categoryName.toLowerCase()
        );

        if (!category) {
          errors.push({
            row: i + 2,
            message: `Category not found: ${categoryName}`,
          });
          continue;
        }

        // Find company
        const company = companies.find(
          (c) =>
            c.name.toLowerCase() === companyName.toLowerCase() ||
            c.code.toLowerCase() === companyName.toLowerCase()
        ) || companies[0];

        // Find location
        const location = locations.find(
          (l) => l.name.toLowerCase() === locationName.toLowerCase()
        ) || locations[0];

        if (!company || !location) {
          errors.push({
            row: i + 2,
            message: 'Company or Location not found',
          });
          continue;
        }

        // Generate asset tag
        const lastAsset = await prisma.asset.findFirst({
          where: { categoryId: category.id },
          orderBy: { createdAt: 'desc' },
        });

        const sequence = (lastAsset?.assetTag?.split('-').pop() || '0').padStart(4, '0');
        const nextSequence = (parseInt(sequence) + 1).toString().padStart(4, '0');
        const assetTag = `99T-${category.code}-${nextSequence}`;

        // Create asset
        await prisma.asset.create({
          data: {
            assetTag,
            serialNumber,
            categoryId: category.id,
            manufacturer,
            model,
            purchaseDate: new Date(),
            purchasePrice: 0,
            currency: 'PKR',
            condition: 'WORKING',
            companyId: company.id,
            locationId: location.id,
          },
        });

        successCount++;
      } catch (err) {
        errors.push({
          row: i + 2,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Audit log
    if (successCount > 0) {
      await prisma.auditLog.create({
        data: {
          tableName: 'assets',
          recordId: 0,
          action: 'CREATE',
          module: 'ASSET_BULK_IMPORT',
          newValues: { successCount, totalRows: rows.length },
        },
      });
    }

    return NextResponse.json({
      success: successCount,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulk import:', error);
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}

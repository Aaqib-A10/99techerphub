import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
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

    if (!data.name || !data.country) {
      return NextResponse.json(
        { error: 'Name and country are required' },
        { status: 400 }
      );
    }

    const location = await prisma.location.create({
      data: {
        name: data.name,
        address: data.address || null,
        country: data.country,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'locations',
        recordId: location.id,
        action: 'CREATE',
        module: 'MASTER_DATA',
        newValues: location,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error: any) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}

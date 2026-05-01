import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('includeInactive') === '1';

  const marketplaces = await prisma.marketplace.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return NextResponse.json(marketplaces);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!['ADMIN', 'HR'].includes(user.role)) {
    return NextResponse.json({ error: 'Admin/HR only' }, { status: 403 });
  }

  const data = await request.json();
  const name = (data.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    const created = await prisma.marketplace.create({ data: { name } });
    await prisma.auditLog.create({
      data: {
        tableName: 'marketplaces',
        recordId: created.id,
        action: 'CREATE',
        module: 'MASTER_DATA',
        newValues: created,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create marketplace' }, { status: 500 });
  }
}

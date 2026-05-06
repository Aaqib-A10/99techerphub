import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT', 'MANAGER'];
const POSTING_ROLES = ['ADMIN', 'ACCOUNTANT'];

// GET — read the active catalog. Used by every category dropdown.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!FINANCE_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const categories = await prisma.ledgerCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(categories);
}

// POST — admin/accountant creates a new ledger category inline from a
// form's "+ Create category" affordance. Auto-generates a code from
// the name when the caller doesn't pass one.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!POSTING_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body?.name || '').toString().trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  // Block "Other" / "Misc" / etc. — the seed already provides those and
  // creating duplicates fragments reports.
  if (/^(other|misc(ellaneous)?)$/i.test(name)) {
    return NextResponse.json(
      { error: '"Other" already exists — pick it from the dropdown.' },
      { status: 409 },
    );
  }

  const code = (body?.code || autoCode(name)).toString().trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  // Find the next sortOrder so user-created categories sit between the
  // last seeded one and OTHER (which is pinned at sortOrder 999).
  const last = await prisma.ledgerCategory.findFirst({
    where: { sortOrder: { lt: 999 } },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const nextSort = (last?.sortOrder ?? 0) + 1;

  try {
    const created = await prisma.ledgerCategory.create({
      data: {
        code,
        name,
        type: body?.type || 'expense',
        description: body?.description ?? null,
        sortOrder: nextSort,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with that name or code already exists.' },
        { status: 409 },
      );
    }
    console.error('[ledger/categories/POST]', e);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

// Generate a short code from a name, e.g. "Office Cleaning" → "OFFICE_CLEANING"
// (uppercased, words joined by underscore, capped at 20 chars).
function autoCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 20);
}

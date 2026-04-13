import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------
type SettingsType =
  | 'company'
  | 'department'
  | 'location'
  | 'assetCategory'
  | 'expenseCategory';

const VALID_TYPES: SettingsType[] = [
  'company',
  'department',
  'location',
  'assetCategory',
  'expenseCategory',
];

const TABLE_LABEL: Record<SettingsType, string> = {
  company: 'company',
  department: 'department',
  location: 'location',
  assetCategory: 'assetCategory',
  expenseCategory: 'expenseCategory',
};

const delegateFor = (type: SettingsType) => {
  switch (type) {
    case 'company':
      return prisma.company;
    case 'department':
      return prisma.department;
    case 'location':
      return prisma.location;
    case 'assetCategory':
      return prisma.assetCategory;
    case 'expenseCategory':
      return prisma.expenseCategory;
  }
};

// Fields we allow a PATCH to touch per type.
const ALLOWED_FIELDS: Record<SettingsType, string[]> = {
  company: ['code', 'name', 'country', 'isActive'],
  department: ['code', 'name', 'isActive'],
  location: ['name', 'address', 'country'],
  assetCategory: ['code', 'name', 'description'],
  expenseCategory: ['code', 'name', 'description', 'isActive'],
};

// Which types support isActive soft-delete
const HAS_IS_ACTIVE: Record<SettingsType, boolean> = {
  company: true,
  department: true,
  location: false,
  assetCategory: false,
  expenseCategory: true,
};

// Convert Date instances to ISO strings so they can go into Prisma Json columns.
const serializeForJson = (obj: any): any => {
  if (obj == null) return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
};

const getTypeParam = (request: NextRequest): SettingsType | null => {
  const { searchParams } = new URL(request.url);
  const t = searchParams.get('type') as SettingsType | null;
  if (!t || !VALID_TYPES.includes(t)) return null;
  return t;
};

// --------------------------------------------------------------
// GET — fetch one record
// --------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const type = getTypeParam(request);
    if (!type)
      return NextResponse.json({ error: 'Valid type is required' }, { status: 400 });
    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const delegate: any = delegateFor(type);
    const record = await delegate.findUnique({ where: { id } });
    if (!record)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch record', details: error?.message },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------
// PATCH — edit a record
// --------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const type = getTypeParam(request);
    if (!type)
      return NextResponse.json({ error: 'Valid type is required' }, { status: 400 });
    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await request.json();
    const allowed = ALLOWED_FIELDS[type];

    // Build filtered update payload. Only fields in allowed list are honoured.
    const updateData: Record<string, any> = {};
    const changedFields: string[] = [];

    const delegate: any = delegateFor(type);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    for (const key of allowed) {
      if (body[key] === undefined) continue;
      let incoming = body[key];
      if (incoming === '') incoming = null;
      // Coerce isActive to boolean
      if (key === 'isActive') incoming = Boolean(incoming);
      if (existing[key] !== incoming) {
        updateData[key] = incoming;
        changedFields.push(key);
      }
    }

    if (changedFields.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        changedFields: [],
        record: existing,
      });
    }

    const updated = await delegate.update({ where: { id }, data: updateData });

    // Audit trail
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    for (const f of changedFields) {
      oldValues[f] = existing[f];
      newValues[f] = updated[f];
    }
    await prisma.auditLog.create({
      data: {
        tableName: TABLE_LABEL[type],
        recordId: id,
        action: 'UPDATE',
        module: 'SETTINGS',
        oldValues,
        newValues,
      },
    });

    return NextResponse.json({
      success: true,
      record: updated,
      changedFields,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update record', details: error?.message },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------
// DELETE — soft delete (isActive=false) if supported; hard delete otherwise
// --------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const type = getTypeParam(request);
    if (!type)
      return NextResponse.json({ error: 'Valid type is required' }, { status: 400 });
    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    const delegate: any = delegateFor(type);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let mode: 'soft' | 'hard' = 'soft';

    if (hardDelete || !HAS_IS_ACTIVE[type]) {
      // Hard-delete path (for location, assetCategory, or explicit hard delete)
      try {
        await delegate.delete({ where: { id } });
        mode = 'hard';
      } catch (err: any) {
        // Foreign key conflict — let the client know this row is referenced
        if (err?.code === 'P2003' || /foreign key/i.test(err?.message || '')) {
          return NextResponse.json(
            {
              error: 'Cannot delete — this record is referenced by other data',
              details: err?.message,
            },
            { status: 409 }
          );
        }
        throw err;
      }
    } else {
      await delegate.update({ where: { id }, data: { isActive: false } });
      mode = 'soft';
    }

    await prisma.auditLog.create({
      data: {
        tableName: TABLE_LABEL[type],
        recordId: id,
        // AuditAction enum only supports CREATE/UPDATE/DELETE.
        // Soft-delete is represented as an UPDATE to isActive.
        action: mode === 'hard' ? 'DELETE' : 'UPDATE',
        module: 'SETTINGS',
        oldValues:
          mode === 'hard'
            ? serializeForJson(existing)
            : { isActive: existing.isActive },
        newValues: mode === 'hard' ? undefined : { isActive: false },
      },
    });

    return NextResponse.json({ success: true, mode });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete record', details: error?.message },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------
// POST — reactivate a soft-deleted record (restore)
// --------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const type = getTypeParam(request);
    if (!type)
      return NextResponse.json({ error: 'Valid type is required' }, { status: 400 });
    const id = parseInt(params.id);
    if (!Number.isFinite(id))
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    if (!HAS_IS_ACTIVE[type])
      return NextResponse.json(
        { error: 'This type does not support reactivation' },
        { status: 400 }
      );

    const delegate: any = delegateFor(type);
    const updated = await delegate.update({
      where: { id },
      data: { isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        tableName: TABLE_LABEL[type],
        recordId: id,
        action: 'UPDATE',
        module: 'SETTINGS',
        oldValues: { isActive: false },
        newValues: { isActive: true },
      },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reactivate record', details: error?.message },
      { status: 500 }
    );
  }
}

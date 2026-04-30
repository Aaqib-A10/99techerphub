import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * Replace the marketplace assignments for an employee.
 * Body: { marketplaceIds: number[] }
 *
 * Permissions: the employee's own reporting manager (any depth in the chain),
 * ADMIN, or HR. Anyone else gets 403.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const empId = parseInt(params.id);
  if (isNaN(empId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const employee = await prisma.employee.findUnique({
    where: { id: empId },
    select: { id: true, reportingManagerId: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  // Permission check: ADMIN/HR always; otherwise must be a manager up-chain
  const canEdit = await canEditEmployee(user, employee);
  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden — manager-up-chain or admin/HR only' }, { status: 403 });
  }

  const data = await request.json();
  if (!Array.isArray(data.marketplaceIds)) {
    return NextResponse.json({ error: 'marketplaceIds must be an array' }, { status: 400 });
  }
  const ids = data.marketplaceIds.map((n: any) => parseInt(n)).filter((n: number) => Number.isFinite(n));

  // Use a transaction so the row delete + recreate is atomic.
  await prisma.$transaction([
    prisma.employeeMarketplace.deleteMany({ where: { employeeId: empId } }),
    ...(ids.length
      ? [prisma.employeeMarketplace.createMany({
          data: ids.map((mid: number) => ({ employeeId: empId, marketplaceId: mid })),
          skipDuplicates: true,
        })]
      : []),
  ]);

  // Audit
  await prisma.auditLog.create({
    data: {
      tableName: 'employee_marketplaces',
      recordId: empId,
      action: 'UPDATE',
      module: 'EMPLOYEE',
      newValues: { marketplaceIds: ids },
    },
  });

  const fresh = await prisma.employeeMarketplace.findMany({
    where: { employeeId: empId },
    include: { marketplace: true },
  });
  return NextResponse.json({ marketplaces: fresh });
}

async function canEditEmployee(
  user: { id: number; role: string; employeeId: number | null },
  target: { id: number; reportingManagerId: number | null }
): Promise<boolean> {
  if (user.role === 'ADMIN' || user.role === 'HR') return true;
  if (!user.employeeId) return false;
  // Walk the reporting chain up from `target` and see if `user.employeeId`
  // appears as a manager. Bound the loop to defend against cycles.
  let currentMgrId: number | null = target.reportingManagerId;
  for (let i = 0; i < 20 && currentMgrId; i++) {
    if (currentMgrId === user.employeeId) return true;
    const m: { reportingManagerId: number | null } | null = await prisma.employee.findUnique({
      where: { id: currentMgrId },
      select: { reportingManagerId: true },
    });
    currentMgrId = m?.reportingManagerId ?? null;
  }
  return false;
}

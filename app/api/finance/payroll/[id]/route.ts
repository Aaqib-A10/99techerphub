import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runId = parseInt(params.id);
    const data = await request.json();

    if (data.action === 'finalize') {
      // Finalize is a single-step update — transaction wraps for audit consistency
      const run = await prisma.$transaction(async (tx) => {
        const updated = await tx.payrollRun.update({
          where: { id: runId },
          data: { status: 'FINALIZED', processedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            tableName: 'payroll_runs',
            recordId: runId,
            action: 'UPDATE',
            module: 'PAYROLL',
            newValues: { status: 'FINALIZED' },
          },
        });

        return updated;
      });

      return NextResponse.json(run);
    }

    if (data.action === 'mark_paid') {
      // ATOMIC: status + commissions + audit all in one transaction
      const result = await prisma.$transaction(async (tx) => {
        const run = await tx.payrollRun.update({
          where: { id: runId },
          data: { status: 'PAID', paidAt: new Date() },
        });

        // Batch: get all employee IDs from payroll items
        const items = await tx.payrollItem.findMany({
          where: { payrollRunId: runId },
          select: { employeeId: true },
        });
        const employeeIds = items.map(i => i.employeeId);

        // Single batch update replaces the N+1 loop
        if (employeeIds.length > 0) {
          await tx.commission.updateMany({
            where: {
              employeeId: { in: employeeIds },
              period: run.period,
              isPaid: false,
            },
            data: { isPaid: true },
          });
        }

        await tx.auditLog.create({
          data: {
            tableName: 'payroll_runs',
            recordId: runId,
            action: 'UPDATE',
            module: 'PAYROLL',
            newValues: { status: 'PAID', employeesAffected: employeeIds.length },
          },
        });

        return run;
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating payroll:', error);
    return NextResponse.json(
      { error: 'Failed to update payroll' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = parseInt(params.id);
    const data = await request.json();

    if (data.action === 'finalize') {
      const run = await prisma.payrollRun.update({
        where: { id: runId },
        data: { status: 'FINALIZED', processedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          tableName: 'payroll_runs',
          recordId: runId,
          action: 'UPDATE',
          module: 'PAYROLL',
          newValues: { status: 'FINALIZED' },
        },
      });

      return NextResponse.json(run);
    }

    if (data.action === 'mark_paid') {
      const run = await prisma.payrollRun.update({
        where: { id: runId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // Mark related commissions as paid
      const items = await prisma.payrollItem.findMany({
        where: { payrollRunId: runId },
      });
      for (const item of items) {
        await prisma.commission.updateMany({
          where: { employeeId: item.employeeId, period: run.period, isPaid: false },
          data: { isPaid: true },
        });
      }

      await prisma.auditLog.create({
        data: {
          tableName: 'payroll_runs',
          recordId: runId,
          action: 'UPDATE',
          module: 'PAYROLL',
          newValues: { status: 'PAID' },
        },
      });

      return NextResponse.json(run);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update payroll', details: error?.message },
      { status: 500 }
    );
  }
}

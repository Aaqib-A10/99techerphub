import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { createNotificationsForRole } from '@/lib/services/notificationService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(params.id);
    const data = await request.json();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const existingExit = await prisma.employeeExit.findUnique({
      where: { employeeId },
    });

    const exitRecord = await prisma.$transaction(async (tx) => {
      let record;
      if (existingExit) {
        record = await tx.employeeExit.update({
          where: { employeeId },
          data: {
            exitDate: new Date(data.exitDate),
            reason: data.reason || null,
            exitType: data.exitType || 'RESIGNATION',
          },
        });
      } else {
        record = await tx.employeeExit.create({
          data: {
            employeeId,
            exitDate: new Date(data.exitDate),
            reason: data.reason || null,
            exitType: data.exitType || 'RESIGNATION',
            clearanceStatus: {},
          },
        });
      }

      await tx.employee.update({
        where: { id: employeeId },
        data: {
          lifecycleStage: 'EXIT_INITIATED',
        },
      });

      await tx.auditLog.create({
        data: {
          tableName: 'employee_exits',
          recordId: record.id,
          action: 'CREATE',
          module: 'EMPLOYEE',
          newValues: record,
        },
      });

      return record;
    });

    // Notify IT, Finance, and Super Admins about the exit so clearance tasks
    // (asset recovery, digital-access revocation, final settlement) can start.
    try {
      const employeeName = `${employee.firstName} ${employee.lastName} (${employee.empCode})`;
      const exitDateStr = new Date(data.exitDate).toLocaleDateString();
      const link = `/employees/${employeeId}`;

      // Count outstanding assets so IT sees scope immediately.
      const activeAssetCount = await prisma.assetAssignment.count({
        where: { employeeId, returnedDate: null },
      });
      const digitalAccessCount = await prisma.digitalAccess.count({
        where: { employeeId, isActive: true },
      });

      // IT: asset + digital access recovery
      await createNotificationsForRole('HR', {
        type: 'SYSTEM_ALERT',
        title: 'Exit Initiated — Asset & Access Recovery Needed',
        message: `${employeeName} is leaving on ${exitDateStr}. Outstanding: ${activeAssetCount} asset(s), ${digitalAccessCount} digital service(s). Start clearance.`,
        link,
      });

      // Finance: final settlement
      await createNotificationsForRole('ACCOUNTANT', {
        type: 'SYSTEM_ALERT',
        title: 'Exit Initiated — Final Settlement Required',
        message: `${employeeName} is leaving on ${exitDateStr}. Prepare final salary, gratuity, and expense reimbursements.`,
        link,
      });

      // Admins for visibility
      await createNotificationsForRole('ADMIN', {
        type: 'SYSTEM_ALERT',
        title: 'Exit Initiated',
        message: `${employeeName} exit initiated. Exit type: ${data.exitType || 'RESIGNATION'}. Last day: ${exitDateStr}.`,
        link,
      });
    } catch (err) {
      console.warn('[exit/initiate] failed to create notifications:', err);
    }

    return NextResponse.json(exitRecord, { status: 201 });
  } catch (error: any) {
    console.error('Error initiating exit:', error);
    return NextResponse.json(
      { error: 'Failed to initiate exit' },
      { status: 500 }
    );
  }
}
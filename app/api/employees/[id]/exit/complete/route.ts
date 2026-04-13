import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id);
    const data = await request.json();

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        assetAssignments: { where: { returnedDate: null } },
        digitalAccess: { where: { isActive: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    if (employee.assetAssignments.length > 0) {
      return NextResponse.json(
        { error: 'All assets must be returned before completing exit' },
        { status: 400 }
      );
    }

    if (employee.digitalAccess.length > 0) {
      return NextResponse.json(
        { error: 'All digital access must be revoked before completing exit' },
        { status: 400 }
      );
    }

    const exitRecord = await prisma.employeeExit.findUnique({
      where: { employeeId },
    });

    if (!exitRecord) {
      return NextResponse.json(
        { error: 'Exit record not found. Please initiate exit first.' },
        { status: 404 }
      );
    }

    const updatedExit = await prisma.employeeExit.update({
      where: { employeeId },
      data: {
        isComplete: true,
        finalSettlement: data.finalSettlement || null,
      },
    });

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        isActive: false,
        lifecycleStage: 'EXITED',
        dateOfLeaving: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'employee_exits',
        recordId: exitRecord.id,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        newValues: updatedExit,
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'employees',
        recordId: employeeId,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        newValues: {
          isActive: false,
          lifecycleStage: 'EXITED',
          dateOfLeaving: new Date(),
        },
      },
    });

    return NextResponse.json(updatedExit, { status: 200 });
  } catch (error: any) {
    console.error('Error completing exit:', error);
    return NextResponse.json(
      { error: 'Failed to complete exit', details: error?.message },
      { status: 500 }
    );
  }
}
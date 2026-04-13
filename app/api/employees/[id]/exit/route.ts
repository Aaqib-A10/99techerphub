import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const empId = parseInt(params.id);
    if (isNaN(empId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const requestData = await request.json();

    // Verify employee exists and has exit record
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { exitRecord: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee.exitRecord) {
      return NextResponse.json(
        { error: 'No exit record found for this employee' },
        { status: 400 }
      );
    }

    // Update clearance status
    const existingClearance = employee.exitRecord.clearanceStatus || {
      assetsReturned: false,
      digitalAccessRevoked: false,
      financialSettlement: false,
      documentsCollected: false,
    };

    const updatedClearance = {
      ...existingClearance,
      ...requestData.clearanceStatus,
    };

    const updatedExitRecord = await prisma.employeeExit.update({
      where: { id: employee.exitRecord.id },
      data: {
        clearanceStatus: updatedClearance,
      },
    });

    return NextResponse.json({
      message: 'Clearance status updated successfully',
      exitRecord: updatedExitRecord,
    });
  } catch (error: any) {
    console.error('Error updating exit clearance:', error);
    return NextResponse.json(
      { error: 'Failed to update exit clearance', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const empId = parseInt(params.id);
    if (isNaN(empId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    // Verify employee exists and has exit record
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { exitRecord: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee.exitRecord) {
      return NextResponse.json(
        { error: 'No exit record found for this employee' },
        { status: 400 }
      );
    }

    // Mark exit as complete
    const updatedExitRecord = await prisma.employeeExit.update({
      where: { id: employee.exitRecord.id },
      data: {
        isComplete: true,
      },
    });

    // Update employee status
    const updatedEmployee = await prisma.employee.update({
      where: { id: empId },
      data: {
        isActive: false,
        lifecycleStage: 'EXITED',
      },
      include: {
        department: true,
        company: true,
        location: true,
        exitRecord: true,
      },
    });

    // Audit logs
    await prisma.auditLog.create({
      data: {
        tableName: 'employee_exits',
        recordId: updatedExitRecord.id,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        newValues: { isComplete: true },
      },
    });

    await prisma.auditLog.create({
      data: {
        tableName: 'employees',
        recordId: empId,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        oldValues: { isActive: true, lifecycleStage: 'EXIT_INITIATED' },
        newValues: { isActive: false, lifecycleStage: 'EXITED' },
      },
    });

    return NextResponse.json({
      message: 'Exit process completed successfully',
      exitRecord: updatedExitRecord,
      employee: updatedEmployee,
    });
  } catch (error: any) {
    console.error('Error completing exit:', error);
    return NextResponse.json(
      { error: 'Failed to complete exit', details: error?.message },
      { status: 500 }
    );
  }
}

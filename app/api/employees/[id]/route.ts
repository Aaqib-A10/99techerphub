import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        department: true,
        company: true,
        location: true,
        assetAssignments: {
          include: { asset: { include: { category: true } } },
        },
        digitalAccess: true,
        salaryHistory: { orderBy: { effectiveFrom: 'desc' } },
        documents: true,
        exitRecord: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const empId = parseInt(params.id);
    if (isNaN(empId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const requestData = await request.json();
    const action = requestData.action || 'update';

    // Verify employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: empId },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // ============================================
    // ACTION: Initiate Exit
    // ============================================
    if (action === 'initiate_exit') {
      return handleInitiateExit(empId, requestData);
    }

    // ============================================
    // ACTION: Update Lifecycle Stage
    // ============================================
    if (action === 'update_stage') {
      return handleUpdateStage(empId, requestData, existingEmployee);
    }

    // ============================================
    // ACTION: General Profile Update (default)
    // ============================================
    if (action === 'update') {
      return handleGeneralUpdate(empId, requestData, existingEmployee);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: Initiate Exit
// ============================================
async function handleInitiateExit(empId: number, data: any) {
  try {
    if (!data.exitDate) {
      return NextResponse.json(
        { error: 'exitDate is required' },
        { status: 400 }
      );
    }

    const exitRecord = await prisma.employeeExit.create({
      data: {
        employeeId: empId,
        exitDate: new Date(data.exitDate),
        reason: data.reason || null,
        exitType: data.exitType || 'RESIGNATION',
        clearanceStatus: {
          assetsReturned: false,
          digitalAccessRevoked: false,
          financialSettlement: false,
          documentsCollected: false,
        },
      },
    });

    const updatedEmployee = await prisma.employee.update({
      where: { id: empId },
      data: {
        lifecycleStage: 'EXIT_INITIATED',
        dateOfLeaving: new Date(data.exitDate),
      },
      include: {
        department: true,
        company: true,
        location: true,
      },
    });

    // Audit log for exit initiation
    await prisma.auditLog.create({
      data: {
        tableName: 'employee_exits',
        recordId: exitRecord.id,
        action: 'CREATE',
        module: 'EMPLOYEE',
        newValues: exitRecord,
      },
    });

    // Audit log for employee lifecycle change
    await prisma.auditLog.create({
      data: {
        tableName: 'employees',
        recordId: empId,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        oldValues: { lifecycleStage: 'ACTIVE' },
        newValues: { lifecycleStage: 'EXIT_INITIATED', dateOfLeaving: updatedEmployee.dateOfLeaving },
      },
    });

    return NextResponse.json({
      message: 'Exit initiated successfully',
      exitRecord,
      employee: updatedEmployee,
    });
  } catch (error: any) {
    console.error('Error initiating exit:', error);
    return NextResponse.json(
      { error: 'Failed to initiate exit' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: Update Lifecycle Stage
// ============================================
async function handleUpdateStage(empId: number, data: any, existingEmployee: any) {
  try {
    if (!data.lifecycleStage) {
      return NextResponse.json(
        { error: 'lifecycleStage is required' },
        { status: 400 }
      );
    }

    const validStages = ['OFFER_SENT', 'ONBOARDING', 'PROVISIONING', 'ACTIVE', 'EXIT_INITIATED', 'EXITED'];
    if (!validStages.includes(data.lifecycleStage)) {
      return NextResponse.json(
        { error: `Invalid lifecycleStage. Must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      );
    }

    const oldStage = existingEmployee.lifecycleStage;
    const newStage = data.lifecycleStage;

    const updatedEmployee = await prisma.employee.update({
      where: { id: empId },
      data: {
        lifecycleStage: newStage,
      },
      include: {
        department: true,
        company: true,
        location: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'employees',
        recordId: empId,
        action: 'UPDATE',
        module: 'EMPLOYEE',
        oldValues: { lifecycleStage: oldStage },
        newValues: { lifecycleStage: newStage },
      },
    });

    return NextResponse.json({
      message: 'Lifecycle stage updated successfully',
      employee: updatedEmployee,
    });
  } catch (error: any) {
    console.error('Error updating lifecycle stage:', error);
    return NextResponse.json(
      { error: 'Failed to update lifecycle stage' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: General Profile Update
// ============================================
async function handleGeneralUpdate(empId: number, data: any, existingEmployee: any) {
  try {
    // List of allowed fields for update
    const allowedFields = [
      'firstName',
      'lastName',
      'fatherName',
      'email',
      'phone',
      'cnic',
      'dateOfBirth',
      'gender',
      'address',
      'permanentAddress',
      'city',
      'country',
      'departmentId',
      'companyId',
      'locationId',
      'designation',
      'employmentStatus',
      'lifecycleStage',
      'probationEndDate',
      'reportingManagerId',
      'bankName',
      'bankAccountNumber',
      'bankBranch',
      'bloodGroup',
      'passportNumber',
      'passportExpiry',
      'maritalStatus',
      'nationality',
      'education',
      'references',
      'photoUrl',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyContactRelation',
      'dateOfJoining',
      'lastDegree',
      'previousOrganization',
      'referenceCheck',
      'bankAccountStatus',
    ];

    // Field classification for input normalization
    const dateFields = ['dateOfBirth', 'probationEndDate', 'passportExpiry', 'dateOfJoining'];
    const fkFields = ['departmentId', 'companyId', 'locationId', 'reportingManagerId'];

    // Normalize an incoming form value into a shape Prisma + the diff check both accept.
    // Empty strings from HTML form controls become `null` for nullable fields.
    // Date strings become `Date` objects (or `null` when blank).
    // FK id fields become numbers (or `null` when blank).
    const normalizeIncoming = (field: string, raw: any): any => {
      if (raw === undefined) return undefined;
      if (raw === '' || raw === null) return null;
      if (dateFields.includes(field)) {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
      }
      if (fkFields.includes(field)) {
        const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      }
      return raw;
    };

    // Normalize an existing DB value so the diff check treats `null` and Date objects
    // the same way as normalized incoming values.
    const normalizeExisting = (field: string, raw: any): any => {
      if (raw === undefined || raw === null) return null;
      if (dateFields.includes(field) && raw instanceof Date) {
        return raw; // compared via .getTime() below
      }
      return raw;
    };

    // Value equality that treats Date objects by timestamp.
    const valuesEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      if (a == null || b == null) return false;
      if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
      if (a instanceof Date || b instanceof Date) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    };

    // Filter input data to only allowed fields, normalizing as we go.
    const updateData: any = {};
    const changedFields: { [key: string]: { old: any; new: any } } = {};

    for (const field of allowedFields) {
      if (field in data) {
        const newValue = normalizeIncoming(field, data[field]);
        const oldValue = normalizeExisting(field, (existingEmployee as any)[field]);

        // Skip if values are the same (handles null/"", Date equality, etc.)
        if (valuesEqual(oldValue, newValue)) {
          continue;
        }

        updateData[field] = newValue;
        changedFields[field] = { old: oldValue, new: newValue };
      }
    }

    // Handle multi-company assignment via join table (companyIds array)
    // Must run BEFORE the "no changes" early return since companyIds is not
    // part of the standard allowedFields diff check.
    let companiesChanged = false;
    if (Array.isArray(data.companyIds)) {
      const newIds: number[] = data.companyIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
      // Replace all: delete existing, then insert new
      await prisma.$executeRaw`DELETE FROM employee_companies WHERE "employeeId" = ${empId}`;
      for (const cid of newIds) {
        await prisma.$executeRaw`INSERT INTO employee_companies ("employeeId", "companyId", "assignedAt") VALUES (${empId}, ${cid}, NOW()) ON CONFLICT ("employeeId", "companyId") DO NOTHING`;
      }
      // Keep companyId in sync with first selected company (backward compat)
      const primaryCompanyId = newIds.length > 0 ? newIds[0] : null;
      if (primaryCompanyId !== existingEmployee.companyId) {
        await prisma.employee.update({
          where: { id: empId },
          data: { companyId: primaryCompanyId },
        });
      }
      companiesChanged = true;
    }

    // If no standard fields changed AND no company changes, return early
    const hasFieldChanges = Object.keys(changedFields).length > 0;
    if (!hasFieldChanges && !companiesChanged) {
      return NextResponse.json({
        message: 'No changes detected',
        employee: existingEmployee,
        changedFields: [],
      });
    }

    // Update employee record if standard fields changed
    let updatedEmployee = existingEmployee;
    if (hasFieldChanges) {
      updatedEmployee = await prisma.employee.update({
        where: { id: empId },
        data: updateData,
        include: {
          department: true,
          company: true,
          location: true,
        },
      });

      // Create audit log with detailed change tracking. Date objects must be
      // serialized to ISO strings so they fit into Prisma's Json column.
      const serializeForAudit = (v: any): any => {
        if (v instanceof Date) return v.toISOString();
        return v;
      };
      const oldValues: any = {};
      const newValues: any = {};

      for (const [field, changes] of Object.entries(changedFields)) {
        oldValues[field] = serializeForAudit((changes as any).old);
        newValues[field] = serializeForAudit((changes as any).new);
      }

      await prisma.auditLog.create({
        data: {
          tableName: 'employees',
          recordId: empId,
          action: 'UPDATE',
          module: 'EMPLOYEE',
          oldValues,
          newValues,
        },
      });
    }

    return NextResponse.json({
      message: companiesChanged && !hasFieldChanges
        ? 'Company assignments updated successfully'
        : 'Employee profile updated successfully',
      employee: updatedEmployee,
      changedFields: Object.keys(changedFields),
    });
  } catch (error: any) {
    console.error('Error updating employee profile:', error);
    return NextResponse.json(
      { error: 'Failed to update employee profile' },
      { status: 500 }
    );
  }
}

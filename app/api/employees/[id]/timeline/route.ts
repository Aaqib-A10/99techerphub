import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

interface TimelineEntry {
  id: string;
  date: Date;
  icon: string;
  title: string;
  description: string;
  module: string;
  action: string;
  badge?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(params.id);
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    // Get query params for pagination
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Fetch ALL audit logs (we'll filter client-side based on relevance)
    const allLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        changedBy: { select: { id: true, email: true } },
      },
    });

    // Filter logs related to this employee
    const relevantLogs = await filterRelevantLogs(allLogs, employeeId);

    // Apply pagination
    const paginatedLogs = relevantLogs.slice(skip, skip + limit);

    // Format timeline entries
    const timelineEntries = await Promise.all(
      paginatedLogs.map((log) => formatTimelineEntry(log, employeeId, employee))
    );

    // Filter out null entries
    const filteredEntries = timelineEntries.filter((entry) => entry !== null) as TimelineEntry[];

    const hasMore = relevantLogs.length > skip + limit;

    return NextResponse.json({
      timeline: filteredEntries,
      pagination: {
        page,
        limit,
        hasMore,
        total: relevantLogs.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

// Helper: Filter logs relevant to this employee
async function filterRelevantLogs(logs: any[], employeeId: number): Promise<any[]> {
  const relevant: any[] = [];

  for (const log of logs) {
    // Direct employee changes
    if (log.module === 'EMPLOYEE' && log.recordId === employeeId) {
      relevant.push(log);
      continue;
    }

    // Salary history for this employee
    if (log.tableName === 'salary_history' && log.module === 'EMPLOYEE') {
      try {
        const salary = await prisma.salaryHistory.findUnique({
          where: { id: log.recordId },
        });
        if (salary && salary.employeeId === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }

    // Digital access for this employee
    if (log.tableName === 'digital_access') {
      try {
        const access = await prisma.digitalAccess.findUnique({
          where: { id: log.recordId },
        });
        if (access && access.employeeId === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }

    // Asset assignments for this employee
    if (log.tableName === 'asset_assignments') {
      try {
        const assignment = await prisma.assetAssignment.findUnique({
          where: { id: log.recordId },
        });
        if (assignment && assignment.employeeId === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }

    // Expenses submitted by this employee
    if (log.tableName === 'expenses') {
      try {
        const expense = await prisma.expense.findUnique({
          where: { id: log.recordId },
        });
        if (expense && expense.submittedById === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }

    // Payroll items for this employee
    if (log.tableName === 'payroll_items') {
      try {
        const payrollItem = await prisma.payrollItem.findUnique({
          where: { id: log.recordId },
        });
        if (payrollItem && payrollItem.employeeId === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }

    // Exit records for this employee
    if (log.tableName === 'employee_exits') {
      try {
        const exit = await prisma.employeeExit.findUnique({
          where: { id: log.recordId },
        });
        if (exit && exit.employeeId === employeeId) {
          relevant.push(log);
        }
      } catch (e) {
        // Skip if not found
      }
      continue;
    }
  }

  return relevant;
}

// Helper function to format audit log entries into timeline entries
async function formatTimelineEntry(
  log: any,
  employeeId: number,
  employee: any
): Promise<TimelineEntry | null> {
  const baseEntry = {
    id: `${log.id}-${log.createdAt.getTime()}`,
    date: log.createdAt,
    badge: log.module,
  };

  try {
    // EMPLOYEE module changes
    if (log.module === 'EMPLOYEE' && log.recordId === employeeId && log.tableName === 'employees') {
      if (log.action === 'CREATE') {
        return {
          ...baseEntry,
          icon: '👤',
          title: 'Employee Record Created',
          description: `Onboarded as ${log.newValues?.designation || 'employee'}`,
          module: 'EMPLOYEE',
          action: 'CREATE',
          color: 'green',
        };
      }

      if (log.action === 'UPDATE') {
        return formatEmployeeUpdate(log, baseEntry);
      }
    }

    // SALARY HISTORY changes
    if (log.tableName === 'salary_history') {
      const salaryRecord = await prisma.salaryHistory.findUnique({
        where: { id: log.recordId },
      });
      if (salaryRecord && salaryRecord.employeeId === employeeId) {
        const oldSalary = log.oldValues?.baseSalary;
        const newSalary = log.newValues?.baseSalary;
        return {
          ...baseEntry,
          icon: '💰',
          title: 'Salary Updated',
          description:
            oldSalary && newSalary
              ? `Increased from PKR ${oldSalary.toLocaleString()} to PKR ${newSalary.toLocaleString()}`
              : `Set to PKR ${newSalary?.toLocaleString() || 'N/A'}`,
          module: 'PAYROLL',
          action: 'UPDATE',
          color: 'purple',
        };
      }
    }

    // DIGITAL ACCESS changes
    if (log.tableName === 'digital_access') {
      const access = await prisma.digitalAccess.findUnique({
        where: { id: log.recordId },
      });
      if (access && access.employeeId === employeeId) {
        if (log.action === 'CREATE') {
          return {
            ...baseEntry,
            icon: '🔐',
            title: 'Digital Access Granted',
            description: `Access granted for ${access.serviceName}`,
            module: 'EMPLOYEE',
            action: 'CREATE',
            color: 'blue',
          };
        }
        if (log.action === 'DELETE') {
          return {
            ...baseEntry,
            icon: '🔒',
            title: 'Digital Access Revoked',
            description: `Access revoked for ${access.serviceName || log.oldValues?.serviceName}`,
            module: 'EMPLOYEE',
            action: 'DELETE',
            color: 'orange',
          };
        }
      }
    }

    // ASSET ASSIGNMENTS
    if (log.tableName === 'asset_assignments') {
      const assignment = await prisma.assetAssignment.findUnique({
        where: { id: log.recordId },
        include: { asset: true },
      });

      if (assignment && assignment.employeeId === employeeId) {
        if (log.action === 'CREATE') {
          return {
            ...baseEntry,
            icon: '📦',
            title: `Asset Assigned: ${assignment.asset.assetTag}`,
            description: `${assignment.asset.manufacturer} ${assignment.asset.model} (${assignment.conditionAtAssignment})`,
            module: 'ASSET',
            action: 'CREATE',
            color: 'blue',
          };
        }
        if (log.action === 'UPDATE' && log.newValues?.returnedDate) {
          return {
            ...baseEntry,
            icon: '↩️',
            title: `Asset Returned: ${assignment.asset.assetTag}`,
            description: `${assignment.asset.manufacturer} ${assignment.asset.model} (Condition: ${assignment.conditionAtReturn})`,
            module: 'ASSET',
            action: 'UPDATE',
            color: 'yellow',
          };
        }
      }
    }

    // EXPENSE submissions
    if (log.tableName === 'expenses') {
      const expense = await prisma.expense.findUnique({
        where: { id: log.recordId },
      });

      if (expense && expense.submittedById === employeeId) {
        if (log.action === 'CREATE') {
          return {
            ...baseEntry,
            icon: '💳',
            title: `Expense Submitted: ${expense.expenseNumber}`,
            description: `PKR ${Number(expense.amount).toLocaleString()} for ${expense.description}`,
            module: 'EXPENSE',
            action: 'CREATE',
            color: 'orange',
          };
        }
        if (log.action === 'UPDATE') {
          const statusChanged = log.oldValues?.status !== log.newValues?.status;
          if (statusChanged) {
            return {
              ...baseEntry,
              icon: '📋',
              title: `Expense ${log.newValues?.status}`,
              description: `${expense.expenseNumber} - ${expense.description}`,
              module: 'EXPENSE',
              action: 'UPDATE',
              color: getExpenseStatusColor(log.newValues?.status),
            };
          }
        }
      }
    }

    // PAYROLL items
    if (log.tableName === 'payroll_items') {
      const payrollItem = await prisma.payrollItem.findUnique({
        where: { id: log.recordId },
      });

      if (payrollItem && payrollItem.employeeId === employeeId) {
        if (log.action === 'CREATE') {
          return {
            ...baseEntry,
            icon: '💵',
            title: 'Payroll Item Created',
            description: `Net Pay: PKR ${Number(payrollItem.netPay).toLocaleString()}`,
            module: 'PAYROLL',
            action: 'CREATE',
            color: 'green',
          };
        }
      }
    }

    // EXIT RECORD
    if (log.tableName === 'employee_exits') {
      const exit = await prisma.employeeExit.findUnique({
        where: { id: log.recordId },
      });

      if (exit && exit.employeeId === employeeId) {
        if (log.action === 'CREATE') {
          return {
            ...baseEntry,
            icon: '👋',
            title: 'Exit Initiated',
            description: `${exit.exitType}: ${exit.reason || 'No reason specified'}`,
            module: 'EMPLOYEE',
            action: 'CREATE',
            color: 'red',
          };
        }
      }
    }
  } catch (error) {
    console.error('Error formatting timeline entry:', error);
  }

  return null;
}

function formatEmployeeUpdate(log: any, baseEntry: any): TimelineEntry {
  const changes: string[] = [];
  const oldValues = log.oldValues || {};
  const newValues = log.newValues || {};

  // Map field names to human-readable labels
  const fieldLabels: { [key: string]: string } = {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    designation: 'Designation',
    departmentId: 'Department',
    companyId: 'Company',
    locationId: 'Location',
    employmentStatus: 'Employment Status',
    lifecycleStage: 'Lifecycle Stage',
    probationEndDate: 'Probation End Date',
    bankName: 'Bank Name',
    bankAccountNumber: 'Bank Account',
  };

  for (const [field, newValue] of Object.entries(newValues)) {
    const oldValue = oldValues[field];
    if (oldValue !== newValue) {
      const label = fieldLabels[field] || field;
      changes.push(`${label} changed`);
    }
  }

  const description = changes.length > 0 ? changes.slice(0, 3).join(', ') : 'Profile updated';

  return {
    ...baseEntry,
    icon: '✏️',
    title: 'Profile Updated',
    description,
    module: 'EMPLOYEE',
    action: 'UPDATE',
    color: 'blue',
  };
}

function getExpenseStatusColor(status: string): 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'PENDING':
      return 'yellow';
    case 'NEEDS_REVISION':
      return 'orange';
    default:
      return 'blue';
  }
}

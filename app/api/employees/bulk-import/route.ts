import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { parseCurrency } from '@/lib/currency';

interface ImportRow {
  [key: string]: string;
}

interface ImportRequest {
  rows: ImportRow[];
  mapping: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows, mapping }: ImportRequest = await request.json();

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows to import' },
        { status: 400 }
      );
    }

    const errors: Array<{ row: number; message: string }> = [];
    let successCount = 0;

    // Get metadata for lookups
    const departments = await prisma.department.findMany({ where: { isActive: true } });
    const companies = await prisma.company.findMany({ where: { isActive: true } });
    const locations = await prisma.location.findMany();

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        // Helper to get mapped value
        const getMappedValue = (columnHeader: string) => {
          return row[columnHeader] || '';
        };

        // Extract values using mapping
        const empCode = Object.entries(mapping)
          .find(([_, v]) => v === 'empcode')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'empcode')![0])
          : '';

        const firstName = Object.entries(mapping)
          .find(([_, v]) => v === 'firstname')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'firstname')![0])
          : '';

        const lastName = Object.entries(mapping)
          .find(([_, v]) => v === 'lastname')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'lastname')![0])
          : '';

        const email = Object.entries(mapping)
          .find(([_, v]) => v === 'email')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'email')![0])
          : '';

        const phone = Object.entries(mapping)
          .find(([_, v]) => v === 'phone')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'phone')![0])
          : '';

        const cnic = Object.entries(mapping)
          .find(([_, v]) => v === 'cnic')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'cnic')![0])
          : '';

        const departmentName = Object.entries(mapping)
          .find(([_, v]) => v === 'department')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'department')![0])
          : '';

        const designation = Object.entries(mapping)
          .find(([_, v]) => v === 'designation')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'designation')![0])
          : '';

        const employmentStatus = Object.entries(mapping)
          .find(([_, v]) => v === 'employmentstatus')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'employmentstatus')![0])
          : 'PERMANENT';

        const dateOfJoiningStr = Object.entries(mapping)
          .find(([_, v]) => v === 'dateofjoining')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'dateofjoining')![0])
          : '';

        const companyCode = Object.entries(mapping)
          .find(([_, v]) => v === 'company')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'company')![0])
          : '';

        const locationName = Object.entries(mapping)
          .find(([_, v]) => v === 'location')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'location')![0])
          : '';

        const bankAccountNumber = Object.entries(mapping)
          .find(([_, v]) => v === 'bankaccountnumber')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'bankaccountnumber')![0])
          : '';

        const baseSalaryStr = Object.entries(mapping)
          .find(([_, v]) => v === 'basesalary')?.[0]
          ? getMappedValue(Object.entries(mapping).find(([_, v]) => v === 'basesalary')![0])
          : '';

        // Validate required fields
        if (!firstName || !lastName || !departmentName) {
          errors.push({
            row: i + 2,
            message: 'Missing required fields (First Name, Last Name, or Department)',
          });
          continue;
        }

        // Find department
        const department = departments.find(
          (d) =>
            d.name.toLowerCase() === departmentName.toLowerCase() ||
            d.code.toLowerCase() === departmentName.toLowerCase()
        );

        if (!department) {
          errors.push({
            row: i + 2,
            message: `Department not found: ${departmentName}`,
          });
          continue;
        }

        // Find company
        const company = companies.find(
          (c) =>
            c.name.toLowerCase() === companyCode.toLowerCase() ||
            c.code.toLowerCase() === companyCode.toLowerCase()
        ) || companies[0];

        // Find location
        const location = locations.find(
          (l) => l.name.toLowerCase() === locationName.toLowerCase()
        ) || locations[0];

        // Parse date
        let dateOfJoining = new Date();
        if (dateOfJoiningStr) {
          const parsed = new Date(dateOfJoiningStr);
          if (!isNaN(parsed.getTime())) {
            dateOfJoining = parsed;
          }
        }

        // Validate employment status
        const validStatuses = ['PERMANENT', 'PROBATION', 'CONSULTANT'];
        const status = validStatuses.includes(employmentStatus.toUpperCase())
          ? employmentStatus.toUpperCase()
          : 'PERMANENT';

        // Create employee
        const employee = await prisma.employee.create({
          data: {
            empCode: empCode || `AUTO-${Date.now()}`,
            firstName,
            lastName,
            email: email || null,
            phone: phone || null,
            cnic: cnic || null,
            designation,
            departmentId: department.id,
            companyId: company?.id,
            locationId: location?.id,
            employmentStatus: status as any,
            dateOfJoining,
            bankAccountNumber: bankAccountNumber || null,
            isActive: true,
          },
        });

        // Create salary history if baseSalary provided
        if (baseSalaryStr) {
          const baseSalary = parseCurrency(baseSalaryStr);
          if (baseSalary > 0) {
            await prisma.salaryHistory.create({
              data: {
                employeeId: employee.id,
                baseSalary,
                currency: 'PKR',
                effectiveFrom: dateOfJoining,
                reason: 'Initial salary from bulk import',
              },
            });
          }
        }

        successCount++;
      } catch (err) {
        errors.push({
          row: i + 2,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Audit log
    if (successCount > 0) {
      await prisma.auditLog.create({
        data: {
          tableName: 'employees',
          recordId: 0,
          action: 'CREATE',
          module: 'EMPLOYEE_BULK_IMPORT',
          newValues: { successCount, totalRows: rows.length },
        },
      });
    }

    return NextResponse.json({
      success: successCount,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulk import:', error);
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}

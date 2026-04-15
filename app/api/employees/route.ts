import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { seedOnboardingTasksForEmployee } from '@/lib/services/onboardingService';
import { parseCurrency } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const meta = searchParams.get('meta');

    // If meta=true, return departments, companies, locations for forms
    if (meta === 'true') {
      const [departments, companies, locations] = await Promise.all([
        prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
        prisma.location.findMany({ orderBy: { name: 'asc' } }),
      ]);
      return NextResponse.json({ departments, companies, locations });
    }

    const includeExited = searchParams.get('includeExited') === 'true';
    const lifecycleStage = searchParams.get('lifecycleStage'); // ACTIVE | EXITED | ONBOARDING | etc.
    const companyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');

    const where: any = {};
    if (lifecycleStage) {
      where.lifecycleStage = lifecycleStage;
    } else if (!includeExited) {
      where.isActive = true;
    }
    if (companyId) where.companyId = parseInt(companyId);
    if (departmentId) where.departmentId = parseInt(departmentId);

    const employees = await prisma.employee.findMany({
      where,
      include: {
        department: true,
        company: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // Generate employee code based on department prefix
    // Convention: SAL-001, CSR-002, DEV-003, MKT-004, etc.
    // Sequence auto-increments per prefix, never reuses IDs
    const dept = await prisma.department.findUnique({
      where: { id: parseInt(data.departmentId) },
    });

    let deptCode = dept?.code || dept?.name?.substring(0, 3).toUpperCase() || 'GEN';

    // Override prefix for E-commerce designations
    const designation = (data.designation || '').toLowerCase();
    if (designation.includes('e commerce') || designation.includes('e-commerce') || designation.includes('ecommerce')) {
      deptCode = 'EC';
    }

    // Find the highest existing code for this department prefix
    const lastEmployee = await prisma.employee.findFirst({
      where: { empCode: { startsWith: `${deptCode}-` } },
      orderBy: { empCode: 'desc' },
    });

    let nextSeq = 1;
    if (lastEmployee) {
      const parts = lastEmployee.empCode.split('-');
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) {
        nextSeq = lastNum + 1;
      }
    }

    const empCode = `${deptCode}-${String(nextSeq).padStart(3, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        empCode,
        firstName: data.firstName,
        lastName: data.lastName,
        fatherName: data.fatherName || null,
        email: data.email || null,
        phone: data.phone || null,
        cnic: data.cnic || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        departmentId: parseInt(data.departmentId),
        companyId: data.companyId ? parseInt(data.companyId) : null,
        locationId: data.locationId ? parseInt(data.locationId) : null,
        designation: data.designation,
        team: (() => {
          const p = empCode.split('-')[0]?.toUpperCase();
          const d = (data.designation || '').toLowerCase();
          if (p === 'DR') return 'Decom-Robotics';
          if (p === 'EC' || d.includes('e commerce')) return 'E commerce';
          if (p === 'CSR' || d.includes('customer support')) return 'Customer Support';
          if (p === 'DEV' && d.includes('ui') && d.includes('ux')) return 'UI / UX';
          if (p === 'DEV') return 'Dev';
          if (p === 'DM') return 'Digital Marketing';
          if (p === 'UT') return 'UT';
          return null;
        })(),
        employmentStatus: data.employmentStatus,
        lifecycleStage: 'ACTIVE',
        dateOfJoining: new Date(data.dateOfJoining),
        probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankBranch: data.bankBranch || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        emergencyContactRelation: data.emergencyContactRelation || null,
        bloodGroup: data.bloodGroup || null,
        passportNumber: data.passportNumber || null,
        passportExpiry: data.passportExpiry ? new Date(data.passportExpiry) : null,
        maritalStatus: data.maritalStatus || null,
        nationality: data.nationality || null,
        education: data.education || null,
        references: data.references || null,
      },
    });

    // If companyIds array provided (multi-company), insert into join table
    const companyIds: number[] = Array.isArray(data.companyIds)
      ? data.companyIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))
      : data.companyId
        ? [parseInt(data.companyId)]
        : [];
    for (const cid of companyIds) {
      await prisma.$executeRaw`INSERT INTO employee_companies ("employeeId", "companyId", "assignedAt") VALUES (${employee.id}, ${cid}, NOW()) ON CONFLICT ("employeeId", "companyId") DO NOTHING`;
    }

    // If salary provided, create initial salary history
    if (data.baseSalary) {
      await prisma.salaryHistory.create({
        data: {
          employeeId: employee.id,
          baseSalary: parseCurrency(data.baseSalary),
          currency: data.currency || 'PKR',
          effectiveFrom: new Date(data.dateOfJoining),
          reason: 'Initial salary',
        },
      });
    }

    // Seed the default onboarding checklist (IT + HR tracks) for this new hire.
    // Runs best-effort — never blocks the create call even if it fails.
    try {
      const seeded = await seedOnboardingTasksForEmployee(
        employee.id,
        new Date(data.dateOfJoining)
      );
      console.log(`[employees POST] seeded ${seeded} onboarding tasks for employee ${employee.id}`);
    } catch (err) {
      console.warn('[employees POST] onboarding seed failed:', err);
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        tableName: 'employees',
        recordId: employee.id,
        action: 'CREATE',
        module: 'EMPLOYEE',
        newValues: employee,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import EmployeeListClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function EmployeesPage() {
  // Fetch employees with their multi-company assignments from the join table
  const employeesRaw = await prisma.employee.findMany({
    include: {
      department: true,
      company: true,
      location: true,
      assetAssignments: {
        where: { returnedDate: null },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch the join table data for all employees (raw SQL since client may not be regenerated)
  const ecRows: { employeeId: number; companyId: number; companyCode: string; companyName: string }[] =
    await prisma.$queryRawUnsafe(`
      SELECT ec."employeeId" as "employeeId", ec."companyId" as "companyId", c.code as "companyCode", c.name as "companyName"
      FROM employee_companies ec
      JOIN companies c ON c.id = ec."companyId"
      ORDER BY ec."assignedAt" ASC
    `);

  // Build a map: employeeId -> companies[]
  const empCompanyMap = new Map<number, { id: number; code: string; name: string }[]>();
  for (const row of ecRows) {
    if (!empCompanyMap.has(row.employeeId)) empCompanyMap.set(row.employeeId, []);
    empCompanyMap.get(row.employeeId)!.push({ id: row.companyId, code: row.companyCode, name: row.companyName });
  }

  const employees = employeesRaw.map((emp) => ({
    ...emp,
    companies: empCompanyMap.get(emp.id) || (emp.company ? [{ id: emp.company.id, code: (emp.company as any).code || '', name: emp.company.name }] : []),
  }));

  const [totalActive, totalInactive, totalExited, departments, companies, newThisMonth, onProbation] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({ where: { isActive: false } }),
    prisma.employee.count({
      where: {
        OR: [
          { isActive: false },
          { lifecycleStage: 'EXITED' },
          { lifecycleStage: 'EXIT_INITIATED' },
        ],
      },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.company.findMany({ where: { isActive: true } }),
    prisma.employee.count({
      where: {
        dateOfJoining: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.employee.count({ where: { employmentStatus: 'PROBATION' } }),
  ]);

  const stats = {
    total: totalActive + totalInactive,
    active: totalActive,
    exited: totalExited,
    onProbation,
    newThisMonth,
  };

  return (
    <div>
      <PageHero
        eyebrow="People / Directory"
        title="Employees"
        description="Manage employee lifecycle from offer to exit"
        actions={
          <>
            <Link href="/offer-letters/new" className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Offer Letter
            </Link>
            <Link href="/employees/import" className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Bulk Import
            </Link>
            <Link href="/employees/new" className="btn btn-accent">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
            </Link>
          </>
        }
      />

      <EmployeeListClient
        initialEmployees={employees as any[]}
        initialDepartments={departments}
        initialCompanies={companies}
        stats={stats}
      />
    </div>
  );
}

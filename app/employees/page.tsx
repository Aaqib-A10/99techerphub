import { prisma } from '@/lib/prisma';
import EmployeeListClient from './client';
import SplitButton from '@/app/components/SplitButton';

export const dynamic = 'force-dynamic';

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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalAll, totalActive, totalExited, exitedLast30, departments, companies, newThisMonth, onProbation] = await Promise.all([
    // Total = every employee ever hired (all records in DB)
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.employee.count({
      where: {
        OR: [
          { isActive: false },
          { lifecycleStage: 'EXITED' },
          { lifecycleStage: 'EXIT_INITIATED' },
        ],
      },
    }),
    // Exited in last 30 days — employees whose lifecycle changed to EXITED recently,
    // or who have an EmployeeExit record with exitDate in the last 30 days
    prisma.employee.count({
      where: {
        OR: [
          {
            exitRecord: { exitDate: { gte: thirtyDaysAgo } },
          },
          {
            lifecycleStage: { in: ['EXITED', 'EXIT_INITIATED'] },
            updatedAt: { gte: thirtyDaysAgo },
          },
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
    prisma.employee.count({ where: { employmentStatus: 'PROBATION', isActive: true } }),
  ]);

  const stats = {
    total: totalAll,
    active: totalActive,
    exited: totalExited,
    exitedLast30,
    onProbation,
    newThisMonth,
  };

  return (
    <div>
      {/* Page header — design system aesthetic. Eyebrow + title + subtitle, actions to the right. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            People · Directory
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Employees
          </h1>
          <p className="mt-[2px] text-[13px] text-core-text2">
            Manage employee lifecycle from offer to exit
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SplitButton
            primary={{
              label: 'Add Employee',
              href: '/employees/new',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14 M5 12h14" />
                </svg>
              ),
            }}
            actions={[
              {
                label: 'Bulk Import',
                href: '/employees/import',
                description: 'Import employees from a CSV or Excel file',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12" />
                  </svg>
                ),
              },
              {
                label: 'Send Offer Letter',
                href: '/offer-letters/new',
                description: 'Draft and send a new candidate offer',
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
      </div>

      <EmployeeListClient
        initialEmployees={employees as any[]}
        initialDepartments={departments}
        initialCompanies={companies}
        stats={stats}
      />
    </div>
  );
}

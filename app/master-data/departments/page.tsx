import { prisma } from '@/lib/prisma';
import DepartmentsClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Get employee count for each department
  const employeeCounts = await Promise.all(
    departments.map((d) =>
      prisma.employee.count({ where: { departmentId: d.id } })
    )
  );

  const employeeCountsMap = Object.fromEntries(
    departments.map((d, i) => [d.id, employeeCounts[i]])
  );

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Departments"
        title="Departments"
        description="Manage organizational departments and teams"
      />

      <DepartmentsClient
        initialDepartments={departments}
        employeeCounts={employeeCountsMap}
      />
    </div>
  );
}

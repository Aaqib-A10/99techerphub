import { prisma } from '@/lib/prisma';
import CompaniesClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Get employee and asset counts for each company
  const [employeeCounts, assetCounts] = await Promise.all([
    Promise.all(
      companies.map((c) =>
        prisma.employee.count({ where: { companyId: c.id } })
      )
    ),
    Promise.all(
      companies.map((c) =>
        prisma.asset.count({ where: { companyId: c.id } })
      )
    ),
  ]);

  const employeeCountsMap = Object.fromEntries(
    companies.map((c, i) => [c.id, employeeCounts[i]])
  );
  const assetCountsMap = Object.fromEntries(
    companies.map((c, i) => [c.id, assetCounts[i]])
  );

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Companies"
        title="Companies"
        description="Manage all company records across 99 Technologies"
      />

      <CompaniesClient
        initialCompanies={companies}
        employeeCounts={employeeCountsMap}
        assetCounts={assetCountsMap}
      />
    </div>
  );
}

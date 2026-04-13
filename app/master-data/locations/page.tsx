import { prisma } from '@/lib/prisma';
import LocationsClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function LocationsPage() {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Get employee and asset counts for each location
  const [employeeCounts, assetCounts] = await Promise.all([
    Promise.all(
      locations.map((l) =>
        prisma.employee.count({ where: { locationId: l.id } })
      )
    ),
    Promise.all(
      locations.map((l) =>
        prisma.asset.count({ where: { locationId: l.id } })
      )
    ),
  ]);

  const employeeCountsMap = Object.fromEntries(
    locations.map((l, i) => [l.id, employeeCounts[i]])
  );
  const assetCountsMap = Object.fromEntries(
    locations.map((l, i) => [l.id, assetCounts[i]])
  );

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Locations"
        title="Locations"
        description="Manage office locations and facilities"
      />

      <LocationsClient
        initialLocations={locations}
        employeeCounts={employeeCountsMap}
        assetCounts={assetCountsMap}
      />
    </div>
  );
}

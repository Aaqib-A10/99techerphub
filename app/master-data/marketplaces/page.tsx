import { prisma } from '@/lib/prisma';
import PageHero from '@/app/components/PageHero';
import MarketplacesClient from './client';

export const dynamic = 'force-dynamic';

export default async function MarketplacesPage() {
  const marketplaces = await prisma.marketplace.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });

  const initial = marketplaces.map((m) => ({
    id: m.id,
    name: m.name,
    isActive: m.isActive,
    employeeCount: m._count.employees,
  }));

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Marketplaces"
        title="Marketplaces"
        description="The catalog of e-commerce channels (Amazon, Walmart, eBay, ...). Add new ones here so managers can assign them on each employee's profile."
      />
      <MarketplacesClient initial={initial} />
    </div>
  );
}

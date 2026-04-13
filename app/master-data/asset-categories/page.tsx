import { prisma } from '@/lib/prisma';
import AssetCategoriesClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function AssetCategoriesPage() {
  const categories = await prisma.assetCategory.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Get asset count for each category
  const assetCounts = await Promise.all(
    categories.map((c) =>
      prisma.asset.count({ where: { categoryId: c.id } })
    )
  );

  const assetCountsMap = Object.fromEntries(
    categories.map((c, i) => [c.id, assetCounts[i]])
  );

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Categories"
        title="Asset Categories"
        description="Define and manage asset classification categories"
      />

      <AssetCategoriesClient
        initialCategories={categories}
        assetCounts={assetCountsMap}
      />
    </div>
  );
}

import { prisma } from '@/lib/prisma';
import ExpenseCategoriesClient from './client';
import PageHero from '@/app/components/PageHero';

export default async function ExpenseCategoriesPage() {
  const [categories, departments] = await Promise.all([
    prisma.expenseCategory.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Get expense count for each category
  const expenseCounts = await Promise.all(
    categories.map((c) =>
      prisma.expense.count({ where: { categoryId: c.id } })
    )
  );

  const expenseCountsMap = Object.fromEntries(
    categories.map((c, i) => [c.id, expenseCounts[i]])
  );

  return (
    <div>
      <PageHero
        eyebrow="Master Data / Categories"
        title="Expense Categories"
        description="Define and manage expense classification categories"
      />

      <ExpenseCategoriesClient
        initialCategories={categories}
        expenseCounts={expenseCountsMap}
        departments={departments}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import PageHero from '@/app/components/PageHero';

export default async function MasterDataPage() {
  const [
    companiesCount,
    departmentsCount,
    locationsCount,
    assetCategoriesCount,
    expenseCategoriesCount,
    marketplacesCount,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.department.count(),
    prisma.location.count(),
    prisma.assetCategory.count(),
    prisma.expenseCategory.count(),
    prisma.marketplace.count(),
  ]);

  const cards = [
    {
      title: 'Companies',
      description: 'Sub-companies: MNC, SJ, PCMART, RTI, LRI, Green Loop',
      count: companiesCount,
      href: '/master-data/companies',
    },
    {
      title: 'Departments',
      description: 'HR, IT, Finance, Operations, Sales, Marketing, Dev, Support, Admin',
      count: departmentsCount,
      href: '/master-data/departments',
    },
    {
      title: 'Locations',
      description: 'Eagan MN, Dubai, Islamabad HQ Floors 3/4/5',
      count: locationsCount,
      href: '/master-data/locations',
    },
    {
      title: 'Categories',
      description: 'Asset and expense categories used across the system',
      count: assetCategoriesCount + expenseCategoriesCount,
      href: '/master-data/asset-categories',
    },
    {
      title: 'Marketplaces',
      description: 'E-commerce channels assigned to employees: Amazon, Walmart, eBay, Back Market…',
      count: marketplacesCount,
      href: '/master-data/marketplaces',
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow="System / Master Data"
        title="Master Data Management"
        description="Manage core lookup tables used across the system"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-center justify-between gap-6 rounded-lg border border-core-border/85 bg-core-surface p-5 transition-all duration-200 hover:border-core-border hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.06)]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-core-text3">
                Lookup table
              </p>
              <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-core-text">
                {card.title}
              </h3>
              <p className="mt-1 text-[12.5px] text-core-text3">{card.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[22px] font-semibold tabular-nums text-core-text leading-none">
                  {card.count}
                </div>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.06em] text-core-text3">
                  records
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-core-text3 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-core-text2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

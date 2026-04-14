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
  ] = await Promise.all([
    prisma.company.count(),
    prisma.department.count(),
    prisma.location.count(),
    prisma.assetCategory.count(),
    prisma.expenseCategory.count(),
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
  ];

  return (
    <div>
      <PageHero
        eyebrow="System / Master Data"
        title="Master Data Management"
        description="Manage core lookup tables used across the system"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card group relative overflow-hidden p-6 transition-all"
            style={{ textDecoration: 'none' }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 24,
                bottom: 24,
                width: 2,
                backgroundColor: '#14B8A6',
                borderRadius: '0 1px 1px 0',
              }}
            />
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] font-bold uppercase mb-2"
                  style={{
                    color: '#14B8A6',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '0.14em',
                  }}
                >
                  Lookup Table
                </div>
                <h3
                  className="text-2xl font-black mb-2"
                  style={{ color: '#0B1F3A', letterSpacing: '-0.02em' }}
                >
                  {card.title}
                </h3>
                <p className="text-sm mb-4" style={{ color: '#44474D' }}>
                  {card.description}
                </p>
                <div
                  className="text-xs font-semibold inline-flex items-center gap-1"
                  style={{ color: '#14B8A6' }}
                >
                  Manage
                  <span aria-hidden>→</span>
                </div>
              </div>
              <div className="text-right">
                <div
                  className="text-5xl font-black"
                  style={{
                    color: '#0B1F3A',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '-0.04em',
                    fontFeatureSettings: '"tnum" 1',
                  }}
                >
                  {card.count}
                </div>
                <div
                  className="text-[10px] uppercase mt-1"
                  style={{
                    color: '#44474D',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '0.14em',
                  }}
                >
                  Records
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

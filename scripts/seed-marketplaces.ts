/**
 * Seed the initial Marketplace catalog. Idempotent — re-running just
 * upserts each entry. New marketplaces can be added via the admin UI at
 * /master-data/marketplaces, no script change needed.
 *
 * Run:
 *   npx tsx scripts/seed-marketplaces.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED = ['Amazon', 'Walmart', 'eBay', 'Back Market'];

async function main() {
  console.log('=== Seeding marketplaces ===');
  for (const name of SEED) {
    const m = await prisma.marketplace.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${m.name} (id=${m.id})`);
  }
  const count = await prisma.marketplace.count();
  console.log(`Done — ${count} marketplaces total`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

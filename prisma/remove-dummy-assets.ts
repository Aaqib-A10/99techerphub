// Remove dummy/test assets (99T- prefix) from the database
// Uses raw SQL to avoid TypeScript type-checking issues
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/remove-dummy-assets.ts

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Count dummy assets first
  const countResult: any[] = await prisma.$queryRaw`SELECT COUNT(*) as count FROM assets WHERE "assetTag" LIKE '99T-%'`;
  const dummyCount = Number(countResult[0].count);

  console.log(`\n🔍 Found ${dummyCount} dummy/test assets with 99T- prefix\n`);

  if (dummyCount === 0) {
    console.log('✅ No dummy assets found. Nothing to remove.');
    return;
  }

  // List them
  const dummyAssets: any[] = await prisma.$queryRaw`SELECT "assetTag", manufacturer, model FROM assets WHERE "assetTag" LIKE '99T-%' ORDER BY "assetTag"`;
  dummyAssets.forEach((a: any) => {
    console.log(`   - ${a.assetTag} (${a.manufacturer} ${a.model})`);
  });

  // Get IDs
  const ids: any[] = await prisma.$queryRaw`SELECT id FROM assets WHERE "assetTag" LIKE '99T-%'`;
  const idList = ids.map((r: any) => r.id);

  if (idList.length > 0) {
    const idStr = idList.join(',');

    // Delete assignments
    await prisma.$executeRawUnsafe(`DELETE FROM asset_assignments WHERE "assetId" IN (${idStr})`);
    console.log(`\n🗑️  Cleaned up asset assignments`);

    // Delete transfers
    await prisma.$executeRawUnsafe(`DELETE FROM asset_transfers WHERE "assetId" IN (${idStr})`);
    console.log(`🗑️  Cleaned up asset transfers`);

    // Delete audit logs
    await prisma.$executeRawUnsafe(`DELETE FROM audit_logs WHERE "recordId" IN (${idStr}) AND "tableName" = 'assets'`);
    console.log(`🗑️  Cleaned up audit logs`);
  }

  // Delete the dummy assets
  const deleted = await prisma.$executeRaw`DELETE FROM assets WHERE "assetTag" LIKE '99T-%'`;
  console.log(`🗑️  Removed ${deleted} dummy assets`);

  // Count remaining
  const remainResult: any[] = await prisma.$queryRaw`SELECT COUNT(*) as count FROM assets`;
  console.log(`\n✅ Cleanup complete! ${Number(remainResult[0].count)} real assets remain in the database.\n`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

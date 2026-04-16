/**
 * Asset Assignment Audit Script
 *
 * Surfaces every data inconsistency between:
 *   - Asset.isAssigned (denormalized flag)
 *   - Asset.assignedToName (legacy string from import)
 *   - AssetAssignment records (source of truth)
 *   - Employee.isActive / lifecycleStage
 *
 * Run: npx tsx scripts/audit-asset-assignments.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACEHOLDER_NAMES = ['', 'Available', 'available', 'N/A', 'n/a', 'Damage', 'Damaged', 'Retired', 'retired'];

function isPlaceholder(name: string | null | undefined): boolean {
  if (!name) return true;
  return PLACEHOLDER_NAMES.includes(name.trim());
}

function header(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function row(...vals: (string | number | null | undefined)[]) {
  console.log(vals.map(v => v ?? '-').join(' | '));
}

async function main() {
  console.log('99 Hub ERP — Asset Assignment Audit');
  console.log('Generated:', new Date().toISOString());

  // 1. Assets marked isAssigned=true but no active AssetAssignment
  header('1. GHOST ASSIGNMENTS (isAssigned=true, no active assignment record)');
  const ghostAssigned = await prisma.asset.findMany({
    where: {
      isAssigned: true,
      assignments: { none: { returnedDate: null } },
    },
    select: { id: true, assetTag: true, serialNumber: true, assignedToName: true, isRetired: true },
    orderBy: { assetTag: 'asc' },
  });
  console.log(`Found: ${ghostAssigned.length}`);
  if (ghostAssigned.length) {
    row('ID', 'Tag', 'Serial', 'AssignedToName', 'Retired');
    ghostAssigned.slice(0, 50).forEach(a =>
      row(a.id, a.assetTag, a.serialNumber, a.assignedToName, a.isRetired ? 'YES' : 'no')
    );
    if (ghostAssigned.length > 50) console.log(`... and ${ghostAssigned.length - 50} more`);
  }

  // 2. Assets with active AssetAssignment but isAssigned=false
  header('2. INVERSE GHOST (active assignment exists, but isAssigned=false)');
  const inverseGhost = await prisma.asset.findMany({
    where: {
      isAssigned: false,
      assignments: { some: { returnedDate: null } },
    },
    select: {
      id: true,
      assetTag: true,
      assignments: {
        where: { returnedDate: null },
        include: { employee: { select: { empCode: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { assetTag: 'asc' },
  });
  console.log(`Found: ${inverseGhost.length}`);
  if (inverseGhost.length) {
    row('ID', 'Tag', 'EmpCode', 'EmpName');
    inverseGhost.slice(0, 50).forEach(a => {
      const aa = a.assignments[0];
      row(a.id, a.assetTag, aa?.employee.empCode, `${aa?.employee.firstName} ${aa?.employee.lastName}`);
    });
  }

  // 3. Legacy assignedToName but no AssetAssignment record
  header('3. LEGACY ORPHAN NAMES (assignedToName set, no AssetAssignment)');
  const legacyOrphans = await prisma.asset.findMany({
    where: {
      assignedToName: { not: null },
      assignments: { none: {} },
    },
    select: { id: true, assetTag: true, assignedToName: true, isAssigned: true },
    orderBy: { assetTag: 'asc' },
  });
  const realLegacy = legacyOrphans.filter(a => !isPlaceholder(a.assignedToName));
  console.log(`Found (excluding placeholders): ${realLegacy.length}`);
  if (realLegacy.length) {
    row('ID', 'Tag', 'AssignedToName', 'isAssigned');
    realLegacy.slice(0, 50).forEach(a => row(a.id, a.assetTag, a.assignedToName, a.isAssigned ? 'YES' : 'no'));
    if (realLegacy.length > 50) console.log(`... and ${realLegacy.length - 50} more`);
  }

  // 4. Exited / inactive employees still holding assets
  header('4. EXITED EMPLOYEES STILL HOLDING ACTIVE ASSETS');
  const exitedWithAssets = await prisma.employee.findMany({
    where: {
      isActive: false,
      assetAssignments: { some: { returnedDate: null } },
    },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      lifecycleStage: true,
      dateOfLeaving: true,
      _count: { select: { assetAssignments: { where: { returnedDate: null } } } },
    },
    orderBy: { dateOfLeaving: 'desc' },
  });
  console.log(`Found: ${exitedWithAssets.length}`);
  if (exitedWithAssets.length) {
    row('ID', 'EmpCode', 'Name', 'Stage', 'LeftOn', 'ActiveAssets');
    exitedWithAssets.forEach(e =>
      row(
        e.id,
        e.empCode,
        `${e.firstName} ${e.lastName}`,
        e.lifecycleStage,
        e.dateOfLeaving?.toISOString().slice(0, 10),
        e._count.assetAssignments
      )
    );
  }

  // 5. Returned assets where isAssigned still true
  header('5. RETURNED BUT FLAG STUCK (returnedDate set, but isAssigned=true)');
  const stuckReturns = await prisma.asset.findMany({
    where: {
      isAssigned: true,
      assignments: { every: { returnedDate: { not: null } } },
      AND: [{ assignments: { some: {} } }],
    },
    select: { id: true, assetTag: true, assignedToName: true },
  });
  console.log(`Found: ${stuckReturns.length}`);
  if (stuckReturns.length) {
    row('ID', 'Tag', 'AssignedToName');
    stuckReturns.forEach(a => row(a.id, a.assetTag, a.assignedToName));
  }

  // 6. Multiple active assignments on same asset (impossible but check)
  header('6. MULTIPLE ACTIVE ASSIGNMENTS ON SAME ASSET (should be 0)');
  const dupActive = await prisma.$queryRaw<Array<{ asset_id: number; count: bigint }>>`
    SELECT asset_id, COUNT(*)::bigint as count
    FROM asset_assignments
    WHERE returned_date IS NULL
    GROUP BY asset_id
    HAVING COUNT(*) > 1
  `;
  console.log(`Found: ${dupActive.length}`);
  if (dupActive.length) {
    row('AssetID', 'ActiveAssignmentCount');
    dupActive.forEach(d => row(Number(d.asset_id), Number(d.count)));
  }

  // 7. Summary
  header('SUMMARY');
  const totalAssets = await prisma.asset.count();
  const totalAssignments = await prisma.assetAssignment.count();
  const activeAssignments = await prisma.assetAssignment.count({ where: { returnedDate: null } });
  const flaggedAssigned = await prisma.asset.count({ where: { isAssigned: true } });
  const flaggedRetired = await prisma.asset.count({ where: { isRetired: true } });

  console.log(`Total assets:                     ${totalAssets}`);
  console.log(`Total assignment records:         ${totalAssignments}`);
  console.log(`Active assignments (open):        ${activeAssignments}`);
  console.log(`Assets with isAssigned=true flag: ${flaggedAssigned}`);
  console.log(`Assets retired:                   ${flaggedRetired}`);
  console.log('');
  console.log('Discrepancy counts:');
  console.log(`  1. Ghost assigned (flag w/o record):     ${ghostAssigned.length}`);
  console.log(`  2. Inverse ghost (record w/o flag):      ${inverseGhost.length}`);
  console.log(`  3. Legacy orphan names:                  ${realLegacy.length}`);
  console.log(`  4. Exited employees holding assets:      ${exitedWithAssets.length}`);
  console.log(`  5. Stuck flag after return:              ${stuckReturns.length}`);
  console.log(`  6. Duplicate active assignments:         ${dupActive.length}`);

  const total =
    ghostAssigned.length +
    inverseGhost.length +
    realLegacy.length +
    exitedWithAssets.length +
    stuckReturns.length +
    dupActive.length;
  console.log(`\nTOTAL DISCREPANCIES: ${total}`);

  if (total === 0) {
    console.log('\n✓ Asset assignment data is CLEAN.');
  } else {
    console.log('\n✗ Discrepancies found. Run with --fix to auto-repair (not yet implemented).');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

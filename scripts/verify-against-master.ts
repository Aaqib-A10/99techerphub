/**
 * Verify existing AssetAssignments against the master inventory sheet.
 *
 * For every row in the master mapping CSV:
 *   - Find the asset in DB (by tag or serial)
 *   - If it has an active assignment, compare the assigned employee against
 *     what the master says
 *   - Flag mismatches
 *
 * Outputs a CSV of conflicts for admin review.
 *
 * Usage:
 *   npx tsx scripts/verify-against-master.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const STOP = new Set([
  'mr','mrs','ms','dr','sir','madam','bhai','sahab','sb','sahib','the','and','&',
  'house','home','office','col',
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s).split(' ').filter(t => t.length > 1 && !STOP.has(t))
  );
}

function score(target: Set<string>, candidate: Set<string>): number {
  if (target.size === 0 || candidate.size === 0) return 0;
  let shared = 0;
  for (const t of target) if (candidate.has(t)) shared++;
  return shared / Math.min(target.size, candidate.size);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim()));
}

async function main() {
  console.log('Verifying existing AssetAssignments vs master inventory');

  // Read master CSV
  const csvPath = join(__dirname, 'master-mappings.csv');
  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(text);
  const header = rows[0].map(h => h.trim().toLowerCase());
  const iTag = header.indexOf('asset_tag');
  const iSer = header.indexOf('serial');
  const iName = header.indexOf('employee_name');
  const iSrc = header.indexOf('source');

  type MasterRow = { tag: string; serial: string; name: string; source: string };
  const master: MasterRow[] = rows.slice(1).map(r => ({
    tag: (r[iTag] || '').trim(),
    serial: (r[iSer] || '').trim(),
    name: (r[iName] || '').trim(),
    source: (r[iSrc] || '').trim(),
  }));

  // Load assets with their active assignment
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      assetTag: true,
      serialNumber: true,
      assignments: {
        where: { returnedDate: null },
        include: {
          employee: {
            select: { id: true, empCode: true, firstName: true, lastName: true, isActive: true },
          },
        },
      },
    },
  });
  const byTag = new Map(assets.map(a => [a.assetTag.toUpperCase(), a]));
  const bySerial = new Map(
    assets.filter(a => a.serialNumber).map(a => [a.serialNumber!.toUpperCase().trim(), a])
  );

  // Match + compare
  const matches: Array<{ m: MasterRow; asset: (typeof assets)[0]; empCode: string; empName: string; sim: number }> = [];
  const mismatches: Array<{ m: MasterRow; asset: (typeof assets)[0]; empCode: string; empName: string; sim: number }> = [];
  const noActiveAssignment: Array<{ m: MasterRow; asset: (typeof assets)[0] }> = [];
  const assetMissing: MasterRow[] = [];

  for (const m of master) {
    let asset: (typeof assets)[0] | undefined;
    if (m.tag) asset = byTag.get(m.tag.toUpperCase());
    if (!asset && m.serial) asset = bySerial.get(m.serial.toUpperCase().trim());

    if (!asset) {
      assetMissing.push(m);
      continue;
    }

    const aa = asset.assignments[0];
    if (!aa) {
      noActiveAssignment.push({ m, asset });
      continue;
    }

    const dbName = `${aa.employee.firstName} ${aa.employee.lastName}`;
    const sim = score(tokenize(m.name), tokenize(dbName));
    const entry = { m, asset, empCode: aa.employee.empCode, empName: dbName, sim };

    if (sim >= 0.67) matches.push(entry);
    else mismatches.push(entry);
  }

  const bar = '='.repeat(80);

  console.log('');
  console.log(bar);
  console.log(`VERIFIED (DB matches master): ${matches.length}`);
  console.log(bar);

  console.log('');
  console.log(bar);
  console.log(`MISMATCHES (DB disagrees with master): ${mismatches.length}`);
  console.log(bar);
  mismatches.slice(0, 50).forEach(x => {
    console.log(
      `  ${x.asset.assetTag} | master="${x.m.name}" | db=[${x.empCode}] ${x.empName} | sim=${x.sim.toFixed(2)}`
    );
  });
  if (mismatches.length > 50) console.log(`  ... and ${mismatches.length - 50} more`);

  console.log('');
  console.log(bar);
  console.log(`MASTER SAYS ASSIGNED BUT DB HAS NONE: ${noActiveAssignment.length}`);
  console.log(bar);

  console.log('');
  console.log(bar);
  console.log(`ASSET NOT IN DB: ${assetMissing.length}`);
  console.log(bar);

  console.log('');
  console.log(bar);
  console.log('SUMMARY');
  console.log(bar);
  console.log(`Master rows checked:                ${master.length}`);
  console.log(`  ✓ Verified (DB matches master):   ${matches.length}`);
  console.log(`  ✗ Mismatch:                       ${mismatches.length}`);
  console.log(`  ⚠ No active assignment in DB:     ${noActiveAssignment.length}`);
  console.log(`  — Asset not in DB:                ${assetMissing.length}`);

  // Export mismatches to CSV
  if (mismatches.length > 0) {
    const outPath = join(__dirname, '..', 'master-mismatches.csv');
    const esc = (s: string | number | null | undefined) => {
      const str = String(s ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      'Asset Tag',
      'Master Says',
      'DB Currently Assigned EmpCode',
      'DB Currently Assigned Name',
      'Name Similarity',
      'Action (keep-db / use-master / skip)',
      'Notes',
    ];
    const lines = [header.join(',')];
    for (const x of mismatches) {
      lines.push([
        x.asset.assetTag,
        x.m.name,
        x.empCode,
        x.empName,
        x.sim.toFixed(2),
        '',
        '',
      ].map(esc).join(','));
    }
    writeFileSync(outPath, lines.join('\n') + '\n');
    console.log(`\nMismatches exported to: ${outPath}`);
    console.log('Admin should fill in "Action" column: keep-db | use-master | skip');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

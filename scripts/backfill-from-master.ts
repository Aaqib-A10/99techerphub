/**
 * Backfill asset assignments from the master inventory sheet.
 *
 * Reads scripts/master-mappings.csv (derived from the authoritative
 * inventory Excel file) and creates AssetAssignment records,
 * matching assets by assetTag or serial number, and fuzzy-matching
 * employee names.
 *
 * Usage:
 *   npx tsx scripts/backfill-from-master.ts            # dry-run
 *   npx tsx scripts/backfill-from-master.ts --apply    # execute
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Tokens to strip
const STOP = new Set([
  'mr','mrs','ms','dr','sir','madam','bhai','sahab','sb','sahib','the','and','&',
  'house','home','office','col',
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter(t => t.length > 1 && !STOP.has(t))
  );
}

function score(target: Set<string>, candidate: Set<string>): number {
  if (target.size === 0 || candidate.size === 0) return 0;
  let shared = 0;
  for (const t of target) if (candidate.has(t)) shared++;
  return shared / Math.min(target.size, candidate.size);
}

// Minimal CSV parser
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

type MasterRow = {
  assetTag: string;
  serial: string;
  employeeName: string;
  source: string;
  comments: string;
};

async function main() {
  console.log(`Backfill from Master Inventory — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  // Read CSV
  const csvPath = join(__dirname, 'master-mappings.csv');
  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(text);
  const header = rows[0].map(h => h.trim());
  const idx = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iTag = idx('asset_tag');
  const iSer = idx('serial');
  const iName = idx('employee_name');
  const iSrc = idx('source');
  const iCmt = idx('comments');

  const master: MasterRow[] = rows.slice(1).map(r => ({
    assetTag: (r[iTag] || '').trim(),
    serial: (r[iSer] || '').trim(),
    employeeName: (r[iName] || '').trim(),
    source: (r[iSrc] || '').trim(),
    comments: (r[iCmt] || '').trim(),
  }));
  console.log(`Master rows: ${master.length}`);

  // Load all assets + employees
  const [assets, employees] = await Promise.all([
    prisma.asset.findMany({
      select: { id: true, assetTag: true, serialNumber: true, isAssigned: true, condition: true, assignedToName: true },
    }),
    prisma.employee.findMany({
      select: { id: true, empCode: true, firstName: true, lastName: true, isActive: true },
    }),
  ]);
  console.log(`DB: ${assets.length} assets, ${employees.length} employees`);

  // Indexes
  const byTag = new Map(assets.map(a => [a.assetTag.toUpperCase(), a]));
  const bySerial = new Map(
    assets.filter(a => a.serialNumber).map(a => [a.serialNumber!.toUpperCase().trim(), a])
  );

  const empIdx = employees.map(e => ({
    ...e,
    fullName: `${e.firstName} ${e.lastName}`.trim(),
    tokens: tokenize(`${e.firstName} ${e.lastName}`),
  }));

  // Load existing active assignments to avoid duplicates
  const existingActive = await prisma.assetAssignment.findMany({
    where: { returnedDate: null },
    select: { assetId: true, employeeId: true },
  });
  const activeAssetIds = new Set(existingActive.map(e => e.assetId));

  // Process
  const matched: Array<{ m: MasterRow; asset: (typeof assets)[0]; emp: (typeof empIdx)[0]; score: number }> = [];
  const skipDup: Array<{ m: MasterRow; asset: (typeof assets)[0] }> = [];
  const assetNotFound: MasterRow[] = [];
  const empNotFound: Array<{ m: MasterRow; asset: (typeof assets)[0]; best?: { emp: (typeof empIdx)[0]; score: number } }> = [];
  const ambiguous: Array<{ m: MasterRow; asset: (typeof assets)[0]; candidates: Array<{ emp: (typeof empIdx)[0]; score: number }> }> = [];

  for (const m of master) {
    // Resolve asset
    let asset: (typeof assets)[0] | undefined;
    if (m.assetTag) {
      asset = byTag.get(m.assetTag.toUpperCase());
    }
    if (!asset && m.serial) {
      asset = bySerial.get(m.serial.toUpperCase().trim());
    }

    if (!asset) {
      assetNotFound.push(m);
      continue;
    }

    if (activeAssetIds.has(asset.id)) {
      skipDup.push({ m, asset });
      continue;
    }

    // Match employee
    const target = tokenize(m.employeeName);
    if (target.size === 0) {
      empNotFound.push({ m, asset });
      continue;
    }

    const scored = empIdx
      .map(emp => ({ emp, score: score(target, emp.tokens) }))
      .filter(s => s.score >= 0.5)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      empNotFound.push({ m, asset });
      continue;
    }

    const top = scored[0];
    const tied = scored.filter(s => s.score === top.score);

    // Prefer active employee when tied
    if (tied.length > 1) {
      const active = tied.filter(s => s.emp.isActive);
      if (active.length === 1) {
        matched.push({ m, asset, emp: active[0].emp, score: active[0].score });
      } else {
        ambiguous.push({ m, asset, candidates: tied.slice(0, 3) });
      }
    } else {
      if (top.score >= 0.67) {
        matched.push({ m, asset, emp: top.emp, score: top.score });
      } else {
        ambiguous.push({ m, asset, candidates: scored.slice(0, 3) });
      }
    }
  }

  // Report
  const bar = '='.repeat(80);
  console.log('');
  console.log(bar);
  console.log(`MATCHED (will assign): ${matched.length}`);
  console.log(bar);
  matched.slice(0, 30).forEach(x =>
    console.log(
      `  ${x.asset.assetTag} | "${x.m.employeeName}" → [${x.emp.empCode}] ${x.emp.fullName}${!x.emp.isActive ? ' (INACTIVE)' : ''} | ${x.score.toFixed(2)}`
    )
  );
  if (matched.length > 30) console.log(`  ... and ${matched.length - 30} more`);

  console.log('');
  console.log(bar);
  console.log(`AMBIGUOUS (needs manual review): ${ambiguous.length}`);
  console.log(bar);
  ambiguous.slice(0, 30).forEach(a => {
    console.log(`  ${a.asset.assetTag} | "${a.m.employeeName}"`);
    a.candidates.forEach(c =>
      console.log(`    → [${c.emp.empCode}] ${c.emp.fullName}${!c.emp.isActive ? ' (INACTIVE)' : ''} | ${c.score.toFixed(2)}`)
    );
  });
  if (ambiguous.length > 30) console.log(`  ... and ${ambiguous.length - 30} more`);

  console.log('');
  console.log(bar);
  console.log(`ASSET NOT FOUND IN DB: ${assetNotFound.length}`);
  console.log(bar);
  assetNotFound.slice(0, 30).forEach(m =>
    console.log(`  tag="${m.assetTag}" serial="${m.serial}" name="${m.employeeName}" src=${m.source}`)
  );
  if (assetNotFound.length > 30) console.log(`  ... and ${assetNotFound.length - 30} more`);

  console.log('');
  console.log(bar);
  console.log(`EMPLOYEE NOT FOUND: ${empNotFound.length}`);
  console.log(bar);
  empNotFound.slice(0, 30).forEach(x =>
    console.log(`  ${x.asset.assetTag} | "${x.m.employeeName}"`)
  );

  console.log('');
  console.log(bar);
  console.log(`SKIPPED (already has active assignment): ${skipDup.length}`);
  console.log(bar);

  console.log('');
  console.log(bar);
  console.log('SUMMARY');
  console.log(bar);
  console.log(`Master rows:           ${master.length}`);
  console.log(`  → Matched:           ${matched.length}`);
  console.log(`  → Ambiguous:         ${ambiguous.length}`);
  console.log(`  → Asset not in DB:   ${assetNotFound.length}`);
  console.log(`  → Employee unknown:  ${empNotFound.length}`);
  console.log(`  → Already assigned:  ${skipDup.length}`);

  // Export ambiguous to CSV for admin review
  if (ambiguous.length > 0) {
    const amPath = join(__dirname, '..', 'master-ambiguous.csv');
    const esc = (s: string | number | null | undefined) => {
      const str = String(s ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      'Asset Tag','Legacy Name',
      'Candidate 1 EmpCode','Candidate 1 Name','Candidate 1 Active','Candidate 1 Score',
      'Candidate 2 EmpCode','Candidate 2 Name','Candidate 2 Active','Candidate 2 Score',
      'Candidate 3 EmpCode','Candidate 3 Name','Candidate 3 Active','Candidate 3 Score',
      'SELECTED EmpCode (fill in)','Notes (optional)',
    ];
    const lines = [header.join(',')];
    for (const a of ambiguous) {
      const c = a.candidates.slice(0, 3);
      lines.push([
        a.asset.assetTag, a.m.employeeName,
        c[0]?.emp.empCode, c[0]?.emp.fullName, c[0] ? (c[0].emp.isActive ? 'Y' : 'N') : '', c[0]?.score.toFixed(2),
        c[1]?.emp.empCode, c[1]?.emp.fullName, c[1] ? (c[1].emp.isActive ? 'Y' : 'N') : '', c[1]?.score.toFixed(2),
        c[2]?.emp.empCode, c[2]?.emp.fullName, c[2] ? (c[2].emp.isActive ? 'Y' : 'N') : '', c[2]?.score.toFixed(2),
        '', '',
      ].map(esc).join(','));
    }
    writeFileSync(amPath, lines.join('\n') + '\n');
    console.log(`\nAmbiguous rows exported to: ${amPath}`);
  }

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes made. Re-run with --apply to create records.');
    return;
  }

  // APPLY
  console.log('\nCreating AssetAssignment records...');
  let created = 0, failed = 0;
  for (const x of matched) {
    try {
      await prisma.$transaction(async tx => {
        await tx.assetAssignment.create({
          data: {
            assetId: x.asset.id,
            employeeId: x.emp.id,
            assignedDate: new Date(),
            conditionAtAssignment: x.asset.condition,
            notes: `Backfilled from master inventory [${x.m.source}] "${x.m.employeeName}"${x.m.comments ? ` — ${x.m.comments}` : ''}`,
          },
        });
        if (!x.asset.isAssigned) {
          await tx.asset.update({
            where: { id: x.asset.id },
            data: { isAssigned: true },
          });
        }
      });
      created++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${x.asset.assetTag}: ${(e as Error).message}`);
    }
  }
  console.log(`\nCreated: ${created}`);
  console.log(`Failed:  ${failed}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Bulk-import the 17 assets present in the master inventory but missing
 * from the database. Reads master-assets-missing.csv (produced by
 * scripts/backfill-from-master.ts) and creates Asset rows with sensible
 * defaults.
 *
 * Defaults applied:
 *   - companyId  = 31  (99 Technologies)
 *   - locationId = 14  (PK - Islamabad Office)
 *   - manufacturer / model = 'Unknown'  (admin can fix later in UI)
 *   - condition  = WORKING
 *   - categoryId is inferred from the asset tag / serial:
 *       LAPTOP-*  -> 1   (Laptop)
 *       MI-*      -> 5   (iPad/Tablet)
 *       no tag    -> 12  (Monitor/LCD)  — also auto-generates LCD-R-### tag
 *
 * Usage:
 *   npx tsx scripts/import-missing-assets.ts                # dry-run
 *   npx tsx scripts/import-missing-assets.ts --apply        # commit
 *   npx tsx scripts/import-missing-assets.ts --csv path.csv # custom CSV path
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const csvArgIdx = process.argv.indexOf('--csv');
const csvPath = csvArgIdx >= 0 ? process.argv[csvArgIdx + 1] : join(__dirname, '..', 'master-assets-missing.csv');

// Defaults — change here if needed
const DEFAULT_COMPANY_ID = 31;   // 99 Technologies
const DEFAULT_LOCATION_ID = 14;  // PK - Islamabad Office
const DEFAULT_MANUFACTURER = 'Unknown';
const DEFAULT_MODEL = 'Unknown';

const CATEGORY_LAPTOP = 1;
const CATEGORY_TABLET = 5;
const CATEGORY_LCD = 12;

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

interface Plan {
  assetTag: string;
  serialNumber: string;
  categoryId: number;
  legacyName: string;
  source: string;
  comments: string;
  generatedTag: boolean;
  generatedSerial: boolean;
  reason?: string;
}

async function main() {
  console.log(`Importing missing assets from: ${csvPath}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const text = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error('CSV is empty or only has a header');
    process.exit(1);
  }
  const header = rows[0].map(h => h.trim().toLowerCase());
  const iTag = header.indexOf('master asset tag');
  const iSer = header.indexOf('master serial');
  const iName = header.indexOf('master says (employee)');
  const iSrc = header.indexOf('source');
  const iComm = header.indexOf('comments');

  if (iTag === -1 || iSer === -1) {
    console.error('CSV missing required columns: "Master Asset Tag", "Master Serial"');
    process.exit(1);
  }

  // Find the next free LCD-R-### number to allocate to no-tag rows
  const maxLcd = await prisma.asset.findFirst({
    where: { assetTag: { startsWith: 'LCD-R-' } },
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });
  let nextLcdNum = 1;
  if (maxLcd?.assetTag) {
    const m = maxLcd.assetTag.match(/^LCD-R-(\d+)$/);
    if (m) nextLcdNum = parseInt(m[1], 10) + 1;
  }
  console.log(`Next LCD-R-### tag will start at: LCD-R-${nextLcdNum}`);

  const plan: Plan[] = [];
  for (const r of rows.slice(1)) {
    let tag = (r[iTag] || '').trim();
    let serial = (r[iSer] || '').trim();
    const name = (r[iName] || '').trim();
    const source = (r[iSrc] || '').trim();
    const comments = (r[iComm] || '').trim();

    let categoryId: number;
    let generatedTag = false;
    let generatedSerial = false;

    if (tag.startsWith('LAPTOP-')) {
      categoryId = CATEGORY_LAPTOP;
    } else if (tag.startsWith('MI-')) {
      categoryId = CATEGORY_TABLET;
    } else if (!tag) {
      // No tag — assume LCD (per CSV source column)
      categoryId = CATEGORY_LCD;
      tag = `LCD-R-${nextLcdNum++}`;
      generatedTag = true;
    } else {
      // Unknown prefix — default to laptop, log as a concern
      categoryId = CATEGORY_LAPTOP;
    }

    // Serial is required by schema; fall back to a placeholder
    if (!serial) {
      serial = `UNKNOWN-${tag}`;
      generatedSerial = true;
    }

    plan.push({
      assetTag: tag, serialNumber: serial, categoryId,
      legacyName: name, source, comments, generatedTag, generatedSerial,
    });
  }

  // Validate: ensure tags are unique within this batch and don't collide with DB
  const seen = new Set<string>();
  const tags = plan.map(p => p.assetTag);
  const dupesInBatch = tags.filter(t => {
    if (seen.has(t)) return true;
    seen.add(t);
    return false;
  });
  if (dupesInBatch.length) {
    console.error('Duplicate tags within batch:', dupesInBatch);
    process.exit(1);
  }
  const existing = await prisma.asset.findMany({
    where: { assetTag: { in: tags } },
    select: { assetTag: true },
  });
  if (existing.length) {
    console.error('Tags already in DB (skipping):', existing.map(a => a.assetTag));
    plan.forEach(p => {
      if (existing.some(e => e.assetTag === p.assetTag)) p.reason = 'ALREADY_EXISTS';
    });
  }

  const toCreate = plan.filter(p => !p.reason);

  // Preview
  console.log('');
  console.log('PLAN:');
  console.log(`  ${'tag'.padEnd(13)} ${'cat'.padEnd(4)} ${'serial'.padEnd(20)} legacy_name`);
  for (const p of plan) {
    const flags = [
      p.generatedTag ? '[gen-tag]' : '',
      p.generatedSerial ? '[gen-ser]' : '',
      p.reason ? `[${p.reason}]` : '',
    ].filter(Boolean).join(' ');
    console.log(`  ${p.assetTag.padEnd(13)} ${String(p.categoryId).padEnd(4)} ${p.serialNumber.padEnd(20)} ${p.legacyName} ${flags}`);
  }

  console.log('');
  console.log(`To create:        ${toCreate.length}`);
  console.log(`Already exists:   ${plan.length - toCreate.length}`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes made. Re-run with --apply to create assets.');
    return;
  }

  console.log('');
  console.log('Creating assets...');
  let created = 0;
  let failed = 0;
  for (const p of toCreate) {
    try {
      await prisma.asset.create({
        data: {
          assetTag: p.assetTag,
          serialNumber: p.serialNumber,
          categoryId: p.categoryId,
          companyId: DEFAULT_COMPANY_ID,
          locationId: DEFAULT_LOCATION_ID,
          manufacturer: DEFAULT_MANUFACTURER,
          model: DEFAULT_MODEL,
          condition: 'WORKING',
          assignedToName: p.legacyName || null,
          isAssigned: !!p.legacyName,
          notes: [p.source, p.comments].filter(Boolean).join(' / ') || null,
        },
      });
      created++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${p.assetTag}: ${(e as Error).message}`);
    }
  }

  console.log('');
  console.log(`Created: ${created}`);
  console.log(`Failed:  ${failed}`);
  console.log('');
  console.log('Note: assets are flagged isAssigned=true with a legacy assignedToName.');
  console.log('To create proper AssetAssignment records linking them to employees,');
  console.log('run: npx tsx scripts/backfill-asset-assignments.ts --apply');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Import manually-resolved asset assignments from the admin team's CSV.
 *
 * Expects the CSV exported by backfill-asset-assignments.ts --export-ambiguous,
 * with the "SELECTED EmpCode (fill in)" column populated.
 *
 * Usage:
 *   npx tsx scripts/import-resolved-assignments.ts <path.csv>            # dry-run
 *   npx tsx scripts/import-resolved-assignments.ts <path.csv> --apply    # execute
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const csvPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-resolved-assignments.ts <path.csv> [--apply]');
  process.exit(1);
}

// Minimal CSV parser (handles quoted fields with commas and escaped quotes)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(f => f.trim().length > 0));
}

async function main() {
  console.log(`Importing resolved assignments from: ${csvPath}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const text = readFileSync(csvPath!, 'utf-8');
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.error('CSV is empty');
    process.exit(1);
  }

  const header = rows[0];
  const tagIdx = header.findIndex(h => h.trim().toLowerCase() === 'asset tag');
  const selIdx = header.findIndex(h => h.trim().toLowerCase().startsWith('selected empcode'));
  const notesIdx = header.findIndex(h => h.trim().toLowerCase().startsWith('notes'));
  const legacyIdx = header.findIndex(h => h.trim().toLowerCase() === 'legacy name');

  if (tagIdx === -1 || selIdx === -1) {
    console.error('CSV must have "Asset Tag" and "SELECTED EmpCode" columns');
    process.exit(1);
  }

  const data = rows.slice(1);
  console.log(`Data rows: ${data.length}`);

  let toAssign = 0;
  let skippedEmpty = 0;
  let skippedMarker = 0;
  let invalid = 0;
  const plan: Array<{ tag: string; empCode: string; legacy: string; notes: string }> = [];

  for (const r of data) {
    const tag = (r[tagIdx] || '').trim();
    const selected = (r[selIdx] || '').trim();
    const legacy = (r[legacyIdx] || '').trim();
    const notes = notesIdx >= 0 ? (r[notesIdx] || '').trim() : '';

    if (!tag) continue;
    if (!selected) {
      skippedEmpty++;
      continue;
    }
    if (/^(skip|none|no|-|n\/a|na)$/i.test(selected)) {
      skippedMarker++;
      continue;
    }

    plan.push({ tag, empCode: selected, legacy, notes });
    toAssign++;
  }

  console.log('');
  console.log(`To assign:           ${toAssign}`);
  console.log(`Skipped (blank):     ${skippedEmpty}`);
  console.log(`Skipped (marker):    ${skippedMarker}`);

  // Validate before applying — resolve asset tags and emp codes
  const tags = plan.map(p => p.tag);
  const empCodes = [...new Set(plan.map(p => p.empCode))];

  const assetsFound = await prisma.asset.findMany({
    where: { assetTag: { in: tags } },
    select: { id: true, assetTag: true, isAssigned: true, condition: true, assignedToName: true },
  });
  const assetMap = new Map(assetsFound.map(a => [a.assetTag, a]));

  const emps = await prisma.employee.findMany({
    where: { empCode: { in: empCodes } },
    select: { id: true, empCode: true, firstName: true, lastName: true, isActive: true },
  });
  const empMap = new Map(emps.map(e => [e.empCode, e]));

  const validatedPlan: typeof plan = [];
  console.log('');
  console.log('VALIDATION ERRORS:');
  for (const p of plan) {
    if (!assetMap.has(p.tag)) {
      console.log(`  ✗ Asset not found: ${p.tag}`);
      invalid++;
      continue;
    }
    if (!empMap.has(p.empCode)) {
      console.log(`  ✗ Employee not found: ${p.empCode} (for ${p.tag})`);
      invalid++;
      continue;
    }
    validatedPlan.push(p);
  }
  if (invalid === 0) console.log('  (none)');

  console.log('');
  console.log(`Valid assignments to create: ${validatedPlan.length}`);

  // Check for existing active assignments that would be duplicated
  const existingActive = await prisma.assetAssignment.findMany({
    where: {
      assetId: { in: validatedPlan.map(p => assetMap.get(p.tag)!.id) },
      returnedDate: null,
    },
    select: { assetId: true },
  });
  const alreadyAssigned = new Set(existingActive.map(a => a.assetId));

  const finalPlan = validatedPlan.filter(p => !alreadyAssigned.has(assetMap.get(p.tag)!.id));
  const duplicates = validatedPlan.length - finalPlan.length;

  if (duplicates > 0) {
    console.log(`Already have active assignment (skipped): ${duplicates}`);
  }

  console.log('');
  console.log('PREVIEW:');
  finalPlan.slice(0, 20).forEach(p => {
    const emp = empMap.get(p.empCode)!;
    console.log(
      `  ${p.tag} | "${p.legacy}" → [${emp.empCode}] ${emp.firstName} ${emp.lastName}${!emp.isActive ? ' (INACTIVE)' : ''}`
    );
  });
  if (finalPlan.length > 20) console.log(`  ... and ${finalPlan.length - 20} more`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes made. Re-run with --apply to create AssetAssignment records.');
    return;
  }

  // APPLY
  console.log('');
  console.log('Creating AssetAssignment records...');
  let created = 0;
  let failed = 0;
  for (const p of finalPlan) {
    const asset = assetMap.get(p.tag)!;
    const emp = empMap.get(p.empCode)!;
    try {
      await prisma.$transaction(async tx => {
        await tx.assetAssignment.create({
          data: {
            assetId: asset.id,
            employeeId: emp.id,
            assignedDate: new Date(),
            conditionAtAssignment: asset.condition,
            notes: `Admin-resolved from "${p.legacy}"${p.notes ? ` — ${p.notes}` : ''}`,
          },
        });
        if (!asset.isAssigned) {
          await tx.asset.update({
            where: { id: asset.id },
            data: { isAssigned: true },
          });
        }
      });
      created++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${p.tag}: ${(e as Error).message}`);
    }
  }

  console.log('');
  console.log(`Created: ${created}`);
  console.log(`Failed:  ${failed}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Backfill Employee.jobTier from designation strings.
 *
 * Two-pass design (the heuristic is wrong often enough to require a review step):
 *
 *   PASS 1 — heuristic + CSV (default):
 *     Walk every employee, suggest a tier based on designation keywords, write
 *     a CSV (`scripts/job-tiers-review.csv`) with one row per employee.
 *     No DB writes. Print distribution summary.
 *
 *   PASS 2 — apply CSV (`--apply scripts/job-tiers-review.csv`):
 *     Read the (possibly hand-edited) CSV, set Employee.jobTier from the
 *     `final_tier` column. Rows with empty `final_tier` fall back to
 *     `suggested_tier`. Rows with `SKIP` are left untouched.
 *
 * Usage:
 *   npx tsx scripts/backfill-job-tiers.ts                        # generate CSV
 *   npx tsx scripts/backfill-job-tiers.ts --apply scripts/job-tiers-review.csv
 */
import { PrismaClient, JobTier } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { suggestJobTier } from '../lib/jobTier';

const prisma = new PrismaClient();

const VALID_TIERS = new Set<string>(['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'LEAD', 'IC', 'SKIP']);

interface SuggestionRow {
  empCode: string;
  name: string;
  designation: string;
  reportingManager: string;
  suggested: JobTier;
  current: JobTier | null;
}

// CSV helpers — fields with commas/quotes/newlines get wrapped + escaped.
function csvField(v: string | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ',') {
          out.push(cur);
          cur = '';
        } else if (c === '"') {
          inQuotes = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// PASS 1: write the review CSV
// ---------------------------------------------------------------------------
async function writeReviewCsv(): Promise<void> {
  console.log('\n=== Job Tier — Suggestion Pass ===\n');

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      jobTier: true,
      reportingManager: { select: { firstName: true, lastName: true } },
    },
    orderBy: { empCode: 'asc' },
  });

  const rows: SuggestionRow[] = employees.map((e) => ({
    empCode: e.empCode,
    name: `${e.firstName} ${e.lastName}`.trim(),
    designation: e.designation || '',
    reportingManager: e.reportingManager
      ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}`.trim()
      : '',
    suggested: suggestJobTier(e.designation || ''),
    current: e.jobTier,
  }));

  // Distribution summary
  const dist: Record<string, number> = {};
  rows.forEach((r) => {
    dist[r.suggested] = (dist[r.suggested] || 0) + 1;
  });
  console.log(`Suggested distribution across ${rows.length} employees:`);
  ['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'LEAD', 'IC'].forEach((t) => {
    console.log(`  ${t.padEnd(10)} ${String(dist[t] ?? 0).padStart(4)}`);
  });

  const csvPath = path.join(__dirname, 'job-tiers-review.csv');
  const header = 'empCode,name,designation,reporting_manager,suggested_tier,final_tier,current_tier,notes';
  const body = rows
    .map((r) =>
      [
        csvField(r.empCode),
        csvField(r.name),
        csvField(r.designation),
        csvField(r.reportingManager),
        r.suggested,
        '', // final_tier — empty means "use suggested"
        r.current ?? '',
        '',
      ].join(',')
    )
    .join('\n');
  writeFileSync(csvPath, header + '\n' + body + '\n', 'utf-8');

  console.log(`\n✓ Wrote ${csvPath}`);
  console.log('\nNext steps:');
  console.log('  1. Open the CSV. Override the final_tier column for any row where the suggestion is wrong.');
  console.log('     Valid values: EXECUTIVE, DIRECTOR, MANAGER, LEAD, IC, SKIP (leave row untouched).');
  console.log('     Empty final_tier = use suggested_tier.');
  console.log('  2. Re-run with: npx tsx scripts/backfill-job-tiers.ts --apply scripts/job-tiers-review.csv\n');
}

// ---------------------------------------------------------------------------
// PASS 2: apply CSV decisions to the DB
// ---------------------------------------------------------------------------
async function applyFromCsv(csvPath: string): Promise<void> {
  console.log(`\n=== Job Tier — Apply Pass ===\n`);
  console.log(`Reading ${csvPath}`);

  const rows = parseCsv(readFileSync(csvPath, 'utf-8'));
  console.log(`Found ${rows.length} rows`);

  let updated = 0;
  let skipped = 0;
  let unchanged = 0;
  let invalid = 0;

  for (const row of rows) {
    const empCode = row.empCode?.trim();
    if (!empCode) continue;

    const finalTier = (row.final_tier?.trim() || row.suggested_tier?.trim() || '').toUpperCase();

    if (finalTier === 'SKIP') {
      skipped++;
      continue;
    }
    if (!VALID_TIERS.has(finalTier) || finalTier === 'SKIP') {
      console.warn(`  ⚠ ${empCode}: invalid tier "${finalTier}" — skipping`);
      invalid++;
      continue;
    }

    const emp = await prisma.employee.findUnique({
      where: { empCode },
      select: { id: true, jobTier: true },
    });
    if (!emp) {
      console.warn(`  ⚠ ${empCode}: not found in DB — skipping`);
      invalid++;
      continue;
    }

    if (emp.jobTier === finalTier) {
      unchanged++;
      continue;
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: { jobTier: finalTier as JobTier },
    });
    updated++;
  }

  console.log(`\n✓ Updated:    ${updated}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Invalid:    ${invalid}`);
  console.log('\n✅ Apply complete\n');
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const applyIdx = args.indexOf('--apply');

  if (applyIdx >= 0) {
    const csvArg = args[applyIdx + 1];
    if (!csvArg) {
      console.error('Usage: --apply <path-to-csv>');
      process.exit(1);
    }
    await applyFromCsv(csvArg);
  } else {
    await writeReviewCsv();
  }
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

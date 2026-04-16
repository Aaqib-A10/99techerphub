/**
 * Backfill AssetAssignment records from legacy Asset.assignedToName
 *
 * Fuzzy-matches each asset's `assignedToName` to an Employee record using
 * token-overlap scoring, then creates a proper AssetAssignment record.
 *
 * Usage:
 *   npx tsx scripts/backfill-asset-assignments.ts                # dry-run
 *   npx tsx scripts/backfill-asset-assignments.ts --apply        # execute
 *   npx tsx scripts/backfill-asset-assignments.ts --apply --verbose
 */

import { PrismaClient, AssetCondition } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

// --export-ambiguous <path.csv>  →  write ambiguous candidates to CSV for admin review
function getExportPath(): string | null {
  const idx = process.argv.indexOf('--export-ambiguous');
  if (idx === -1) return null;
  return process.argv[idx + 1] || './ambiguous-assets.csv';
}
const EXPORT_PATH = getExportPath();

// Score thresholds
const AUTO_MATCH = 0.67; // ≥ this = auto-create assignment
const REVIEW = 0.5; // ≥ this = flag for manual review

const PLACEHOLDERS = new Set([
  '',
  'available',
  'n/a',
  'na',
  'damage',
  'damaged',
  'retired',
  'unknown',
  'none',
  'null',
  'unassigned',
]);

// Tokens to strip from names (titles, honorifics, noise)
const STOP_TOKENS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'sir',
  'madam',
  'house',
  'home',
  'office',
  'bhai',
  'sahab',
  'sb',
  'sahib',
  'the',
  'and',
  '&',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): Set<string> {
  const tokens = normalize(s)
    .split(' ')
    .filter(t => t.length > 1 && !STOP_TOKENS.has(t));
  return new Set(tokens);
}

function score(target: Set<string>, candidate: Set<string>): number {
  if (target.size === 0 || candidate.size === 0) return 0;
  let shared = 0;
  for (const t of target) if (candidate.has(t)) shared++;
  return shared / Math.min(target.size, candidate.size);
}

async function main() {
  console.log(`Asset Assignment Backfill — ${APPLY ? 'APPLY' : 'DRY-RUN'} mode`);
  console.log('Generated:', new Date().toISOString());
  console.log('');

  // Load all employees with their token sets
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
  const empIndex = employees.map(e => ({
    ...e,
    fullName: `${e.firstName} ${e.lastName}`.trim(),
    tokens: tokenize(`${e.firstName} ${e.lastName}`),
  }));
  console.log(`Loaded ${employees.length} employees (${empIndex.filter(e => e.isActive).length} active)`);

  // Load candidate assets: have a name string, no existing active assignment
  const assets = await prisma.asset.findMany({
    where: {
      assignedToName: { not: null },
      assignments: { none: { returnedDate: null } },
    },
    select: {
      id: true,
      assetTag: true,
      assignedToName: true,
      isAssigned: true,
      condition: true,
    },
  });
  console.log(`Found ${assets.length} assets with legacy assignedToName`);
  console.log('');

  const matched: Array<{
    asset: (typeof assets)[number];
    emp: (typeof empIndex)[number];
    score: number;
  }> = [];
  const ambiguous: Array<{
    asset: (typeof assets)[number];
    candidates: Array<{ emp: (typeof empIndex)[number]; score: number }>;
  }> = [];
  const unmatched: Array<{
    asset: (typeof assets)[number];
    reason: string;
    best?: { emp: (typeof empIndex)[number]; score: number };
  }> = [];
  const placeholderSkipped: typeof assets = [];

  for (const asset of assets) {
    const raw = (asset.assignedToName || '').trim();
    const normalized = normalize(raw);

    if (PLACEHOLDERS.has(normalized) || normalized.length < 2) {
      placeholderSkipped.push(asset);
      continue;
    }

    const targetTokens = tokenize(raw);
    if (targetTokens.size === 0) {
      unmatched.push({ asset, reason: 'name had no usable tokens after normalization' });
      continue;
    }

    // Score against every employee
    const scored = empIndex
      .map(emp => ({ emp, score: score(targetTokens, emp.tokens) }))
      .filter(s => s.score >= REVIEW)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      unmatched.push({ asset, reason: `no employee matched >= ${REVIEW}` });
      continue;
    }

    const best = scored[0];

    // Ambiguous: multiple candidates tied at the top score, or best < AUTO_MATCH
    const tied = scored.filter(s => s.score === best.score);
    if (tied.length > 1) {
      ambiguous.push({ asset, candidates: tied });
      continue;
    }

    if (best.score < AUTO_MATCH) {
      ambiguous.push({ asset, candidates: scored.slice(0, 3) });
      continue;
    }

    matched.push({ asset, emp: best.emp, score: best.score });
  }

  // Reports
  console.log('='.repeat(80));
  console.log(`MATCHED (score >= ${AUTO_MATCH}): ${matched.length}`);
  console.log('='.repeat(80));
  if (VERBOSE) {
    matched.forEach(m =>
      console.log(
        `  ${m.asset.assetTag} | "${m.asset.assignedToName}" → [${m.emp.empCode}] ${m.emp.fullName}${!m.emp.isActive ? ' (INACTIVE)' : ''} | ${m.score.toFixed(2)}`
      )
    );
  } else {
    console.log(`(use --verbose to see all matches)`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`AMBIGUOUS (needs manual review): ${ambiguous.length}`);
  console.log('='.repeat(80));
  ambiguous.slice(0, 50).forEach(a => {
    console.log(`  ${a.asset.assetTag} | "${a.asset.assignedToName}"`);
    a.candidates.forEach(c =>
      console.log(`    → [${c.emp.empCode}] ${c.emp.fullName} | ${c.score.toFixed(2)}`)
    );
  });
  if (ambiguous.length > 50) console.log(`  ... and ${ambiguous.length - 50} more`);

  console.log('');
  console.log('='.repeat(80));
  console.log(`UNMATCHED (no employee found): ${unmatched.length}`);
  console.log('='.repeat(80));
  unmatched.slice(0, 50).forEach(u => {
    console.log(`  ${u.asset.assetTag} | "${u.asset.assignedToName}" | ${u.reason}`);
  });
  if (unmatched.length > 50) console.log(`  ... and ${unmatched.length - 50} more`);

  console.log('');
  console.log('='.repeat(80));
  console.log(`SKIPPED (placeholder names): ${placeholderSkipped.length}`);
  console.log('='.repeat(80));
  if (VERBOSE) {
    placeholderSkipped.forEach(a =>
      console.log(`  ${a.assetTag} | "${a.assignedToName}"`)
    );
  }

  // Count inactive matches as a warning
  const inactiveMatches = matched.filter(m => !m.emp.isActive).length;

  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total candidate assets:         ${assets.length}`);
  console.log(`  → Auto-matched:               ${matched.length}`);
  if (inactiveMatches) console.log(`     (of which inactive employees: ${inactiveMatches})`);
  console.log(`  → Ambiguous (needs review):   ${ambiguous.length}`);
  console.log(`  → Unmatched:                  ${unmatched.length}`);
  console.log(`  → Placeholder (skipped):      ${placeholderSkipped.length}`);

  // Export ambiguous to CSV for admin review
  if (EXPORT_PATH) {
    const esc = (s: string | number | null | undefined) => {
      const str = String(s ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = [
      'Asset Tag',
      'Legacy Name',
      'Candidate 1 EmpCode',
      'Candidate 1 Name',
      'Candidate 1 Active',
      'Candidate 1 Score',
      'Candidate 2 EmpCode',
      'Candidate 2 Name',
      'Candidate 2 Active',
      'Candidate 2 Score',
      'Candidate 3 EmpCode',
      'Candidate 3 Name',
      'Candidate 3 Active',
      'Candidate 3 Score',
      'SELECTED EmpCode (fill in)',
      'Notes (optional)',
    ];
    const rows = ambiguous.map(a => {
      const c = a.candidates.slice(0, 3);
      return [
        a.asset.assetTag,
        a.asset.assignedToName,
        c[0]?.emp.empCode,
        c[0]?.emp.fullName,
        c[0] ? (c[0].emp.isActive ? 'Y' : 'N') : '',
        c[0]?.score.toFixed(2),
        c[1]?.emp.empCode,
        c[1]?.emp.fullName,
        c[1] ? (c[1].emp.isActive ? 'Y' : 'N') : '',
        c[1]?.score.toFixed(2),
        c[2]?.emp.empCode,
        c[2]?.emp.fullName,
        c[2] ? (c[2].emp.isActive ? 'Y' : 'N') : '',
        c[2]?.score.toFixed(2),
        '',
        '',
      ].map(esc).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n') + '\n';
    writeFileSync(EXPORT_PATH, csv);
    console.log('');
    console.log(`✓ Exported ${ambiguous.length} ambiguous rows to ${EXPORT_PATH}`);
    console.log(`  Admin can open in Excel, fill the "SELECTED EmpCode" column, send back.`);
  }

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes made. Re-run with --apply to create AssetAssignment records.');
    return;
  }

  // APPLY mode: create AssetAssignment records for matched only
  console.log('');
  console.log('Applying matched assignments...');

  let created = 0;
  let failed = 0;
  for (const m of matched) {
    try {
      await prisma.$transaction(async tx => {
        await tx.assetAssignment.create({
          data: {
            assetId: m.asset.id,
            employeeId: m.emp.id,
            assignedDate: new Date(), // no better info available
            conditionAtAssignment: m.asset.condition,
            notes: `Backfilled from legacy assignedToName="${m.asset.assignedToName}" (match score: ${m.score.toFixed(2)})`,
          },
        });
        // Ensure flag is in sync
        if (!m.asset.isAssigned) {
          await tx.asset.update({
            where: { id: m.asset.id },
            data: { isAssigned: true },
          });
        }
      });
      created++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${m.asset.assetTag}: ${(e as Error).message}`);
    }
  }

  console.log('');
  console.log(`Created: ${created}`);
  console.log(`Failed:  ${failed}`);
  console.log('');
  console.log('Ambiguous and unmatched assets still need manual resolution.');
  console.log('Run scripts/audit-asset-assignments.ts to verify.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

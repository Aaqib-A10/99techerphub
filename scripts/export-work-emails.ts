/**
 * Export every active employee to a CSV that admin fills in with each
 * person's organization email (workEmail). Re-import via
 * scripts/import-work-emails.ts.
 *
 * Usage:
 *   npx tsx scripts/export-work-emails.ts                # writes ./work-emails.csv
 *   npx tsx scripts/export-work-emails.ts --out path.csv
 *   npx tsx scripts/export-work-emails.ts --missing-only # only employees with empty workEmail
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const outIdx = process.argv.indexOf('--out');
const outPath =
  outIdx >= 0 ? process.argv[outIdx + 1] : join(__dirname, '..', 'work-emails.csv');
const missingOnly = process.argv.includes('--missing-only');

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(missingOnly ? { OR: [{ workEmail: null }, { workEmail: '' }] } : {}),
    },
    select: {
      empCode: true,
      firstName: true,
      lastName: true,
      email: true,
      workEmail: true,
      designation: true,
      department: { select: { name: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { firstName: 'asc' }],
  });

  const header = [
    'empCode',
    'firstName',
    'lastName',
    'department',
    'designation',
    'currentPersonalEmail',
    'currentWorkEmail',
    'NEW_WORK_EMAIL (fill in)',
    'Notes',
  ];

  const lines = [header.join(',')];
  for (const e of employees) {
    lines.push(
      [
        e.empCode,
        e.firstName,
        e.lastName,
        e.department?.name,
        e.designation,
        e.email,
        e.workEmail,
        '', // NEW_WORK_EMAIL — admin fills
        '',
      ]
        .map(esc)
        .join(',')
    );
  }

  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`Wrote ${employees.length} employees to: ${outPath}`);
  console.log(missingOnly ? '(Only those missing workEmail)' : '(All active employees)');
  console.log('');
  console.log('Admin instructions:');
  console.log('  1. Open in Excel.');
  console.log(
    '  2. Fill the NEW_WORK_EMAIL column with each person\'s @99technologies.com email.'
  );
  console.log('  3. Leave blank if unknown / no work email yet.');
  console.log('  4. Save as CSV. Run: npx tsx scripts/import-work-emails.ts <path.csv> --apply');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

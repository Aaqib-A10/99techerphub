/**
 * Export every active employee to a CSV that admin can fill in to set
 * the org tree structure (reportingManager + designation).
 *
 * The output has an empty NEW_MANAGER_EMPCODE column for admin to fill.
 * Admin sends the file back; run scripts/import-org-structure.ts --apply
 * to push the changes into the DB.
 *
 * Usage:
 *   npx tsx scripts/export-org-structure.ts                     # writes ./org-structure.csv
 *   npx tsx scripts/export-org-structure.ts --out path.csv
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const outIdx = process.argv.indexOf('--out');
const outPath =
  outIdx >= 0 ? process.argv[outIdx + 1] : join(__dirname, '..', 'org-structure.csv');

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      team: true,
      department: { select: { name: true } },
      reportingManager: {
        select: { empCode: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ department: { name: 'asc' } }, { firstName: 'asc' }],
  });

  const header = [
    'empCode',
    'firstName',
    'lastName',
    'department',
    'designation',
    'team',
    'currentManagerEmpCode',
    'currentManagerName',
    'NEW_MANAGER_EMPCODE',
    'NEW_DESIGNATION (optional)',
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
        e.team,
        e.reportingManager?.empCode,
        e.reportingManager
          ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}`
          : '',
        '', // NEW_MANAGER_EMPCODE — admin fills
        '', // NEW_DESIGNATION — optional
        '', // Notes
      ]
        .map(esc)
        .join(',')
    );
  }

  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`Wrote ${employees.length} active employees to: ${outPath}`);
  console.log('');
  console.log('Admin instructions:');
  console.log('  1. Open the CSV in Excel.');
  console.log('  2. For each row, fill in NEW_MANAGER_EMPCODE with the empCode of the person they report to.');
  console.log('     (Leave blank to leave existing manager unchanged.)');
  console.log('     (Use SKIP or NONE to clear the existing manager.)');
  console.log('  3. Optional: fill NEW_DESIGNATION to update job title.');
  console.log('  4. Save as CSV and send back. Run import-org-structure.ts to apply.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

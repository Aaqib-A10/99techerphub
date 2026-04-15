import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const TEAM_MAP: Record<string, string> = {};

// Read mapping from Excel export
const lines = fs.readFileSync('/tmp/team_mapping.txt', 'utf-8').trim().split('\n');
for (const line of lines) {
  const [empCode, team] = line.split('|');
  if (empCode && team) {
    TEAM_MAP[empCode.trim()] = team.trim();
  }
}

async function main() {
  console.log(`Loaded ${Object.keys(TEAM_MAP).length} team mappings from spreadsheet`);

  // Get all employees
  const employees = await prisma.employee.findMany({
    select: { id: true, empCode: true, team: true },
  });

  console.log(`Total employees in DB: ${employees.length}`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const emp of employees) {
    const newTeam = TEAM_MAP[emp.empCode];
    if (!newTeam) {
      notFound++;
      continue;
    }

    // Skip if team already matches
    if (emp.team === newTeam) {
      skipped++;
      continue;
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: { team: newTeam },
    });

    console.log(`  ${emp.empCode}: "${emp.team || '(empty)'}" -> "${newTeam}"`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}, Not in spreadsheet: ${notFound}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

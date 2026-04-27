/**
 * Read the CSV produced by scripts/export-work-emails.ts (admin fills
 * NEW_WORK_EMAIL column) and update Employee.workEmail in bulk.
 *
 * Validates:
 *   - Every empCode resolves to an active employee
 *   - Every NEW_WORK_EMAIL is a syntactically reasonable email
 *   - No two rows assign the same workEmail (workEmail is unique in DB)
 *
 * Usage:
 *   npx tsx scripts/import-work-emails.ts <path.csv>            # dry-run
 *   npx tsx scripts/import-work-emails.ts <path.csv> --apply    # commit
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const csvPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-work-emails.ts <path.csv> [--apply]');
  process.exit(1);
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
  return rows.filter((r) => r.some((f) => f.trim()));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const text = readFileSync(csvPath!, 'utf-8');
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error('CSV is empty.');
    process.exit(1);
  }
  const header = rows[0];
  const iEmp = header.findIndex((h) => h.trim().toLowerCase() === 'empcode');
  const iEmail = header.findIndex((h) => h.trim().toUpperCase().startsWith('NEW_WORK_EMAIL'));
  if (iEmp < 0 || iEmail < 0) {
    console.error('CSV must have empCode + NEW_WORK_EMAIL columns.');
    process.exit(1);
  }

  type Row = { empCode: string; newEmail: string };
  const plans: Row[] = [];
  for (const r of rows.slice(1)) {
    const empCode = (r[iEmp] || '').trim();
    const newEmail = (r[iEmail] || '').trim().toLowerCase();
    if (!empCode || !newEmail) continue;
    plans.push({ empCode, newEmail });
  }

  console.log(`Mode:              ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`CSV rows:          ${rows.length - 1}`);
  console.log(`Updates planned:   ${plans.length}`);

  // Validate
  const errors: string[] = [];

  // 1. Email format
  for (const p of plans) {
    if (!EMAIL_RE.test(p.newEmail)) {
      errors.push(`Bad email format: ${p.newEmail} (for ${p.empCode})`);
    }
  }

  // 2. Duplicates within the batch
  const seenEmails = new Map<string, string>();
  for (const p of plans) {
    if (seenEmails.has(p.newEmail)) {
      errors.push(`Duplicate workEmail in CSV: ${p.newEmail} on ${seenEmails.get(p.newEmail)} and ${p.empCode}`);
    } else {
      seenEmails.set(p.newEmail, p.empCode);
    }
  }

  // 3. Resolve empCodes
  const codes = plans.map((p) => p.empCode);
  const employees = await prisma.employee.findMany({
    where: { empCode: { in: codes } },
    select: { id: true, empCode: true, isActive: true, workEmail: true },
  });
  const byCode = new Map(employees.map((e) => [e.empCode, e]));
  for (const p of plans) {
    if (!byCode.has(p.empCode)) errors.push(`Unknown empCode: ${p.empCode}`);
  }

  // 4. Conflict with existing workEmail rows (other employees using same email)
  const existingWithEmail = await prisma.employee.findMany({
    where: { workEmail: { in: plans.map((p) => p.newEmail) } },
    select: { id: true, empCode: true, workEmail: true },
  });
  for (const p of plans) {
    const me = byCode.get(p.empCode);
    const conflict = existingWithEmail.find((e) => e.workEmail === p.newEmail);
    if (conflict && (!me || conflict.id !== me.id)) {
      errors.push(
        `workEmail ${p.newEmail} already used by ${conflict.empCode} (cannot assign to ${p.empCode})`
      );
    }
  }

  if (errors.length) {
    console.log('');
    console.log('VALIDATION ERRORS:');
    errors.slice(0, 30).forEach((e) => console.log(`  ✗ ${e}`));
    if (errors.length > 30) console.log(`  ... and ${errors.length - 30} more`);
    if (APPLY) {
      console.log('');
      console.log('Aborting — fix errors and re-run.');
      process.exit(1);
    }
  }

  // Preview
  console.log('');
  console.log('PREVIEW (first 20):');
  plans.slice(0, 20).forEach((p) => {
    const me = byCode.get(p.empCode);
    const old = me?.workEmail;
    console.log(`  ${p.empCode}: ${old ? `"${old}" → ` : ''}"${p.newEmail}"`);
  });
  if (plans.length > 20) console.log(`  ... and ${plans.length - 20} more`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes. Re-run with --apply to commit.');
    return;
  }

  // Apply
  console.log('');
  console.log('Applying...');
  let updated = 0;
  let failed = 0;
  for (const p of plans) {
    const me = byCode.get(p.empCode);
    if (!me) continue;
    try {
      await prisma.employee.update({
        where: { id: me.id },
        data: { workEmail: p.newEmail },
      });
      updated++;
    } catch (e) {
      failed++;
      console.error(`  FAILED ${p.empCode}: ${(e as Error).message}`);
    }
  }

  console.log('');
  console.log(`Updated: ${updated}`);
  console.log(`Failed:  ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

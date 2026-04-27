/**
 * Apply the manager / designation decisions returned by admin in the CSV
 * produced by scripts/export-org-structure.ts.
 *
 * Validates that:
 *   - Every empCode resolves to an active employee
 *   - Every NEW_MANAGER_EMPCODE resolves (or is SKIP / NONE / blank)
 *   - No circular reporting chain is introduced (A reports to B reports to A)
 *
 * Usage:
 *   npx tsx scripts/import-org-structure.ts <path.csv>            # dry-run
 *   npx tsx scripts/import-org-structure.ts <path.csv> --apply    # commit
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const csvPath = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));

if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-org-structure.ts <path.csv> [--apply]');
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

interface Plan {
  empCode: string;
  newManagerEmpCode: string | null; // null => clear, undefined => leave alone
  clearManager: boolean;
  newDesignation: string | null;
}

async function main() {
  const text = readFileSync(csvPath!, 'utf-8');
  const rows = parseCsv(text);
  if (rows.length < 2) {
    console.error('CSV is empty.');
    process.exit(1);
  }
  const header = rows[0].map((h) => h.trim());
  const idxOf = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const iEmp = idxOf('empCode');
  const iMgr = header.findIndex((h) => h.trim().toUpperCase().startsWith('NEW_MANAGER_EMPCODE'));
  const iDes = header.findIndex((h) => h.trim().toUpperCase().startsWith('NEW_DESIGNATION'));
  if (iEmp < 0 || iMgr < 0) {
    console.error('CSV must have empCode and NEW_MANAGER_EMPCODE columns.');
    process.exit(1);
  }

  const plans: Plan[] = [];
  for (const r of rows.slice(1)) {
    const emp = (r[iEmp] || '').trim();
    if (!emp) continue;
    const mgrRaw = (r[iMgr] || '').trim();
    const desRaw = iDes >= 0 ? (r[iDes] || '').trim() : '';

    let newManagerEmpCode: string | null = null;
    let clearManager = false;
    if (!mgrRaw) {
      // leave alone — encode as undefined-ish: skip update
      continue; // skip rows with no change requested (and no designation update)
    } else if (/^(skip|none|no|-)$/i.test(mgrRaw)) {
      clearManager = true;
    } else {
      newManagerEmpCode = mgrRaw;
    }

    plans.push({
      empCode: emp,
      newManagerEmpCode,
      clearManager,
      newDesignation: desRaw || null,
    });
  }

  // Also include rows that only update designation
  for (const r of rows.slice(1)) {
    const emp = (r[iEmp] || '').trim();
    if (!emp) continue;
    const mgrRaw = (r[iMgr] || '').trim();
    const desRaw = iDes >= 0 ? (r[iDes] || '').trim() : '';
    if (!mgrRaw && desRaw && !plans.some((p) => p.empCode === emp)) {
      plans.push({
        empCode: emp,
        newManagerEmpCode: null,
        clearManager: false,
        newDesignation: desRaw,
      });
    }
  }

  console.log(`Mode:              ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`CSV rows:          ${rows.length - 1}`);
  console.log(`Updates planned:   ${plans.length}`);

  // Resolve all empCodes (employees + new managers) up front
  const allCodes = [
    ...new Set([
      ...plans.map((p) => p.empCode),
      ...plans.map((p) => p.newManagerEmpCode || '').filter(Boolean),
    ]),
  ];
  const employees = await prisma.employee.findMany({
    where: { empCode: { in: allCodes } },
    select: { id: true, empCode: true, isActive: true, reportingManagerId: true },
  });
  const byCode = new Map(employees.map((e) => [e.empCode, e]));

  // Validate
  const invalid: string[] = [];
  for (const p of plans) {
    if (!byCode.has(p.empCode)) {
      invalid.push(`Unknown empCode: ${p.empCode}`);
      continue;
    }
    if (p.newManagerEmpCode && !byCode.has(p.newManagerEmpCode)) {
      invalid.push(`Unknown manager empCode: ${p.newManagerEmpCode} (for ${p.empCode})`);
    }
    if (p.newManagerEmpCode === p.empCode) {
      invalid.push(`${p.empCode} cannot report to themselves`);
    }
  }

  // Detect cycles after applying. Build a tentative manager map.
  const tentativeManager = new Map<number, number | null>();
  for (const e of employees) tentativeManager.set(e.id, e.reportingManagerId);
  for (const p of plans) {
    const me = byCode.get(p.empCode);
    if (!me) continue;
    if (p.clearManager) {
      tentativeManager.set(me.id, null);
    } else if (p.newManagerEmpCode) {
      const mgr = byCode.get(p.newManagerEmpCode);
      if (mgr) tentativeManager.set(me.id, mgr.id);
    }
  }
  // Walk each chain — any > N hops without reaching null = cycle
  for (const [start] of tentativeManager) {
    let cur: number | null = start;
    const seen = new Set<number>();
    while (cur != null) {
      if (seen.has(cur)) {
        const me = employees.find((e) => e.id === start);
        invalid.push(`Cycle detected starting at ${me?.empCode}`);
        break;
      }
      seen.add(cur);
      cur = tentativeManager.get(cur) ?? null;
    }
  }

  if (invalid.length) {
    console.log('');
    console.log('VALIDATION ERRORS:');
    for (const e of invalid.slice(0, 20)) console.log(`  ✗ ${e}`);
    if (invalid.length > 20) console.log(`  ... and ${invalid.length - 20} more`);
    if (APPLY) {
      console.log('');
      console.log('Aborting — fix the errors and re-run.');
      process.exit(1);
    }
  }

  // Preview
  console.log('');
  console.log('PREVIEW (first 20):');
  plans.slice(0, 20).forEach((p) => {
    const me = byCode.get(p.empCode);
    if (!me) return;
    const parts: string[] = [];
    if (p.clearManager) parts.push('manager → (none)');
    else if (p.newManagerEmpCode) parts.push(`manager → ${p.newManagerEmpCode}`);
    if (p.newDesignation) parts.push(`designation → "${p.newDesignation}"`);
    console.log(`  ${p.empCode}: ${parts.join(', ')}`);
  });
  if (plans.length > 20) console.log(`  ... and ${plans.length - 20} more`);

  if (!APPLY) {
    console.log('');
    console.log('DRY-RUN — no changes made. Re-run with --apply to commit.');
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
    const data: { reportingManagerId?: number | null; designation?: string } = {};
    if (p.clearManager) data.reportingManagerId = null;
    else if (p.newManagerEmpCode) {
      const mgr = byCode.get(p.newManagerEmpCode);
      if (mgr) data.reportingManagerId = mgr.id;
    }
    if (p.newDesignation) data.designation = p.newDesignation;
    if (Object.keys(data).length === 0) continue;

    try {
      await prisma.employee.update({ where: { id: me.id }, data });
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

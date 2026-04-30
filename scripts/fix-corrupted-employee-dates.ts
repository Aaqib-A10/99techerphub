/**
 * Repairs employees whose dateOfJoining / dateOfBirth landed at year 1970
 * because an old import passed Excel date serials straight to `new Date(n)`,
 * which treated `n` as milliseconds-since-epoch.
 *
 * Recovery:
 * 1. EXITED records — match by empCode against scripts/Exited_employees.xlsx
 *    and use the xlsx Date directly (precise).
 * 2. Anything else (ACTIVE corrupted, or EXITED rows missing from the xlsx)
 *    — recover from the surviving milliseconds in the corrupted timestamp,
 *    treating it as the original Excel serial. Subject to ±1–2 day rounding
 *    if the source xlsx applied a TZ offset on parse.
 *
 * USAGE:
 *   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' \
 *     scripts/fix-corrupted-employee-dates.ts            # dry-run, prints diff
 *   npx ts-node ... scripts/fix-corrupted-employee-dates.ts --apply   # writes
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
// Master employee xlsx files. Multiple sources are merged by empCode; first
// non-null value wins. The Exited_employees.xlsx is a subset of the master
// but kept for backward compatibility if the master goes missing.
const XLSX_PATHS = [
  path.join(__dirname, 'Active_employees.xlsx'),
  path.join(__dirname, 'Exited_employees.xlsx'),
];

// Excel serial → JS Date.
// Excel's "epoch" is 1900-01-01 with a 1900-leap-year bug; serials > 60 line
// up cleanly when anchored at 1899-12-30.
function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
}

// Strip time-of-day so the recovered date stays at midnight UTC.
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

interface XlsxRow {
  'Emp ID'?: string | number;
  'Date of Joining'?: Date | string;
  'Date of Birth'?: Date | string;
}

function loadXlsxMap(): Map<string, { doj?: Date; dob?: Date }> {
  const map = new Map<string, { doj?: Date; dob?: Date }>();
  let totalRows = 0;
  for (const filepath of XLSX_PATHS) {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.readFile(filepath, { cellDates: true });
    } catch {
      console.log(`  (skip — not found: ${path.basename(filepath)})`);
      continue;
    }
    let fileRows = 0;
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<XlsxRow>(wb.Sheets[sheetName]);
      for (const r of rows) {
        const code = r['Emp ID'] != null ? String(r['Emp ID']).trim() : '';
        if (!code) continue;
        const newDoj = r['Date of Joining'] instanceof Date ? r['Date of Joining'] : undefined;
        const newDob = r['Date of Birth'] instanceof Date ? r['Date of Birth'] : undefined;
        const existing = map.get(code) ?? {};
        // First non-null value wins per field; later sheets only fill gaps.
        map.set(code, {
          doj: existing.doj ?? newDoj,
          dob: existing.dob ?? newDob,
        });
        fileRows++;
      }
    }
    totalRows += fileRows;
    console.log(`  loaded ${fileRows} rows from ${path.basename(filepath)}`);
  }
  console.log(`  ${map.size} unique empCodes across ${totalRows} total rows`);
  return map;
}

async function main() {
  console.log(APPLY ? '🔧 APPLY mode — changes will be written.' : '🔍 DRY-RUN — no DB writes.');

  const xlsxMap = loadXlsxMap();
  console.log(`Loaded ${xlsxMap.size} empCodes from xlsx files.\n`);

  const corrupted = await prisma.employee.findMany({
    where: { dateOfJoining: { gte: new Date('1970-01-01'), lt: new Date('1971-01-01') } },
    select: {
      id: true,
      empCode: true,
      firstName: true,
      lastName: true,
      lifecycleStage: true,
      dateOfBirth: true,
      dateOfJoining: true,
    },
    orderBy: { empCode: 'asc' },
  });
  console.log(`Found ${corrupted.length} corrupted records.\n`);

  const summary = {
    fixedFromXlsx: 0,
    fixedFromSerial: 0,
    skippedNoData: 0,
    dobFixed: 0,
  };

  for (const e of corrupted) {
    const xlsxEntry = xlsxMap.get(e.empCode);

    // ---- dateOfJoining ----
    let newDoj: Date | undefined;
    let dojSource: 'xlsx' | 'serial' | 'none' = 'none';

    if (xlsxEntry?.doj) {
      newDoj = dateOnly(xlsxEntry.doj);
      dojSource = 'xlsx';
    } else {
      const serial = e.dateOfJoining.getTime();
      if (serial > 1000) {
        newDoj = dateOnly(excelSerialToDate(serial));
        dojSource = 'serial';
      }
    }

    // ---- dateOfBirth ----
    let newDob: Date | undefined;
    const currentDobIs1970 =
      e.dateOfBirth &&
      e.dateOfBirth.getUTCFullYear() === 1970 &&
      e.dateOfBirth.getUTCMonth() === 0 &&
      e.dateOfBirth.getUTCDate() === 1;

    if (currentDobIs1970 || !e.dateOfBirth) {
      if (xlsxEntry?.dob) {
        newDob = dateOnly(xlsxEntry.dob);
      } else if (e.dateOfBirth) {
        const serial = e.dateOfBirth.getTime();
        if (serial > 1000) newDob = dateOnly(excelSerialToDate(serial));
      }
    }

    const dojChanged = newDoj && newDoj.getTime() !== e.dateOfJoining.getTime();
    const dobChanged =
      newDob && (!e.dateOfBirth || newDob.getTime() !== e.dateOfBirth.getTime());

    if (!dojChanged && !dobChanged) {
      summary.skippedNoData++;
      continue;
    }

    const tag = `[${e.empCode}] ${e.firstName} ${e.lastName} (${e.lifecycleStage})`;
    const dojLine = dojChanged
      ? `   doj: ${e.dateOfJoining.toISOString().slice(0, 10)} → ${newDoj!.toISOString().slice(0, 10)} (via ${dojSource})`
      : null;
    const dobLine = dobChanged
      ? `   dob: ${e.dateOfBirth ? e.dateOfBirth.toISOString().slice(0, 10) : '∅'} → ${newDob!.toISOString().slice(0, 10)}`
      : null;
    console.log(tag);
    if (dojLine) console.log(dojLine);
    if (dobLine) console.log(dobLine);

    if (dojSource === 'xlsx') summary.fixedFromXlsx++;
    if (dojSource === 'serial') summary.fixedFromSerial++;
    if (dobChanged) summary.dobFixed++;

    if (APPLY) {
      const data: { dateOfJoining?: Date; dateOfBirth?: Date } = {};
      if (dojChanged) data.dateOfJoining = newDoj!;
      if (dobChanged) data.dateOfBirth = newDob!;
      await prisma.employee.update({ where: { id: e.id }, data });
    }
  }

  console.log('\n=== Summary ===');
  console.log(`doj fixed from xlsx:      ${summary.fixedFromXlsx}`);
  console.log(`doj fixed from serial:    ${summary.fixedFromSerial}`);
  console.log(`dob fixed:                ${summary.dobFixed}`);
  console.log(`skipped (no data):        ${summary.skippedNoData}`);
  console.log(`total corrupted:          ${corrupted.length}`);
  if (!APPLY) {
    console.log('\nRe-run with --apply to write changes.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

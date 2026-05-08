/**
 * One-shot import: load March 2026 salary sheet into SalaryHistory.
 *
 * Source: "Salary Sheet Mar- HR (1).xlsx" (single sheet, header
 * "Payroll sheet (Billing)"). Each row carries Pay PKR + Pay $; we
 * choose which currency to import per row (see logic below) and skip
 * rows whose employee can't be matched in the DB — those need manual
 * entry, per spec.
 *
 * Effective date: 2026-03-01 (start of the month the sheet covers).
 *
 * Idempotent: skips an employee if they already have ANY
 * SalaryHistory row, so re-running won't double-import. To re-run
 * fresh, delete existing rows first.
 *
 * Usage:
 *   node prisma/import-salary-march-2026.js path/to/sheet.xlsx
 *   DRY_RUN=1 node prisma/import-salary-march-2026.js path/to/sheet.xlsx
 *
 * Default xlsx path is the one in ~/Downloads on the dev box; pass
 * an explicit path on prod.
 */

const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const DRY_RUN = process.env.DRY_RUN === '1';
const DEFAULT_XLSX =
  '/Users/aqib/Downloads/Salary Sheet Mar- HR (1).xlsx';

const EFFECTIVE_FROM = new Date('2026-03-01T00:00:00Z');

// ---- helpers ----

function normCnic(s) {
  return String(s ?? '').replace(/[^0-9]/g, '');
}
function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function parseAmount(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[, $]/g, '').trim();
  if (!s || s === '-') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX;
  console.log(`Importing from: ${xlsxPath}`);
  console.log(`DRY_RUN=${DRY_RUN}`);
  console.log(`Effective date for new BASE rows: ${EFFECTIVE_FROM.toISOString().slice(0, 10)}`);

  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: '',
    raw: false,
  });

  const prisma = new PrismaClient();
  try {
    // Pull all active+inactive employees once. Build lookup maps for
    // CNIC (primary) and full-name (fallback).
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        empCode: true,
        firstName: true,
        lastName: true,
        cnic: true,
      },
    });
    const byCnic = new Map();
    const byName = new Map();
    for (const e of employees) {
      const c = normCnic(e.cnic);
      if (c) byCnic.set(c, e);
      byName.set(normName(`${e.firstName} ${e.lastName}`), e);
    }

    // Pre-fetch SalaryHistory presence for idempotency. One query.
    const empWithHistory = new Set(
      (await prisma.salaryHistory.findMany({
        select: { employeeId: true },
        distinct: ['employeeId'],
      })).map((s) => s.employeeId),
    );

    const stats = {
      total: 0,
      imported: 0,
      skippedNoMatch: 0,
      skippedAlreadyHave: 0,
      skippedNoAmount: 0,
      mixedCurrency: 0,
    };
    const skipped = [];

    for (const row of rows) {
      const name = String(row['Employee Name'] ?? '').trim();
      // Skip blanks, headers, summary rows
      if (!name) continue;
      if (name.toLowerCase().includes('total')) continue;
      if (name.toLowerCase().startsWith('employee')) continue;
      stats.total++;

      const cnic = normCnic(row['CNIC']);
      let emp = (cnic && byCnic.get(cnic)) || byName.get(normName(name));
      if (!emp) {
        // Last-resort: first-name match if exactly one employee shares it
        const first = normName(name).split(' ')[0];
        const candidates = employees.filter(
          (e) => normName(e.firstName) === first,
        );
        if (candidates.length === 1) emp = candidates[0];
      }
      if (!emp) {
        stats.skippedNoMatch++;
        skipped.push({ name, cnic, reason: 'No employee match' });
        continue;
      }
      if (empWithHistory.has(emp.id)) {
        stats.skippedAlreadyHave++;
        continue;
      }

      const pkr = parseAmount(row[' Pay PKR ']);
      const usd = parseAmount(row[' Pay $ ']);
      // "Total $" sometimes carries the canonical USD figure when
      // `Pay $` is split across base + medical; prefer it when
      // present and larger.
      const totalUsd = parseAmount(row[' Total $ ']);
      const usdEff = Math.max(usd, totalUsd);

      if (pkr === 0 && usdEff === 0) {
        stats.skippedNoAmount++;
        skipped.push({ name, cnic, reason: 'No salary amount' });
        continue;
      }

      // Currency choice:
      //   - PKR-only row → import PKR
      //   - USD-only row → import USD
      //   - both populated → import whichever is dominant (we
      //     compare PKR vs USD-converted-to-PKR roughly to decide).
      //     The other component goes into the row's `reason` so HR
      //     can see what was lost. Use ~280 PKR/USD for the rough
      //     compare; doesn't need to be exact, just a tiebreaker.
      let currency = 'PKR';
      let amount = pkr;
      let mixedNote = '';
      if (pkr > 0 && usdEff > 0) {
        stats.mixedCurrency++;
        const usdInPkr = usdEff * 280;
        if (usdInPkr > pkr) {
          currency = 'USD';
          amount = usdEff;
          mixedNote = ` (also PKR ${pkr.toLocaleString()} on sheet — enter manually if recurring)`;
        } else {
          mixedNote = ` (also USD ${usdEff} on sheet — enter manually if recurring)`;
        }
      } else if (pkr === 0) {
        currency = 'USD';
        amount = usdEff;
      }

      const reason = `Imported from Mar 2026 salary sheet${mixedNote}`;

      if (DRY_RUN) {
        console.log(
          `[dry-run] ${emp.empCode} ${emp.firstName} ${emp.lastName} → ${currency} ${amount.toLocaleString()}${mixedNote}`,
        );
        stats.imported++;
        continue;
      }

      await prisma.salaryHistory.create({
        data: {
          employeeId: emp.id,
          baseSalary: amount,
          currency,
          effectiveFrom: EFFECTIVE_FROM,
          reason,
        },
      });
      stats.imported++;
    }

    console.log('\n--- SUMMARY ---');
    console.log(`Rows scanned:                ${stats.total}`);
    console.log(`Imported:                    ${stats.imported}`);
    console.log(`Skipped (already had hist.): ${stats.skippedAlreadyHave}`);
    console.log(`Skipped (no employee match): ${stats.skippedNoMatch}`);
    console.log(`Skipped (no amount):         ${stats.skippedNoAmount}`);
    console.log(`Mixed-currency rows seen:    ${stats.mixedCurrency}`);
    if (skipped.length) {
      console.log('\n--- SKIPPED (manual entry needed) ---');
      for (const s of skipped) {
        console.log(`  ${s.name}${s.cnic ? ` (CNIC ${s.cnic})` : ''} — ${s.reason}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

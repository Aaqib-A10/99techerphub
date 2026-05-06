/**
 * One-shot seed for a fresh deploy. Runs the seeds in the right order:
 *
 *   1. Expense categories  — populates /expenses/new dropdown
 *   2. Ledger categories + opening balance — populates /finance/ledger
 *   3. Digital services    — populates /access-catalog
 *
 * Each child seed is idempotent (upsert by code/name), so running this
 * script repeatedly is safe.
 *
 * Run with:
 *   node prisma/seed-all.js
 *
 * Typical prod sequence after a deploy that includes schema changes:
 *   git pull
 *   npx prisma generate
 *   npx prisma db push --accept-data-loss
 *   node prisma/seed-all.js
 *   pm2 restart 99tech-erp
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SEEDS = [
  'seed-expense-categories.js',
  'seed-ledger.js',
  'seed-digital-services.js',
];

function run(file) {
  const fullPath = path.join(__dirname, file);
  console.log(`\n--- Running ${file} ---`);
  const r = spawnSync('node', [fullPath], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`${file} exited with code ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

for (const f of SEEDS) run(f);
console.log('\nAll seeds complete.');

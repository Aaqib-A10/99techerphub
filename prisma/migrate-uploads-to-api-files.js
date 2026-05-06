/**
 * One-shot migration: move uploaded receipts from public/uploads/receipts/
 * to <UPLOADS_DIR>/receipts/ on disk, and rewrite stored URLs from
 * `/uploads/receipts/...` to `/api/files/receipts/...` across every
 * column that holds a receipt/attachment URL.
 *
 * Why: the old layout served files via Next.js's static handler from
 * public/uploads/ — which started 404'ing in prod after `next build`.
 * The new layout serves through /api/files/[...path] (auth-protected,
 * reads from a directory outside the build tree).
 *
 * Idempotent: skips files already moved, skips rows already rewritten,
 * and tolerates files missing on disk (logs and continues).
 *
 * Usage:
 *   node prisma/migrate-uploads-to-api-files.js
 *
 * Env:
 *   UPLOADS_DIR  optional override; defaults to <cwd>/uploads
 *   DRY_RUN=1    print the plan without touching disk or DB
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.env.DRY_RUN === '1';

const OLD_PREFIX = '/uploads/receipts/';
const NEW_PREFIX = '/api/files/receipts/';

function uploadsRoot() {
  const fromEnv = process.env.UPLOADS_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return path.join(process.cwd(), 'uploads');
}

async function moveFiles() {
  const oldDir = path.join(process.cwd(), 'public', 'uploads', 'receipts');
  const newDir = path.join(uploadsRoot(), 'receipts');

  if (!fs.existsSync(oldDir)) {
    console.log(`[files] no old directory at ${oldDir} — nothing to move`);
    return { moved: 0, missing: 0, skipped: 0 };
  }

  if (!DRY_RUN) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  const entries = fs.readdirSync(oldDir, { withFileTypes: true });
  let moved = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const src = path.join(oldDir, entry.name);
    const dest = path.join(newDir, entry.name);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] would move ${src} → ${dest}`);
      moved++;
      continue;
    }
    try {
      fs.renameSync(src, dest);
      moved++;
    } catch (err) {
      // Cross-device rename — fall back to copy + unlink.
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      moved++;
    }
  }

  console.log(
    `[files] moved=${moved} skipped(already-at-dest)=${skipped} from ${oldDir}`,
  );
  return { moved, skipped };
}

async function rewriteUrls(prisma) {
  // (model, field) pairs that hold a receipt/attachment URL.
  const targets = [
    { model: 'expense', field: 'receiptUrl' },
    { model: 'ledgerEntry', field: 'attachmentUrl' },
    { model: 'bill', field: 'attachmentUrl' },
    { model: 'cheque', field: 'attachmentUrl' },
    { model: 'opexEntry', field: 'attachmentUrl' },
  ];

  let totalUpdated = 0;
  for (const { model, field } of targets) {
    const where = { [field]: { startsWith: OLD_PREFIX } };
    const rows = await prisma[model].findMany({
      where,
      select: { id: true, [field]: true },
    });
    if (rows.length === 0) {
      console.log(`[db] ${model}.${field} — no rows to rewrite`);
      continue;
    }
    if (DRY_RUN) {
      console.log(
        `[dry-run] would rewrite ${rows.length} rows in ${model}.${field}`,
      );
      rows.slice(0, 3).forEach((r) => {
        console.log(`           ${r.id}: ${r[field]}`);
      });
      totalUpdated += rows.length;
      continue;
    }
    for (const row of rows) {
      const newUrl = row[field].replace(OLD_PREFIX, NEW_PREFIX);
      await prisma[model].update({
        where: { id: row.id },
        data: { [field]: newUrl },
      });
    }
    console.log(`[db] ${model}.${field} — rewrote ${rows.length} rows`);
    totalUpdated += rows.length;
  }
  return totalUpdated;
}

async function main() {
  console.log(`Migration starting (DRY_RUN=${DRY_RUN})`);
  console.log(`uploads root: ${uploadsRoot()}`);

  const prisma = new PrismaClient();
  try {
    await moveFiles();
    const updated = await rewriteUrls(prisma);
    console.log(`\nDone. Total rows ${DRY_RUN ? 'that would be ' : ''}updated: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

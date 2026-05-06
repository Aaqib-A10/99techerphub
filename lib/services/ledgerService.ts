/**
 * Finance Ledger posting service.
 *
 * Every cash event in the system funnels through `postEntry` so:
 *   1. Serial numbers stay monotonically increasing across concurrent
 *      transactions (advisory lock + last-id read).
 *   2. The running balance on every affected row stays correct even
 *      when a backdated entry is inserted (recompute walk forward).
 *   3. Image hard-stop is enforced server-side, not just on the form.
 *   4. transDate cannot precede the opening balance.
 *   5. Currency is locked to PKR for v1.
 *
 * Sub-modules (Bill, Cheque, OpexEntry) call `postEntry` from inside
 * their own create transaction so a failure rolls everything back.
 */
import { Prisma, PrismaClient, LedgerSource } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

// Postgres advisory-lock key. Hash of 'ledger_serial' picked by hand so
// the value is deterministic across deploys; if we ever add another
// advisory-locked resource, give it a different key.
const SERIAL_LOCK_KEY = 99_000_001;

// v1 is single-currency. Drop this restriction by widening the union
// and adjusting the running-balance walk to currency-scoped chains.
const ALLOWED_CURRENCIES = ['PKR'] as const;
type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];

// Sources that already carry their own audit trail upstream and so
// don't have to attach a receipt to the ledger row.
const ATTACHMENT_EXEMPT: LedgerSource[] = ['PAYROLL', 'EXPENSE', 'OPENING'];

// Whitelist of fields persisted on attachmentMeta — anything else from
// the client gets dropped. Keeps the JSON column from growing
// unboundedly via misuse (50MB blobs, malicious payloads, etc.).
const META_KEYS = ['capturedAt', 'fileName', 'fileSize', 'fileType'] as const;

export interface PostEntryInput {
  transDate: Date;
  transDetail: string;
  categoryId: number;
  creditAmt?: number | string;
  debitAmt?: number | string;
  currency?: string;
  companyId?: number | null;
  source: LedgerSource;
  sourceId?: number | null;
  attachmentUrl?: string | null;
  attachmentMeta?: any;
  reviewFlag?: boolean;
  reversesEntryId?: number | null;
  createdById: number;
}

export interface PostEntryResult {
  id: number;
  serialNo: string;
  runningBal: number;
}

/**
 * Post a new ledger entry. Use within an existing transaction whenever
 * the caller is creating a paired sub-module row (Bill/Cheque/OpexEntry).
 *
 * @param tx — pass the prisma transaction client; defaults to the global
 *             prisma when no outer transaction exists.
 */
export async function postEntry(
  input: PostEntryInput,
  tx: Tx = defaultPrisma,
): Promise<PostEntryResult> {
  const credit = num(input.creditAmt);
  const debit = num(input.debitAmt);

  // ─── Validation ────────────────────────────────────────────────────
  if (credit < 0 || debit < 0) {
    throw new LedgerError('Amounts cannot be negative.');
  }
  if (credit > 0 && debit > 0) {
    throw new LedgerError('An entry has either a credit or a debit, not both.');
  }
  if (credit === 0 && debit === 0) {
    throw new LedgerError('An entry must have a non-zero credit or debit.');
  }
  if (
    debit > 0 &&
    !ATTACHMENT_EXEMPT.includes(input.source) &&
    !input.attachmentUrl
  ) {
    throw new LedgerError('Cash-out entries require an attachment.');
  }
  if (!input.transDetail?.trim()) {
    throw new LedgerError('Description is required.');
  }
  const currency = (input.currency ?? 'PKR') as AllowedCurrency;
  if (!ALLOWED_CURRENCIES.includes(currency)) {
    throw new LedgerError(
      `Unsupported currency "${input.currency}" — v1 of the ledger is PKR-only.`,
    );
  }

  // Reject transDate before the opening balance. Without this guard a
  // late-arriving backdated entry could slot in BEFORE the verified
  // starting point and break the "PKR 103,057 was the starting point"
  // promise. The OPENING entry itself is exempt (it sets the floor).
  if (input.source !== 'OPENING') {
    const opening = await tx.ledgerEntry.findFirst({
      where: { source: 'OPENING' },
      orderBy: { transDate: 'asc' },
      select: { transDate: true, serialNo: true },
    });
    if (opening && input.transDate < opening.transDate) {
      throw new LedgerError(
        `Transaction date (${input.transDate.toISOString().slice(0, 10)}) is before the opening balance (${opening.transDate.toISOString().slice(0, 10)}, ${opening.serialNo}). Backdate beyond the opening is not allowed.`,
      );
    }
  }

  // ─── Drift check on attachment ─────────────────────────────────────
  let reviewFlag = !!input.reviewFlag;
  let reviewNotes: string | null = null;
  const cleanMeta = sanitizeAttachmentMeta(input.attachmentMeta);
  const capturedAt = cleanMeta?.capturedAt;
  if (capturedAt) {
    const cap = new Date(capturedAt).getTime();
    const trans = input.transDate.getTime();
    const driftDays = Math.abs(cap - trans) / (1000 * 60 * 60 * 24);
    if (driftDays > 7) {
      reviewFlag = true;
      reviewNotes = `Attachment captured ${driftDays.toFixed(1)} days off from transaction date.`;
    }
  }

  // ─── Acquire advisory lock for serial generation ───────────────────
  // pg_advisory_xact_lock auto-releases at transaction commit/rollback,
  // so concurrent ledger posts serialize at this point. The lock key is
  // a constant, NOT a per-source key, because serials are global.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${SERIAL_LOCK_KEY})`);

  const serialNo = await nextSerial(tx);

  // ─── Compute running balance for the new entry ─────────────────────
  const previous = await tx.ledgerEntry.findFirst({
    where: {
      OR: [
        { transDate: { lt: input.transDate } },
        { transDate: input.transDate, id: { lt: 999_999_999 } },
      ],
    },
    orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
    select: { runningBal: true },
  });
  const previousBal = previous ? Number(previous.runningBal) : 0;
  const runningBal = previousBal + credit - debit;

  // ─── Insert the row ────────────────────────────────────────────────
  const created = await tx.ledgerEntry.create({
    data: {
      serialNo,
      transDate: input.transDate,
      transDetail: input.transDetail.trim(),
      categoryId: input.categoryId,
      // quantity + unitPrice are no longer carried (audit fix 7) — the
      // schema column defaults still cover the old data; new rows
      // record line-item detail on the source row, not the ledger.
      quantity: '0',
      unitPrice: '0',
      creditAmt: credit.toFixed(2),
      debitAmt: debit.toFixed(2),
      runningBal: runningBal.toFixed(2),
      currency,
      companyId: input.companyId ?? null,
      source: input.source,
      sourceId: input.sourceId ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentMeta: cleanMeta ?? Prisma.JsonNull,
      reviewFlag,
      reviewNotes,
      reversesEntryId: input.reversesEntryId ?? null,
      createdById: input.createdById,
    },
  });

  // ─── Recompute downstream balances if this entry was backdated ─────
  // Any row whose transDate (or same-day-with-greater-id) is AFTER this
  // entry needs its runningBal walked forward. In practice this list
  // is empty for the common case where entries arrive chronologically.
  const downstream = await tx.ledgerEntry.findMany({
    where: {
      OR: [
        { transDate: { gt: input.transDate } },
        { transDate: input.transDate, id: { gt: created.id } },
      ],
    },
    orderBy: [{ transDate: 'asc' }, { id: 'asc' }],
    select: { id: true, creditAmt: true, debitAmt: true },
  });
  if (downstream.length > 0) {
    let bal = runningBal;
    for (const row of downstream) {
      bal = bal + Number(row.creditAmt) - Number(row.debitAmt);
      await tx.ledgerEntry.update({
        where: { id: row.id },
        data: { runningBal: bal.toFixed(2) },
      });
    }
  }

  // If this entry IS a reversal, mark the original as reversed.
  if (input.reversesEntryId) {
    await tx.ledgerEntry.update({
      where: { id: input.reversesEntryId },
      data: { isReversed: true },
    });
  }

  return {
    id: created.id,
    serialNo: created.serialNo,
    runningBal,
  };
}

/**
 * Build a contra entry that reverses an existing one. The new entry
 * mirrors the original's debit/credit (debit becomes credit and vice
 * versa) and references the original via reversesEntryId.
 */
export async function postReversingEntry(
  originalId: number,
  reason: string,
  createdById: number,
  tx: Tx = defaultPrisma,
): Promise<PostEntryResult> {
  if (!reason?.trim()) {
    throw new LedgerError('A reason is required when reversing an entry.');
  }
  const original = await tx.ledgerEntry.findUnique({
    where: { id: originalId },
  });
  if (!original) throw new LedgerError('Original entry not found.');
  if (original.isReversed) {
    throw new LedgerError('This entry has already been reversed.');
  }
  if (original.reversesEntryId) {
    throw new LedgerError('A reversal cannot itself be reversed.');
  }

  const credit = Number(original.debitAmt); // flip
  const debit = Number(original.creditAmt);

  return postEntry(
    {
      transDate: new Date(),
      transDetail: `Reversal of ${original.serialNo}: ${reason.trim()}`,
      categoryId: original.categoryId,
      creditAmt: credit,
      debitAmt: debit,
      currency: original.currency,
      companyId: original.companyId,
      source: original.source,
      sourceId: original.sourceId,
      attachmentUrl: original.attachmentUrl,
      reversesEntryId: original.id,
      createdById,
    },
    tx,
  );
}

/**
 * SN-NNNNNN serial generator. Must be called inside a transaction that
 * already holds the advisory lock (postEntry handles that).
 */
async function nextSerial(tx: Tx): Promise<string> {
  const last = await tx.ledgerEntry.findFirst({
    orderBy: { id: 'desc' },
    select: { serialNo: true },
  });
  if (!last) return 'SN-000001';
  const m = last.serialNo.match(/^SN-(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `SN-${String(n).padStart(6, '0')}`;
}

/**
 * Strip everything except the four whitelisted keys. Coerces sizes /
 * dates so a malformed value can't poison the JSON column.
 */
function sanitizeAttachmentMeta(meta: any): Record<string, any> | null {
  if (!meta || typeof meta !== 'object') return null;
  const out: Record<string, any> = {};
  for (const k of META_KEYS) {
    if (k in meta) out[k] = meta[k];
  }
  if (typeof out.capturedAt === 'string') {
    const t = Date.parse(out.capturedAt);
    if (!Number.isFinite(t)) delete out.capturedAt;
  } else {
    delete out.capturedAt;
  }
  if (typeof out.fileName === 'string') {
    out.fileName = out.fileName.slice(0, 255);
  } else {
    delete out.fileName;
  }
  if (typeof out.fileSize === 'number' && Number.isFinite(out.fileSize)) {
    out.fileSize = Math.max(0, Math.min(out.fileSize, 50 * 1024 * 1024));
  } else {
    delete out.fileSize;
  }
  if (typeof out.fileType === 'string') {
    out.fileType = out.fileType.slice(0, 100);
  } else {
    delete out.fileType;
  }
  return Object.keys(out).length ? out : null;
}

function num(v: number | string | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

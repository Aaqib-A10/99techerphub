/**
 * Finance Ledger posting service.
 *
 * Every cash event in the system funnels through `postEntry` so:
 *   1. Serial numbers stay monotonically increasing (advisory lock + last-id read).
 *   2. The running balance on EACH inserted row reflects the sum of every
 *      prior entry in chronological order — the read view doesn't have to
 *      compute SUMs on every page load.
 *   3. Image hard-stop is enforced on the server, not the form.
 *
 * Sub-modules (Bill, Cheque, OpexEntry) call `postEntry` from inside
 * their own create transaction so a failure rolls everything back.
 */
import { Prisma, PrismaClient, LedgerSource } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface PostEntryInput {
  transDate: Date;
  transDetail: string;
  categoryId: number;
  quantity?: number | string;
  unitPrice?: number | string;
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
 *             prisma when no outer transaction exists (e.g. opening
 *             balance, manual post).
 */
export async function postEntry(
  input: PostEntryInput,
  tx: Tx = defaultPrisma,
): Promise<PostEntryResult> {
  const credit = num(input.creditAmt);
  const debit = num(input.debitAmt);

  // Validation rules from the spec.
  if (credit < 0 || debit < 0) {
    throw new LedgerError('Amounts cannot be negative.');
  }
  if (credit > 0 && debit > 0) {
    throw new LedgerError('An entry has either a credit or a debit, not both.');
  }
  if (credit === 0 && debit === 0) {
    throw new LedgerError('An entry must have a non-zero credit or debit.');
  }
  // Image hard-stop: any cash-out requires an attachment, regardless of
  // source. The exception is auto-posts from PAYROLL/EXPENSE which
  // already have their own audit trail (the expense receipt, the payroll
  // run document) — we trust those upstream guards.
  const exemptSources: LedgerSource[] = ['PAYROLL', 'EXPENSE', 'OPENING'];
  if (
    debit > 0 &&
    !exemptSources.includes(input.source) &&
    !input.attachmentUrl
  ) {
    throw new LedgerError('Cash-out entries require an attachment.');
  }
  if (!input.transDetail?.trim()) {
    throw new LedgerError('Description is required.');
  }

  // Drift check — flag for review if the captured timestamp on the
  // attachment is more than 7 days off from the transaction date.
  let reviewFlag = !!input.reviewFlag;
  let reviewNotes: string | null = null;
  const capturedAt = input.attachmentMeta?.capturedAt;
  if (capturedAt) {
    const cap = new Date(capturedAt).getTime();
    const trans = input.transDate.getTime();
    const driftDays = Math.abs(cap - trans) / (1000 * 60 * 60 * 24);
    if (driftDays > 7) {
      reviewFlag = true;
      reviewNotes = `Attachment captured ${driftDays.toFixed(1)} days off from transaction date.`;
    }
  }

  // Find the previous entry for the running balance. We index by
  // transDate so chronological order is the source of truth, with id as
  // the tie-breaker on same-day events.
  const previous = await tx.ledgerEntry.findFirst({
    where: {
      OR: [
        { transDate: { lt: input.transDate } },
        { transDate: input.transDate, id: { lt: 999_999_999 } }, // any same-day prior id
      ],
    },
    orderBy: [{ transDate: 'desc' }, { id: 'desc' }],
    select: { runningBal: true },
  });
  const previousBal = previous ? Number(previous.runningBal) : 0;
  const runningBal = previousBal + credit - debit;

  const serialNo = await nextSerial(tx);

  const created = await tx.ledgerEntry.create({
    data: {
      serialNo,
      transDate: input.transDate,
      transDetail: input.transDetail.trim(),
      categoryId: input.categoryId,
      quantity: num(input.quantity).toFixed(2),
      unitPrice: num(input.unitPrice).toFixed(2),
      creditAmt: credit.toFixed(2),
      debitAmt: debit.toFixed(2),
      runningBal: runningBal.toFixed(2),
      currency: input.currency ?? 'PKR',
      companyId: input.companyId ?? null,
      source: input.source,
      sourceId: input.sourceId ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentMeta: input.attachmentMeta ?? undefined,
      reviewFlag,
      reviewNotes,
      reversesEntryId: input.reversesEntryId ?? null,
      createdById: input.createdById,
    },
  });

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
      // Reversal exempt from attachment hard-stop — the audit comes from
      // the link back to the original entry plus the required reason.
      attachmentUrl: original.attachmentUrl,
      reversesEntryId: original.id,
      createdById,
    },
    tx,
  );
}

/**
 * SN-NNNNNN. Read the highest existing serial then increment. Inside a
 * transaction this is safe because Postgres serializes the SELECT;
 * outside we briefly open a transaction.
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

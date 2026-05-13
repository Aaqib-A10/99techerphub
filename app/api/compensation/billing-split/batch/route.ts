import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, COMPENSATION_EDIT_ROLES } from '@/lib/auth';

/**
 * POST /api/compensation/billing-split/batch
 *
 * Add multiple BillingSplits for one employee in a single atomic
 * transaction. Used by the multi-row "Add Billing Splits" modal
 * where HR enters several companies and percentages at once
 * (e.g. 50/50 between SJ and MNC).
 *
 * Body:
 *   {
 *     employeeId: number,
 *     splits: [
 *       { companyId, percentage, effectiveFrom, effectiveTo? },
 *       ...
 *     ]
 *   }
 *
 * Validation (in order — first failure short-circuits):
 *   1. Each row's percentage is in (0, 100] and dates parse.
 *   2. No duplicate companies within the batch.
 *   3. No company in the batch already has an active split for
 *      this employee (HR should edit that row instead).
 *   4. Sum of (existing active percentages + batch percentages)
 *      <= 100.0001 (Decimal fudge).
 *
 * On any validation failure the whole request rejects — the
 * transaction never starts. Either all rows save or none do.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!COMPENSATION_EDIT_ROLES.includes(user.role as any)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const employeeId = parseInt(body?.employeeId);
    if (!Number.isFinite(employeeId)) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }
    const splits = Array.isArray(body?.splits) ? body.splits : null;
    if (!splits || splits.length === 0) {
      return NextResponse.json(
        { error: 'splits[] must contain at least one row' },
        { status: 400 },
      );
    }
    if (splits.length > 20) {
      return NextResponse.json(
        { error: 'Too many splits — max 20 per request' },
        { status: 400 },
      );
    }

    // Validate every row first, collect parsed values.
    type Parsed = {
      companyId: number;
      percentage: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    };
    const parsed: Parsed[] = [];
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      const companyId = parseInt(s?.companyId);
      const percentage = Number(s?.percentage);
      if (!Number.isFinite(companyId)) {
        return NextResponse.json(
          { error: `Row ${i + 1}: companyId is required` },
          { status: 400 },
        );
      }
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return NextResponse.json(
          { error: `Row ${i + 1}: percentage must be between 0 and 100` },
          { status: 400 },
        );
      }
      if (!s?.effectiveFrom) {
        return NextResponse.json(
          { error: `Row ${i + 1}: effectiveFrom is required` },
          { status: 400 },
        );
      }
      const effectiveFrom = new Date(s.effectiveFrom);
      if (Number.isNaN(effectiveFrom.getTime())) {
        return NextResponse.json(
          { error: `Row ${i + 1}: effectiveFrom is not a valid date` },
          { status: 400 },
        );
      }
      let effectiveTo: Date | null = null;
      if (s.effectiveTo) {
        effectiveTo = new Date(s.effectiveTo);
        if (Number.isNaN(effectiveTo.getTime())) {
          return NextResponse.json(
            { error: `Row ${i + 1}: effectiveTo is not a valid date` },
            { status: 400 },
          );
        }
      }
      parsed.push({ companyId, percentage, effectiveFrom, effectiveTo });
    }

    // No duplicate companies inside the batch.
    const inBatch = new Set<number>();
    for (const p of parsed) {
      if (inBatch.has(p.companyId)) {
        return NextResponse.json(
          { error: 'Same company appears twice in the batch' },
          { status: 400 },
        );
      }
      inBatch.add(p.companyId);
    }

    // Confirm every company exists (one query).
    const companies = await prisma.company.findMany({
      where: { id: { in: Array.from(inBatch) } },
      select: { id: true, name: true },
    });
    if (companies.length !== inBatch.size) {
      const missing = Array.from(inBatch).filter(
        (id) => !companies.find((c) => c.id === id),
      );
      return NextResponse.json(
        { error: `Unknown company id(s): ${missing.join(', ')}` },
        { status: 404 },
      );
    }

    // Check existing active splits — no duplicates, no over-100.
    const now = new Date();
    const existing = await prisma.billingSplit.findMany({
      where: {
        employeeId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      select: { id: true, companyId: true, percentage: true },
    });

    for (const p of parsed) {
      const dup = existing.find((e) => e.companyId === p.companyId);
      if (dup) {
        const c = companies.find((c) => c.id === p.companyId);
        return NextResponse.json(
          {
            error: `${c?.name ?? `Company #${p.companyId}`} already has an active split. Edit that row instead of adding a duplicate.`,
          },
          { status: 409 },
        );
      }
    }

    const existingSum = existing.reduce(
      (acc, s) => acc + Number(s.percentage),
      0,
    );
    const batchSum = parsed.reduce((acc, s) => acc + s.percentage, 0);
    if (existingSum + batchSum > 100.0001) {
      return NextResponse.json(
        {
          error: `Would push allocation to ${(existingSum + batchSum).toFixed(2)}% (max 100). Active total is currently ${existingSum.toFixed(2)}%, batch adds ${batchSum.toFixed(2)}%.`,
        },
        { status: 400 },
      );
    }

    // Atomic insert — all-or-nothing.
    const created = await prisma.$transaction(
      parsed.map((p) =>
        prisma.billingSplit.create({
          data: {
            employeeId,
            companyId: p.companyId,
            percentage: p.percentage,
            effectiveFrom: p.effectiveFrom,
            effectiveTo: p.effectiveTo,
          },
          include: {
            company: { select: { id: true, name: true, code: true } },
          },
        }),
      ),
    );

    return NextResponse.json({ splits: created }, { status: 201 });
  } catch (err: any) {
    console.error('[billing-split/batch POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to create splits' },
      { status: 500 },
    );
  }
}

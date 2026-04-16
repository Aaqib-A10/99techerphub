import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext } from '@/lib/auth';
import { parseCurrency, validatePercentageSum } from '@/lib/currency';
import { tenantPrisma } from '@/lib/prisma-tenant';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = tenantPrisma(ctx.companyIds);
    const billingSplits = await db.billingSplit.findMany({
      include: {
        employee: true,
        company: true,
      },
      orderBy: { employee: { lastName: 'asc' } },
    });

    return NextResponse.json(billingSplits);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch billing splits' },
      { status: 500 }
    );
  }
}

// POST: Create/update billing splits — ATOMIC with advisory lock
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { employeeId, splits } = data;
    const empId = parseInt(employeeId);

    // Validate percentages sum to exactly 100% using integer arithmetic
    if (!validatePercentageSum(splits.map((s: any) => s.percentage))) {
      return NextResponse.json(
        { error: 'Billing percentages must sum to 100%' },
        { status: 400 }
      );
    }

    const newSplits = await prisma.$transaction(async (tx) => {
      // Advisory lock per employee — serializes concurrent billing updates
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(99003, ${empId}::int4)`;

      // Close existing splits (inside transaction — rolls back if creates fail)
      const existingSplits = await tx.billingSplit.findMany({
        where: { employeeId: empId, effectiveTo: null },
      });

      if (existingSplits.length > 0) {
        await tx.billingSplit.updateMany({
          where: { employeeId: empId, effectiveTo: null },
          data: { effectiveTo: new Date() },
        });
      }

      // Create new splits sequentially (all inside transaction)
      const created = [];
      for (const split of splits) {
        const newSplit = await tx.billingSplit.create({
          data: {
            employeeId: empId,
            companyId: parseInt(split.companyId),
            percentage: parseCurrency(split.percentage),
            effectiveFrom: new Date(),
          },
          include: {
            employee: true,
            company: true,
          },
        });
        created.push(newSplit);
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          tableName: 'billing_splits',
          recordId: created[0]?.id || 0,
          action: 'CREATE',
          module: 'FINANCE',
          newValues: { splits: created },
          oldValues: { splits: existingSplits },
        },
      });

      return created;
    });

    return NextResponse.json(newSplits, { status: 201 });
  } catch (error: any) {
    console.error('Error creating billing splits:', error);
    return NextResponse.json(
      { error: 'Failed to create billing splits' },
      { status: 500 }
    );
  }
}

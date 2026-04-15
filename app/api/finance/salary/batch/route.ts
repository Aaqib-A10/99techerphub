import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/finance/salary/batch
 *
 * Returns ALL active salaries in a single query, keyed by employeeId.
 * Replaces the N+1 pattern where the billing page fetched salary
 * individually for each employee.
 */
export async function GET() {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const salaries = await prisma.salaryHistory.findMany({
      where: { effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Build a map: employeeId → salary record (first = most recent)
    const salaryMap: Record<number, (typeof salaries)[0]> = {};
    for (const sal of salaries) {
      if (!salaryMap[sal.employeeId]) {
        salaryMap[sal.employeeId] = sal;
      }
    }

    return NextResponse.json(salaryMap);
  } catch (error) {
    console.error('Error fetching batch salaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary data' },
      { status: 500 }
    );
  }
}
